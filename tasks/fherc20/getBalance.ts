import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FHERC20 } from "../../typechain-types";

task("task:getBalance").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { fhenixjs, ethers, deployments } = hre;
  const [signer] = await ethers.getSigners();

  const erc20 = await deployments.get("FHERC20");
  const address = await signer.getAddress();
  console.log(`Running getCount, targeting contract at: ${erc20.address}`);

  const contract = (await ethers.getContractAt(
    "FHERC20",
      erc20.address,
  )) as unknown as unknown as FHERC20;

  let permit = await fhenixjs.generatePermit(
      erc20.address,
    undefined, // use the internal provider
    signer,
  );

  const sealedResult = await contract.balanceOfEncrypted(address, permit);
  let unsealed = fhenixjs.unseal(erc20.address, sealedResult);

  console.log(`got balance result: ${unsealed.toString()}`);
});
