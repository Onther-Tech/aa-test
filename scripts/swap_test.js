const ethers = require('ethers');
require('dotenv').config();
const hre = require('hardhat');
const {getContract, getPoolContractAddress, deployContract} = require("./helper_functions.js");
const UniswapV3PoolArtifact = require('./abis1/UniswapV3Pool.sol/UniswapV3Pool.json');
const { expect } = require("chai");

async function main() {
  const accounts = await hre.ethers.getSigners();
  const deployer = accounts[0];
  console.log('deployer' , deployer.address);


  providers = hre.ethers.provider;
  let totalGasUsed = ethers.BigNumber.from("0")
  ///=========== UniswapV3Factory
  const UniswapV3FactoryContract = await getContract('UniswapV3Factory');
  ///=============== NonfungiblePositionManagerContract
  const NonfungiblePositionManagerContract = await getContract('NonfungiblePositionManager');
  ///=============== TONContract
  const TONContract = await getContract('TON');
  const TONAddress = TONContract.address;
  ///=============== WETHContract
  const WETHContract = await getContract('WETH');
  const WETHAddress = WETHContract.address;
  ///=============== WETHContract
  const TOSContract = await getContract('TOS');
  const TOSAddress = TOSContract.address;
  ///=============== SwapRouterContract
  const SwapRouterContract = await getContract('SwapRouter02');
  const SwapRouterAddress = SwapRouterContract.address;
  console.log(SwapRouterAddress);

  let poolAddressTOSTON = await getPoolContractAddress(UniswapV3FactoryContract, TONAddress, TOSAddress, 3000);
  let poolAddressWETHTON = await getPoolContractAddress(UniswapV3FactoryContract, WETHAddress, TONAddress, 3000);
  console.log("SwapRouterAddress",SwapRouterAddress);
  console.log("poolAddressWETHTON",poolAddressWETHTON);

  let deadline = Date.now() + 100000;

  //==============TON => ETH (ERC20->ETH)

  let allowanceAmount = ethers.utils.parseEther("100")
  let allowance = await TONContract.allowance(deployer.address, SwapRouterContract.address)
  console.log("allowance",allowance);

  if(allowance.lt(allowanceAmount)) {
    await (await TONContract.connect(deployer).approve(SwapRouterContract.address, allowanceAmount)).wait()
  }

  amountIn = ethers.utils.parseEther('1');
  const params1 =
    {
      tokenIn: TONAddress,
      tokenOut: WETHAddress,
      fee: 3000,
      recipient: SwapRouterAddress,
      deadline: deadline,
      amountIn: amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    }
  ;
  const encData1 = SwapRouterContract.interface.encodeFunctionData('exactInputSingle', [params1]);
  const amountMinimum = 0
  const encData2 = SwapRouterContract.interface.encodeFunctionData('unwrapWETH9(uint256,address)', [amountMinimum, deployer.address])

  const encMultiCall = SwapRouterContract.interface.encodeFunctionData('multicall(uint256,bytes[])', [deadline,[encData1, encData2]])
  //console.log(encMultiCall);
  deadline = Math.floor(Date.now() / 1000) + 100000;

  try {
    const txArgs = {
        to: SwapRouterContract.address,
        from: deployer.address,
        data: encMultiCall,
        gasLimit: 300000,
    }
    const tx = await deployer.sendTransaction(txArgs)
    await tx.wait();
    const receipt = await providers.getTransactionReceipt(tx.hash);
    console.log("===TON => ETH (ETH->ERC20)");
    console.log("transactionHash:", receipt.transactionHash);
    console.log("gasUsed: ",receipt.gasUsed);
    console.log();
    totalGasUsed = totalGasUsed.add(receipt.gasUsed);
  } catch (e) {
    console.log(e.message);
  }

  /*
  try{
      const tx = await SwapRouterContract.multicall([encData1, encData2], {
        gasLimit: 3000000
      });
      await tx.wait();
      const receipt = await providers.getTransactionReceipt(tx.hash);
      console.log("===TON => ETH (ERC20->ETH)");
      console.log("transactionHash:", receipt.transactionHash);
      console.log("gasUsed: ",receipt.gasUsed);
      console.log();
      totalGasUsed = totalGasUsed.add(receipt.gasUsed);
    }
    catch(e) {
      console.log("e", e.message);
    }
    console.log("totalGasUsed:",totalGasUsed);
    */

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});