// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ICerminFactory} from "./interfaces/ICerminFactory.sol";
import {ICerminVault} from "./interfaces/ICerminVault.sol";
import {IPriceFeed} from "./interfaces/mezo/IPriceFeed.sol";

/// @title CerminSaku — scheduled allowances paid from a Cermin vault's Shadow
/// @notice A vault owner (say, a parent in Medan) schedules a fixed MUSD
///         allowance to a recipient (a child studying in Jogja): `amount`
///         every `period`, `periods` times. Anyone — usually the keeper — calls
///         `release(id)` when a payment is due.
///
///         Safety first: before paying, Saku asks the vault whether the
///         payment is safe at the live price (health floor + crash reserve,
///         see CerminVault.sakuStatus). If not, the payment is HELD: no money
///         moves, an `AllowanceHeld` event records why, and the period stays
///         owed until the position is safe again. The vault re-checks the same
///         gates itself, so even a buggy Saku cannot drain an unsafe vault.
///
///         Saku never holds funds: the vault pays the recipient directly, out
///         of the spendable bucket only. Collateral (MON) is never touched.
///
///         Every release, paid or held, also writes one line to the schedule's
///         passbook in contract state (see `Entry`), so the whole history reads
///         back in one call without an event indexer.
contract CerminSaku is ReentrancyGuard {
    /// @notice Shortest allowed period. One minute keeps demos possible;
    ///         production schedules are monthly.
    uint64 public constant MIN_PERIOD = 60;
    /// @notice Longest schedule: 10 years of monthly payments.
    uint32 public constant MAX_PERIODS = 120;

    struct Schedule {
        address vault; // CerminVault clone that pays
        address recipient; // who receives the allowance
        uint128 amount; // MUSD (18 decimals) per period
        uint64 period; // seconds between payments
        uint64 start; // timestamp the first payment is due
        uint32 periods; // total number of payments
        uint32 paid; // payments made so far
        bool cancelled;
        bytes32 label; // short UI label, e.g. "Uang saku Rara"
    }

    /// @notice One passbook line: a payment, or a hold with its reason.
    /// @dev    Monad's public RPC serves eth_getLogs 100 blocks (~40 s) at a
    ///         time, so rebuilding weeks of history from events takes tens of
    ///         thousands of calls. Two storage slots per line make the history
    ///         a single eth_call instead, and `dueAt` next to `at` shows how
    ///         long after its due time each payment actually landed.
    struct Entry {
        uint64 at; // block timestamp of the release
        uint64 dueAt; // when the period paid (or held) was due
        uint32 paymentNo; // 1-based payment number; 0 for a hold
        ICerminVault.SakuStatus status; // Ok = paid, otherwise why it was held
        uint32 icrBps; // vault ICR at that moment, capped at type(uint32).max
        uint128 amount; // MUSD (18 decimals)
        uint128 price; // collateral price used for the check (18 decimals)
    }

    ICerminFactory public immutable FACTORY;

    Schedule[] private _schedules;
    mapping(address vault => uint256[] ids) private _byVault;
    mapping(address recipient => uint256[] ids) private _byRecipient;
    mapping(uint256 id => Entry[]) private _passbook;

    event ScheduleCreated(
        uint256 indexed id,
        address indexed vault,
        address indexed recipient,
        uint256 amount,
        uint64 period,
        uint32 periods,
        uint64 start,
        bytes32 label
    );
    event ScheduleCancelled(uint256 indexed id, address indexed vault, uint32 paid);
    event AllowancePaid(
        uint256 indexed id,
        address indexed vault,
        address indexed recipient,
        uint256 amount,
        uint32 paymentNo,
        uint256 icrBps
    );
    event AllowanceHeld(
        uint256 indexed id, address indexed vault, ICerminVault.SakuStatus reason, uint256 icrBps, uint256 price
    );

    error NoVault();
    error InvalidSchedule();
    error UnknownSchedule();
    error NotVaultOwner();
    error ScheduleInactive();
    error NothingDue();

    constructor(address factory_) {
        FACTORY = ICerminFactory(factory_);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner actions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Schedule an allowance from the caller's vault.
    /// @dev    The caller must also grant this contract a spend allowance on
    ///         the vault (`vault.setSpendAllowance(saku, cap)`); that cap is the
    ///         hard ceiling across all of the vault's schedules.
    /// @param firstPaymentAt 0 = due immediately.
    function createSchedule(
        address recipient,
        uint128 amount,
        uint64 period,
        uint32 periods,
        uint64 firstPaymentAt,
        bytes32 label
    ) external returns (uint256 id) {
        address vault = FACTORY.vaultOf(msg.sender);
        if (vault == address(0)) revert NoVault();
        if (recipient == address(0) || recipient == vault) revert InvalidSchedule();
        if (amount == 0 || period < MIN_PERIOD || periods == 0 || periods > MAX_PERIODS) revert InvalidSchedule();
        uint64 start = firstPaymentAt == 0 ? uint64(block.timestamp) : firstPaymentAt;
        if (start < block.timestamp) revert InvalidSchedule();

        id = _schedules.length;
        _schedules.push(
            Schedule({
                vault: vault,
                recipient: recipient,
                amount: amount,
                period: period,
                start: start,
                periods: periods,
                paid: 0,
                cancelled: false,
                label: label
            })
        );
        _byVault[vault].push(id);
        _byRecipient[recipient].push(id);
        emit ScheduleCreated(id, vault, recipient, amount, period, periods, start, label);
    }

    /// @notice Stop a schedule. Only the current owner of the paying vault.
    function cancel(uint256 id) external {
        Schedule storage s = _get(id);
        if (msg.sender != ICerminVault(s.vault).owner()) revert NotVaultOwner();
        if (s.cancelled) revert ScheduleInactive();
        s.cancelled = true;
        emit ScheduleCancelled(id, s.vault, s.paid);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Permissionless release
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pay the oldest unpaid period of `id` if it is due and safe.
    /// @return paid true if money moved; false if the vault held it.
    function release(uint256 id) external nonReentrant returns (bool paid) {
        Schedule storage s = _get(id);
        if (s.cancelled || s.paid >= s.periods) revert ScheduleInactive();
        if (_dueCount(s) == 0) revert NothingDue();

        ICerminVault vault = ICerminVault(s.vault);
        uint256 price = IPriceFeed(_priceFeed(s.vault)).fetchPrice();
        (ICerminVault.SakuStatus status, uint256 icrBps,,) = vault.sakuStatus(address(this), s.amount, price);
        uint64 dueAt = s.start + uint64(s.paid) * s.period;
        if (status != ICerminVault.SakuStatus.Ok) {
            _record(id, dueAt, 0, status, icrBps, s.amount, price);
            emit AllowanceHeld(id, s.vault, status, icrBps, price);
            return false;
        }

        uint32 paymentNo = s.paid + 1;
        s.paid = paymentNo;
        _record(id, dueAt, paymentNo, status, icrBps, s.amount, price);
        vault.withdrawSpendableFor(s.amount, s.recipient);
        emit AllowancePaid(id, s.vault, s.recipient, s.amount, paymentNo, icrBps);
        return true;
    }

    function _record(
        uint256 id,
        uint64 dueAt,
        uint32 paymentNo,
        ICerminVault.SakuStatus status,
        uint256 icrBps,
        uint128 amount,
        uint256 price
    ) private {
        _passbook[id].push(
            Entry({
                at: uint64(block.timestamp),
                dueAt: dueAt,
                paymentNo: paymentNo,
                status: status,
                icrBps: icrBps > type(uint32).max ? type(uint32).max : uint32(icrBps),
                amount: amount,
                price: price > type(uint128).max ? type(uint128).max : uint128(price)
            })
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function scheduleCount() external view returns (uint256) {
        return _schedules.length;
    }

    function getSchedule(uint256 id) external view returns (Schedule memory) {
        return _get(id);
    }

    function schedulesOfVault(address vault) external view returns (uint256[] memory) {
        return _byVault[vault];
    }

    function schedulesOfRecipient(address recipient) external view returns (uint256[] memory) {
        return _byRecipient[recipient];
    }

    function passbookLength(uint256 id) external view returns (uint256) {
        _get(id);
        return _passbook[id].length;
    }

    /// @notice Passbook lines `offset`..`offset + limit` of a schedule, oldest first.
    function passbook(uint256 id, uint256 offset, uint256 limit) external view returns (Entry[] memory out) {
        _get(id);
        Entry[] storage book = _passbook[id];
        if (offset >= book.length) return out;
        uint256 end = offset + limit > book.length ? book.length : offset + limit;
        out = new Entry[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            out[i - offset] = book[i];
        }
    }

    /// @notice Number of payments due now (owed and not yet paid).
    function dueCount(uint256 id) external view returns (uint32) {
        return _dueCount(_get(id));
    }

    /// @notice Timestamp the next unpaid payment is (or was) due; 0 if finished.
    function nextDueAt(uint256 id) external view returns (uint64) {
        Schedule storage s = _get(id);
        if (s.cancelled || s.paid >= s.periods) return 0;
        return s.start + uint64(s.paid) * s.period;
    }

    function _dueCount(Schedule storage s) private view returns (uint32) {
        if (s.cancelled || block.timestamp < s.start) return 0;
        uint256 elapsed = (block.timestamp - s.start) / s.period + 1;
        uint256 owed = elapsed < s.periods ? elapsed : s.periods;
        return owed > s.paid ? uint32(owed - s.paid) : 0;
    }

    function _get(uint256 id) private view returns (Schedule storage) {
        if (id >= _schedules.length) revert UnknownSchedule();
        return _schedules[id];
    }

    function _priceFeed(address vault) private view returns (address) {
        return IVaultFeeds(vault).PRICE_FEED();
    }
}

/// @dev The vault exposes its CDP wiring as public immutables.
interface IVaultFeeds {
    function PRICE_FEED() external view returns (address);
}
