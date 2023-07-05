// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../libraries/Create2.sol";

interface ITokamakAccount {
    function initialize(address anOwner) external;
}

/**
 * A sample factory contract for TokamakAccount
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract TokamakAccountFactory {
    // TokamakAccount public immutable accountImplementation;
    address public immutable entryPoint;
    address public immutable accountImplementation;

    event SetAddress(address _entryPoint, address _accountImplementation);
    event CreatedAccount(address owner, uint256 salt, address account);

    constructor(address _entryPoint, address _accountImplementation) {
        // console.logBytes(type(ERC1967Proxy).creationCode);
        entryPoint = _entryPoint;
        accountImplementation = _accountImplementation;
    }
    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(address owner, uint256 salt) public returns (address ret) {
        address addr = getAddress(owner, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return addr;
        }
        ret = address(new ERC1967Proxy{salt : bytes32(salt)}(
                address(accountImplementation),
                abi.encodeCall(ITokamakAccount.initialize, (owner))
            ));
        emit CreatedAccount(owner, salt, ret);
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(address owner,uint256 salt) public view returns (address) {
        return Create2.computeAddress(bytes32(salt), keccak256(abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    address(accountImplementation),
                    abi.encodeCall(ITokamakAccount.initialize, (owner))
                )
            )));
    }
}
