const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  // Get deployment info
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("🚀 Deploying SimpleDocumentSharing contract...");
  console.log("📡 Network:", network.name, "(" + network.chainId + ")");
  console.log("🔑 Deploying with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "MATIC");
  
  if (balance === 0n) {
    console.error("❌ Deployer account has no MATIC for gas fees!");
    console.error("   Get test MATIC from: https://faucet.polygon.technology/");
    process.exit(1);
  }

  // Deploy contract
  console.log("\n📋 Deploying contract...");
  const SimpleDocumentSharing = await ethers.getContractFactory("SimpleDocumentSharing");
  const documentSharing = await SimpleDocumentSharing.deploy();

  // Wait for deployment
  await documentSharing.waitForDeployment();
  const contractAddress = await documentSharing.getAddress();

  console.log("✅ SimpleDocumentSharing deployed to:", contractAddress);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  try {
    const owner = await documentSharing.owner();
    console.log("📋 Contract owner:", owner);
    console.log("🔗 Contract verified successfully!");
  } catch (error) {
    console.error("❌ Contract verification failed:", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    deployer: deployer.address,
    network: network.name,
    chainId: network.chainId.toString(),
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    txHash: documentSharing.deploymentTransaction()?.hash
  };

  const deploymentFile = `deployment-${network.name}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentFile);

  // Update .env file
  console.log("\n📝 Next steps:");
  console.log("1. Update your .env file with:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
  console.log("2. Restart your backend server");
  console.log("3. Test the blockchain integration");

  if (network.name === "mumbai" || network.name === "polygon") {
    console.log(`4. Verify on PolygonScan: https://${network.name === "mumbai" ? "mumbai." : ""}polygonscan.com/address/${contractAddress}`);
  }

  return {
    contractAddress,
    deploymentInfo
  };
}

// Execute deployment
main()
  .then((result) => {
    console.log("\n🎉 Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });