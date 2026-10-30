// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/// @notice Deliberately vulnerable vault used only for the reentrancy challenge.
contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        require(msg.value > 0, "Vault: deposit must be positive");
        balances[msg.sender] += msg.value;
    }

    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Vault: nothing to withdraw");

        // Vulnerability: the external call happens before the balance is cleared.
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Vault: send failed");

        balances[msg.sender] = 0;
    }

    function vaultBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
