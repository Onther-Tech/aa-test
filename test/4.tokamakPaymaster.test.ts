import { expect } from './shared/expect'
import { ethers, network } from 'hardhat'

import { Signer } from 'ethers'
import { tokamakFixtures } from './shared/fixtures'
import { TokamakFixture } from './shared/fixtureInterfaces'
import { FeeAmount, encodePath } from "./shared/utils"
import TokamakAccount from '../artifacts/contracts/TokamakAccount.sol/TokamakAccount.json'

describe('4.tokamakPaymaster.test', () => {
    let deployer: Signer, addr1: Signer, addr2:Signer;
    let deployed: TokamakFixture
    let addr1Address: string, addr2Address: string

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

        it('initialize', async () => {
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


    describe('# addToken', () => {

        it('onlyOwner : revert ', async () => {
            await expect(deployed.tokamakPaymaster.connect(addr1).addToken(
                deployed.ton.address,
                deployed.tokamakOracle.address )).to.be.revertedWith("Ownable: caller is not the owner")

        });

        it('onlyOwner', async () => {

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

    describe('# addDepositFor', () => {

        it('add deposit for ', async () => {
            const amount = ethers.utils.parseEther("1")
            let allowance = await deployed.ton.allowance(deployer.address, deployed.tokamakPaymaster.address);

            if (allowance.lt(amount)) {
               await( await deployed.ton.connect(deployer).approve(deployed.tokamakPaymaster.address, amount)).wait()
            }

            await (await deployed.tokamakPaymaster.connect(deployer).addDepositFor(
                deployed.ton.address,
                addr1Address,
                amount
            )).wait()

            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(depositInfo.amount).to.be.eq(amount)
        });

        it('add deposit for AccountContract.', async () => {
            let accountAddress = await deployed.tokamakAccountFactory.getAddress(addr1.address, 0)
            // await (await deployed.tokamakAccountFactory["createAccount(address,uint256)"](addr1.address, 0)).wait()
            // expect(await ethers.provider.getCode(accountAddress)).to.be.not.equal('0x')

            const amount = ethers.utils.parseEther("1")
            let allowance = await deployed.ton.allowance(deployer.address, deployed.tokamakPaymaster.address);

            if (allowance.lt(amount)) {
               await( await deployed.ton.connect(deployer).approve(deployed.tokamakPaymaster.address, amount)).wait()
            }

            await (await deployed.tokamakPaymaster.connect(deployer).addDepositFor(
                deployed.ton.address,
                accountAddress,
                amount
            )).wait()

            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                accountAddress,
            );
            expect(depositInfo.amount).to.be.eq(amount)
        });
    });

    describe('# unlockTokenDeposit', () => {

        it('unlockTokenDeposit', async () => {
            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(depositInfo._unlockBlock).to.be.eq(0)
            await (await deployed.tokamakPaymaster.connect(addr1).unlockTokenDeposit()).wait()
            depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(depositInfo._unlockBlock).to.be.gt(0)
        });

        it('unlockTokenDeposit', async () => {
            let accountAddress = await deployed.tokamakAccountFactory.getAddress(addr1.address, 0)
            await (await deployed.tokamakAccountFactory["createAccount(address,uint256)"](addr1.address, 0)).wait()
            expect(await ethers.provider.getCode(accountAddress)).to.be.not.equal('0x')
            const tokamakAccount = await ethers.getContractAt(TokamakAccount.abi, accountAddress, addr1)

            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                accountAddress,
            );
            expect(depositInfo._unlockBlock).to.be.eq(0)


            const func = deployed.tokamakPaymaster.interface.encodeFunctionData("unlockTokenDeposit", []);

            await (await tokamakAccount.connect(addr1).execute(
                    deployed.tokamakPaymaster.address,
                    ethers.constants.Zero,
                    func
                )).wait()

            depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                accountAddress,
            );
            expect(depositInfo._unlockBlock).to.be.gt(0)
        });

    });

    describe('# lockTokenDeposit', () => {

        it('lockTokenDeposit', async () => {
            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(depositInfo._unlockBlock).to.be.gt(0)
            await (await deployed.tokamakPaymaster.connect(addr1).lockTokenDeposit()).wait()
            depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(depositInfo._unlockBlock).to.be.eq(0)
        });

        it('lockTokenDeposit', async () => {
            let accountAddress = await deployed.tokamakAccountFactory.getAddress(addr1.address, 0)
            const tokamakAccount = await ethers.getContractAt(TokamakAccount.abi, accountAddress, addr1)

            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                accountAddress,
            );
            expect(depositInfo._unlockBlock).to.be.gt(0)


            const func = deployed.tokamakPaymaster.interface.encodeFunctionData("lockTokenDeposit", []);

            await (await tokamakAccount.connect(addr1).execute(
                    deployed.tokamakPaymaster.address,
                    ethers.constants.Zero,
                    func
                )).wait()

            depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                accountAddress,
            );
            expect(depositInfo._unlockBlock).to.be.eq(0)
        });

    });

    describe('# withdrawTokensTo', () => {
        it('revert: when _unlockBlock is zero', async () => {
            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(depositInfo._unlockBlock).to.be.eq(0)
            const amount = ethers.utils.parseEther("1")
            await expect(deployed.tokamakPaymaster.connect(addr1).withdrawTokensTo(
                deployed.ton.address,
                addr1Address,
                amount
            )).to.be.rejectedWith("DepositPaymaster: must unlockTokenDeposit")
        });

        it('withdrawTokensTo: when _unlockBlock is not zero and unlockTokenDeposit', async () => {
            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(depositInfo._unlockBlock).to.be.eq(0)
            await (await deployed.tokamakPaymaster.connect(addr1).unlockTokenDeposit()).wait()
            depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(depositInfo._unlockBlock).to.be.gt(0)

            let depositTon = depositInfo.amount
            let balanceTon = await deployed.ton.balanceOf(addr1Address)
            const amount = ethers.utils.parseEther("1")
            await (await deployed.tokamakPaymaster.connect(addr1).withdrawTokensTo(
                deployed.ton.address,
                addr1Address,
                amount
            )).wait()

            let depositInfo2 = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(await deployed.ton.balanceOf(addr1Address)).to.be.eq(balanceTon.add(amount))
            expect(depositInfo2.amount).to.be.eq(depositTon.sub(amount))
        });

        it('withdrawTokensTo: when _unlockBlock is not zero and unlockTokenDeposit', async () => {
            let accountAddress = await deployed.tokamakAccountFactory.getAddress(addr1.address, 0)
            const tokamakAccount = await ethers.getContractAt(TokamakAccount.abi, accountAddress, addr1)

            let depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                accountAddress,
            );
            expect(depositInfo._unlockBlock).to.be.eq(0)

            //
            const func = deployed.tokamakPaymaster.interface.encodeFunctionData("unlockTokenDeposit", []);
            await (await tokamakAccount.connect(addr1).execute(
                    deployed.tokamakPaymaster.address,
                    ethers.constants.Zero,
                    func
                )).wait()
            //

            depositInfo = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                accountAddress,
            );
            expect(depositInfo._unlockBlock).to.be.gt(0)

            let depositTon = depositInfo.amount
            let balanceTon = await deployed.ton.balanceOf(addr1Address)
            const amount = ethers.utils.parseEther("1")
            //
            const func1 = deployed.tokamakPaymaster.interface.encodeFunctionData(
                "withdrawTokensTo",
                [
                    deployed.ton.address,
                    addr1Address,
                    amount
                ]);
            await (await tokamakAccount.connect(addr1).execute(
                    deployed.tokamakPaymaster.address,
                    ethers.constants.Zero,
                    func1
                )).wait()
            //

            let depositInfo2  = await deployed.tokamakPaymaster.depositInfo(
                deployed.ton.address,
                addr1Address,
            );
            expect(await deployed.ton.balanceOf(addr1Address)).to.be.eq(balanceTon.add(amount))
            expect(depositInfo2.amount).to.be.eq(depositTon.sub(amount))
        });

    });

    describe('# deposit', () => {

        it('# deposit ', async () => {
            const amount = ethers.utils.parseEther("1")

            await deployer.sendTransaction({
                to: addr1Address,
                value: amount
            })
            const balanceAddr1 = await addr1.getBalance()

            const balanceDeposit = await deployed.tokamakPaymaster.getDeposit()
            await (await deployed.tokamakPaymaster.connect(addr1).deposit({value: amount})).wait()
            expect(await addr1.getBalance()).to.be.lt(balanceAddr1.sub(amount))
            expect(await deployed.tokamakPaymaster.getDeposit()).to.be.eq(balanceDeposit.add(amount))

        });
    });

    describe('# withdrawTo', () => {

        it('# revert: not Owner', async () => {
            const amount = ethers.utils.parseEther("0.1")
            await expect(deployed.tokamakPaymaster.connect(addr1).withdrawTo(addr1Address, amount)).
                to.be.rejectedWith("Ownable: caller is not the owner")
        });

        it('# withdrawTo ', async () => {

            const amount = ethers.utils.parseEther("0.1")

            const balanceAddr1 = await addr1.getBalance()
            const balanceDeposit = await deployed.tokamakPaymaster.getDeposit()

            await (await deployed.tokamakPaymaster.connect(deployer).withdrawTo(addr1Address, amount)).wait()

            expect(await addr1.getBalance()).to.be.eq(balanceAddr1.add(amount))
            expect(await deployed.tokamakPaymaster.getDeposit()).to.be.eq(balanceDeposit.sub(amount))

        });

    });

    describe('# withdrawStake : No stake to withdraw', () => {

        it('# revert: No stake to withdraw', async () => {
            await expect(deployed.tokamakPaymaster.connect(deployer).withdrawStake(addr1Address)).
                to.be.revertedWith("No stake to withdraw")
        });

    });

    describe('# addStake ', () => {

        it('# revert: not Owner ', async () => {
            const amount = ethers.utils.parseEther("0.1")
            let unstakeDelaySec = 1000

            await expect(deployed.tokamakPaymaster.connect(addr1).addStake(unstakeDelaySec)).
                to.be.rejectedWith("Ownable: caller is not the owner")
        });

        it('# addStake ', async () => {
            const amount = ethers.utils.parseEther("0.1")
            let unstakeDelaySec = 1000

            await (await deployed.tokamakPaymaster.connect(deployer).addStake(unstakeDelaySec, {value:amount})).wait()

            let depositInfo = await deployed.tokamakEntryPoint.getDepositInfo(deployed.tokamakPaymaster.address)

            // console.log(depositInfo)

            expect(depositInfo.staked).to.be.eq(true)
            expect(depositInfo.stake).to.be.eq(amount)
            expect(depositInfo.unstakeDelaySec).to.be.eq(unstakeDelaySec)
        });

    });

    describe('# withdrawStake : must call unlockStake() first', () => {

        it('# revert: must call unlockStake() first', async () => {
            await expect(deployed.tokamakPaymaster.connect(deployer).withdrawStake(addr1Address)).
                to.be.revertedWith("must call unlockStake() first")
        });

    });

    describe('# unlockStake  ', () => {

        it('# revert: not Owner ', async () => {
            await expect(deployed.tokamakPaymaster.connect(addr1).unlockStake()).
                to.be.rejectedWith("Ownable: caller is not the owner")
        });

        it('# unlockStake ', async () => {
            await(await deployed.tokamakPaymaster.connect(deployer).unlockStake()).wait()
        });

    });

    describe('# withdrawStake : Stake withdrawal is not due', () => {

        it('# revert: not Owner', async () => {
            await expect(deployed.tokamakPaymaster.connect(addr1).withdrawStake(addr1Address)).
                to.be.rejectedWith("Ownable: caller is not the owner")
        });

        it('# withdrawStake ', async () => {
            await expect(deployed.tokamakPaymaster.connect(deployer).withdrawStake(addr1Address)).
                to.be.rejectedWith("Stake withdrawal is not due")
        });

        it('# pass time ', async () => {
            let unstakeDelaySec = 1000
            ethers.provider.send("evm_increaseTime", [unstakeDelaySec])
            ethers.provider.send("evm_mine")
        });

        it('# withdrawStake ', async () => {
            let balance = await addr1.getBalance()
            let depositInfo1 = await deployed.tokamakEntryPoint.getDepositInfo(deployed.tokamakPaymaster.address)

            await deployed.tokamakPaymaster.connect(deployer).withdrawStake(addr1Address)
            let depositInfo2 = await deployed.tokamakEntryPoint.getDepositInfo(deployed.tokamakPaymaster.address)

            expect(depositInfo2.stake).to.be.eq(0)
            expect(depositInfo2.withdrawTime).to.be.eq(0)
            expect(depositInfo2.unstakeDelaySec).to.be.eq(0)
            expect(await addr1.getBalance()).to.be.eq(balance.add(depositInfo1.stake))

        });


    });

});

