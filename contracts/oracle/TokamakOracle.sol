// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces1/IOracle.sol";
import "../interfaces1/IL2StandardERC20.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

interface IIOracleLibrary {
    function getOutAmountsCurTick(address factory, bytes memory _path, uint256 _amountIn)
        external view returns (uint256 amountOut);
}

contract TokamakOracle is Ownable, IOracle {
    address public constant ovmGasOracle = 0x420000000000000000000000000000000000000F;

    address public oracleLibrary;
    address public uniswapV3Factory;
    address public ton;

    uint256 public fixedPriceTONPerETH;
    uint256 public fixedPriceTOSPerETH;

    // feeToken
    mapping(address => bytes[]) public pricePaths; // pricePathInfos must be ordering as 'weth - fee - ...- ton'

    event ChangedPricePathInfo(address token, bytes[] poolPaths);
    event SetFixedTONPrice(uint256 amount);

    modifier nonZeroAddress(address _addr) {
        require(_addr != address(0), "zero address");
        _;
    }

    modifier nonZero(uint256 amount) {
        require(amount != 0, "zero value");
        _;
    }

    constructor() {
    }

    function initialize(
        address _ton,
        address _oracleLibrary,
        address _uniswapV3Factory
    ) public nonZeroAddress(_ton) nonZeroAddress(_oracleLibrary) nonZeroAddress(_uniswapV3Factory) onlyOwner {
        ton = _ton;
        oracleLibrary = _oracleLibrary;
        uniswapV3Factory = _uniswapV3Factory;

    }

    function setFixedTONPrice(
        uint256 _fixedPriceTONPerETH
    )   public
        nonZero(_fixedPriceTONPerETH)
        onlyOwner
    {
        require(
            fixedPriceTONPerETH != _fixedPriceTONPerETH, "same value");

        fixedPriceTONPerETH = _fixedPriceTONPerETH;

        emit SetFixedTONPrice(_fixedPriceTONPerETH);
    }

    function setFixedTOSPrice(
        uint256 _fixedPriceTOSPerETH
    )   public
        nonZero(_fixedPriceTOSPerETH)
        onlyOwner
    {
        require(
            fixedPriceTOSPerETH != _fixedPriceTOSPerETH, "same value");

        fixedPriceTOSPerETH = _fixedPriceTOSPerETH;
    }

    function addTokenPricePaths(
        address feeToken,
        bytes[] calldata pathes
    ) public nonZeroAddress(feeToken) onlyOwner {
        if (pricePaths[feeToken].length != 0)  delete pricePaths[feeToken];

        for (uint256 i = 0; i < pathes.length; i++){
            if (pathes[i].length > 0) {
                pricePaths[feeToken].push(pathes[i]);
            }
        }
        emit ChangedPricePathInfo(feeToken, pathes);
    }


    function viewTokenPricePaths(address feeToken) external view returns (bytes[] memory) {
        return pricePaths[feeToken];
    }

     /**
     * return amount of tokens that are required to receive that much eth.
     * pricePathInfos must be ordering as 'weth - fee - ...- ton'
     * we choose the one that returns the minimum amount when swapping in pools.
     */
    function getTokenValueOfEth(address feeToken, uint256 ethOutput) public view virtual override returns (uint256 tokenInput){
        bytes[] memory pathes = pricePaths[feeToken];
        if (pathes.length > 0){
            uint256 prices = 0;
            for (uint256 i = 0; i < pathes.length; i++){
                if (pathes[i].length > 0) {
                    prices = IIOracleLibrary(oracleLibrary).getOutAmountsCurTick(uniswapV3Factory, pathes[i], ethOutput);
                    if (i == 0) tokenInput = prices;
                    else tokenInput = Math.min(tokenInput, prices);
                }
            }
        }
    }

    // function getTokenValueOfEth(uint256 ethOutput) external view virtual override returns (uint256 tokenInput){
    //     return getTokenValueOfEth(ton, ethOutput);
    // }

    function getTokenValueOfEth(uint256 ethOutput) external view virtual override returns (uint256 tokenInput){
        tokenInput = fixedPriceTONPerETH * ethOutput / 1e18;
    }

}