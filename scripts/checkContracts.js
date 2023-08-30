const ethers = require('ethers');
require('dotenv').config();
const hre = require('hardhat');
const {getContract, getPoolContractAddress, deployContract} = require("./helper_functions.js");
const UniswapV3PoolArtifact = require('./abis1/UniswapV3Pool.sol/UniswapV3Pool.json');
const { expect } = require("chai");
const { getAccountInitCode, simulationResultCatch, parseValidationResult} = require('../test/tokamak_testutils')
const { fillAndSign, DefaultsForUserOp } = require('../test/UserOp')
const { hexConcat, hexZeroPad, parseEther } = require('ethers/lib/utils')
const {
  arrayify,
  defaultAbiCoder,
  hexDataSlice,
  keccak256
} = require('ethers/lib/utils')

const entryPointJson = require("../artifacts/contracts/TokamakEntryPoint.sol/TokamakEntryPoint.dbg.json")
const paymasterJson = require("../artifacts/contracts/TokamakPaymaster.sol/TokamakPaymaster.dbg.json")


async function main() {
  const depositAmountOfPaymaster = ethers.utils.parseEther("0.1")
  const { tonHolder, user2Address, user3Address } = await hre.getNamedAccounts();

  const accounts = await hre.ethers.getSigners();
  const deployer = accounts[0];
  console.log('deployer' , deployer.address);
  const user2 = await hre.ethers.getSigner(user2Address);
  console.log('user2' , user2.address);

  const chainName = hre.network.name;
  if(chainName == 'hardhat') {
    await hre.ethers.provider.send("hardhat_setBalance", [
      deployer.address,
      "0x8ac7230489e80000",
    ]);
  }

  providers = hre.ethers.provider;
  let totalGasUsed = ethers.BigNumber.from("0")

  ///=============== WETHContract
  const WETHContract = await getContract('WETH');
  const WETHAddress = WETHContract.address;

  ///=============== TONContract
  const TONContract = await getContract('TON');
  const TONAddress = TONContract.address;
  console.log('TONContract' , TONContract.address);
  if(chainName == 'hardhat') {
    const tonHolderSiger = await hre.ethers.getSigner(tonHolder);
    console.log('tonHolderSiger' , tonHolderSiger.address);
    await (await TONContract.connect(tonHolderSiger).transfer(
      deployer.address,
      ethers.utils.parseEther("1000")
    ));
  }

  ///=============== SwapRouterContract
  const SwapRouterContract = await getContract('SwapRouter02');
  const SwapRouterAddress = SwapRouterContract.address;
  console.log("SwapRouterAddress", SwapRouterAddress);

  ///=========== TokamakAccountFactory
  const TokamakAccountFactory = await getContract('TokamakAccountFactory');
  console.log('TokamakAccountFactory' , TokamakAccountFactory.address);

  ///=========== TokamakEntryPoint
  const TokamakEntryPointContract = await getContract('TokamakEntryPoint');
  console.log('TokamakEntryPointContract' , TokamakEntryPointContract.address);

  ///=========== TokamakPaymaster
  const TokamakPaymasterContract = await getContract('TokamakPaymaster');
  console.log('TokamakPaymasterContract' , TokamakPaymasterContract.address);


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
