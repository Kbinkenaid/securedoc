const express = require('express');
const multer = require('multer');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');
const Document = require('../models/Document');
const User = require('../models/User');
const { ipfsService, blockchainService } = require('../services');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for processing
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Only allow one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Allow most common file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-zip-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// Helper function to validate document access
async function validateDocumentAccess(documentId, userId) {
  const document = await Document.findById(documentId).populate('owner', 'name email');
  
  if (!document || !document.isActive) {
    throw new Error('Document not found');
  }

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('Access validation:', {
      documentId,
      userId,
      ownerId: document.owner._id.toString(),
      isOwner: document.owner._id.toString() === userId.toString(),
      sharedWithCount: document.sharedWith.length
    });
  }

  if (!document.hasAccess(userId)) {
    throw new Error('Access denied');
  }

  return document;
}

// Upload document
router.post('/upload', authMiddleware, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file provided'
      });
    }

    const { title, description, encrypt } = req.body;
    const userId = req.user._id;

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        message: 'Document title is required'
      });
    }

    if (title.length > 100) {
      return res.status(400).json({
        message: 'Title cannot exceed 100 characters'
      });
    }

    // Upload to IPFS
    console.log('Uploading to IPFS...');
    const ipfsResult = await ipfsService.uploadFile(req.file.buffer, {
      encrypt: encrypt === 'true' || encrypt === true
    });

    // Create metadata for blockchain
    const metadata = JSON.stringify({
      title: title.trim(),
      description: description?.trim() || '',
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    });

    // Add to blockchain
    console.log('Adding to blockchain...');
    const blockchainResult = await blockchainService.addDocument(
      userId.toString(),
      ipfsResult.ipfsHash,
      metadata
    );

    // Store in database
    const document = new Document({
      title: title.trim(),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      ipfsHash: ipfsResult.ipfsHash,
      blockchainDocumentId: blockchainResult.documentId,
      owner: userId,
      isEncrypted: !!ipfsResult.encryptionKey
    });

    // Store encryption key if file was encrypted
    if (ipfsResult.encryptionKey) {
      document.encryptionKey = ipfsResult.encryptionKey;
    }

    await document.save();

    // Update user's wallet address if not set
    if (!req.user.walletAddress) {
      req.user.walletAddress = blockchainResult.walletAddress;
      await req.user.save();
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document._id,
        title: document.title,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        ipfsHash: document.ipfsHash,
        blockchainDocumentId: document.blockchainDocumentId,
        isEncrypted: document.isEncrypted,
        createdAt: document.createdAt,
        owner: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email
        }
      },
      blockchain: {
        transactionHash: blockchainResult.transactionHash,
        blockNumber: blockchainResult.blockNumber,
        walletAddress: blockchainResult.walletAddress
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 50MB'
      });
    }
    
    if (error.message.includes('File type') && error.message.includes('not allowed')) {
      return res.status(400).json({
        message: error.message
      });
    }
    
    res.status(500).json({
      message: 'Error uploading document',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user's documents
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const userId = req.user._id;

    // Build query
    const query = {
      owner: userId,
      isActive: true
    };

    // Add search functionality
    if (search && search.trim().length > 0) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { originalName: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const documents = await Document.find(query)
      .populate('owner', 'name email')
      .populate('sharedWith.user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Document.countDocuments(query);

    res.json({
      documents: documents.map(doc => ({
        id: doc._id,
        title: doc.title,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        isEncrypted: doc.isEncrypted,
        downloadCount: doc.downloadCount,
        sharedWith: doc.sharedWith,
        isShared: doc.isShared,
        createdAt: doc.createdAt,
        lastAccessedAt: doc.lastAccessedAt,
        owner: doc.owner
      })),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching user documents:', error);
    res.status(500).json({
      message: 'Error fetching documents'
    });
  }
});

// Get documents shared with user
router.get('/shared-with-me', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const userId = req.user._id;

    // Build query for documents shared with this user
    const query = {
      'sharedWith.user': userId,
      isActive: true
    };

    // Add search functionality
    if (search && search.trim().length > 0) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { originalName: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const documents = await Document.find(query)
      .populate('owner', 'name email')
      .populate('sharedWith.user', 'name email')
      .sort({ 'sharedWith.sharedAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Document.countDocuments(query);

    res.json({
      documents: documents.map(doc => {
        // Find the specific sharing entry for this user
        const sharedEntry = doc.sharedWith.find(share => 
          share.user._id.toString() === userId.toString()
        );
        
        return {
          id: doc._id,
          title: doc.title,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          size: doc.size,
          isEncrypted: doc.isEncrypted,
          downloadCount: doc.downloadCount,
          createdAt: doc.createdAt,
          lastAccessedAt: doc.lastAccessedAt,
          owner: doc.owner,
          sharedAt: sharedEntry?.sharedAt,
          permissions: sharedEntry?.permissions
        };
      }),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching shared documents:', error);
    res.status(500).json({
      message: 'Error fetching shared documents'
    });
  }
});

// Get specific document details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user._id;

    const document = await validateDocumentAccess(documentId, userId);

    // Update last accessed time
    document.lastAccessedAt = new Date();
    await document.save();

    res.json({
      document: {
        id: document._id,
        title: document.title,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        ipfsHash: document.ipfsHash,
        blockchainDocumentId: document.blockchainDocumentId,
        isEncrypted: document.isEncrypted,
        downloadCount: document.downloadCount,
        sharedWith: document.sharedWith,
        isShared: document.isShared,
        createdAt: document.createdAt,
        lastAccessedAt: document.lastAccessedAt,
        owner: document.owner,
        userPermission: document.getUserPermission(userId)
      }
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    
    if (error.message === 'Document not found') {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    if (error.message === 'Access denied') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.status(500).json({
      message: 'Error fetching document'
    });
  }
});

// Download document
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user._id;

    const document = await validateDocumentAccess(documentId, userId);

    // Verify blockchain access
    const blockchainAccess = await blockchainService.hasAccess(
      userId.toString(),
      document.blockchainDocumentId
    );

    // In development mode, if database access passes but blockchain fails,
    // we'll allow it since blockchain state is not persistent in dev mode
    const { isDevelopmentMode } = require('../services');
    if (!blockchainAccess && !isDevelopmentMode) {
      return res.status(403).json({
        message: 'Blockchain access denied'
      });
    }
    
    if (!blockchainAccess && isDevelopmentMode) {
      console.log('Warning: Blockchain access failed in dev mode, allowing database access');
    }

    // Download from IPFS
    console.log('Downloading from IPFS:', document.ipfsHash);
    
    const downloadOptions = {};
    if (document.isEncrypted && document.encryptionKey) {
      downloadOptions.decrypt = true;
      downloadOptions.encryptionKey = document.encryptionKey;
    }

    const fileBuffer = await ipfsService.downloadFile(
      document.ipfsHash, 
      downloadOptions
    );

    // Update download count
    document.downloadCount += 1;
    document.lastAccessedAt = new Date();
    await document.save();

    // Set appropriate headers
    res.set({
      'Content-Type': document.mimeType,
      'Content-Length': fileBuffer.length,
      'Content-Disposition': `attachment; filename="${document.originalName}"`,
      'Cache-Control': 'no-cache'
    });

    res.send(fileBuffer);
  } catch (error) {
    console.error('Error downloading document:', error);
    
    if (error.message === 'Document not found') {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    if (error.message === 'Access denied' || error.message.includes('Blockchain access denied')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.status(500).json({
      message: 'Error downloading document',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete document
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user._id;

    const document = await Document.findById(documentId);
    
    if (!document || !document.isActive) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can delete
    if (document.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only document owner can delete' });
    }

    // Remove from blockchain (this will revoke all access)
    try {
      await blockchainService.contract.removeDocument(document.blockchainDocumentId);
    } catch (blockchainError) {
      console.error('Blockchain removal error:', blockchainError);
      // Continue with database removal even if blockchain fails
    }

    // Unpin from IPFS (optional, allows garbage collection)
    try {
      await ipfsService.unpinFile(document.ipfsHash);
    } catch (ipfsError) {
      console.error('IPFS unpin error:', ipfsError);
      // Continue with database removal even if IPFS unpin fails
    }

    // Mark as inactive in database (soft delete)
    document.isActive = false;
    await document.save();

    res.json({
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      message: 'Error deleting document'
    });
  }
});

// Update document metadata
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user._id;
    const { title, description } = req.body;

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        message: 'Document title is required'
      });
    }

    if (title.length > 100) {
      return res.status(400).json({
        message: 'Title cannot exceed 100 characters'
      });
    }

    const document = await Document.findById(documentId);
    
    if (!document || !document.isActive) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can update
    if (document.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only document owner can update' });
    }

    // Update database
    document.title = title.trim();
    await document.save();

    // Update blockchain metadata if needed
    try {
      const metadata = JSON.stringify({
        title: title.trim(),
        description: description?.trim() || '',
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        updatedAt: new Date().toISOString()
      });

      // Note: This requires the updateDocument function in the smart contract
      // For now, we'll just update the database
    } catch (blockchainError) {
      console.error('Blockchain update error:', blockchainError);
      // Continue with database update even if blockchain fails
    }

    res.json({
      message: 'Document updated successfully',
      document: {
        id: document._id,
        title: document.title,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({
      message: 'Error updating document'
    });
  }
});

module.exports = router;