const { ethers } = require("hardhat");

const ownerAddress = '0xc1eba383D94c6021160042491A5dfaF1d82694E6'
//TokamakEntryPoint 0x444Baeef99eD68B14A3D67Cc1452D8f8Aa406136
const TokamakEntryPoint = '0x444Baeef99eD68B14A3D67Cc1452D8f8Aa406136'

async function main() {

  const TokamakPaymaster = await ethers.getContractFactory("TokamakPaymaster");
  const tokamakPaymaster = await TokamakPaymaster.deploy(
    TokamakEntryPoint);

  let tx = await tokamakPaymaster.deployed();

  // console.log(tx)

  console.log('TokamakPaymaster' , tokamakPaymaster.address)

  // deployed firstEvent 0x63c95fbA722613Cb4385687E609840Ed10262434
  // startTime 설정해야 합니다!!
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
