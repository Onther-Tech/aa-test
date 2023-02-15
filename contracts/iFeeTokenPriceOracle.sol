// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface iFeeTokenPriceOracle {
    function initialize(address _feeToken, address _l1FeeWallet) external;
    function updatePriceRatio(uint256 _priceRatio) external;
    function getL1TokenFee(bytes memory _txData) external view returns (uint256);
    function withdrawToken() external;
}
