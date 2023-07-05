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

        it('onlyOwner can add token', async () => {
            await deployed
        });


    });

    describe('# setPoolPathes', () => {

        it('create non mint-able token', async () => {

        });

    });

    describe('# getTokenValueOfEth', () => {

        it('create non mint-able token', async () => {

        });

    });

});

