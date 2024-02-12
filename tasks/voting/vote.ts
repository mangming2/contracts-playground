import { task } from "hardhat/config";
import type { ArgumentType, TaskArguments } from "hardhat/types";
import {Voting} from "../../typechain-types";

task("task:vote")
    .addParam("option", "Option to choose")
    .addOptionalParam("account", "Specify which account [0, 9]", "0")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { fhenixjs, ethers, deployments } = hre;

        const Voting = await deployments.get("Voting");

        const signers = await ethers.getSigners();
        const signer = signers[Number(taskArguments.account)];

        const voting = await ethers.getContractAt("Voting", Voting.address);

        console.log(`contract at: ${Voting.address}, for signer: ${signer.address}`);

        if (hre.network.name === "localfhenix") {
            if (await signer.getBalance() < ethers.utils.parseEther("1.0")) {
               await fhenixjs.getFunds(signer.address);
            }
        }

        const eOption = await fhenixjs.encrypt_uint8(Number(taskArguments.option));
        let contractWithSigner = voting.connect(signer) as unknown as Voting;

        console.time("voteDuration");
        const tx = await contractWithSigner.vote(eOption);
        console.timeEnd("voteDuration");
        console.log(`Voted for option ${taskArguments.option}!`);
        // console.log(`Result: ${JSON.stringify(tx)}`);
    });
