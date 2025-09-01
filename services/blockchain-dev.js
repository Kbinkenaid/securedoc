const crypto = require('crypto');

// Development blockchain service that simulates blockchain operations for testing
class DevBlockchainService {
  constructor() {
    this.isConnected = true;
    this.userWallets = new Map(); // Cache for user wallets
    this.documents = new Map(); // Simulate blockchain storage
    this.permissions = new Map(); // Simulate access control
    this.gasPrice = '20000000000'; // 20 gwei
    this.gasLimit = 500000;
    
    console.log('Dev Blockchain service initialized (simulation mode)');
  }

  // Generate or retrieve user wallet (deterministic)
  async getUserWallet(userId) {
    try {
      // Check cache first
      if (this.userWallets.has(userId)) {
        return this.userWallets.get(userId);
      }

      // Generate deterministic wallet address for user
      const seed = crypto.createHash('sha256').update(`${userId}_wallet_seed`).digest('hex');
      const address = '0x' + seed.substring(0, 40);
      
      const wallet = {
        address: address,
        privateKey: seed
      };
      
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
    return '0x' + crypto.createHash('sha256').update(data).digest('hex');
  }

  // Add document to blockchain (simulated)
  async addDocument(userId, ipfsHash, metadata) {
    if (!this.isConnected) {
      throw new Error('Dev blockchain service not connected');
    }

    try {
      const userWallet = await this.getUserWallet(userId);
      const documentId = this.generateDocumentId(userId, ipfsHash);
      
      // Simulate blockchain storage
      this.documents.set(documentId, {
        ipfsHash,
        owner: userWallet.address,
        metadata,
        createdAt: Date.now()
      });

      // Initialize permissions for owner
      this.permissions.set(`${documentId}:${userWallet.address}`, true);

      console.log('Dev Blockchain: Document added', { documentId, owner: userWallet.address });

      return {
        documentId,
        transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
        blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
        walletAddress: userWallet.address
      };
    } catch (error) {
      console.error('Error adding document to dev blockchain:', error);
      throw new Error(`Failed to add document to dev blockchain: ${error.message}`);
    }
  }

  // Grant access to document (simulated)
  async grantAccess(ownerUserId, documentId, targetUserEmail, targetUserId) {
    if (!this.isConnected) {
      throw new Error('Dev blockchain service not connected');
    }

    try {
      const ownerWallet = await this.getUserWallet(ownerUserId);
      const targetWallet = await this.getUserWallet(targetUserId);
      
      // Check if document exists and user is owner
      const document = this.documents.get(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      if (document.owner !== ownerWallet.address) {
        throw new Error('Only document owner can grant access');
      }

      // Grant permission
      this.permissions.set(`${documentId}:${targetWallet.address}`, true);

      console.log('Dev Blockchain: Access granted', { 
        documentId, 
        owner: ownerWallet.address, 
        target: targetWallet.address 
      });

      return {
        transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
        blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
        targetWalletAddress: targetWallet.address
      };
    } catch (error) {
      console.error('Error granting access on dev blockchain:', error);
      throw new Error(`Failed to grant access on dev blockchain: ${error.message}`);
    }
  }

  // Revoke access to document (simulated)
  async revokeAccess(ownerUserId, documentId, targetUserId) {
    if (!this.isConnected) {
      throw new Error('Dev blockchain service not connected');
    }

    try {
      const ownerWallet = await this.getUserWallet(ownerUserId);
      const targetWallet = await this.getUserWallet(targetUserId);
      
      // Check if document exists and user is owner
      const document = this.documents.get(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      if (document.owner !== ownerWallet.address) {
        throw new Error('Only document owner can revoke access');
      }

      // Revoke permission
      this.permissions.delete(`${documentId}:${targetWallet.address}`);

      console.log('Dev Blockchain: Access revoked', { 
        documentId, 
        owner: ownerWallet.address, 
        target: targetWallet.address 
      });

      return {
        transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
        blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
        targetWalletAddress: targetWallet.address
      };
    } catch (error) {
      console.error('Error revoking access on dev blockchain:', error);
      throw new Error(`Failed to revoke access on dev blockchain: ${error.message}`);
    }
  }

  // Check if user has access to document (simulated)
  async hasAccess(userId, documentId) {
    if (!this.isConnected) {
      throw new Error('Dev blockchain service not connected');
    }

    try {
      const userWallet = await this.getUserWallet(userId);
      
      // Check if user has permission
      const hasPermission = this.permissions.has(`${documentId}:${userWallet.address}`);
      
      console.log('Dev Blockchain: Access check', { 
        documentId, 
        user: userWallet.address, 
        hasAccess: hasPermission 
      });

      return hasPermission;
    } catch (error) {
      console.error('Error checking access on dev blockchain:', error);
      throw new Error(`Failed to check access on dev blockchain: ${error.message}`);
    }
  }

  // Get document information from blockchain (simulated)
  async getDocument(userId, documentId) {
    if (!this.isConnected) {
      throw new Error('Dev blockchain service not connected');
    }

    try {
      const userWallet = await this.getUserWallet(userId);
      
      // First check if user has access
      const access = await this.hasAccess(userId, documentId);
      if (!access) {
        throw new Error('Access denied to document');
      }

      const document = this.documents.get(documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      return {
        ipfsHash: document.ipfsHash,
        owner: document.owner,
        createdAt: document.createdAt,
        metadata: document.metadata
      };
    } catch (error) {
      console.error('Error getting document from dev blockchain:', error);
      throw new Error(`Failed to get document from dev blockchain: ${error.message}`);
    }
  }

  // Get all users with access to a document (simulated)
  async getDocumentAccessors(ownerUserId, documentId) {
    if (!this.isConnected) {
      throw new Error('Dev blockchain service not connected');
    }

    try {
      const ownerWallet = await this.getUserWallet(ownerUserId);
      
      // Check if user is owner
      const document = this.documents.get(documentId);
      if (!document || document.owner !== ownerWallet.address) {
        throw new Error('Only document owner can view accessors');
      }

      // Find all users with access
      const accessors = [];
      for (const [key, hasAccess] of this.permissions.entries()) {
        const [docId, userAddress] = key.split(':');
        if (docId === documentId && hasAccess && userAddress !== ownerWallet.address) {
          accessors.push(userAddress);
        }
      }
      
      return accessors;
    } catch (error) {
      console.error('Error getting document accessors:', error);
      throw new Error(`Failed to get document accessors: ${error.message}`);
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

  // Get wallet balance (simulated)
  async getWalletBalance(userId) {
    try {
      const wallet = await this.getUserWallet(userId);
      
      // Return fake balance
      return {
        balance: '1000000000000000000', // 1 ETH in wei
        balanceFormatted: '1.0',
        address: wallet.address
      };
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      throw new Error('Failed to get wallet balance');
    }
  }

  // Fund user wallet (simulated)
  async fundUserWallet(userAddress, amount) {
    console.log(`Dev Blockchain: Simulated funding of ${userAddress} with ${amount} wei`);
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  // Batch operations for efficiency (simulated)
  async batchGrantAccess(ownerUserId, documentId, targetUserIds) {
    if (!this.isConnected) {
      throw new Error('Dev blockchain service not connected');
    }

    try {
      const ownerWallet = await this.getUserWallet(ownerUserId);
      
      // Get target wallet addresses
      const targetAddresses = [];
      for (const userId of targetUserIds) {
        const wallet = await this.getUserWallet(userId);
        targetAddresses.push(wallet.address);
        
        // Grant permission
        this.permissions.set(`${documentId}:${wallet.address}`, true);
      }

      console.log('Dev Blockchain: Batch access granted', { 
        documentId, 
        owner: ownerWallet.address, 
        targets: targetAddresses 
      });

      return {
        transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
        blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
        targetAddresses
      };
    } catch (error) {
      console.error('Error in batch grant access:', error);
      throw new Error(`Failed to batch grant access: ${error.message}`);
    }
  }

  // Get service status
  getStatus() {
    return {
      isConnected: this.isConnected,
      hasContract: true,
      hasWallet: true,
      contractAddress: 'dev_contract_simulation',
      networkConfigured: true,
      gasPrice: '20 gwei',
      mode: 'development'
    };
  }

  // Setup event listeners (no-op for dev)
  setupEventListeners() {
    console.log('Dev Blockchain: Event listeners simulated');
  }
}

module.exports = DevBlockchainService;