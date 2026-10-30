// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/// @notice Reentrancy-safe version of the challenge vault.
contract FixedVault {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        require(msg.value > 0, "Vault: deposit must be positive");
        balances[msg.sender] += msg.value;
    }

    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Vault: nothing to withdraw");

        // Checks-Effects-Interactions: update internal state before calling out.
        balances[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Vault: send failed");
    }

    function vaultBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
