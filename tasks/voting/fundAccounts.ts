import { task } from "hardhat/config";

task("task:fundAccounts", "Prints the list of accounts", async (_taskArgs, hre) => {
    const { ethers } = hre;
    const accounts = await hre.ethers.getSigners();

    const fundingAcct = accounts[0];

    let amountInWei = ethers.utils.parseEther("0.1");

    for (let i = 1; i < accounts.length; i++) {
        const account = accounts[i];
        await fundingAcct.sendTransaction({ to: account.address, value: amountInWei });
        console.log(account.address);
    }
});