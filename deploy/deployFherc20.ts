import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { fhenixjs, ethers } = hre;
  const { deploy } = hre.deployments;
  const [signer] = await ethers.getSigners();

  if (hre.network.name === "localfhenix") {
    if (await signer.getBalance() < ethers.utils.parseEther("1.0")) {
      await fhenixjs.getFunds(signer.address);
    }
  }
  const counter = await deploy("FHERC20", {
    from: signer.address,
    args: ["token", "FHE"],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`fherc20 contract: `, counter.address);
};

export default func;
func.id = "deploy_fherc20";
func.tags = ["FHERC20"];
