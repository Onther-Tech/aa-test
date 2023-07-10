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

        it('depositTo', async () => {
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

        it('addStake', async () => {
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

    });

    describe('# getTokenValueOfEth', () => {

    });

});

