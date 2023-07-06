import { expect } from './shared/expect'
import { ethers, network } from 'hardhat'

import { Signer } from 'ethers'
import { tokamakFixtures } from './shared/fixtures'
import { TokamakFixture } from './shared/fixtureInterfaces'

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

    describe('# setFixedPrice', () => {

        it('onlyOwner : revert ', async () => {
            const priceTon = ethers.utils.parseEther("1000")
            const priceTos = ethers.utils.parseEther("800")

            await expect(deployed.tokamakOracle.connect(addr1).setFixedPrice(
                priceTon, priceTos
                )).to.be.revertedWith("Ownable: caller is not the owner")

        });

        it('onlyOwner', async () => {
            const priceTon = ethers.utils.parseEther("1000")
            const priceTos = ethers.utils.parseEther("800")

            await (await deployed.tokamakOracle.connect(deployer).setFixedPrice(
                priceTon, priceTos
                )).wait()

            expect(await deployed.tokamakOracle.ton()).to.be.eq(deployed.ton.address)
            expect(await deployed.tokamakOracle.oracleLibrary()).to.be.eq(deployed.oracleLibrary.address)
            expect(await deployed.tokamakOracle.uniswapV3Factory()).to.be.eq(deployed.uniswapV3FactoryAddress)

        });
    })

    describe('# addTokenPricePaths', () => {
        it('onlyOwner : revert ', async () => {
            const priceTon = ethers.utils.parseEther("1000")
            const priceTos = ethers.utils.parseEther("800")

            await expect(deployed.tokamakOracle.connect(addr1).setFixedPrice(
                priceTon, priceTos
                )).to.be.revertedWith("Ownable: caller is not the owner")

        });

        it('onlyOwner', async () => {

        });
    })

    // describe('# setPoolPathes', () => {

    //     it('create non mint-able token', async () => {

    //     });

    // });

    // describe('# getTokenValueOfEth', () => {

    //     it('create non mint-able token', async () => {

    //     });

    // });

});

