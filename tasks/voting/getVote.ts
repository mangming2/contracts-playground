import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import {Voting} from "../../typechain-types";

task("task:getVote")
    .addOptionalParam("account", "Specify which account [0, 9]", "0")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { fhenixjs, ethers, deployments } = hre;

        const Voting = await deployments.get("Voting");

        const signers = await ethers.getSigners();
        const signer = signers[Number(taskArguments.account)];

        console.log(`getting vote for contract at: ${Voting.address}, for signer: ${signer.address}`);

        const voting = await ethers.getContractAt("Voting", Voting.address);
        let contractWithSigner = voting.connect(signer) as unknown as Voting;

        const permit = await fhenixjs.generatePermit(
            Voting.address,
            undefined,
            signers[taskArguments.account]
        );

        const userVote = await contractWithSigner.getUserVote(permit);
        const decryptedVote = fhenixjs.unseal(Voting.address, userVote);

        console.log(`Account voted: ${decryptedVote}`);
    });