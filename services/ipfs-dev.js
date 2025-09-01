const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Development IPFS service that stores files locally for testing
class DevIPFSService {
  constructor() {
    this.isConnected = true;
    this.storageDir = path.join(__dirname, '..', 'dev-storage');
    this.initializeStorage();
  }

  initializeStorage() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      console.log('Dev IPFS storage initialized at:', this.storageDir);
    } catch (error) {
      console.error('Failed to initialize dev storage:', error);
      this.isConnected = false;
    }
  }

  // Generate a fake IPFS hash for development
  generateFakeIPFSHash(fileBuffer) {
    return 'Qm' + crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 44);
  }

  // Upload file to local storage (simulating IPFS)
  async uploadFile(fileBuffer, options = {}) {
    if (!this.isConnected) {
      throw new Error('Dev IPFS storage not available');
    }

    try {
      // Optional: Encrypt file before storage
      let processedBuffer = fileBuffer;
      let encryptionKey = null;

      if (options.encrypt) {
        const result = this.encryptBuffer(fileBuffer);
        processedBuffer = result.encryptedBuffer;
        encryptionKey = result.key;
      }

      // Generate fake IPFS hash
      const ipfsHash = this.generateFakeIPFSHash(processedBuffer);
      
      // Store file locally
      const filePath = path.join(this.storageDir, ipfsHash);
      fs.writeFileSync(filePath, processedBuffer);

      console.log('File stored locally with fake IPFS hash:', ipfsHash);

      return {
        ipfsHash,
        size: processedBuffer.length,
        encryptionKey: encryptionKey
      };
    } catch (error) {
      console.error('Dev IPFS upload error:', error);
      throw new Error(`Failed to upload file to dev storage: ${error.message}`);
    }
  }

  // Download file from local storage
  async downloadFile(ipfsHash, options = {}) {
    if (!this.isConnected) {
      throw new Error('Dev IPFS storage not available');
    }

    try {
      // Validate hash format (basic check)
      if (!ipfsHash || !ipfsHash.startsWith('Qm')) {
        throw new Error('Invalid IPFS hash format');
      }

      const filePath = path.join(this.storageDir, ipfsHash);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found in dev storage');
      }

      let fileBuffer = fs.readFileSync(filePath);

      // Optional: Decrypt file after download
      if (options.decrypt && options.encryptionKey) {
        fileBuffer = this.decryptBuffer(fileBuffer, options.encryptionKey);
      }

      return fileBuffer;
    } catch (error) {
      console.error('Dev IPFS download error:', error);
      throw new Error(`Failed to download file from dev storage: ${error.message}`);
    }
  }

  // Verify upload (always returns true for dev)
  async verifyUpload(ipfsHash) {
    const filePath = path.join(this.storageDir, ipfsHash);
    return fs.existsSync(filePath);
  }

  // Pin file (no-op for dev)
  async pinFile(ipfsHash) {
    console.log('Dev IPFS: Pin operation simulated for', ipfsHash);
    return true;
  }

  // Unpin file (no-op for dev)
  async unpinFile(ipfsHash) {
    console.log('Dev IPFS: Unpin operation simulated for', ipfsHash);
    return true;
  }

  // Encrypt buffer using AES-256-GCM
  encryptBuffer(buffer) {
    const key = crypto.randomBytes(32); // 256-bit key
    const iv = crypto.randomBytes(16);  // 128-bit IV
    
    const cipher = crypto.createCipher('aes-256-gcm', key);
    cipher.setAAD(Buffer.from('ipfs-document', 'utf8'));
    
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    const encryptedBuffer = Buffer.concat([iv, authTag, encrypted]);
    
    return {
      encryptedBuffer,
      key: key.toString('base64')
    };
  }

  // Decrypt buffer using AES-256-GCM
  decryptBuffer(encryptedBuffer, keyBase64) {
    const key = Buffer.from(keyBase64, 'base64');
    
    // Extract IV (first 16 bytes), auth tag (next 16 bytes), and encrypted data
    const iv = encryptedBuffer.subarray(0, 16);
    const authTag = encryptedBuffer.subarray(16, 32);
    const encrypted = encryptedBuffer.subarray(32);
    
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from('ipfs-document', 'utf8'));
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted;
  }

  // Validate IPFS hash format
  isValidIPFSHash(hash) {
    // Basic validation for development
    return hash && typeof hash === 'string' && hash.startsWith('Qm') && hash.length === 46;
  }

  // Get service status
  getStatus() {
    return {
      isConnected: this.isConnected,
      hasClient: true,
      mode: 'development',
      storageDir: this.storageDir
    };
  }

  // Generate a unique document ID for blockchain
  generateDocumentId(userId, filename, timestamp = Date.now()) {
    const data = `${userId}-${filename}-${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

module.exports = DevIPFSService;