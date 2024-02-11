import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FHERC20 } from "../../typechain-types";

task("task:mint")
  .addParam("amount", "Amount to transfer (plaintext number)", "1")
  .addOptionalParam("to", "Destination address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { fhenixjs, ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    let signerAddress = await signer.getAddress();
    const amountToAdd = Number(taskArguments.amount);

    let destinationAddress = taskArguments?.to || signerAddress;

    const Counter = await deployments.get("FHERC20");

    console.log(
      `Running addCount(${amountToAdd}), targeting contract at: ${Counter.address}`,
    );

    const contract = await ethers.getContractAt("FHERC20", Counter.address);

    const encyrptedAmount = await fhenixjs.encrypt_uint32(amountToAdd);

    let contractWithSigner = contract.connect(signer) as unknown as FHERC20;

    try {
      await contractWithSigner.mintEncrypted(encyrptedAmount);
    } catch (e) {
      console.log(`transfer balance: ${e}`);
      return;
    }
  });
