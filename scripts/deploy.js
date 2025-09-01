const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

async function deployContract() {
  try {
    // Check environment variables
    if (!process.env.POLYGON_RPC_URL) {
      throw new Error('POLYGON_RPC_URL not set in environment');
    }
    
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not set in environment');
    }

    console.log('🚀 Starting contract deployment...');
    
    // Connect to network
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('📡 Connected to network');
    console.log('🔑 Deployer address:', wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Deployer balance:', ethers.formatEther(balance), 'MATIC');
    
    if (balance === 0n) {
      throw new Error('Deployer wallet has no MATIC for gas fees');
    }

    // Read smart contract
    const contractPath = './contracts/SimpleDocumentSharing.sol';
    if (!fs.existsSync(contractPath)) {
      throw new Error('Smart contract file not found');
    }

    const contractSource = fs.readFileSync(contractPath, 'utf8');
    
    // Note: In a real deployment, you'd compile the contract first
    // For now, we'll provide deployment instructions
    console.log('\n📋 Contract deployment instructions:');
    console.log('1. Compile the smart contract using Hardhat, Truffle, or Remix');
    console.log('2. Deploy using your preferred deployment tool');
    console.log('3. Update the CONTRACT_ADDRESS in your .env file');
    
    console.log('\n🔗 Contract file location:', contractPath);
    console.log('📄 Contract size:', contractSource.length, 'characters');
    
    // Example Hardhat deployment command
    console.log('\n🛠️  Example Hardhat deployment:');
    console.log('   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox');
    console.log('   npx hardhat init');
    console.log('   # Copy contract to contracts/ directory');
    console.log('   npx hardhat compile');
    console.log('   npx hardhat run scripts/deploy.js --network polygon_mumbai');

    // Example deployment script for reference
    const exampleDeployScript = `
// Example Hardhat deployment script (scripts/deploy.js)
const { ethers } = require("hardhat");

async function main() {
  const SimpleDocumentSharing = await ethers.getContractFactory("SimpleDocumentSharing");
  const documentSharing = await SimpleDocumentSharing.deploy();

  await documentSharing.waitForDeployment();

  console.log("SimpleDocumentSharing deployed to:", documentSharing.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;

    console.log('\n📝 Example deployment script:');
    console.log(exampleDeployScript);
    
    return true;
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    return false;
  }
}

// Verify contract deployment
async function verifyDeployment(contractAddress) {
  try {
    if (!contractAddress) {
      throw new Error('Contract address not provided');
    }

    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    // Check if contract exists
    const code = await provider.getCode(contractAddress);
    
    if (code === '0x') {
      throw new Error('No contract found at the provided address');
    }

    console.log('✅ Contract verified at:', contractAddress);
    console.log('📏 Contract size:', code.length, 'bytes');
    
    return true;
  } catch (error) {
    console.error('❌ Contract verification failed:', error.message);
    return false;
  }
}

// Initialize contract for testing
async function initializeContract(contractAddress) {
  try {
    const CONTRACT_ABI = [
      "function addDocument(bytes32 documentId, string calldata ipfsHash, string calldata metadata) external",
      "function hasAccess(bytes32 documentId, address user) external view returns (bool)",
      "function owner() external view returns (address)"
    ];

    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    
    // Test basic contract function
    const owner = await contract.owner();
    console.log('📋 Contract owner:', owner);
    console.log('🔗 Contract initialized successfully');
    
    return contract;
  } catch (error) {
    console.error('❌ Contract initialization failed:', error.message);
    return null;
  }
}

// Main function
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'deploy':
      await deployContract();
      break;
      
    case 'verify':
      const contractAddress = process.argv[3];
      if (!contractAddress) {
        console.error('Please provide contract address: npm run deploy verify <address>');
        return;
      }
      await verifyDeployment(contractAddress);
      break;
      
    case 'init':
      const initAddress = process.argv[3];
      if (!initAddress) {
        console.error('Please provide contract address: npm run deploy init <address>');
        return;
      }
      await initializeContract(initAddress);
      break;
      
    default:
      console.log('📚 Available commands:');
      console.log('   npm run deploy deploy    - Show deployment instructions');
      console.log('   npm run deploy verify <address>  - Verify deployed contract');
      console.log('   npm run deploy init <address>    - Initialize contract for testing');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  deployContract,
  verifyDeployment,
  initializeContract
};