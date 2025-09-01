const { create } = require('ipfs-http-client');
const crypto = require('crypto');

class IPFSService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.initializeClient();
  }

  initializeClient() {
    try {
      // Initialize IPFS client with Infura gateway
      if (process.env.IPFS_PROJECT_ID && process.env.IPFS_PROJECT_SECRET) {
        const auth = 'Basic ' + Buffer.from(
          process.env.IPFS_PROJECT_ID + ':' + process.env.IPFS_PROJECT_SECRET
        ).toString('base64');

        this.client = create({
          host: 'ipfs.infura.io',
          port: 5001,
          protocol: 'https',
          headers: {
            authorization: auth
          }
        });
      } else {
        // Fallback to local IPFS node
        this.client = create({ 
          host: 'localhost', 
          port: 5001, 
          protocol: 'http' 
        });
      }

      this.isConnected = true;
      console.log('IPFS client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IPFS client:', error);
      this.isConnected = false;
    }
  }

  // Upload file to IPFS
  async uploadFile(fileBuffer, options = {}) {
    if (!this.isConnected || !this.client) {
      throw new Error('IPFS client not connected');
    }

    try {
      // Optional: Encrypt file before upload
      let processedBuffer = fileBuffer;
      let encryptionKey = null;

      if (options.encrypt) {
        const result = this.encryptBuffer(fileBuffer);
        processedBuffer = result.encryptedBuffer;
        encryptionKey = result.key;
      }

      // Add file to IPFS
      const result = await this.client.add(processedBuffer, {
        pin: true, // Pin the file to prevent garbage collection
        wrapWithDirectory: false,
        cidVersion: 1, // Use CIDv1 for better compatibility
        hashAlg: 'sha2-256'
      });

      // Validate the upload
      if (!result || !result.cid) {
        throw new Error('Failed to get IPFS hash from upload');
      }

      const ipfsHash = result.cid.toString();

      // Verify the upload by trying to retrieve the file
      await this.verifyUpload(ipfsHash);

      return {
        ipfsHash,
        size: result.size,
        encryptionKey: encryptionKey // Only returned if encryption was used
      };
    } catch (error) {
      console.error('IPFS upload error:', error);
      throw new Error(`Failed to upload file to IPFS: ${error.message}`);
    }
  }

  // Download file from IPFS
  async downloadFile(ipfsHash, options = {}) {
    if (!this.isConnected || !this.client) {
      throw new Error('IPFS client not connected');
    }

    try {
      // Validate IPFS hash format
      if (!this.isValidIPFSHash(ipfsHash)) {
        throw new Error('Invalid IPFS hash format');
      }

      // Get file from IPFS
      const chunks = [];
      const stream = this.client.cat(ipfsHash, {
        timeout: 30000 // 30 second timeout
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      let fileBuffer = Buffer.concat(chunks);

      // Optional: Decrypt file after download
      if (options.decrypt && options.encryptionKey) {
        fileBuffer = this.decryptBuffer(fileBuffer, options.encryptionKey);
      }

      return fileBuffer;
    } catch (error) {
      console.error('IPFS download error:', error);
      throw new Error(`Failed to download file from IPFS: ${error.message}`);
    }
  }

  // Verify that a file was uploaded successfully
  async verifyUpload(ipfsHash) {
    try {
      const chunks = [];
      const stream = this.client.cat(ipfsHash, {
        timeout: 10000 // 10 second timeout for verification
      });

      // Just read the first chunk to verify accessibility
      for await (const chunk of stream) {
        chunks.push(chunk);
        if (chunks.length > 0) break; // Only need to verify first chunk
      }

      return chunks.length > 0;
    } catch (error) {
      throw new Error(`Upload verification failed: ${error.message}`);
    }
  }

  // Pin a file to prevent garbage collection
  async pinFile(ipfsHash) {
    if (!this.isConnected || !this.client) {
      throw new Error('IPFS client not connected');
    }

    try {
      await this.client.pin.add(ipfsHash);
      return true;
    } catch (error) {
      console.error('IPFS pin error:', error);
      throw new Error(`Failed to pin file: ${error.message}`);
    }
  }

  // Unpin a file (allow garbage collection)
  async unpinFile(ipfsHash) {
    if (!this.isConnected || !this.client) {
      throw new Error('IPFS client not connected');
    }

    try {
      await this.client.pin.rm(ipfsHash);
      return true;
    } catch (error) {
      console.error('IPFS unpin error:', error);
      // Don't throw error for unpin failures as file might not be pinned
      return false;
    }
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
    // Basic validation for CIDv0 and CIDv1
    const cidv0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
    const cidv1Regex = /^(baf|baa|bab|bac|bad|bae|baf|bag|bah|bai|baj|bak|bal|bam|ban|bao|bap|baq|bar|bas|bat|bau|bav|baw|bax|bay|baz)[a-z2-7]{48,}/;
    
    return cidv0Regex.test(hash) || cidv1Regex.test(hash);
  }

  // Get IPFS client status
  getStatus() {
    return {
      isConnected: this.isConnected,
      hasClient: !!this.client
    };
  }

  // Generate a unique document ID for blockchain
  generateDocumentId(userId, filename, timestamp = Date.now()) {
    const data = `${userId}-${filename}-${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// Create singleton instance
const ipfsService = new IPFSService();

module.exports = ipfsService;