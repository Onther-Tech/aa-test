const { ethers, Signer, BigNumber } = require('ethers');
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

const { Runner } = require('../test/helpers/client')

const JsonRpcProvider = require('@ethersproject/providers')

// bundler v0.6.0
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
const NETWORK = 'http://localhost:8545'
const BUNDLER_URL = 'http://localhost:3000/rpc'



/*
// ---- use case 0 ---
// 1. L1 에서 L2로 디파짓과 함수호출을 동시에 한다.
//    => 확인사항 L1에서 하나의 트랜잭션으로 구성할때, L2에서 순차적 실행이 보장되는가?
// 1-1. L1에서 L2로 톤을 특정 주소 전송 depositERC20To
// 1-2. L1에서 L1Message를 통해 특정 컨트랙의 함수를 호출, paymaster.depositTo
//
*/

// ---- use case 1 ---
// 사전 작업 1. paymaster는 entryPoint에 이더를 예치해야 한다.
// 사전 작업 2. user2Contract 계정은 톤을 보유하고 있다.
// 사전 작업 3. *** user1 이 paymaster에 user2 계정으로 톤을 예치한다. *****
// 1. user2Contract 계정의 1톤을 이더로 swap 하려고 한다.
// 1-1. user2Contract 계정에서 ton.approve(paymaster, max)
// 1-2. user2Contract 계정에서 ton.approve(swapRouter, max)
// 1-3. user2Contract 계정에서 swapRouter.multicall(exactInputSingle, unwrapWETH9)

async function approveCalldata(SwapRouterContract, TONContract, PaymasterContract,
  TONAddress, WETHAddress, SwapRouterAddress, deadline, swapTonAmountIn, receiverAddress,
  maxApproveAmount) {

  ///============
  const func0 = TONContract.interface.encodeFunctionData("approve",
    [PaymasterContract.address, maxApproveAmount]);
  ///============
  const func1 = TONContract.interface.encodeFunctionData("approve",
    [SwapRouterAddress, maxApproveAmount]);
  ///============
  const params1 =
    {
      tokenIn: TONAddress,
      tokenOut: WETHAddress,
      fee: 3000,
      recipient: SwapRouterAddress,
      deadline: deadline,
      amountIn: swapTonAmountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    }
  const encData1 = SwapRouterContract.interface.encodeFunctionData('exactInputSingle',
    [params1]);
  const amountMinimum = 0
  const encData2 = SwapRouterContract.interface.encodeFunctionData('unwrapWETH9(uint256,address)',
    [amountMinimum, receiverAddress])
  const func2 = SwapRouterContract.interface.encodeFunctionData('multicall(uint256,bytes[])',
    [deadline,[encData1, encData2]])

  ///=============== TokamakAccount
  const TokamakAccount = await getContract('TokamakAccount');

  // let callData = TokamakAccount.interface.encodeFunctionData("executeBatch(address[],bytes[])",
  //     [[TONContract.address, TONContract.address, SwapRouterContract.address], [func0, func1, func2]]
  // )

  let callData = TokamakAccount.interface.encodeFunctionData("executeBatch(address[],bytes[])",
      [[TONContract.address, TONContract.address], [func1, func1]]
    )

  // let callData = TokamakAccount.interface.encodeFunctionData("execute",
  //     [TONContract.address, ethers.constants.Zero, func1]
  // )

  return callData;
}

async function swapCalldata(SwapRouterContract, TONContract, PaymasterContract,
  TONAddress, WETHAddress, SwapRouterAddress, deadline, swapTonAmountIn, receiverAddress,
  maxApproveAmount) {

  ///============
  const func0 = TONContract.interface.encodeFunctionData("approve",
    [PaymasterContract.address, maxApproveAmount]);
  ///============
  const func1 = TONContract.interface.encodeFunctionData("approve",
    [SwapRouterAddress, maxApproveAmount]);
  ///============
  const params1 =
    {
      tokenIn: TONAddress,
      tokenOut: WETHAddress,
      fee: 3000,
      recipient: SwapRouterAddress,
      deadline: deadline,
      amountIn: swapTonAmountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    }
  const encData1 = SwapRouterContract.interface.encodeFunctionData('exactInputSingle',
    [params1]);
  const amountMinimum = 0
  const encData2 = SwapRouterContract.interface.encodeFunctionData('unwrapWETH9(uint256,address)',
    [amountMinimum, receiverAddress])
  const func2 = SwapRouterContract.interface.encodeFunctionData('multicall(uint256,bytes[])',
    [deadline,[encData1, encData2]])

  ///=============== TokamakAccount
  const TokamakAccount = await getContract('TokamakAccount');

  // let callData = TokamakAccount.interface.encodeFunctionData("executeBatch(address[],bytes[])",
  //     [[TONContract.address, TONContract.address, SwapRouterContract.address], [func0, func1, func2]]
  // )

  // let callData = TokamakAccount.interface.encodeFunctionData("executeBatch(address[],bytes[])",
  //     [[TONContract.address, TONContract.address], [func1, func1]]
  //   )

  // let callData = TokamakAccount.interface.encodeFunctionData("execute",
  //     [TONContract.address, ethers.constants.Zero, func1]
  // )

  let callData = TokamakAccount.interface.encodeFunctionData("execute",
      [SwapRouterContract.address, ethers.constants.Zero, func2]
  )
  return callData;
}


