import { expect } from './shared/expect'
import { ethers, network } from 'hardhat'

import { Signer } from 'ethers'
import { tokamakFixtures } from './shared/fixtures'
import { TokamakFixture } from './shared/fixtureInterfaces'
import { FeeAmount, encodePath } from "./shared/utils"
import { bytes } from './solidityTypes'


describe('3.TokamakOracle.test', () => {
    let deployer: Signer, addr1: Signer, addr2:Signer;
    let deployed: TokamakFixture

    before('create fixture loader', async () => {
        deployed = await tokamakFixtures()
        deployer = deployed.deployer;
        addr1 = deployed.addr1;
        addr2 = deployed.addr2;
    })

    describe('# initialize', () => {

        it('onlyOwner : revert ', async () => {
            await expect(deployed.tokamakOracle.connect(addr1).initialize(
                deployed.ton.address,
                deployed.oracleLibrary.address,
                deployed.uniswapV3FactoryAddress)).to.be.revertedWith("Ownable: caller is not the owner")

        });

        it('onlyOwner', async () => {
            await (await deployed.tokamakOracle.connect(deployer).initialize(
                deployed.ton.address,
                deployed.oracleLibrary.address,
                deployed.uniswapV3FactoryAddress)).wait()

            expect(await deployed.tokamakOracle.ton()).to.be.eq(deployed.ton.address)
            expect(await deployed.tokamakOracle.oracleLibrary()).to.be.eq(deployed.oracleLibrary.address)
            expect(await deployed.tokamakOracle.uniswapV3Factory()).to.be.eq(deployed.uniswapV3FactoryAddress)

        });
    });

    describe('# setFixedTONPrice', () => {

        it('onlyOwner : revert ', async () => {
            const priceTon = ethers.utils.parseEther("1000")
            const priceTos = ethers.utils.parseEther("800")

            await expect(deployed.tokamakOracle.connect(addr1).setFixedTONPrice(
                priceTon
                )).to.be.revertedWith("Ownable: caller is not the owner")

        });

        it('onlyOwner', async () => {
            const priceTon = ethers.utils.parseEther("1000")
            const priceTos = ethers.utils.parseEther("800")

            await (await deployed.tokamakOracle.connect(deployer).setFixedTONPrice(
                priceTon
                )).wait()

            expect(await deployed.tokamakOracle.fixedPriceTONPerETH()).to.be.eq(
                priceTon)


        });
    })

    describe('# addTokenPricePaths', () => {
        it('onlyOwner : revert ', async () => {

            const weth_ton_path = encodePath(
                [deployed.wethAddress, deployed.ton.address], [FeeAmount.MEDIUM])


            await expect(deployed.tokamakOracle.connect(addr1).addTokenPricePaths(
                deployed.ton.address, [weth_ton_path]
                )).to.be.revertedWith("Ownable: caller is not the owner")

        });

        it('onlyOwner register ton as fee token.', async () => {

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

    })

    describe('# getTokenValueOfEth', () => {
        it('getTokenValueOfEth', async () => {
            const fixedPriceTONPerETH = await deployed.tokamakOracle.fixedPriceTONPerETH()
            let amount = ethers.BigNumber.from("10000")
            let amountTon = await deployed.tokamakOracle["getTokenValueOfEth(uint256)"](amount);
            let calcAmountTon = fixedPriceTONPerETH.mul(amount).div(ethers.utils.parseEther("1"));

            expect(amountTon).to.be.eq(calcAmountTon)

        });
    })

});

