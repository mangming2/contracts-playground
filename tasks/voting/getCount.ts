import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:getCount")
    .addParam("account", "Specify which account [0, 9]")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { fhenixjs, ethers, deployments } = hre;
        const [signer] = await ethers.getSigners();

        const Counter = await deployments.get("Counter");

        const signers = await ethers.getSigners();

        const counter = await ethers.getContractAt("Counter", Counter.address);

        let permit = await fhenixjs.generatePermit(
            counter.address,
            undefined, // use the internal provider
            signer,
        );

        const eAmount = await counter.connect(signers[taskArguments.account]).getCounter(permit.publicKey);
        const amount = fhenixjs.unseal(Counter.address, eAmount);
        console.log("Current counter: ", amount);
    });