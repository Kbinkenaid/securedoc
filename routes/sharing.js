const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Document = require('../models/Document');
const User = require('../models/User');
const { blockchainService } = require('../services');

const router = express.Router();

// Helper function to validate document ownership
async function validateDocumentOwnership(documentId, userId) {
  const document = await Document.findById(documentId);
  
  if (!document || !document.isActive) {
    throw new Error('Document not found');
  }

  if (document.owner.toString() !== userId.toString()) {
    throw new Error('Only document owner can manage sharing');
  }

  return document;
}

// Grant access to a document
router.post('/grant', authMiddleware, async (req, res) => {
  try {
    const { documentId, userEmail, permissions = 'read' } = req.body;
    const ownerId = req.user._id;

    // Validation
    if (!documentId || !userEmail) {
      return res.status(400).json({
        message: 'Document ID and user email are required'
      });
    }

    if (!['read', 'write'].includes(permissions)) {
      return res.status(400).json({
        message: 'Permissions must be either "read" or "write"'
      });
    }

    // Validate document ownership
    const document = await validateDocumentOwnership(documentId, ownerId);

    // Find target user
    const targetUser = await User.findOne({ 
      email: userEmail.toLowerCase().trim(),
      isActive: true 
    });

    if (!targetUser) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Cannot share with yourself
    if (targetUser._id.toString() === ownerId.toString()) {
      return res.status(400).json({
        message: 'Cannot share document with yourself'
      });
    }

    // Check if already shared
    const existingShare = document.sharedWith.find(share => 
      share.user.toString() === targetUser._id.toString()
    );

    if (existingShare) {
      // Update permissions if different
      if (existingShare.permissions !== permissions) {
        existingShare.permissions = permissions;
        existingShare.sharedAt = new Date();
        
        await document.save();
        
        return res.json({
          message: 'Document sharing permissions updated successfully',
          sharing: {
            documentId,
            documentTitle: document.title,
            sharedWith: {
              id: targetUser._id,
              name: targetUser.name,
              email: targetUser.email
            },
            permissions,
            sharedAt: existingShare.sharedAt
          }
        });
      } else {
        return res.status(400).json({
          message: 'Document is already shared with this user'
        });
      }
    }

    // Grant access on blockchain
    console.log('Granting access on blockchain...');
    let blockchainResult;
    try {
      blockchainResult = await blockchainService.grantAccess(
        ownerId.toString(),
        document.blockchainDocumentId,
        targetUser.email,
        targetUser._id.toString()
      );
    } catch (blockchainError) {
      // In development mode, if blockchain operation fails, we can still proceed with database-only sharing
      const { isDevelopmentMode } = require('../services');
      if (isDevelopmentMode) {
        console.log('Warning: Blockchain operation failed in dev mode, proceeding with database-only sharing');
        blockchainResult = {
          transactionHash: '0xdev_' + Math.random().toString(36).substr(2, 9),
          blockNumber: Math.floor(Math.random() * 1000000),
          targetWalletAddress: '0xdev_address'
        };
      } else {
        throw blockchainError;
      }
    }

    // Update database
    const shareSuccess = document.shareWith(targetUser._id, permissions);
    
    if (!shareSuccess) {
      return res.status(400).json({
        message: 'Failed to share document'
      });
    }

    await document.save();

    res.json({
      message: 'Document shared successfully',
      sharing: {
        documentId,
        documentTitle: document.title,
        sharedWith: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email
        },
        permissions,
        sharedAt: new Date()
      },
      blockchain: {
        transactionHash: blockchainResult.transactionHash,
        blockNumber: blockchainResult.blockNumber,
        targetWalletAddress: blockchainResult.targetWalletAddress
      }
    });
  } catch (error) {
    console.error('Error granting document access:', error);
    
    if (error.message === 'Document not found') {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    if (error.message === 'Only document owner can manage sharing') {
      return res.status(403).json({ message: 'Only document owner can share documents' });
    }
    
    res.status(500).json({
      message: 'Error sharing document',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Revoke access to a document
router.post('/revoke', authMiddleware, async (req, res) => {
  try {
    const { documentId, userId } = req.body;
    const ownerId = req.user._id;

    // Validation
    if (!documentId || !userId) {
      return res.status(400).json({
        message: 'Document ID and user ID are required'
      });
    }

    // Validate document ownership
    const document = await validateDocumentOwnership(documentId, ownerId);

    // Find target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Check if document is shared with this user
    const hasAccess = document.sharedWith.some(share => 
      share.user.toString() === userId.toString()
    );

    if (!hasAccess) {
      return res.status(400).json({
        message: 'Document is not shared with this user'
      });
    }

    // Revoke access on blockchain
    console.log('Revoking access on blockchain...');
    const blockchainResult = await blockchainService.revokeAccess(
      ownerId.toString(),
      document.blockchainDocumentId,
      userId
    );

    // Update database
    const revokeSuccess = document.unshareWith(userId);
    
    if (!revokeSuccess) {
      return res.status(400).json({
        message: 'Failed to revoke document access'
      });
    }

    await document.save();

    res.json({
      message: 'Document access revoked successfully',
      revocation: {
        documentId,
        documentTitle: document.title,
        revokedFrom: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email
        },
        revokedAt: new Date()
      },
      blockchain: {
        transactionHash: blockchainResult.transactionHash,
        blockNumber: blockchainResult.blockNumber,
        targetWalletAddress: blockchainResult.targetWalletAddress
      }
    });
  } catch (error) {
    console.error('Error revoking document access:', error);
    
    if (error.message === 'Document not found') {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    if (error.message === 'Only document owner can manage sharing') {
      return res.status(403).json({ message: 'Only document owner can revoke access' });
    }
    
    res.status(500).json({
      message: 'Error revoking document access',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get sharing information for a document
router.get('/document/:id', authMiddleware, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user._id;

    const document = await Document.findById(documentId)
      .populate('owner', 'name email walletAddress')
      .populate('sharedWith.user', 'name email walletAddress');
    
    if (!document || !document.isActive) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can view sharing details
    if (document.owner._id.toString() !== userId.toString()) {
      return res.status(403).json({ 
        message: 'Only document owner can view sharing details' 
      });
    }

    // Get blockchain accessors for verification
    let blockchainAccessors = [];
    try {
      blockchainAccessors = await blockchainService.getDocumentAccessors(
        userId.toString(),
        document.blockchainDocumentId
      );
    } catch (blockchainError) {
      console.error('Error getting blockchain accessors:', blockchainError);
    }

    res.json({
      document: {
        id: document._id,
        title: document.title,
        owner: document.owner,
        createdAt: document.createdAt,
        blockchainDocumentId: document.blockchainDocumentId
      },
      sharedWith: document.sharedWith.map(share => ({
        user: share.user,
        permissions: share.permissions,
        sharedAt: share.sharedAt
      })),
      blockchainAccessors,
      stats: {
        totalShares: document.sharedWith.length,
        downloadCount: document.downloadCount,
        lastAccessedAt: document.lastAccessedAt
      }
    });
  } catch (error) {
    console.error('Error getting document sharing info:', error);
    res.status(500).json({
      message: 'Error getting document sharing information'
    });
  }
});

// Batch share with multiple users
router.post('/batch-grant', authMiddleware, async (req, res) => {
  try {
    const { documentId, userEmails, permissions = 'read' } = req.body;
    const ownerId = req.user._id;

    // Validation
    if (!documentId || !userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
      return res.status(400).json({
        message: 'Document ID and array of user emails are required'
      });
    }

    if (userEmails.length > 50) {
      return res.status(400).json({
        message: 'Cannot share with more than 50 users at once'
      });
    }

    if (!['read', 'write'].includes(permissions)) {
      return res.status(400).json({
        message: 'Permissions must be either "read" or "write"'
      });
    }

    // Validate document ownership
    const document = await validateDocumentOwnership(documentId, ownerId);

    // Find all target users
    const targetUsers = await User.find({
      email: { $in: userEmails.map(email => email.toLowerCase().trim()) },
      isActive: true
    });

    if (targetUsers.length === 0) {
      return res.status(404).json({
        message: 'No valid users found'
      });
    }

    // Filter out owner and already shared users
    const validUsers = targetUsers.filter(user => {
      // Not the owner
      if (user._id.toString() === ownerId.toString()) return false;
      
      // Not already shared
      const alreadyShared = document.sharedWith.some(share => 
        share.user.toString() === user._id.toString()
      );
      return !alreadyShared;
    });

    if (validUsers.length === 0) {
      return res.status(400).json({
        message: 'No new users to share with (already shared or includes owner)'
      });
    }

    // Grant access on blockchain (batch operation)
    console.log('Granting batch access on blockchain...');
    const blockchainResult = await blockchainService.batchGrantAccess(
      ownerId.toString(),
      document.blockchainDocumentId,
      validUsers.map(user => user._id.toString())
    );

    // Update database
    const results = [];
    for (const user of validUsers) {
      const shareSuccess = document.shareWith(user._id, permissions);
      if (shareSuccess) {
        results.push({
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          },
          permissions,
          sharedAt: new Date(),
          success: true
        });
      }
    }

    await document.save();

    // Find users that weren't found
    const foundEmails = targetUsers.map(user => user.email);
    const notFoundEmails = userEmails
      .map(email => email.toLowerCase().trim())
      .filter(email => !foundEmails.includes(email));

    res.json({
      message: `Document shared with ${results.length} users successfully`,
      sharing: {
        documentId,
        documentTitle: document.title,
        successful: results,
        notFound: notFoundEmails,
        totalRequested: userEmails.length,
        totalShared: results.length
      },
      blockchain: {
        transactionHash: blockchainResult.transactionHash,
        blockNumber: blockchainResult.blockNumber,
        targetAddresses: blockchainResult.targetAddresses
      }
    });
  } catch (error) {
    console.error('Error in batch grant:', error);
    
    if (error.message === 'Document not found') {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    if (error.message === 'Only document owner can manage sharing') {
      return res.status(403).json({ message: 'Only document owner can share documents' });
    }
    
    res.status(500).json({
      message: 'Error sharing document with multiple users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check user's access to a specific document
router.get('/access/:documentId', authMiddleware, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user._id;

    const document = await Document.findById(documentId);
    
    if (!document || !document.isActive) {
      return res.status(404).json({ 
        message: 'Document not found',
        hasAccess: false 
      });
    }

    // Check database access
    const databaseAccess = document.hasAccess(userId);
    let blockchainAccess = false;

    // Check blockchain access
    try {
      blockchainAccess = await blockchainService.hasAccess(
        userId.toString(),
        document.blockchainDocumentId
      );
    } catch (blockchainError) {
      console.error('Error checking blockchain access:', blockchainError);
    }

    // User must have access in both systems
    const hasAccess = databaseAccess && blockchainAccess;
    const userPermission = document.getUserPermission(userId);

    res.json({
      hasAccess,
      permission: userPermission,
      document: {
        id: document._id,
        title: document.title,
        owner: document.owner,
        isOwner: document.owner.toString() === userId.toString()
      },
      verification: {
        database: databaseAccess,
        blockchain: blockchainAccess
      }
    });
  } catch (error) {
    console.error('Error checking document access:', error);
    res.status(500).json({
      message: 'Error checking document access',
      hasAccess: false
    });
  }
});

// Get user's sharing activity (documents they've shared)
router.get('/my-shares', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    // Find documents owned by user that have been shared
    const documents = await Document.find({
      owner: userId,
      isActive: true,
      'sharedWith.0': { $exists: true } // Has at least one share
    })
    .populate('sharedWith.user', 'name email')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Document.countDocuments({
      owner: userId,
      isActive: true,
      'sharedWith.0': { $exists: true }
    });

    const sharingActivity = documents.map(doc => ({
      document: {
        id: doc._id,
        title: doc.title,
        originalName: doc.originalName,
        createdAt: doc.createdAt
      },
      sharedWith: doc.sharedWith.map(share => ({
        user: share.user,
        permissions: share.permissions,
        sharedAt: share.sharedAt
      })),
      totalShares: doc.sharedWith.length
    }));

    res.json({
      sharingActivity,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error getting sharing activity:', error);
    res.status(500).json({
      message: 'Error getting sharing activity'
    });
  }
});

module.exports = router;