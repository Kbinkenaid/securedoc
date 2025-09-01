const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative']
  },
  ipfsHash: {
    type: String,
    required: [true, 'IPFS hash is required'],
    unique: true
  },
  blockchainDocumentId: {
    type: String,
    required: [true, 'Blockchain document ID is required'],
    unique: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Document owner is required']
  },
  isEncrypted: {
    type: Boolean,
    default: false
  },
  encryptionKey: {
    type: String, // Only store if needed for server-side decryption
    select: false // Don't include in queries by default
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sharedAt: {
      type: Date,
      default: Date.now
    },
    permissions: {
      type: String,
      enum: ['read', 'write'],
      default: 'read'
    }
  }],
  downloadCount: {
    type: Number,
    default: 0
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
documentSchema.index({ owner: 1, isActive: 1 });
documentSchema.index({ 'sharedWith.user': 1, isActive: 1 });
documentSchema.index({ ipfsHash: 1 });
documentSchema.index({ blockchainDocumentId: 1 });

// Virtual for checking if document is shared
documentSchema.virtual('isShared').get(function() {
  return this.sharedWith && this.sharedWith.length > 0;
});

// Instance method to check if user has access
documentSchema.methods.hasAccess = function(userId) {
  // Owner always has access
  // Handle both populated and non-populated owner field
  const ownerId = this.owner._id ? this.owner._id.toString() : this.owner.toString();
  if (ownerId === userId.toString()) {
    return true;
  }
  
  // Check if user is in shared list
  return this.sharedWith.some(share => 
    share.user.toString() === userId.toString()
  );
};

// Instance method to get user's permission level
documentSchema.methods.getUserPermission = function(userId) {
  // Owner has all permissions
  // Handle both populated and non-populated owner field
  const ownerId = this.owner._id ? this.owner._id.toString() : this.owner.toString();
  if (ownerId === userId.toString()) {
    return 'owner';
  }
  
  // Find user in shared list
  const sharedEntry = this.sharedWith.find(share => 
    share.user.toString() === userId.toString()
  );
  
  return sharedEntry ? sharedEntry.permissions : null;
};

// Instance method to add user to shared list
documentSchema.methods.shareWith = function(userId, permissions = 'read') {
  // Don't share with owner
  if (this.owner.toString() === userId.toString()) {
    return false;
  }
  
  // Check if already shared
  const existingShare = this.sharedWith.find(share => 
    share.user.toString() === userId.toString()
  );
  
  if (existingShare) {
    // Update permissions if different
    if (existingShare.permissions !== permissions) {
      existingShare.permissions = permissions;
      existingShare.sharedAt = new Date();
      return true;
    }
    return false;
  }
  
  // Add new share
  this.sharedWith.push({
    user: userId,
    permissions: permissions,
    sharedAt: new Date()
  });
  
  return true;
};

// Instance method to remove user from shared list
documentSchema.methods.unshareWith = function(userId) {
  const initialLength = this.sharedWith.length;
  this.sharedWith = this.sharedWith.filter(share => 
    share.user.toString() !== userId.toString()
  );
  return this.sharedWith.length < initialLength;
};

module.exports = mongoose.model('Document', documentSchema);