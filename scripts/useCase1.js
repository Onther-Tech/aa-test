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

  console.log(`
  //============================================================
  //== 사전작업 1 . paymaster는 entryPoint에 이더를 예치해야 한다.
  //============================================================
  `)
  await (await TokamakEntryPointContract.connect(deployer).depositTo(
    TokamakPaymasterContract.address
    , {value: depositAmountOfPaymaster})).wait()

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
  let user2ContractAddress = await TokamakAccountFactory.getAddress(user2Address, 0)
  console.log('user2Address' , user2Address);
  console.log('user2ContractAddress' , user2ContractAddress);

  // let balanceOfTON = await TONContract.balanceOf(deployer.address)
  // console.log('balanceOfTON' , balanceOfTON);
  await (await TONContract.connect(deployer).transfer(user2ContractAddress, swapTonAmountIn)).wait()
  let tonBalanceOfUser2Contract = await TONContract.balanceOf(user2ContractAddress)
  console.log('ton balance of User2Contract' , ethers.utils.formatUnits(tonBalanceOfUser2Contract, 18), "TON");


  console.log(`
  //============================================================
  //== 사전작업 3 . user1 이 paymaster에 user2Contract 계정으로 10 TON 을 예치한다.
  //============================================================
  `)
  let depositAmountInPaymaster = ethers.utils.parseEther("10")
  let allowance = await TONContract.allowance(deployer.address, TokamakPaymasterContract.address);

  if (allowance.lt(depositAmountInPaymaster)) {
      await( await TONContract.connect(deployer).approve(TokamakPaymasterContract.address, depositAmountInPaymaster)).wait()
  }

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
        // console.log('e',e)
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

  console.log(`
  //============================================================
  //== handleOps : 실행한다. (approveCalldata)
  // check 1. EntryPoint 에 예치된  Paymaster 의 예치금은 줄어들고,
  //          줄어든 금액만큼 beneficiary(deployer)의 이더가 늘어난다.
  // check 2. Paymaster 에 예치된 user2ContractAddress의 톤 예치금이 줄어든다.
  // check 3. user2ContractAddress 이 보유한 1톤이 이더로 스왑된다.
  //============================================================
  `)
  let deployedUserOperationEvent
  let beneficiaryAddress = user3Address
  let depositInfoPrev = await TokamakEntryPointContract.getDepositInfo(
    TokamakPaymasterContract.address
  );
  console.log('depositInfoPrev Of Paymaster In EntryPoint',
  ethers.utils.formatEther(depositInfoPrev.deposit) , "ETH")

  let beneficiaryBalanceEthPrev = await hre.ethers.provider.getBalance(beneficiaryAddress)
  // let beneficiaryBalanceTon = await TONContract.balanceOf(deployer.address)

  console.log('beneficiaryBalanceEthPrev of deployer',
    ethers.utils.formatEther(beneficiaryBalanceEthPrev) , "ETH")
  // console.log('beneficiaryBalanceTon of deployer',
  //   ethers.utils.formatEther(beneficiaryBalanceTon) , "TON")


  let tonDepositInPaymasterPrev = await TokamakPaymasterContract.depositInfo(
    TONContract.address,
    user2ContractAddress,
  );

  console.log('depositInfoInPaymaster of user2ContractAddress Prev' ,
    ethers.utils.formatUnits(tonDepositInPaymasterPrev.amount, 18), "TON");

  let tonBalanceOfUser2ContractPrev = await TONContract.balanceOf(user2ContractAddress)
  let ethBalanceOfUser2ContractPrev = await hre.ethers.provider.getBalance(user2ContractAddress)

  console.log('eth BalanceOf User2Contract Prev',
    ethers.utils.formatEther(ethBalanceOfUser2ContractPrev) , "ETH")

  console.log('ton BalanceOf User2Contract Prev',
    ethers.utils.formatEther(tonBalanceOfUser2ContractPrev) , "TON")

  let approveData = await approveCalldata(SwapRouterContract, TONContract, TokamakPaymasterContract,
      TONAddress, WETHAddress, SwapRouterAddress, deadline, swapTonAmountIn, receiverAddress,
      maxApproveAmount) ;

  userOp = await fillAndSign({
      sender: user2ContractAddress,
      initCode: initCode,
      callData: approveData,
      paymasterAndData: hexConcat([TokamakPaymasterContract.address, hexZeroPad(TONAddress, 20)]),
  }, user2Wallet, TokamakEntryPointContract)

  console.log('userOp', userOp)

  try {
    await TokamakEntryPointContract.callStatic.simulateValidation(userOp)
    } catch (e) {
        if ((e).message.includes('ValidationResult')) {
            let message = (e).message
            ValidationResult = parseValidationResult(message)
            if(ValidationResult) {
                //the gas used for validation (including preValidationGas)
                // console.log('preOpGas : ',  ValidationResult.returnInfo.preOpGas.toString())

                // the required prefund for this operation
                console.log('prefund : ', ValidationResult.returnInfo.prefund.toString() )
                // prefund = BigNumber.from(ValidationResult.returnInfo.prefund.toString())
                //abi.encode(account, token, gasPriceUserOp, maxTokenCost, maxCost)
                //paymaster.validatePaymasterUserOp return paymasterContext
                // console.log('paymasterContext : ', ValidationResult.returnInfo.paymasterContext  )
                let paymasterContext = defaultAbiCoder.decode(["address","address","uint256","uint256","uint256"],ValidationResult.returnInfo.paymasterContext)
                console.log('paymasterContext : ', paymasterContext )
            }

            //UserOperationEvent
            const topic1 = TokamakEntryPointContract.interface.getEventTopic('UserOperationEvent');
            const topic2 = TokamakPaymasterContract.interface.getEventTopic('PostOp');
            const receipt = await ( await TokamakEntryPointContract.connect(deployer)
                .handleOps([userOp], beneficiaryAddress, { gasLimit: 1e6 })).wait()
            const logUserOperationEvent = receipt.logs.find(x => x.topics.indexOf(topic1) >= 0);

            const logPostOp = receipt.logs.find(x => x.topics.indexOf(topic2) >= 0);
            // console.log(logUserOperationEvent)

            deployedUserOperationEvent = TokamakEntryPointContract.interface.parseLog(logUserOperationEvent);

            console.log('deployedUserOperationEvent.args', deployedUserOperationEvent.args)
            // const deployedPostOp = TokamakPaymasterContract.interface.parseLog(logPostOp);
            // console.log(deployedUserOperationEvent.args)
            // console.log(deployedPostOp.args)
            // actualGasCost = deployedEvent.args.actualGasCost
            // console.log('actualGasCost', actualGasCost )

        } else {
            // expect(e.message).to.include('FailedOp(0, "AA23 reverted (or OOG)")')
            console.log('FailedOp(0, "AA23 reverted (or OOG)")')
        }
    }


  let depositInfoAfter = await TokamakEntryPointContract.getDepositInfo(
    TokamakPaymasterContract.address
  );
  console.log('depositInfoAfter Of Paymaster In EntryPoint',
  ethers.utils.formatEther(depositInfoAfter.deposit) , "ETH")

  let beneficiaryBalanceEthAfter = await hre.ethers.provider.getBalance(beneficiaryAddress)

  console.log('beneficiaryBalanceEthAfter of deployer',
    ethers.utils.formatEther(beneficiaryBalanceEthAfter) , "ETH")

  let tonDepositInPaymasterAfter = await TokamakPaymasterContract.depositInfo(
    TONContract.address,
    user2ContractAddress,
  );

  console.log('depositInfoInPaymaster of user2ContractAddress After' ,
    ethers.utils.formatUnits(tonDepositInPaymasterAfter.amount, 18), "TON");

  let tonBalanceOfUser2ContractAfter = await TONContract.balanceOf(user2ContractAddress)
  let ethBalanceOfUser2ContractAfter = await hre.ethers.provider.getBalance(user2ContractAddress)

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

    let swapData = await swapCalldata(SwapRouterContract, TONContract, TokamakPaymasterContract,
        TONAddress, WETHAddress, SwapRouterAddress, deadline, swapTonAmountIn, receiverAddress,
        maxApproveAmount) ;

    userOp = await fillAndSign({
        sender: user2ContractAddress,
        // initCode: initCode,
        callData: swapData,
        paymasterAndData: hexConcat([TokamakPaymasterContract.address, hexZeroPad(TONAddress, 20)]),
    }, user2Wallet, TokamakEntryPointContract)

    console.log('userOp', userOp)

    try {
      await TokamakEntryPointContract.callStatic.simulateValidation(userOp)
      } catch (e) {
          if ((e).message.includes('ValidationResult')) {
              let message = (e).message
              ValidationResult = parseValidationResult(message)
              if(ValidationResult) {
                  //the gas used for validation (including preValidationGas)
                  // console.log('preOpGas : ',  ValidationResult.returnInfo.preOpGas.toString())

                  // the required prefund for this operation
                  console.log('prefund : ', ValidationResult.returnInfo.prefund.toString() )
                  // prefund = BigNumber.from(ValidationResult.returnInfo.prefund.toString())
                  //abi.encode(account, token, gasPriceUserOp, maxTokenCost, maxCost)
                  //paymaster.validatePaymasterUserOp return paymasterContext
                  // console.log('paymasterContext : ', ValidationResult.returnInfo.paymasterContext  )
                  let paymasterContext = defaultAbiCoder.decode(["address","address","uint256","uint256","uint256"],ValidationResult.returnInfo.paymasterContext)
                  console.log('paymasterContext : ', paymasterContext )
              }

              //UserOperationEvent
              const topic1 = TokamakEntryPointContract.interface.getEventTopic('UserOperationEvent');
              const topic2 = TokamakPaymasterContract.interface.getEventTopic('PostOp');
              const receipt = await ( await TokamakEntryPointContract.connect(deployer)
                  .handleOps([userOp], beneficiaryAddress, { gasLimit: 1e6 })).wait()
              const logUserOperationEvent = receipt.logs.find(x => x.topics.indexOf(topic1) >= 0);

              const logPostOp = receipt.logs.find(x => x.topics.indexOf(topic2) >= 0);
              // console.log(logUserOperationEvent)

              deployedUserOperationEvent = TokamakEntryPointContract.interface.parseLog(logUserOperationEvent);

              console.log('deployedUserOperationEvent.args', deployedUserOperationEvent.args)
              // const deployedPostOp = TokamakPaymasterContract.interface.parseLog(logPostOp);
              // console.log(deployedUserOperationEvent.args)
              // console.log(deployedPostOp.args)
              // actualGasCost = deployedEvent.args.actualGasCost
              // console.log('actualGasCost', actualGasCost )

          } else {
              // expect(e.message).to.include('FailedOp(0, "AA23 reverted (or OOG)")')
              console.log('FailedOp(0, "AA23 reverted (or OOG)")')
          }
      }


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


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
