// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title DocumentSharing
 * @dev Smart contract for managing document sharing permissions on IPFS
 * @notice This contract manages access control for documents stored on IPFS
 */
contract DocumentSharing is Ownable, ReentrancyGuard, Pausable {
    
    struct Document {
        string ipfsHash;        // IPFS hash of the document
        address owner;          // Owner of the document
        uint256 createdAt;      // Timestamp when document was added
        bool exists;            // Flag to check if document exists
        string metadata;        // Optional metadata (title, description, etc.)
    }
    
    // Mapping from document ID to Document struct
    mapping(bytes32 => Document) public documents;
    
    // Mapping from document ID to user address to access permission
    mapping(bytes32 => mapping(address => bool)) public accessList;
    
    // Mapping from document ID to array of addresses with access
    mapping(bytes32 => address[]) public documentAccessors;
    
    // Mapping from user address to their owned document IDs
    mapping(address => bytes32[]) public userDocuments;
    
    // Mapping from user address to document IDs they have access to
    mapping(address => bytes32[]) public userAccessibleDocuments;
    
    // Events
    event DocumentAdded(
        bytes32 indexed documentId, 
        address indexed owner, 
        string ipfsHash,
        string metadata
    );
    
    event AccessGranted(
        bytes32 indexed documentId, 
        address indexed owner,
        address indexed user
    );
    
    event AccessRevoked(
        bytes32 indexed documentId, 
        address indexed owner,
        address indexed user
    );
    
    event DocumentRemoved(
        bytes32 indexed documentId, 
        address indexed owner
    );
    
    event DocumentUpdated(
        bytes32 indexed documentId, 
        address indexed owner,
        string newIpfsHash,
        string newMetadata
    );
    
    // Modifiers
    modifier documentExists(bytes32 documentId) {
        require(documents[documentId].exists, "Document does not exist");
        _;
    }
    
    modifier onlyDocumentOwner(bytes32 documentId) {
        require(documents[documentId].owner == msg.sender, "Only document owner can perform this action");
        _;
    }
    
    modifier hasAccess(bytes32 documentId) {
        require(
            documents[documentId].owner == msg.sender || accessList[documentId][msg.sender],
            "Access denied"
        );
        _;
    }
    
    constructor() {}
    
    /**
     * @dev Add a new document to the contract
     * @param documentId Unique identifier for the document
     * @param ipfsHash IPFS hash of the document
     * @param metadata Optional metadata for the document
     */
    function addDocument(
        bytes32 documentId,
        string calldata ipfsHash,
        string calldata metadata
    ) external whenNotPaused nonReentrant {
        require(!documents[documentId].exists, "Document already exists");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        
        documents[documentId] = Document({
            ipfsHash: ipfsHash,
            owner: msg.sender,
            createdAt: block.timestamp,
            exists: true,
            metadata: metadata
        });
        
        // Add to user's document list
        userDocuments[msg.sender].push(documentId);
        
        emit DocumentAdded(documentId, msg.sender, ipfsHash, metadata);
    }
    
    /**
     * @dev Grant access to a document
     * @param documentId ID of the document
     * @param user Address to grant access to
     */
    function grantAccess(bytes32 documentId, address user) 
        external 
        whenNotPaused 
        nonReentrant 
        documentExists(documentId) 
        onlyDocumentOwner(documentId) 
    {
        require(user != address(0), "Invalid user address");
        require(user != msg.sender, "Cannot grant access to yourself");
        require(!accessList[documentId][user], "User already has access");
        
        accessList[documentId][user] = true;
        documentAccessors[documentId].push(user);
        userAccessibleDocuments[user].push(documentId);
        
        emit AccessGranted(documentId, msg.sender, user);
    }
    
    /**
     * @dev Revoke access to a document
     * @param documentId ID of the document
     * @param user Address to revoke access from
     */
    function revokeAccess(bytes32 documentId, address user) 
        external 
        whenNotPaused 
        nonReentrant 
        documentExists(documentId) 
        onlyDocumentOwner(documentId) 
    {
        require(user != address(0), "Invalid user address");
        require(accessList[documentId][user], "User does not have access");
        
        accessList[documentId][user] = false;
        
        // Remove from documentAccessors array
        _removeFromArray(documentAccessors[documentId], user);
        
        // Remove from userAccessibleDocuments array
        _removeDocumentFromUserArray(userAccessibleDocuments[user], documentId);
        
        emit AccessRevoked(documentId, msg.sender, user);
    }
    
    /**
     * @dev Check if a user has access to a document
     * @param documentId ID of the document
     * @param user Address to check access for
     * @return bool True if user has access, false otherwise
     */
    function hasAccess(bytes32 documentId, address user) 
        external 
        view 
        documentExists(documentId) 
        returns (bool) 
    {
        return documents[documentId].owner == user || accessList[documentId][user];
    }
    
    /**
     * @dev Get document information
     * @param documentId ID of the document
     * @return ipfsHash IPFS hash of the document
     * @return owner Owner address
     * @return createdAt Creation timestamp
     * @return metadata Document metadata
     */
    function getDocument(bytes32 documentId) 
        external 
        view 
        documentExists(documentId) 
        hasAccess(documentId) 
        returns (string memory ipfsHash, address owner, uint256 createdAt, string memory metadata) 
    {
        Document memory doc = documents[documentId];
        return (doc.ipfsHash, doc.owner, doc.createdAt, doc.metadata);
    }
    
    /**
     * @dev Get all users who have access to a document
     * @param documentId ID of the document
     * @return Array of addresses with access
     */
    function getDocumentAccessors(bytes32 documentId) 
        external 
        view 
        documentExists(documentId) 
        onlyDocumentOwner(documentId) 
        returns (address[] memory) 
    {
        return documentAccessors[documentId];
    }
    
    /**
     * @dev Get all documents owned by a user
     * @param user User address
     * @return Array of document IDs owned by the user
     */
    function getUserDocuments(address user) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return userDocuments[user];
    }
    
    /**
     * @dev Get all documents accessible to a user (not owned by them)
     * @param user User address
     * @return Array of document IDs accessible to the user
     */
    function getUserAccessibleDocuments(address user) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return userAccessibleDocuments[user];
    }
    
    /**
     * @dev Update document IPFS hash and metadata (for document versions)
     * @param documentId ID of the document
     * @param newIpfsHash New IPFS hash
     * @param newMetadata New metadata
     */
    function updateDocument(
        bytes32 documentId,
        string calldata newIpfsHash,
        string calldata newMetadata
    ) 
        external 
        whenNotPaused 
        nonReentrant 
        documentExists(documentId) 
        onlyDocumentOwner(documentId) 
    {
        require(bytes(newIpfsHash).length > 0, "IPFS hash cannot be empty");
        
        documents[documentId].ipfsHash = newIpfsHash;
        documents[documentId].metadata = newMetadata;
        
        emit DocumentUpdated(documentId, msg.sender, newIpfsHash, newMetadata);
    }
    
    /**
     * @dev Remove a document and revoke all access
     * @param documentId ID of the document to remove
     */
    function removeDocument(bytes32 documentId) 
        external 
        whenNotPaused 
        nonReentrant 
        documentExists(documentId) 
        onlyDocumentOwner(documentId) 
    {
        // Revoke access for all users
        address[] memory accessors = documentAccessors[documentId];
        for (uint256 i = 0; i < accessors.length; i++) {
            address user = accessors[i];
            accessList[documentId][user] = false;
            _removeDocumentFromUserArray(userAccessibleDocuments[user], documentId);
        }
        
        // Remove from owner's document list
        _removeDocumentFromUserArray(userDocuments[msg.sender], documentId);
        
        // Clear accessor list
        delete documentAccessors[documentId];
        
        // Mark document as non-existent
        documents[documentId].exists = false;
        
        emit DocumentRemoved(documentId, msg.sender);
    }
    
    /**
     * @dev Batch grant access to multiple users
     * @param documentId ID of the document
     * @param users Array of user addresses to grant access to
     */
    function batchGrantAccess(bytes32 documentId, address[] calldata users) 
        external 
        whenNotPaused 
        nonReentrant 
        documentExists(documentId) 
        onlyDocumentOwner(documentId) 
    {
        require(users.length > 0, "Users array cannot be empty");
        require(users.length <= 50, "Too many users in batch");
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            require(user != address(0), "Invalid user address");
            require(user != msg.sender, "Cannot grant access to yourself");
            
            if (!accessList[documentId][user]) {
                accessList[documentId][user] = true;
                documentAccessors[documentId].push(user);
                userAccessibleDocuments[user].push(documentId);
                
                emit AccessGranted(documentId, msg.sender, user);
            }
        }
    }
    
    /**
     * @dev Emergency pause function (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Emergency unpause function (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Internal helper functions
    
    /**
     * @dev Remove an address from an array
     */
    function _removeFromArray(address[] storage array, address element) internal {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == element) {
                array[i] = array[array.length - 1];
                array.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Remove a document ID from user's array
     */
    function _removeDocumentFromUserArray(bytes32[] storage array, bytes32 documentId) internal {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == documentId) {
                array[i] = array[array.length - 1];
                array.pop();
                break;
            }
        }
    }
}