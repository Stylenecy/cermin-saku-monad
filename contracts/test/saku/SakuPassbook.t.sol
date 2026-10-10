// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {SakuBase} from "./SakuBase.t.sol";
import {CerminSaku} from "../../src/CerminSaku.sol";
import {ICerminVault} from "../../src/interfaces/ICerminVault.sol";

/// @notice The passbook in contract state: every release writes exactly one
///         line, paid or held, and the lines tell when each period was due.
contract SakuPassbookTest is SakuBase {
    function test_Passbook_EmptyForNewSchedule() public {
        uint256 id = _schedule(1_000e18, MONTH, 12);
        assertEq(saku.passbookLength(id), 0);
        assertEq(saku.passbook(id, 0, 10).length, 0);
    }

    function test_Passbook_RecordsPaymentWithDueTime() public {
        _grant(12_000e18);
        uint256 id = _schedule(1_000e18, MONTH, 12);
        uint64 start = uint64(block.timestamp);
        vm.warp(block.timestamp + 7); // the keeper arrives 7 s after the due time
        assertTrue(saku.release(id));

        CerminSaku.Entry[] memory book = saku.passbook(id, 0, 10);
        assertEq(book.length, 1);
        assertEq(book[0].at, start + 7);
        assertEq(book[0].dueAt, start);
        assertEq(book[0].paymentNo, 1);
        assertEq(uint8(book[0].status), uint8(ICerminVault.SakuStatus.Ok));
        assertEq(book[0].icrBps, 20_000);
        assertEq(book[0].amount, 1_000e18);
        assertEq(book[0].price, PRICE);
    }

    function test_Passbook_HoldThenCatchUpKeepsDueTimes() public {
        _grant(12_000e18);
        uint256 id = _schedule(1_000e18, MONTH, 12);
        uint64 start = uint64(block.timestamp);

        priceFeed.setPrice(72_500e18); // ICR 145%, under the 150% floor
        assertFalse(saku.release(id));

        vm.warp(start + MONTH + 3); // a month later the price recovers
        priceFeed.setPrice(80_000e18);
        assertTrue(saku.release(id));
        assertTrue(saku.release(id));

        CerminSaku.Entry[] memory book = saku.passbook(id, 0, 10);
        assertEq(book.length, 3, "one line per release");
        assertEq(uint8(book[0].status), uint8(ICerminVault.SakuStatus.IcrBelowFloor));
        assertEq(book[0].paymentNo, 0, "a hold has no payment number");
        assertEq(book[0].icrBps, 14_500);
        assertEq(book[0].price, 72_500e18);
        assertEq(book[0].dueAt, start, "the held period");

        assertEq(book[1].paymentNo, 1);
        assertEq(book[1].dueAt, start, "the held period, paid late");
        assertEq(book[1].at, start + MONTH + 3);
        assertEq(book[2].paymentNo, 2);
        assertEq(book[2].dueAt, start + MONTH);
    }

    function test_Passbook_Pagination() public {
        _grant(12_000e18);
        uint256 id = _schedule(1_000e18, MONTH, 12);
        vm.warp(block.timestamp + 4 * MONTH);
        for (uint256 i; i < 5; ++i) {
            saku.release(id);
        }
        assertEq(saku.passbookLength(id), 5);
        CerminSaku.Entry[] memory page = saku.passbook(id, 3, 10);
        assertEq(page.length, 2, "clipped at the end");
        assertEq(page[0].paymentNo, 4);
        assertEq(page[1].paymentNo, 5);
        assertEq(saku.passbook(id, 5, 10).length, 0, "offset past the end");
        assertEq(saku.passbook(id, 0, 2).length, 2);
    }

    function test_Passbook_FailedReleaseWritesNothing() public {
        _grant(12_000e18);
        uint256 id = _schedule(1_000e18, MONTH, 12);
        saku.release(id);
        vm.expectRevert(CerminSaku.NothingDue.selector);
        saku.release(id);
        assertEq(saku.passbookLength(id), 1);
    }

    function test_Passbook_UnknownScheduleReverts() public {
        vm.expectRevert(CerminSaku.UnknownSchedule.selector);
        saku.passbookLength(42);
        vm.expectRevert(CerminSaku.UnknownSchedule.selector);
        saku.passbook(42, 0, 1);
    }

    /// Fuzz: whatever the price path, the passbook has one line per release and
    /// its payment numbers match the schedule's paid counter.
    function testFuzz_Passbook_MatchesPaidCounter(uint8 steps, uint256 seed) public {
        steps = uint8(bound(steps, 1, 24));
        _grant(12_000e18);
        uint256 id = _schedule(1_000e18, 1 days, 12);
        uint256 releases;
        for (uint256 i; i < steps; ++i) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            priceFeed.setPrice(bound(seed, 60_000e18, 120_000e18));
            vm.warp(block.timestamp + 1 days);
            if (saku.dueCount(id) > 0 && saku.getSchedule(id).paid < 12) {
                saku.release(id);
                ++releases;
            }
        }
        assertEq(saku.passbookLength(id), releases);
        CerminSaku.Entry[] memory book = saku.passbook(id, 0, 64);
        uint32 lastPaid;
        for (uint256 i; i < book.length; ++i) {
            assertLe(book[i].dueAt, book[i].at, "never recorded before it was due");
            if (book[i].paymentNo != 0) {
                assertEq(book[i].paymentNo, lastPaid + 1, "payments counted in order");
                lastPaid = book[i].paymentNo;
            }
        }
        assertEq(lastPaid, saku.getSchedule(id).paid);
    }
}
