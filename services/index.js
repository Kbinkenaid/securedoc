// Service loader - picks development or production services based on environment

// Check if we have blockchain credentials configured
const hasBlockchainConfig = process.env.POLYGON_RPC_URL && 
                           process.env.POLYGON_RPC_URL !== 'https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY' &&
                           process.env.PRIVATE_KEY && 
                           process.env.PRIVATE_KEY !== 'your_wallet_private_key_for_contract_deployment';

// Check if we have IPFS credentials configured
const hasIPFSConfig = process.env.IPFS_PROJECT_ID && 
                     process.env.IPFS_PROJECT_ID !== 'your_infura_ipfs_project_id' &&
                     process.env.IPFS_PROJECT_SECRET && 
                     process.env.IPFS_PROJECT_SECRET !== 'your_infura_ipfs_secret';

// Load appropriate services
let ipfsService, blockchainService;

if (hasIPFSConfig) {
  console.log('🌐 Using production IPFS service');
  ipfsService = require('./ipfs');
} else {
  console.log('🔧 Using development IPFS service (local storage)');
  const DevIPFSService = require('./ipfs-dev');
  ipfsService = new DevIPFSService();
}

if (hasBlockchainConfig) {
  console.log('⛓️  Using production blockchain service');
  blockchainService = require('./blockchain');
} else {
  console.log('🔧 Using development blockchain service (simulation)');
  const DevBlockchainService = require('./blockchain-dev');
  blockchainService = new DevBlockchainService();
}

// Export services
module.exports = {
  ipfsService,
  blockchainService,
  isDevelopmentMode: !hasBlockchainConfig || !hasIPFSConfig
};

// Log service status
console.log('\n📋 Service Configuration:');
console.log('   IPFS:', hasIPFSConfig ? 'Production (Infura)' : 'Development (Local)');
console.log('   Blockchain:', hasBlockchainConfig ? 'Production (Polygon)' : 'Development (Simulation)');
console.log('   Mode:', module.exports.isDevelopmentMode ? 'Development' : 'Production');