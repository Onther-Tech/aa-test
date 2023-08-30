// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { LibMessenger } from "../libraries/LibMessenger.sol";
import "../libraries/SafeERC20.sol";
import {IERC20} from "../interfaces/IERC20.sol";
import "../libraries/BytesLib.sol";

import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import { OnApprove } from "../interfaces/OnApprove.sol";

// import "hardhat/console.sol";

interface L1CrossDomainMessengerI {
    function sendMessage(
        address _target,
        bytes memory _message,
        uint32 _gasLimit
    ) external;
}

interface L1BridgeI {
    function depositERC20To(
        address _l1Token,
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) external;
}

/**
 * @title L1toL2DepositAndMessage
 * @dev
 */
contract L1toL2DepositAndMessage is ERC165Storage{
    using SafeERC20 for IERC20;
    using BytesLib for bytes;
    /* ========== DEPENDENCIES ========== */

    address public ton;

    constructor(address tonAddress) {
        ton = tonAddress;
        _registerInterface(OnApprove(address(this)).onApprove.selector);
    }

    function onApprove(
        address sender,
        address spender,
        uint256 amount,
        bytes calldata data
    ) public returns (bool) {
        require(sender == ton, 'sender is not TON contract');
        // data :
        // 20 bytes addressManager,
        // 20 bytes l1Token,
        // 20 bytes  l2Token,
        // 20 bytes depositAndCallTarget,
        // 4 bytes minGasLimitForDeposit
        // 4 bytes minGasLimitForCall
        // 나머지 bytes call

        require(data.length > 88, 'wrong data');
        // console.log("data.length %s", data.length);

        address addressManager = data.toAddress(0);
        address depositAndCallTarget = data.toAddress(60);
        uint256 amount1 = amount;

        address l1Token = data.toAddress(20);
        address l2Token = data.toAddress(40);
        uint32  minGasLimitForDeposit = data.toUint32(80);
        uint32  minGasLimitForCall = data.toUint32(84);
        bytes memory callData = data.slice(88, (data.length-88));

        // console.log("addressManager %s", addressManager);
        // console.log("l1Token %s", l1Token);
        // console.log("l2Token %s", l2Token);
        // console.log("depositAndCallTarget %s", depositAndCallTarget);
        // console.log("amount %s", amount);
        // console.log("minGasLimitForDeposit %s", minGasLimitForDeposit);
        // console.log("minGasLimitForCall %s", minGasLimitForCall);
        // console.logBytes(data.slice(88, data.length-1));

        address l1Messenger = LibMessenger.getL1CommunicationMessenger(addressManager);
        require(l1Messenger != address(0), "l1Messenger is ZeroAddress");

        _depositL1TokenToL2(
            sender,
            addressManager,
            l1Token,
            l2Token,
            depositAndCallTarget,
            amount1,
            minGasLimitForDeposit
        );

        L1CrossDomainMessengerI(l1Messenger).sendMessage(
                depositAndCallTarget,
                callData,
                minGasLimitForCall
            );

        return true;
    }

    function _depositL1TokenToL2(
        address sender,
        address addressManager, address l1Token, address l2Token, address depositTo,
        uint256 amount, uint32 _minGasLimit )
        internal
    {
        address l1Bridge = LibMessenger.getL1Bridge(addressManager);
        require(l1Bridge != address(0), "l1Bridge is ZeroAddress");

        require(IERC20(l1Token).balanceOf(sender) >= amount, "l1Token balance is insufficient");
        require(IERC20(l1Token).allowance(sender, address(this)) >= amount, "l1Token allowance is insufficient");

        uint256 allowance = IERC20(l1Token).allowance(address(this), l1Bridge);

        if (allowance < amount) {
            IERC20(l1Token).approve(l1Bridge, type(uint256).max);
        }

        IERC20(l1Token).safeTransferFrom(sender, address(this), amount);

        L1BridgeI(l1Bridge).depositERC20To(
            l1Token,
            l2Token,
            depositTo,
            amount,
            _minGasLimit,
            abi.encode(l1Token, l2Token, depositTo, amount)
        );
    }

}