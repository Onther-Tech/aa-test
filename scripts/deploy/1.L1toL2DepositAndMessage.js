const { ethers } = require("hardhat");

const ownerAddress = '0xc1eba383D94c6021160042491A5dfaF1d82694E6'
const paymaster = '0xF33C5E2ABE4c052783AAed527390A77FAD5841FA'

async function main() {

  // goerli
  let l1_TON_Address = "0x68c1F9620aeC7F2913430aD6daC1bb16D8444F00";
  let LibMessenger_Address = "0x7Ce2d12686dE696B9b4e67CB04E31D1F51d3b589";

  //==== LibMessenger =================================
  // const LibMessenger_ = await ethers.getContractFactory("LibMessenger");
  // const libMessenger = await LibMessenger_.deploy();
  // await libMessenger.deployed();
  // console.log('LibMessenger' , libMessenger.address)

  //==== L1toL2Message =================================
  const L1toL2DepositAndMessage_ = await ethers.getContractFactory("L1toL2DepositAndMessage", {
      libraries: { LibMessenger: LibMessenger_Address }
  });
  const l1toL2DepositAndMessage = await L1toL2DepositAndMessage_.deploy(l1_TON_Address);
  await l1toL2DepositAndMessage.deployed();
  console.log('L1toL2DepositAndMessage' , l1toL2DepositAndMessage.address)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
