"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type BuyerOrderActionsProps = {
  orderId: bigint;
  buyer: string;
  amount: bigint;
  status: number;
  onUpdated?: () => void;
};

type PaymentStep = "idle" | "approving" | "depositing";

export const BuyerOrderActions = ({ orderId, buyer, amount, status, onUpdated }: BuyerOrderActionsProps) => {
  const { address: connectedAddress } = useAccount();
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("idle");

  const { data: escrowContract, isLoading: isEscrowLoading } = useDeployedContractInfo({
    contractName: "Escrow",
  });

  const { writeContractAsync: writeTokenAsync, isMining: isTokenMining } = useScaffoldWriteContract({
    contractName: "ZHToken",
  });

  const { writeContractAsync: writeEscrowAsync, isMining: isEscrowMining } = useScaffoldWriteContract({
    contractName: "Escrow",
  });

  const isBuyer = connectedAddress?.toLowerCase() === buyer.toLowerCase();
  const isBusy = paymentStep !== "idle" || isTokenMining || isEscrowMining;

  const handlePay = async () => {
    if (!isBuyer) {
      notification.error("只有订单买家可以付款");
      return;
    }

    if (status !== 0) {
      notification.error("只有 Created 状态的订单可以付款");
      return;
    }

    if (!escrowContract) {
      notification.error("Escrow 合约信息尚未加载");
      return;
    }

    try {
      setPaymentStep("approving");

      const approveHash = await writeTokenAsync({
        functionName: "approve",
        args: [escrowContract.address, amount],
      });

      if (!approveHash) return;

      setPaymentStep("depositing");

      const depositHash = await writeEscrowAsync({
        functionName: "deposit",
        args: [orderId],
      });

      if (!depositHash) return;

      notification.success("付款成功，订单已进入 Paid 状态");
      onUpdated?.();
    } catch (error) {
      console.error("Approve or deposit failed:", error);
      notification.error("付款失败，请检查代币余额、授权交易或钱包状态");
    } finally {
      setPaymentStep("idle");
    }
  };

  const handleConfirm = async () => {
    if (!isBuyer) {
      notification.error("只有订单买家可以确认收货");
      return;
    }

    if (status !== 1) {
      notification.error("只有 Paid 状态的订单可以确认收货");
      return;
    }

    try {
      const confirmHash = await writeEscrowAsync({
        functionName: "confirm",
        args: [orderId],
      });

      if (!confirmHash) return;

      notification.success("确认收货成功，订单已完成");
      onUpdated?.();
    } catch (error) {
      console.error("Confirm order failed:", error);
      notification.error("确认收货失败，请检查订单状态和当前钱包");
    }
  };

  if (!isBuyer) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === 0 && (
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handlePay}
          disabled={isBusy || isEscrowLoading}
        >
          {paymentStep === "approving" && (
            <>
              <span className="loading loading-spinner loading-xs" />第 1/2 步：授权代币
            </>
          )}
          {paymentStep === "depositing" && (
            <>
              <span className="loading loading-spinner loading-xs" />第 2/2 步：存入托管
            </>
          )}
          {paymentStep === "idle" && "一键付款"}
        </button>
      )}

      {status === 1 && (
        <button className="btn btn-success btn-sm" type="button" onClick={handleConfirm} disabled={isBusy}>
          {isEscrowMining ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              等待确认
            </>
          ) : (
            "确认收货"
          )}
        </button>
      )}
    </div>
  );
};
