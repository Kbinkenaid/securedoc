# Document Sharing API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Authentication Endpoints

### Register User
**POST** `/auth/register`

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### Login User
**POST** `/auth/login`

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "lastLoginAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### Get Current User
**GET** `/auth/me`

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "walletAddress": "0x...",
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### Search Users
**GET** `/auth/users/search?email=john`

**Response:**
```json
{
  "users": [
    {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

## Document Endpoints

### Upload Document
**POST** `/documents/upload`

Form data:
- `document`: File
- `title`: String (required)
- `description`: String (optional)
- `encrypt`: Boolean (optional)

**Response:**
```json
{
  "message": "Document uploaded successfully",
  "document": {
    "id": "document-id",
    "title": "My Document",
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1024,
    "ipfsHash": "QmHash...",
    "blockchainDocumentId": "0x...",
    "isEncrypted": false,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "owner": {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "blockchain": {
    "transactionHash": "0x...",
    "blockNumber": 12345,
    "walletAddress": "0x..."
  }
}
```

### Get My Documents
**GET** `/documents/mine?page=1&limit=10&search=query`

**Response:**
```json
{
  "documents": [
    {
      "id": "document-id",
      "title": "My Document",
      "originalName": "document.pdf",
      "mimeType": "application/pdf",
      "size": 1024,
      "isEncrypted": false,
      "downloadCount": 5,
      "sharedWith": [],
      "isShared": false,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "lastAccessedAt": "2023-01-01T00:00:00.000Z",
      "owner": {
        "id": "user-id",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### Get Shared Documents
**GET** `/documents/shared-with-me?page=1&limit=10&search=query`

**Response:**
```json
{
  "documents": [
    {
      "id": "document-id",
      "title": "Shared Document",
      "originalName": "shared.pdf",
      "mimeType": "application/pdf",
      "size": 1024,
      "isEncrypted": false,
      "downloadCount": 2,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "lastAccessedAt": "2023-01-01T00:00:00.000Z",
      "owner": {
        "id": "other-user-id",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "sharedAt": "2023-01-01T00:00:00.000Z",
      "permissions": "read"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### Get Document Details
**GET** `/documents/:id`

**Response:**
```json
{
  "document": {
    "id": "document-id",
    "title": "My Document",
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1024,
    "ipfsHash": "QmHash...",
    "blockchainDocumentId": "0x...",
    "isEncrypted": false,
    "downloadCount": 5,
    "sharedWith": [
      {
        "user": {
          "id": "user-id",
          "name": "Jane Doe",
          "email": "jane@example.com"
        },
        "permissions": "read",
        "sharedAt": "2023-01-01T00:00:00.000Z"
      }
    ],
    "isShared": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "lastAccessedAt": "2023-01-01T00:00:00.000Z",
    "owner": {
      "id": "owner-id",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "userPermission": "owner"
  }
}
```

### Download Document
**GET** `/documents/:id/download`

**Response:** File stream with appropriate headers

### Delete Document
**DELETE** `/documents/:id`

**Response:**
```json
{
  "message": "Document deleted successfully"
}
```

### Update Document
**PUT** `/documents/:id`

```json
{
  "title": "Updated Title",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "message": "Document updated successfully",
  "document": {
    "id": "document-id",
    "title": "Updated Title",
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1024,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

## Sharing Endpoints

### Grant Access
**POST** `/sharing/grant`

```json
{
  "documentId": "document-id",
  "userEmail": "user@example.com",
  "permissions": "read"
}
```

**Response:**
```json
{
  "message": "Document shared successfully",
  "sharing": {
    "documentId": "document-id",
    "documentTitle": "My Document",
    "sharedWith": {
      "id": "user-id",
      "name": "Jane Doe",
      "email": "jane@example.com"
    },
    "permissions": "read",
    "sharedAt": "2023-01-01T00:00:00.000Z"
  },
  "blockchain": {
    "transactionHash": "0x...",
    "blockNumber": 12345,
    "targetWalletAddress": "0x..."
  }
}
```

### Revoke Access
**POST** `/sharing/revoke`

```json
{
  "documentId": "document-id",
  "userId": "user-id"
}
```

**Response:**
```json
{
  "message": "Document access revoked successfully",
  "revocation": {
    "documentId": "document-id",
    "documentTitle": "My Document",
    "revokedFrom": {
      "id": "user-id",
      "name": "Jane Doe",
      "email": "jane@example.com"
    },
    "revokedAt": "2023-01-01T00:00:00.000Z"
  },
  "blockchain": {
    "transactionHash": "0x...",
    "blockNumber": 12345,
    "targetWalletAddress": "0x..."
  }
}
```

### Batch Grant Access
**POST** `/sharing/batch-grant`

```json
{
  "documentId": "document-id",
  "userEmails": ["user1@example.com", "user2@example.com"],
  "permissions": "read"
}
```

**Response:**
```json
{
  "message": "Document shared with 2 users successfully",
  "sharing": {
    "documentId": "document-id",
    "documentTitle": "My Document",
    "successful": [
      {
        "user": {
          "id": "user-id-1",
          "name": "User One",
          "email": "user1@example.com"
        },
        "permissions": "read",
        "sharedAt": "2023-01-01T00:00:00.000Z",
        "success": true
      }
    ],
    "notFound": ["nonexistent@example.com"],
    "totalRequested": 2,
    "totalShared": 1
  }
}
```

### Get Document Sharing Info
**GET** `/sharing/document/:id`

**Response:**
```json
{
  "document": {
    "id": "document-id",
    "title": "My Document",
    "owner": {
      "id": "owner-id",
      "name": "John Doe",
      "email": "john@example.com",
      "walletAddress": "0x..."
    },
    "createdAt": "2023-01-01T00:00:00.000Z",
    "blockchainDocumentId": "0x..."
  },
  "sharedWith": [
    {
      "user": {
        "id": "user-id",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "walletAddress": "0x..."
      },
      "permissions": "read",
      "sharedAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "blockchainAccessors": ["0x...", "0x..."],
  "stats": {
    "totalShares": 1,
    "downloadCount": 5,
    "lastAccessedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### Check Access
**GET** `/sharing/access/:documentId`

**Response:**
```json
{
  "hasAccess": true,
  "permission": "read",
  "document": {
    "id": "document-id",
    "title": "My Document",
    "owner": "owner-id",
    "isOwner": false
  },
  "verification": {
    "database": true,
    "blockchain": true
  }
}
```

### Get My Sharing Activity
**GET** `/sharing/my-shares?page=1&limit=10`

**Response:**
```json
{
  "sharingActivity": [
    {
      "document": {
        "id": "document-id",
        "title": "My Document",
        "originalName": "document.pdf",
        "createdAt": "2023-01-01T00:00:00.000Z"
      },
      "sharedWith": [
        {
          "user": {
            "id": "user-id",
            "name": "Jane Doe",
            "email": "jane@example.com"
          },
          "permissions": "read",
          "sharedAt": "2023-01-01T00:00:00.000Z"
        }
      ],
      "totalShares": 1
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

## Status Endpoints

### Health Check
**GET** `/health`

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "message": "Error description",
  "error": "Detailed error message (development only)",
  "errors": ["Array of validation errors (when applicable)"]
}
```

## HTTP Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error