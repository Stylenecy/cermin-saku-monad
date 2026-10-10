"use client";

import { useCallback, useEffect, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { zeroAddress } from "viem";
import { CERMIN_VAULT_ABI, ERC20_ABI, CONTRACTS } from "@/lib/contracts";

export type ClosePhase = "idle" | "approving" | "closing" | "done";

interface CloseArgs {
  /** Extra MUSD the vault will pull from the owner during close (debt - GAS_COMP - vault MUSD). */
  shortfall: bigint;
  /** Current MUSD allowance owner → vault. If it already covers `shortfall`, the approve step is skipped. */
  currentAllowance: bigint;
}

export function useVaultActions(vaultAddress: `0x${string}` | undefined) {
  const queryClient = useQueryClient();
  const [closePhase, setClosePhase] = useState<ClosePhase>("idle");

  const {
    writeContract: writeWithdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
    reset: resetWithdraw,
    error: withdrawError,
  } = useWriteContract();

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    reset: resetApprove,
    error: approveError,
  } = useWriteContract();

  const {
    writeContract: writeClose,
    data: closeHash,
    isPending: isClosePending,
    reset: resetClose,
    error: closeWriteError,
  } = useWriteContract();

  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
    reset: resetDeposit,
    error: depositError,
  } = useWriteContract();

  const {
    writeContract: writeDefend,
    data: defendHash,
    isPending: isDefendPending,
    reset: resetDefend,
    error: defendError,
  } = useWriteContract();

  const { isLoading: isWithdrawConfirming, isSuccess: withdrawSuccess } =
    useWaitForTransactionReceipt({ hash: withdrawHash });

  const { isLoading: isApproveConfirming, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });

  const { isLoading: isCloseConfirming, isSuccess: closeSuccess } =
    useWaitForTransactionReceipt({ hash: closeHash });

  const { isLoading: isDepositConfirming, isSuccess: depositSuccess } =
    useWaitForTransactionReceipt({ hash: depositHash });

  const { isLoading: isDefendConfirming, isSuccess: defendSuccess } =
    useWaitForTransactionReceipt({ hash: defendHash });

  // Once the MUSD approve confirms, auto-fire the actual close.
  useEffect(() => {
    if (closePhase === "approving" && approveSuccess && vaultAddress) {
      setClosePhase("closing");
      writeClose({
        address: vaultAddress,
        abi: CERMIN_VAULT_ABI,
        functionName: "close",
        args: [],
      });
    }
  }, [closePhase, approveSuccess, vaultAddress, writeClose]);

  useEffect(() => {
    if (withdrawSuccess || closeSuccess || depositSuccess || defendSuccess) {
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
      queryClient.invalidateQueries({ queryKey: ["readContracts"] });
    }
    if (closeSuccess) setClosePhase("done");
  }, [withdrawSuccess, closeSuccess, depositSuccess, defendSuccess, queryClient]);

  const withdrawSpendable = useCallback(
    (amount: bigint, recipient: `0x${string}`) => {
      if (!vaultAddress) return;
      writeWithdraw({
        address: vaultAddress,
        abi: CERMIN_VAULT_ABI,
        functionName: "withdrawSpendable",
        args: [amount, recipient],
      });
    },
    [vaultAddress, writeWithdraw],
  );

  const addCollateral = useCallback(
    (amountWei: bigint) => {
      if (!vaultAddress || amountWei <= 0n) return;
      resetDeposit();
      // deposit() forwards MON to the CDP's addColl. Hints are 0x0 (MVP, like open).
      writeDeposit({
        address: vaultAddress,
        abi: CERMIN_VAULT_ABI,
        functionName: "deposit",
        args: [zeroAddress, zeroAddress],
        value: amountWei,
      });
    },
    [vaultAddress, writeDeposit, resetDeposit],
  );

  const defend = useCallback(() => {
    if (!vaultAddress) return;
    resetDefend();
    // Permissionless: anyone can repay debt to lift ICR. Reverts with
    // ICRAboveDefend if the vault is already healthy. Hints are 0x0 (MVP).
    writeDefend({
      address: vaultAddress,
      abi: CERMIN_VAULT_ABI,
      functionName: "defend",
      args: [zeroAddress, zeroAddress],
    });
  }, [vaultAddress, writeDefend, resetDefend]);

  const closeVault = useCallback(
    ({ shortfall, currentAllowance }: CloseArgs) => {
      if (!vaultAddress) return;
      resetApprove();
      resetClose();

      // 10%-or-1-MUSD buffer covers borrow-fee interest accruing between read
      // and execution; without it the safeTransferFrom inside close() can revert.
      if (shortfall > 0n && currentAllowance < shortfall) {
        const buffer = shortfall / 10n > 10n ** 18n ? shortfall / 10n : 10n ** 18n;
        const approveAmount = shortfall + buffer;
        setClosePhase("approving");
        writeApprove({
          address: CONTRACTS.MUSD,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [vaultAddress, approveAmount],
        });
      } else {
        setClosePhase("closing");
        writeClose({
          address: vaultAddress,
          abi: CERMIN_VAULT_ABI,
          functionName: "close",
          args: [],
        });
      }
    },
    [vaultAddress, writeApprove, writeClose, resetApprove, resetClose],
  );

  const resetCloseFlow = useCallback(() => {
    setClosePhase("idle");
    resetApprove();
    resetClose();
  }, [resetApprove, resetClose]);

  const isCloseLoading =
    closePhase === "approving" ||
    closePhase === "closing" ||
    isApprovePending ||
    isApproveConfirming ||
    isClosePending ||
    isCloseConfirming;

  const closeError = approveError ?? closeWriteError;

  return {
    withdrawSpendable,
    addCollateral,
    defend,
    closeVault,
    resetCloseFlow,
    isWithdrawLoading: isWithdrawPending || isWithdrawConfirming,
    isAddCollateralLoading: isDepositPending || isDepositConfirming,
    isDefendLoading: isDefendPending || isDefendConfirming,
    isCloseLoading,
    closePhase,
    withdrawHash,
    approveHash,
    closeHash,
    depositHash,
    defendHash,
    withdrawError,
    addCollateralError: depositError,
    defendError,
    closeError,
    resetWithdraw,
  };
}