async function main() {

  const provider = JsonRpcProvider.getDefaultProvider(NETWORK)
  let signer
  //const deployFactory: boolean = opts.deployFactory
  let deployFactory
  try {
    const accounts = await provider.listAccounts()
    console.log('accounts', accounts)
    if (accounts.length === 0) {
      console.log('fatal: no account. use --mnemonic (needed to fund account)')
      process.exit(1)
    }
    // for hardhat/node, use account[0]
    signer = provider.getSigner()
    deployFactory = true
  } catch (e) {
    throw new Error('must specify --mnemonic')
  }
  const accountOwner = new ethers.Wallet(`${process.env.ADMIN}`, hre.ethers.provider);

  const index = Date.now()

  // const client = await new Runner(provider, BUNDLER_URL, accountOwner, ENTRY_POINT, index).init(deployFactory ? signer : undefined)

  // TokamakPaymaster에 0.1 ETH 입금
  const depositAmountOfPaymaster = ethers.utils.parseEther("0.1")
  const { tonHolder, user2Address, user3Address } = await hre.getNamedAccounts();

  const accounts = await hre.ethers.getSigners();
  const deployer = accounts[0];
  console.log('deployer' , deployer.address);
  const user2 = await hre.ethers.getSigner(user2Address);
  console.log('user2' , user2.address);

  const chainName = hre.network.name;
  console.log('chainName' , chainName);

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

  console.log('WETHAddress' , WETHAddress);
  ///=============== TONContract
  const TONContract = await getContract('TON');
  const TONAddress = TONContract.address;
  console.log('TONContract' , TONContract.address);
  if(chainName == 'hardhat') {
    const tonHolderSiger = await hre.ethers.getSigner(tonHolder);
    console.log('tonHolderSiger' , tonHolderSiger.address);
    //
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

  console.log(`
  //============================================================
  //== 사전작업 1 . paymaster는 entryPoint에 이더를 예치해야 한다.
  //============================================================
  `)

  // TokamakPaymasterContract > TokamakEntryPointContract에 입금. 0.1 ETH
  await (await TokamakEntryPointContract.connect(deployer).depositTo(
    TokamakPaymasterContract.address
    , {value: depositAmountOfPaymaster})).wait()

  // deposit 수량은 기존 1 ETH + 0.1 ETH = 1.1 ETH
  let depositInfo = await TokamakEntryPointContract.getDepositInfo(
    TokamakPaymasterContract.address,
  );
  console.log('depositInfo of TokamakPaymaster ' , depositInfo);

  console.log(`
  //============================================================
  //== 사전작업 2 . user2Contract 계정은 1 TON 을 보유하고 있다.
  //============================================================
  `)
  let swapTonAmountIn = ethers.utils.parseEther("1")
  // user2Address를 owner로 계정의 컨트랙트 주소를 계산
  // 항상 같은 주소가 나와야 함
  let user2ContractAddress = await TokamakAccountFactory.getAddress(user2Address, 0)
  console.log('user2Address' , user2Address);
  console.log('user2ContractAddress' , user2ContractAddress);

  // let balanceOfTON = await TONContract.balanceOf(deployer.address)
  // console.log('balanceOfTON' , balanceOfTON);

  // deployer > user2ContractAddress, 1 TON 전송
  await (await TONContract.connect(deployer).transfer(user2ContractAddress, swapTonAmountIn)).wait()
  let tonBalanceOfUser2Contract = await TONContract.balanceOf(user2ContractAddress)
  console.log('ton balance of User2Contract' , ethers.utils.formatUnits(tonBalanceOfUser2Contract, 18), "TON");


  console.log(`
  //============================================================
  //== 사전작업 3 . user1 이 paymaster에 user2Contract 계정으로 10 TON 을 예치한다.
  //============================================================
  `)
  let depositAmountInPaymaster = ethers.utils.parseEther("10")
  // deployer = owner
  // TokamakPaymasterContract.address = spender
  let allowance = await TONContract.allowance(deployer.address, TokamakPaymasterContract.address);

  // TokamakPaymasterContract의 allowance가 예치할 금액보다 작으면 depositAmountInPaymaster 만큼 approve
  if (allowance.lt(depositAmountInPaymaster)) {
      await( await TONContract.connect(deployer).approve(TokamakPaymasterContract.address, depositAmountInPaymaster)).wait()
  }

  // user2Contract > TokamakPaymaster, 10 TON 예치
  // 예치한 금액만큼 예치액 증가
  await (await TokamakPaymasterContract.connect(deployer).addDepositFor(
    TONContract.address,
    user2ContractAddress,
    depositAmountInPaymaster
  )).wait()

  let depositInfoInPaymaster = await TokamakPaymasterContract.depositInfo(
      TONContract.address,
      user2ContractAddress,
  );
  console.log('depositInfoInPaymaster of user2ContractAddress' ,
    ethers.utils.formatUnits(depositInfoInPaymaster.amount, 18), "TON");

    console.log(`
    //============================================================
    //== simulateValidation : 실행전에 시뮬레이션을 한다. 필요한 가스(prefund)를 확인한다.
    //============================================================
    `)
    let deadline = Date.now() + 100000;
    // let deadline = Math.floor(Date.now()/1000) + 100000;
    let receiverAddress = user2ContractAddress
    let maxApproveAmount = ethers.utils.parseEther("1000000000000")
    let callData = await swapCalldata(SwapRouterContract, TONContract, TokamakPaymasterContract,
      TONAddress, WETHAddress, SwapRouterAddress, deadline, swapTonAmountIn, receiverAddress,
      maxApproveAmount) ;

    let initCode = await hre.ethers.provider.getCode(user2ContractAddress)

    if(initCode == '0x') {
      initCode = getAccountInitCode(user2Address, TokamakAccountFactory)
    } else {
      initCode = '0x'
    }

    let user2Wallet = new ethers.Wallet(`${process.env.USER2_PRIVATE_KEY}`, hre.ethers.provider);

    let userOp = await fillAndSign({
        sender: user2ContractAddress,
        initCode: initCode,
        callData: callData,
        paymasterAndData: hexConcat([TokamakPaymasterContract.address, hexZeroPad(TONAddress, 20)]),
    }, user2Wallet, TokamakEntryPointContract)

    console.log('userOp', userOp)

    try {
      await TokamakEntryPointContract.callStatic.simulateValidation(userOp)
      } catch (e) {
          if (e.message.includes('ValidationResult')) {
              let message = e.message
              ValidationResult = parseValidationResult(message)
              // const tx = await deployed.tokamakEntryPoint.handleOps([userOp], addr1Address, { gasLimit: 1e6 })
              // await tx.wait()
          } else {
              // expect(e.message).to.include('FailedOp(0, "AA23 reverted (or OOG)")')
          }
      }
      // expect(ValidationResult?.returnInfo.preOpGas).to.be.gt(ethers.constants.Zero)

      if(ValidationResult) {
          //the gas used for validation (including preValidationGas)
          console.log('preOpGas : ',  ValidationResult.returnInfo.preOpGas.toString())

          // the required prefund for this operation
          console.log('prefund : ', ValidationResult.returnInfo.prefund.toString() )

          //abi.encode(account, token, gasPriceUserOp, maxTokenCost, maxCost)
          //paymaster.validatePaymasterUserOp return paymasterContext
          console.log('paymasterContext : ', ValidationResult.returnInfo.paymasterContext  )
          let paymasterContext = defaultAbiCoder.decode(["address","address","uint256","uint256","uint256"],ValidationResult.returnInfo.paymasterContext)
          console.log('paymasterContext : ', paymasterContext )
      }

    let beneficiaryAddress = user3Address


    console.log(`
    //============================================================
    //== handleOps : 실행한다. (swapCalldata)
    // check 1. EntryPoint 에 예치된  Paymaster 의 예치금은 줄어들고,
    //          줄어든 금액만큼 beneficiary(deployer)의 이더가 늘어난다.
    // check 2. Paymaster 에 예치된 user2ContractAddress의 톤 예치금이 줄어든다.
    // check 3. user2ContractAddress 이 보유한 1톤이 이더로 스왑된다.
    //============================================================
    `)
    depositInfoPrev = await TokamakEntryPointContract.getDepositInfo(
      TokamakPaymasterContract.address
    );
    console.log('depositInfoPrev Of Paymaster In EntryPoint',
    ethers.utils.formatEther(depositInfoPrev.deposit) , "ETH")

    beneficiaryBalanceEthPrev = await hre.ethers.provider.getBalance(beneficiaryAddress)
    // let beneficiaryBalanceTon = await TONContract.balanceOf(deployer.address)

    console.log('beneficiaryBalanceEthPrev of deployer',
      ethers.utils.formatEther(beneficiaryBalanceEthPrev) , "ETH")
    // console.log('beneficiaryBalanceTon of deployer',
    //   ethers.utils.formatEther(beneficiaryBalanceTon) , "TON")


    tonDepositInPaymasterPrev = await TokamakPaymasterContract.depositInfo(
      TONContract.address,
      user2ContractAddress,
    );

    console.log('depositInfoInPaymaster of user2ContractAddress Prev' ,
      ethers.utils.formatUnits(tonDepositInPaymasterPrev.amount, 18), "TON");

    tonBalanceOfUser2ContractPrev = await TONContract.balanceOf(user2ContractAddress)
    ethBalanceOfUser2ContractPrev = await hre.ethers.provider.getBalance(user2ContractAddress)

    console.log('eth BalanceOf User2Contract Prev',
      ethers.utils.formatEther(ethBalanceOfUser2ContractPrev) , "ETH")

    console.log('ton BalanceOf User2Contract Prev',
      ethers.utils.formatEther(tonBalanceOfUser2ContractPrev) , "TON")

    // create calldata
    let swapData = await swapCalldata(SwapRouterContract, TONContract, TokamakPaymasterContract,
        TONAddress, WETHAddress, SwapRouterAddress, deadline, swapTonAmountIn, receiverAddress,
        maxApproveAmount)

    userOp = await fillAndSign({
      sender: user2ContractAddress,
      initCode: initCode,
      callData: swapData,
      paymasterAndData: hexConcat([TokamakPaymasterContract.address, hexZeroPad(TONAddress, 20)]),
  }, user2Wallet, TokamakEntryPointContract)

    console.log('userOp', userOp)

    const code = await provider.getCode(TokamakPaymasterContract.address)
    console.log('code=', code)
  /*
    // send userOp to bundler
    const userOpHash = await client.bundlerProvider.sendUserOpToBundler(userOp)
    console.log('userOpHash', userOpHash)
    const txid = await client.accountApi.getUserOpReceipt(userOpHash)
    console.log('reqId', userOpHash, 'txid=', txid)

    depositInfoAfter = await TokamakEntryPointContract.getDepositInfo(
      TokamakPaymasterContract.address
    );
    console.log('depositInfoAfter Of Paymaster In EntryPoint',
    ethers.utils.formatEther(depositInfoAfter.deposit) , "ETH")

    beneficiaryBalanceEthAfter = await hre.ethers.provider.getBalance(beneficiaryAddress)

    console.log('beneficiaryBalanceEthAfter of deployer',
      ethers.utils.formatEther(beneficiaryBalanceEthAfter) , "ETH")

    tonDepositInPaymasterAfter = await TokamakPaymasterContract.depositInfo(
      TONContract.address,
      user2ContractAddress,
    );

    console.log('depositInfoInPaymaster of user2ContractAddress After' ,
      ethers.utils.formatUnits(tonDepositInPaymasterAfter.amount, 18), "TON");

    tonBalanceOfUser2ContractAfter = await TONContract.balanceOf(user2ContractAddress)
    ethBalanceOfUser2ContractAfter = await hre.ethers.provider.getBalance(user2ContractAddress)

    console.log('eth BalanceOf User2Contract After',
      ethers.utils.formatEther(ethBalanceOfUser2ContractAfter) , "ETH")

    console.log('ton BalanceOf User2Contract After',
      ethers.utils.formatEther(tonBalanceOfUser2ContractAfter) , "TON")

    console.log(">> check 1. depositInfoOf Paymaster In EntryPoint",
      ethers.utils.formatEther(depositInfoPrev.deposit) , "ETH -> ",
      ethers.utils.formatEther(depositInfoAfter.deposit) , "ETH " )
    console.log(">> check 1. eth balance of beneficiary ",
      ethers.utils.formatEther(beneficiaryBalanceEthPrev) , "ETH -> ",
      ethers.utils.formatEther(beneficiaryBalanceEthAfter) , "ETH " )
    console.log(">> check 1.  compare  ",
      ethers.utils.formatEther(depositInfoPrev.deposit.sub(depositInfoAfter.deposit)) , "ETH ==",
      ethers.utils.formatEther(beneficiaryBalanceEthAfter.sub(beneficiaryBalanceEthPrev)) , "ETH " )
    console.log(">> check 2. ton deposit of user2Contract in Paymaster",
      ethers.utils.formatEther(tonDepositInPaymasterPrev.amount) , "TON -> ",
      ethers.utils.formatEther(tonDepositInPaymasterAfter.amount) , "TON " )
*/

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
