import { expect } from './shared/expect'
import { ethers, network } from 'hardhat'

import { Signer } from 'ethers'
import { tokamakFixtures } from './shared/fixtures'
import { TokamakFixture } from './shared/fixtureInterfaces'
import { FeeAmount, encodePath } from "./shared/utils"
import TokamakAccount from '../artifacts/contracts/TokamakAccount.sol/TokamakAccount.json'

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

        it('setFixedPrice', async () => {
            const priceTon = ethers.utils.parseEther("1000")
            const priceTos = ethers.utils.parseEther("800")

            await (await deployed.tokamakOracle.connect(deployer).setFixedPrice(
                priceTon, priceTos
                )).wait()

            expect(await deployed.tokamakOracle.fixedPriceTONPerETH()).to.be.eq(
                priceTon)
            expect(await deployed.tokamakOracle.fixedPriceTOSPerETH()).to.be.eq(
                priceTos)
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
        it('tokamakAccountFactory makeㄴ TokamakAccount', async () => {
            accountOwnerAddress = await deployed.tokamakAccountFactory.getAddress(addr1.address, 0)
            expect(await ethers.provider.getCode(accountOwnerAddress)).to.be.equal('0x')

            const topic = deployed.tokamakAccountFactory.interface.getEventTopic('CreatedAccount');
            const receipt = await (await deployed.tokamakAccountFactory["createAccount(address,uint256)"](addr1.address, 0)).wait()
            const log = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
            const deployedEvent = deployed.tokamakAccountFactory.interface.parseLog(log);

            expect(deployedEvent.args.account).to.be.eq(accountOwnerAddress)
            expect(await ethers.provider.getCode(accountOwnerAddress)).to.be.not.equal('0x')
            expect(deployedEvent.args.account).to.be.eq(accountOwnerAddress)

        });
        it('# simulateValidation : addr1 ', async () => {
            const userOp: UserOperation = {
                sender: maliciousAccount.address,
                nonce: await deployed.tokamakEntryPoint.getNonce(maliciousAccount.address, 0),
                signature: defaultAbiCoder.encode(['uint256'], [block.baseFeePerGas]),
                initCode: '0x',
                callData: '0x',
                callGasLimit: '0x' + 1e5.toString(16),
                verificationGasLimit: '0x' + 1e5.toString(16),
                preVerificationGas: '0x' + 1e5.toString(16),
                // we need maxFeeperGas > block.basefee + maxPriorityFeePerGas so requiredPrefund onchain is basefee + maxPriorityFeePerGas
                maxFeePerGas: block.baseFeePerGas.mul(3),
                maxPriorityFeePerGas: block.baseFeePerGas,
                paymasterAndData: '0x'
              }

            const UserOperation = {
                sender : addr1Address
                nonce : await addr1;
                initCode;
                 callData;
                 callGasLimit;
                uint256 verificationGasLimit;
                uint256 preVerificationGas;
                uint256 maxFeePerGas;
                uint256 maxPriorityFeePerGas;
                bytes paymasterAndData;
                bytes signature;
            }

            const userOp = await fillAndSign({
                sender: account.address,
                paymasterAndData: paymaster.address
              }, ethersSigner, entryPoint)
        });

        it('# simulateValidation : using PayMaster', async () => {
            const userOp = await fillAndSign({
                sender: account.address,
                paymasterAndData: paymaster.address
              }, ethersSigner, entryPoint)
        });


        it('# handleAggregatedOps ', async () => {
            const amount = ethers.utils.parseEther("0.1")
            let unstakeDelaySec = 1000

            await (await deployed.tokamakEntryPoint.connect(addr1).addStake(unstakeDelaySec, {value:amount})).wait()

            let depositInfo = await deployed.tokamakEntryPoint.getDepositInfo(addr1Address)
            expect(depositInfo.staked).to.be.eq(true)
            expect(depositInfo.stake).to.be.eq(amount)
            expect(depositInfo.unstakeDelaySec).to.be.eq(unstakeDelaySec)
        });

        it('# simulateHandleOp ', async () => {
        });

    });

});

