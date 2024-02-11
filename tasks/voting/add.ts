import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:addCount")
    .addParam("amount", "Amount to add to the counter (plaintext number)")
    .addParam("account", "Specify which account [0, 9]")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { fhenixjs, ethers, deployments } = hre;
        const [signer] = await ethers.getSigners();
        let signerAddress = await signer.getAddress();

        const Counter = await deployments.get("Counter");

        const signers = await ethers.getSigners();

        const counter = await ethers.getContractAt("Counter", Counter.address);

        console.log(`contract at: ${Counter.address}, for signer: ${signers[taskArguments.account].address}`);

        const eAmount = await fhenixjs.encrypt_uint32(Number(taskArguments.amount));

        await counter.connect(signers[Number(taskArguments.account)]).add(eAmount);

        console.log(`Added ${taskArguments.amount} to counter!`);
    });