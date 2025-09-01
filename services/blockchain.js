const { ethers } = require('ethers');
const crypto = require('crypto');

// ABI for the SimpleDocumentSharing contract
const CONTRACT_ABI = [
  "function addDocument(bytes32 documentId, string calldata ipfsHash, string calldata metadata) external",
  "function grantAccess(bytes32 documentId, address user) external",
  "function revokeAccess(bytes32 documentId, address user) external",
  "function hasAccess(bytes32 documentId, address user) external view returns (bool)",
  "function getDocument(bytes32 documentId) external view returns (string memory ipfsHash, address documentOwner, uint256 createdAt, string memory metadata)",
  "function getDocumentAccessors(bytes32 documentId) external view returns (address[] memory)",
  "function batchGrantAccess(bytes32 documentId, address[] calldata users) external",
  "function removeDocument(bytes32 documentId) external",
  "event DocumentAdded(bytes32 indexed documentId, address indexed owner, string ipfsHash, string metadata)",
  "event AccessGranted(bytes32 indexed documentId, address indexed owner, address indexed user)",
  "event AccessRevoked(bytes32 indexed documentId, address indexed owner, address indexed user)"
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.userWallets = new Map(); // Cache for user wallets
    this.isConnected = false;
    this.gasPrice = null;
    this.gasLimit = 500000; // Default gas limit
    
    this.initializeProvider();
  }

  async initializeProvider() {
    try {
      // Initialize provider
      if (!process.env.POLYGON_RPC_URL) {
        throw new Error('POLYGON_RPC_URL not configured');
      }

      this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

      // Test connection
      await this.provider.getNetwork();
      console.log('Connected to Polygon network');

      // Initialize main wallet if private key is provided
      if (process.env.PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(
          process.env.CONTRACT_ADDRESS,
          CONTRACT_ABI,
          this.wallet
        );

        console.log('Blockchain service initialized with contract at:', process.env.CONTRACT_ADDRESS);
      }

      // Get current gas price
      await this.updateGasPrice();
      
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
      this.isConnected = false;
    }
  }

  async updateGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      this.gasPrice = feeData.gasPrice;
    } catch (error) {
      console.error('Failed to update gas price:', error);
      // Fallback to a reasonable gas price (20 gwei)
      this.gasPrice = ethers.parseUnits('20', 'gwei');
    }
  }

  // Generate or retrieve user wallet
  async getUserWallet(userId) {
    try {
      // Check cache first
      if (this.userWallets.has(userId)) {
        return this.userWallets.get(userId);
      }

      // Generate deterministic wallet for user
      const seed = crypto.createHash('sha256').update(`${userId}_${process.env.JWT_SECRET}`).digest();
      const wallet = new ethers.Wallet(seed, this.provider);
      
      // Cache the wallet
      this.userWallets.set(userId, wallet);
      
      return wallet;
    } catch (error) {
      console.error('Error generating user wallet:', error);
      throw new Error('Failed to generate user wallet');
    }
  }

  // Generate blockchain document ID
  generateDocumentId(userId, filename, timestamp = Date.now()) {
    const data = `${userId}-${filename}-${timestamp}`;
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }

  // Add document to blockchain
  async addDocument(userId, ipfsHash, metadata) {
    if (!this.isConnected || !this.contract) {
      throw new Error('Blockchain service not connected');
    }

    try {
      const userWallet = await this.getUserWallet(userId);
      const documentId = this.generateDocumentId(userId, ipfsHash);
      
      // Create contract instance with user's wallet
      const userContract = this.contract.connect(userWallet);
      
      // Check if user has enough balance for transaction
      const balance = await this.provider.getBalance(userWallet.address);
      const estimatedCost = this.gasPrice * BigInt(this.gasLimit);
      
      if (balance < estimatedCost) {
        // In production, you might want to handle this differently
        // For now, we'll fund the user's wallet from the main wallet
        await this.fundUserWallet(userWallet.address, estimatedCost * 2n);
      }

      // Add document to blockchain
      const tx = await userContract.addDocument(documentId, ipfsHash, metadata, {
        gasPrice: this.gasPrice,
        gasLimit: this.gasLimit
      });

      const receipt = await tx.wait();
      
      return {
        documentId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        walletAddress: userWallet.address
      };
    } catch (error) {
      console.error('Error adding document to blockchain:', error);
      throw new Error(`Failed to add document to blockchain: ${error.message}`);
    }
  }

  // Grant access to document
  async grantAccess(ownerUserId, documentId, targetUserEmail, targetUserId) {
    if (!this.isConnected || !this.contract) {
      throw new Error('Blockchain service not connected');
    }

    try {
      const ownerWallet = await this.getUserWallet(ownerUserId);
      const targetWallet = await this.getUserWallet(targetUserId);
      
      const ownerContract = this.contract.connect(ownerWallet);
      
      // Ensure target wallet has some funds for future transactions
      const targetBalance = await this.provider.getBalance(targetWallet.address);
      if (targetBalance === 0n) {
        await this.fundUserWallet(targetWallet.address, ethers.parseEther('0.01'));
      }
      
      const tx = await ownerContract.grantAccess(documentId, targetWallet.address, {
        gasPrice: this.gasPrice,
        gasLimit: this.gasLimit
      });

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        targetWalletAddress: targetWallet.address
      };
    } catch (error) {
      console.error('Error granting access on blockchain:', error);
      throw new Error(`Failed to grant access on blockchain: ${error.message}`);
    }
  }

  // Revoke access to document
  async revokeAccess(ownerUserId, documentId, targetUserId) {
    if (!this.isConnected || !this.contract) {
      throw new Error('Blockchain service not connected');
    }

    try {
      const ownerWallet = await this.getUserWallet(ownerUserId);
      const targetWallet = await this.getUserWallet(targetUserId);
      
      const ownerContract = this.contract.connect(ownerWallet);
      
      const tx = await ownerContract.revokeAccess(documentId, targetWallet.address, {
        gasPrice: this.gasPrice,
        gasLimit: this.gasLimit
      });

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        targetWalletAddress: targetWallet.address
      };
    } catch (error) {
      console.error('Error revoking access on blockchain:', error);
      throw new Error(`Failed to revoke access on blockchain: ${error.message}`);
    }
  }

  // Check if user has access to document
  async hasAccess(userId, documentId) {
    if (!this.isConnected || !this.contract) {
      throw new Error('Blockchain service not connected');
    }

    try {
      const userWallet = await this.getUserWallet(userId);
      
      const hasAccess = await this.contract.hasAccess(documentId, userWallet.address);
      
      return hasAccess;
    } catch (error) {
      console.error('Error checking access on blockchain:', error);
      throw new Error(`Failed to check access on blockchain: ${error.message}`);
    }
  }

  // Get document information from blockchain
  async getDocument(userId, documentId) {
    if (!this.isConnected || !this.contract) {
      throw new Error('Blockchain service not connected');
    }

    try {
      const userWallet = await this.getUserWallet(userId);
      
      // First check if user has access
      const access = await this.hasAccess(userId, documentId);
      if (!access) {
        throw new Error('Access denied to document');
      }
      
      const [ipfsHash, owner, createdAt, metadata] = await this.contract.getDocument(documentId);
      
      return {
        ipfsHash,
        owner,
        createdAt: Number(createdAt),
        metadata
      };
    } catch (error) {
      console.error('Error getting document from blockchain:', error);
      throw new Error(`Failed to get document from blockchain: ${error.message}`);
    }
  }

  // Get all users with access to a document
  async getDocumentAccessors(ownerUserId, documentId) {
    if (!this.isConnected || !this.contract) {
      throw new Error('Blockchain service not connected');
    }

    try {
      const ownerWallet = await this.getUserWallet(ownerUserId);
      const ownerContract = this.contract.connect(ownerWallet);
      
      const accessors = await ownerContract.getDocumentAccessors(documentId);
      
      return accessors;
    } catch (error) {
      console.error('Error getting document accessors:', error);
      throw new Error(`Failed to get document accessors: ${error.message}`);
    }
  }

  // Fund a user wallet (for gas fees)
  async fundUserWallet(userAddress, amount) {
    if (!this.wallet) {
      throw new Error('Main wallet not available for funding');
    }

    try {
      const tx = await this.wallet.sendTransaction({
        to: userAddress,
        value: amount,
        gasPrice: this.gasPrice,
        gasLimit: 21000 // Standard ETH transfer
      });

      await tx.wait();
      console.log(`Funded wallet ${userAddress} with ${ethers.formatEther(amount)} MATIC`);
      
      return tx.hash;
    } catch (error) {
      console.error('Error funding user wallet:', error);
      throw new Error(`Failed to fund user wallet: ${error.message}`);
    }
  }

  // Get user's wallet address
  async getUserWalletAddress(userId) {
    try {
      const wallet = await this.getUserWallet(userId);
      return wallet.address;
    } catch (error) {
      console.error('Error getting user wallet address:', error);
      throw new Error('Failed to get user wallet address');
    }
  }

  // Get wallet balance
  async getWalletBalance(userId) {
    try {
      const wallet = await this.getUserWallet(userId);
      const balance = await this.provider.getBalance(wallet.address);
      
      return {
        balance: balance.toString(),
        balanceFormatted: ethers.formatEther(balance),
        address: wallet.address
      };
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      throw new Error('Failed to get wallet balance');
    }
  }

  // Listen to contract events
  setupEventListeners() {
    if (!this.contract) return;

    // Listen for document added events
    this.contract.on('DocumentAdded', (documentId, owner, ipfsHash, metadata) => {
      console.log('Document added:', { documentId, owner, ipfsHash, metadata });
    });

    // Listen for access granted events
    this.contract.on('AccessGranted', (documentId, owner, user) => {
      console.log('Access granted:', { documentId, owner, user });
    });

    // Listen for access revoked events
    this.contract.on('AccessRevoked', (documentId, owner, user) => {
      console.log('Access revoked:', { documentId, owner, user });
    });
  }

  // Get service status
  getStatus() {
    return {
      isConnected: this.isConnected,
      hasContract: !!this.contract,
      hasWallet: !!this.wallet,
      contractAddress: process.env.CONTRACT_ADDRESS,
      networkConfigured: !!process.env.POLYGON_RPC_URL,
      gasPrice: this.gasPrice ? ethers.formatUnits(this.gasPrice, 'gwei') + ' gwei' : null
    };
  }

  // Batch operations for efficiency
  async batchGrantAccess(ownerUserId, documentId, targetUserIds) {
    if (!this.isConnected || !this.contract) {
      throw new Error('Blockchain service not connected');
    }

    try {
      const ownerWallet = await this.getUserWallet(ownerUserId);
      const ownerContract = this.contract.connect(ownerWallet);
      
      // Get target wallet addresses
      const targetAddresses = await Promise.all(
        targetUserIds.map(userId => this.getUserWallet(userId).then(w => w.address))
      );
      
      const tx = await ownerContract.batchGrantAccess(documentId, targetAddresses, {
        gasPrice: this.gasPrice,
        gasLimit: this.gasLimit * BigInt(targetUserIds.length) // Scale gas limit
      });

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        targetAddresses
      };
    } catch (error) {
      console.error('Error in batch grant access:', error);
      throw new Error(`Failed to batch grant access: ${error.message}`);
    }
  }
}

// Create singleton instance
const blockchainService = new BlockchainService();

// Setup event listeners
blockchainService.setupEventListeners();

module.exports = blockchainService;