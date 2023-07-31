import { expect } from './shared/expect'
import { ethers, network } from 'hardhat'
import {
    arrayify,
    defaultAbiCoder,
    hexDataSlice,
    keccak256
  } from 'ethers/lib/utils'
import { Signer, BigNumber } from 'ethers'
import { tokamakFixtures } from './shared/fixtures'
import { TokamakFixture } from './shared/fixtureInterfaces'
import { FeeAmount, encodePath } from "./shared/utils"
import { UserOperation, StakeInfo, ReturnInfo} from './UserOperation'
import TokamakAccount from '../artifacts/contracts/TokamakAccount.sol/TokamakAccount.json'
import { getAccountInitCode, simulationResultCatch, parseValidationResult} from './tokamak_testutils'
import { fillAndSign, DefaultsForUserOp } from './UserOp'
import { hexConcat, hexZeroPad, parseEther } from 'ethers/lib/utils'

async function sampleCalldata(deployed: TokamakFixture, addr1Addr:Signer, addr2Addr: string) {
    let amount = ethers.utils.parseEther("0.1");
    let OneAddress = '0x0000000000000000000000000000000000000001';

    let amountApprove = ethers.utils.parseEther("100");
    const func1 = deployed.ton.interface.encodeFunctionData("approve", [deployed.SwapRouter02Address, amountApprove]);
    const func2 = deployed.ton.interface.encodeFunctionData("transfer", [OneAddress, amount]);
    const ITokamakAccountAbi = require("../artifacts/contracts/TokamakAccount.sol/TokamakAccount.json")
    let tokamakAccount = new ethers.Contract("TokamakAccount", ITokamakAccountAbi.abi, addr1Addr)
    // let callData = tokamakAccount.interface.encodeFunctionData("executeBatch",
    //     [[deployed.ton.address, deployed.ton.address], [func1, func2]]
    // )
    let callData = tokamakAccount.interface.encodeFunctionData("execute",
        [deployed.ton.address, ethers.constants.Zero, func1]
    )

    // console.log(callData)
    return callData;
}

async function createAndApproveToPaymaster(deployed: TokamakFixture, addr:Signer, addrAddr: string) {
    let amount = ethers.utils.parseEther("10000000000000000");
    let accountOwnerAddress = await deployed.tokamakAccountFactory.getAddress(addrAddr, 0)
    expect(await ethers.provider.getCode(accountOwnerAddress)).to.be.equal('0x')

    const topic = deployed.tokamakAccountFactory.interface.getEventTopic('CreatedAccount');
    const receipt = await (await deployed.tokamakAccountFactory.connect(deployed.deployer)["createAccount(address,uint256)"](addrAddr, 0)).wait()
    // const log = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
    // const deployedEvent = deployed.tokamakAccountFactory.interface.parseLog(log);

    const func1 = deployed.ton.interface.encodeFunctionData("approve", [deployed.tokamakPaymaster.address, amount]);
    const ITokamakAccountAbi = require("../artifacts/contracts/TokamakAccount.sol/TokamakAccount.json")
    let tokamakAccount = await ethers.getContractAt(ITokamakAccountAbi.abi, accountOwnerAddress, addr)
    // let callData = tokamakAccount.interface.encodeFunctionData("execute",
    //     [deployed.ton.address, func1]
    // )
    await (await tokamakAccount.connect(addr).execute(
            deployed.ton.address,
            ethers.constants.Zero,
            func1
        )).wait()
    expect(await deployed.ton.allowance(accountOwnerAddress, deployed.tokamakPaymaster.address)).to.be.eq(amount)

    return accountOwnerAddress;
}

async function tonDepositTo(deployed: TokamakFixture, to: string, amount: BigNumber) {
    let allowance = await deployed.ton.allowance(deployed.deployer.address, deployed.tokamakPaymaster.address);

    if (allowance.lt(amount)) {
        await( await deployed.ton.connect(deployed.deployer).approve(deployed.tokamakPaymaster.address, amount)).wait()
    }

    await (await deployed.tokamakPaymaster.connect(deployed.deployer).addDepositFor(
        deployed.ton.address,
        to,
        amount
    )).wait()

    // let depositInfo = await deployed.tokamakPaymaster.depositInfo(
    //     deployed.ton.address,
    //     to,
    // );
    // expect(depositInfo.amount).to.be.eq(amount)
}

