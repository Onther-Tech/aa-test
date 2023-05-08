// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@eth-optimism/contracts/L2/messaging/IL2ERC20Bridge.sol";
import "@eth-optimism/contracts/libraries/constants/Lib_PredeployAddresses.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "./iFeeTokenPriceOracle.sol";
import "./OVM_GasPriceOracle.sol";

contract FeeTokenPriceOracle is iFeeTokenPriceOracle, Ownable {
    using SafeERC20 for IERC20;

    address public feeToken;
    address public l1FeeWallet;
    uint256 public priceRatio;
    uint256 public discountRatio;
    address public gasPriceOracleAddress = 0x420000000000000000000000000000000000000F;

    constructor() {
    }

    function initialize(
        address _feeToken,
        address _l1FeeWallet
    ) public {
        feeToken = _feeToken;
        l1FeeWallet = _l1FeeWallet;

        priceRatio = 1000;
    }

    function updatePriceRatio(uint256 _priceRatio) public onlyOwner {
        priceRatio = _priceRatio;
    }

    function getTokenValueOfEth(uint256 valueEth) internal view virtual returns (uint256) {
        return valueEth * priceRatio / 100 * (100 - discountRatio) / 100;
    }

    function getL1TokenFee(bytes memory _txData) public view returns (uint256) {
        OVM_GasPriceOracle gasPriceOracleContract = OVM_GasPriceOracle(gasPriceOracleAddress);
        return gasPriceOracleContract.getL1Fee(_txData) * priceRatio;
    }

    function updateDiscountRatio(uint256 _discountRatio) public onlyOwner {
        discountRatio = _discountRatio;
    }

    function withdrawToken() public onlyOwner {
        IL2ERC20Bridge(Lib_PredeployAddresses.L2_STANDARD_BRIDGE).withdrawTo(
            feeToken,
            l1FeeWallet,
            IERC20(feeToken).balanceOf(address(this)),
            0,
            bytes("")
        );
    }
}