describe('5.TokamakEntryPoint.test', () => {
    let deployer: Signer, addr1: Signer, addr2:Signer;
    let deployed: TokamakFixture
    let addr1Address: string, addr2Address: string
    let tokamakAccount: any;
    let accountOwnerAddress: string;
    before('create fixture loader', async () => {
        deployed = await tokamakFixtures()
        deployer = deployed.deployer;
        addr1 = deployed.addr1;
        addr2 = deployed.addr2;
        addr1Address = await addr1.getAddress()
        addr2Address = await  addr2.getAddress()
    })

    describe('# set tokamak oracle', () => {

        it('initialize', async () => {
            await (await deployed.tokamakOracle.connect(deployer).initialize(
                deployed.ton.address,
                deployed.oracleLibrary.address,
                deployed.uniswapV3FactoryAddress)).wait()

            expect(await deployed.tokamakOracle.ton()).to.be.eq(deployed.ton.address)
            expect(await deployed.tokamakOracle.oracleLibrary()).to.be.eq(deployed.oracleLibrary.address)
            expect(await deployed.tokamakOracle.uniswapV3Factory()).to.be.eq(deployed.uniswapV3FactoryAddress)

        });

        it('setFixedTONPrice', async () => {
            const priceTon = ethers.utils.parseEther("1000")
            const priceTos = ethers.utils.parseEther("800")

            await (await deployed.tokamakOracle.connect(deployer).setFixedTONPrice(
                priceTon
                )).wait()

            expect(await deployed.tokamakOracle.fixedPriceTONPerETH()).to.be.eq(
                priceTon)

        });

        it('addTokenPricePaths', async () => {
            let paths = await deployed.tokamakOracle.viewTokenPricePaths(deployed.ton.address);
            expect(paths.length).to.be.eq(0)

            const weth_ton_path = encodePath(
                [deployed.wethAddress, deployed.ton.address], [FeeAmount.MEDIUM])

            await (await deployed.tokamakOracle.connect(deployer).addTokenPricePaths(
                deployed.ton.address, [weth_ton_path]
                )).wait()

            let paths1 = await deployed.tokamakOracle.viewTokenPricePaths(deployed.ton.address);

            expect(paths1.length).to.be.eq(1)
            expect(paths1[paths1.length-1]).to.be.eq(weth_ton_path)

        });
    });


    describe('# set tokamak paymaster', () => {

        it('addToken', async () => {

            expect(await deployed.tokamakPaymaster.oracles(
                deployed.ton.address
            )).to.be.eq(ethers.constants.AddressZero)

            await (await deployed.tokamakPaymaster.connect(deployer).addToken(
                deployed.ton.address,
                deployed.tokamakOracle.address )).wait()

            expect(await deployed.tokamakPaymaster.oracles(
                deployed.ton.address
            )).to.be.eq(deployed.tokamakOracle.address)

        });

    });


    describe('# StakeManager ', () => {

        it('# depositTo ', async () => {
            const amount = ethers.utils.parseEther("1")

            await (await deployer.sendTransaction({
                to: addr1Address,
                value: amount
            })).wait()

            const balanceAddr1 = await addr1.getBalance()

            let depositInfo = await deployed.tokamakEntryPoint.getDepositInfo(
                addr1Address,
            );
            expect(depositInfo.deposit).to.be.eq(0)
            await (await deployed.tokamakEntryPoint.connect(addr1).depositTo(addr1Address
                , {value: amount})).wait()
            depositInfo = await deployed.tokamakEntryPoint.getDepositInfo(
                addr1Address,
            );
            expect(depositInfo.deposit).to.be.eq(amount)
            expect(await addr1.getBalance()).to.be.lt(balanceAddr1.sub(amount))
        });

        it('# withdrawTo ', async () => {

            const amount = ethers.utils.parseEther("0.1")

            const balanceAddr2 = await addr2.getBalance()
            const balanceDeposit = await deployed.tokamakEntryPoint.getDepositInfo(addr1Address)

            await (await deployed.tokamakEntryPoint.connect(addr1).withdrawTo(addr2Address, amount)).wait()

            expect(await addr2.getBalance()).to.be.eq(balanceAddr2.add(amount))

            let depositInfo2 = await deployed.tokamakEntryPoint.getDepositInfo(addr1Address)

            expect(depositInfo2.deposit).to.be.eq(balanceDeposit.deposit.sub(amount))
        });

        it('# addStake ', async () => {
            const amount = ethers.utils.parseEther("0.1")
            let unstakeDelaySec = 1000

            await (await deployed.tokamakEntryPoint.connect(addr1).addStake(unstakeDelaySec, {value:amount})).wait()

            let depositInfo = await deployed.tokamakEntryPoint.getDepositInfo(addr1Address)
            expect(depositInfo.staked).to.be.eq(true)
            expect(depositInfo.stake).to.be.eq(amount)
            expect(depositInfo.unstakeDelaySec).to.be.eq(unstakeDelaySec)
        });

        it('# withdrawStake revert: must call unlockStake() first', async () => {
            await expect(deployed.tokamakEntryPoint.connect(addr1).withdrawStake(addr2Address)).
                to.be.revertedWith("must call unlockStake() first")
        });

        it('# unlockStake ', async () => {
            await(await deployed.tokamakEntryPoint.connect(addr1).unlockStake()).wait()
        });

        it('# withdrawStake ', async () => {
            await expect(deployed.tokamakEntryPoint.connect(addr1).withdrawStake(addr2Address)).
                to.be.rejectedWith("Stake withdrawal is not due")
        });

        it('# pass time ', async () => {
            let unstakeDelaySec = 1000
            ethers.provider.send("evm_increaseTime", [unstakeDelaySec])
            ethers.provider.send("evm_mine")
        });

        it('# withdrawStake ', async () => {
            let balanceAddr2 = await addr2.getBalance()
            let depositInfo1 = await deployed.tokamakEntryPoint.getDepositInfo(addr1Address)
            await deployed.tokamakEntryPoint.connect(addr1).withdrawStake(addr2Address)
            let depositInfo2 = await deployed.tokamakEntryPoint.getDepositInfo(addr1Address)
            expect(depositInfo2.stake).to.be.eq(0)
            expect(depositInfo2.withdrawTime).to.be.eq(0)
            expect(depositInfo2.unstakeDelaySec).to.be.eq(0)
            expect(await addr2.getBalance()).to.be.eq(balanceAddr2.add(depositInfo1.stake))
        });
    });

    describe('# EntryPoint', () => {

        it('# 1. simulateValidation : revert: should fail if paymaster has no deposit', async () => {
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);

            const userOp = await fillAndSign({
                sender: accountOwnerAddress,
                initCode: getAccountInitCode(addr1Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(deployed.ton.address, 20)]),
            }, addr1, deployed.tokamakEntryPoint)

            await expect( deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp))
                .to.be.revertedWith("AA31 paymaster deposit too low")

        });

        it('# depositTo : tokamakPaymaster', async () => {
            const amount = ethers.utils.parseEther("1")

            let balanceEntryPoint = await ethers.provider.getBalance(deployed.tokamakEntryPoint.address)
            let balanceDeployer = await ethers.provider.getBalance(deployer.address)

            let depositInfo = await deployed.tokamakEntryPoint.getDepositInfo(
                deployed.tokamakPaymaster.address
            );
            expect(depositInfo.deposit).to.be.eq(0)
            await (await deployed.tokamakEntryPoint.connect(deployer).depositTo(
                deployed.tokamakPaymaster.address, {value: amount})).wait()

            depositInfo = await deployed.tokamakEntryPoint.getDepositInfo(
                deployed.tokamakPaymaster.address
            );
            expect(depositInfo.deposit).to.be.eq(amount)
            expect(await ethers.provider.getBalance(deployed.tokamakEntryPoint.address)).to.be.eq(balanceEntryPoint.add(amount))
            expect(await ethers.provider.getBalance(deployer.address)).to.be.lt(balanceDeployer.sub(amount))

        });

        it('# 2. simulateValidation : revert: AA33 reverted: DepositPaymaster: unsupported token', async () => {
            let feeTokenAddress = deployed.token.address
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);

            const userOp = await fillAndSign({
                sender: accountOwnerAddress,
                initCode: getAccountInitCode(addr1Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr1, deployed.tokamakEntryPoint)

            await expect( deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp))
                .to.be.revertedWith("AA33 reverted: DepositPaymaster: unsupported token")
        });

        it('# transfer ton to AccountContract of addr1', async () => {

            accountOwnerAddress = await deployed.tokamakAccountFactory.getAddress(addr1Address, 0)
            // expect(await ethers.provider.getCode(accountOwnerAddress)).to.be.equal('0x')

            let tonBalanceOf = await deployed.ton.balanceOf(accountOwnerAddress)
            const amount = ethers.utils.parseEther("1")

            if(tonBalanceOf.eq(ethers.constants.Zero)) {
                await( await deployed.ton.connect(deployer).transfer(accountOwnerAddress, amount)).wait()
            }
            // tonBalanceOf = await deployed.ton.balanceOf(accountOwnerAddress)
            // console.log('tonBalanceOf', tonBalanceOf)
        })

        // 토큰 승인이 0이고, 토큰 예치금이 없다면 실패한다.
        it('# 3. simulateValidation : revert: token allowance of account is zero and tokenDeposit is zero', async () => {
            let feeTokenAddress = deployed.ton.address
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);

            const userOp = await fillAndSign({
                sender: accountOwnerAddress,
                initCode: getAccountInitCode(addr1Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr1, deployed.tokamakEntryPoint)

            // console.log(userOp)

            await expect( deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp))
                .to.be.revertedWith("AA33 reverted: DepositPaymaster: allowance(balance) or deposit is insufficient")
        });

        it('# 4. simulateValidation : revert if Account did not deployed and initCode is null', async () => {
            let feeTokenAddress = deployed.ton.address
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);
            // const amount = ethers.utils.parseEther("2")
            // await( await deployed.ton.connect(deployer).transfer(accountOwnerAddress, amount)).wait()
            const amount = ethers.utils.parseEther("2")
            await tonDepositTo(deployed, accountOwnerAddress, amount);

            let userOp = await fillAndSign({
                sender: accountOwnerAddress,
                nonce: 0,
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr1, deployed.tokamakEntryPoint)

            userOp.verificationGasLimit = 0
            await expect(deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp))
                .to.be.revertedWith("AA20 account not deployed");
        });


        it('# 5. simulateValidation : revert if zero verificationGasLimit  ', async () => {
            let feeTokenAddress = deployed.ton.address
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);
            const amount = ethers.utils.parseEther("2")
            await( await deployed.ton.connect(deployer).transfer(accountOwnerAddress, amount)).wait()

            let userOp = await fillAndSign({
                sender: accountOwnerAddress,
                initCode: getAccountInitCode(addr1Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr1, deployed.tokamakEntryPoint)

            userOp.verificationGasLimit = 0
            await expect(deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp))
                .to.be.revertedWith("AA23 reverted (or OOG)");

        });

        it('# 6. simulateValidation : revert if invalid signature length', async () => {
            let feeTokenAddress = deployed.ton.address
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);
            const amount = ethers.utils.parseEther("2")
            await( await deployed.ton.connect(deployer).transfer(accountOwnerAddress, amount)).wait()

            let userOp = await fillAndSign({
                sender: accountOwnerAddress,
                initCode: getAccountInitCode(addr1Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr1, deployed.tokamakEntryPoint)

            userOp.signature = '0x'

            await expect(deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp))
                .to.be.revertedWith("AA23 reverted: ECDSA: invalid signature length");

        });

        it('# 7. simulateValidation : revert if invalid signature', async () => {
            let feeTokenAddress = deployed.ton.address
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);
            const amount = ethers.utils.parseEther("2")
            await( await deployed.ton.connect(deployer).transfer(accountOwnerAddress, amount)).wait()

            let userOp = await fillAndSign({
                sender: accountOwnerAddress,
                initCode: getAccountInitCode(addr1Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr1, deployed.tokamakEntryPoint)

            userOp.signature = '0xb2e4e274f9f2b7e3588956cd0a55c72fcaf63ba01c230d8f871d2a60de5bba675b30a59534251dfb3d24ca7033c4c32f397407236afb949a832908c57ee6d15110'

            await expect(deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp))
                .to.be.revertedWith("AA23 reverted: ECDSA: invalid signature");
        });

        it('# 8. simulateValidation : revert if accountContract is already deployed and iniCode is not null', async () => {
            let feeTokenAddress = deployed.ton.address
            let callData = await sampleCalldata(deployed , addr2 , addr2Address);
            let accountAddress = await createAndApproveToPaymaster(deployed, addr2, addr2Address)
            // console.log('accountAddress',accountAddress)
            let tonBalanceOf = await deployed.ton.balanceOf(accountAddress)
            const amount = ethers.utils.parseEther("10")
            if(tonBalanceOf.eq(ethers.constants.Zero)) {
                await( await deployed.ton.connect(deployer).transfer(accountAddress, amount)).wait()
            }

            const userOp = await fillAndSign({
                sender: accountAddress,
                initCode: getAccountInitCode(addr2Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr2, deployed.tokamakEntryPoint)

            await expect( deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp))
                .to.be.revertedWith("AA10 sender already constructed")
        });

        // 토큰 승인이 0라면, 토큰 예치금이 있으면 가능하다.
        it('# 9. simulateValidation : success if token allowance of account is zero, but tokenDeposit is not zero', async () => {
            let feeTokenAddress = deployed.ton.address
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);
            let ValidationResult
            const amount = ethers.utils.parseEther("2")
            await tonDepositTo(deployed, accountOwnerAddress, amount);

            const userOp = await fillAndSign({
                sender: accountOwnerAddress,
                initCode: getAccountInitCode(addr1Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr1, deployed.tokamakEntryPoint)

            // console.log(userOp)
            // await deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp)
            try {
                await deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp)
                } catch (e: any) {
                    // console.log('e',e)
                    if ((e as Error).message.includes('ValidationResult')) {
                        let message = (e as Error).message
                        ValidationResult = parseValidationResult(message)
                    } else {
                        expect(e.message).to.include('FailedOp(0, "AA23 reverted (or OOG)")')
                    }
                }
                expect(ValidationResult?.returnInfo.preOpGas).to.be.gt(ethers.constants.Zero)
                /*
                if(ValidationResult) {
                    //the gas used for validation (including preValidationGas)
                    // console.log('preOpGas : ',  ValidationResult.returnInfo.preOpGas.toString())

                    // the required prefund for this operation
                    // console.log('prefund : ', ValidationResult.returnInfo.prefund.toString() )

                    //abi.encode(account, token, gasPriceUserOp, maxTokenCost, maxCost)
                    //paymaster.validatePaymasterUserOp return paymasterContext
                    // console.log('paymasterContext : ', ValidationResult.returnInfo.paymasterContext  )
                    let paymasterContext = defaultAbiCoder.decode(["address","address","uint256","uint256","uint256"],ValidationResult.returnInfo.paymasterContext)
                    // console.log('paymasterContext : ', paymasterContext )
                }*/

        });


        // 토큰 예치금이 없는 경우에는 토큰 승인이 0보다 크고, 잔액이 있으면 된다.
        it('# 10. simulateValidation : success if token deposit is zero, accountContract is created and approve token and token balance is enough.', async () => {
            let feeTokenAddress = deployed.ton.address
            let ValidationResult
            let accountAddress = await deployed.tokamakAccountFactory.getAddress(addr2.address, 0)
            // console.log('accountAddress',accountAddress)
            expect(await ethers.provider.getCode(accountAddress)).to.be.not.equal('0x')

            let callData = await sampleCalldata(deployed , addr2 , addr2Address);

            const userOp = await fillAndSign({
                sender: accountAddress,
                // initCode: getAccountInitCode(addr2Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr2, deployed.tokamakEntryPoint)

            try {
                await deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp)
                } catch (e: any) {
                    // console.log('e',e)
                    if ((e as Error).message.includes('ValidationResult')) {
                        let message = (e as Error).message
                        ValidationResult = parseValidationResult(message)
                        // const tx = await deployed.tokamakEntryPoint.handleOps([userOp], addr1Address, { gasLimit: 1e6 })
                        // await tx.wait()
                    } else {
                        // expect(e.message).to.include('FailedOp(0, "AA23 reverted (or OOG)")')
                    }
                }
                expect(ValidationResult?.returnInfo.preOpGas).to.be.gt(ethers.constants.Zero)
                /*
                if(ValidationResult) {
                    //the gas used for validation (including preValidationGas)
                    // console.log('preOpGas : ',  ValidationResult.returnInfo.preOpGas.toString())

                    // the required prefund for this operation
                    // console.log('prefund : ', ValidationResult.returnInfo.prefund.toString() )

                    //abi.encode(account, token, gasPriceUserOp, maxTokenCost, maxCost)
                    //paymaster.validatePaymasterUserOp return paymasterContext
                    // console.log('paymasterContext : ', ValidationResult.returnInfo.paymasterContext  )
                    let paymasterContext = defaultAbiCoder.decode(["address","address","uint256","uint256","uint256"],ValidationResult.returnInfo.paymasterContext)
                    // console.log('paymasterContext : ', paymasterContext )
                }
                */
        });

        it('# 11. handleOps : success if token allowance of account is zero, but tokenDeposit is not zero', async () => {
            let feeTokenAddress = deployed.ton.address
            let callData = await sampleCalldata(deployed , addr1 , addr2Address);
            let ValidationResult
            let deployedUserOperationEvent
            const amount = ethers.utils.parseEther("2")
            await tonDepositTo(deployed, accountOwnerAddress, amount);

            let prefund = ethers.constants.Zero
            let depositInfoPrev = await deployed.tokamakEntryPoint.getDepositInfo(
                deployed.tokamakPaymaster.address
            );
            // console.log('depositInfoPrev.deposit', depositInfoPrev.deposit)

            let beneficiaryBalanceEthPrev = await deployed.beneficiary.getBalance()
            let beneficiaryBalanceTon = await deployed.ton.balanceOf(deployed.beneficiary.address)


            const userOp = await fillAndSign({
                sender: accountOwnerAddress,
                initCode: getAccountInitCode(addr1Address, deployed.tokamakAccountFactory),
                callData: callData,
                paymasterAndData: hexConcat([deployed.tokamakPaymaster.address, hexZeroPad(feeTokenAddress, 20)]),
            }, addr1, deployed.tokamakEntryPoint)
            // console.log(userOp)
            try {
                await deployed.tokamakEntryPoint.callStatic.simulateValidation(userOp)
                } catch (e: any) {
                    // console.log('e',e)
                    if ((e as Error).message.includes('ValidationResult')) {
                        let message = (e as Error).message
                        ValidationResult = parseValidationResult(message)
                        if(ValidationResult) {
                            //the gas used for validation (including preValidationGas)
                            // console.log('preOpGas : ',  ValidationResult.returnInfo.preOpGas.toString())

                            // the required prefund for this operation
                            // console.log('prefund : ', ValidationResult.returnInfo.prefund.toString() )
                            prefund = BigNumber.from(ValidationResult.returnInfo.prefund.toString())
                            //abi.encode(account, token, gasPriceUserOp, maxTokenCost, maxCost)
                            //paymaster.validatePaymasterUserOp return paymasterContext
                            // console.log('paymasterContext : ', ValidationResult.returnInfo.paymasterContext  )
                            let paymasterContext = defaultAbiCoder.decode(["address","address","uint256","uint256","uint256"],ValidationResult.returnInfo.paymasterContext)
                            // console.log('paymasterContext : ', paymasterContext )
                        }


                        //UserOperationEvent
                        const topic1 = deployed.tokamakEntryPoint.interface.getEventTopic('UserOperationEvent');
                        const topic2 = deployed.tokamakPaymaster.interface.getEventTopic('PostOp');
                        const receipt = await ( await deployed.tokamakEntryPoint.connect(deployer)
                            .handleOps([userOp], deployed.beneficiary.address, { gasLimit: 1e6 })).wait()
                        const logUserOperationEvent = receipt.logs.find(x => x.topics.indexOf(topic1) >= 0);
                        // const logPostOp = receipt.logs.find(x => x.topics.indexOf(topic2) >= 0);
                        // console.log(logUserOperationEvent)
                        deployedUserOperationEvent = deployed.tokamakEntryPoint.interface.parseLog(logUserOperationEvent);
                        // const deployedPostOp = deployed.tokamakPaymaster.interface.parseLog(logPostOp);

                        // console.log(deployedUserOperationEvent.args)
                        // console.log(deployedPostOp.args)
                        // actualGasCost = deployedEvent.args.actualGasCost
                    } else {
                        expect(e.message).to.include('FailedOp(0, "AA23 reverted (or OOG)")')
                    }
                }

                // expect(deployedUserOperationEvent?.args.userOpHash).to.be.not.eq(ethers.constants.Zero)
                expect(deployedUserOperationEvent?.args.sender).to.be.eq(accountOwnerAddress)
                expect(deployedUserOperationEvent?.args.paymaster).to.be.eq(deployed.tokamakPaymaster.address)
                expect(deployedUserOperationEvent?.args.nonce).to.be.eq(userOp.nonce)
                expect(deployedUserOperationEvent?.args.success).to.be.eq(true)
                expect(deployedUserOperationEvent?.args.actualGasCost).to.be.gt(ethers.constants.Zero)
                let depositInfoAfter = await deployed.tokamakEntryPoint.getDepositInfo(
                    deployed.tokamakPaymaster.address
                );
                expect(deployedUserOperationEvent?.args.actualGasCost)
                    .to.be.eq(depositInfoPrev.deposit.sub(depositInfoAfter.deposit))

                let beneficiaryBalanceEthAfter = await deployed.beneficiary.getBalance()
                expect(deployedUserOperationEvent?.args.actualGasCost)
                    .to.be.eq(beneficiaryBalanceEthAfter.sub(beneficiaryBalanceEthPrev))

        });
    });

});

