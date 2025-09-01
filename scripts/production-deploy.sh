#!/bin/bash

# 🚀 Production Deployment Script
# Document Sharing Application

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."
echo "=================================="

# Check if required environment variables are set
check_env() {
    if [ -z "$POLYGON_RPC_URL" ] || [ "$POLYGON_RPC_URL" = "https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY" ]; then
        echo "❌ POLYGON_RPC_URL not configured in .env"
        exit 1
    fi
    
    if [ -z "$PRIVATE_KEY" ] || [ "$PRIVATE_KEY" = "your_wallet_private_key_for_contract_deployment" ]; then
        echo "❌ PRIVATE_KEY not configured in .env"
        exit 1
    fi
    
    echo "✅ Environment variables configured"
}

# Check wallet balance
check_balance() {
    echo "💰 Checking wallet balance..."
    
    node -e "
    const { ethers } = require('ethers');
    async function checkBalance() {
        const provider = new ethers.JsonRpcProvider('$POLYGON_RPC_URL');
        const wallet = new ethers.Wallet('$PRIVATE_KEY', provider);
        
        try {
            const balance = await provider.getBalance(wallet.address);
            const balanceEth = ethers.formatEther(balance);
            console.log('Address:', wallet.address);
            console.log('Balance:', balanceEth, 'MATIC');
            
            if (balance === 0n) {
                console.log('❌ Wallet has no MATIC for deployment!');
                console.log('   Get test MATIC from: https://faucet.polygon.technology/');
                process.exit(1);
            } else {
                console.log('✅ Wallet has sufficient balance');
            }
        } catch (error) {
            console.error('❌ Error checking balance:', error.message);
            process.exit(1);
        }
    }
    checkBalance();
    " || exit 1
}

# Deploy smart contract
deploy_contract() {
    echo "📋 Deploying smart contract to Mumbai..."
    
    # Ensure contracts directory exists
    if [ ! -f "hardhat-contracts/SimpleDocumentSharing.sol" ]; then
        echo "❌ Smart contract not found at hardhat-contracts/SimpleDocumentSharing.sol"
        echo "   Copying from contracts/ directory..."
        cp contracts/SimpleDocumentSharing.sol hardhat-contracts/ || exit 1
    fi
    
    # Deploy contract
    npx hardhat run scripts/deploy-contract.js --network mumbai
    
    echo "✅ Smart contract deployment completed"
}

# Update backend configuration
update_backend() {
    echo "🔄 Updating backend configuration..."
    
    # Read deployed contract address from deployment file
    if [ -f "deployment-mumbai.json" ]; then
        CONTRACT_ADDRESS=$(node -e "console.log(require('./deployment-mumbai.json').contractAddress)")
        
        # Update .env file
        sed -i.bak "s/CONTRACT_ADDRESS=.*/CONTRACT_ADDRESS=$CONTRACT_ADDRESS/" .env
        echo "✅ Updated CONTRACT_ADDRESS in .env: $CONTRACT_ADDRESS"
    else
        echo "⚠️  Deployment file not found, CONTRACT_ADDRESS not updated"
    fi
}

# Test production configuration
test_production() {
    echo "🧪 Testing production configuration..."
    
    # Test blockchain connection
    echo "  Testing blockchain connection..."
    node -e "
    const { ethers } = require('ethers');
    async function test() {
        const provider = new ethers.JsonRpcProvider('$POLYGON_RPC_URL');
        const network = await provider.getNetwork();
        console.log('  ✅ Connected to network:', network.name, '(Chain ID:', network.chainId.toString() + ')');
    }
    test().catch(console.error);
    " || echo "  ⚠️  Blockchain connection test failed"
    
    # Test MongoDB connection
    echo "  Testing MongoDB connection..."
    node -e "
    const mongoose = require('mongoose');
    mongoose.connect('$MONGODB_URI')
        .then(() => {
            console.log('  ✅ MongoDB connection successful');
            mongoose.disconnect();
        })
        .catch(err => console.log('  ⚠️  MongoDB connection failed:', err.message));
    " || echo "  ⚠️  MongoDB connection test failed"
    
    echo "✅ Production configuration tests completed"
}

# Create mobile app
create_mobile_app() {
    echo "📱 Setting up React Native mobile app..."
    
    cd ..
    
    if [ ! -d "DocumentSharingApp" ]; then
        echo "  Creating new React Native project..."
        npx @react-native-community/cli init DocumentSharingApp
        
        cd DocumentSharingApp
        
        echo "  Installing dependencies..."
        npm install @react-native-async-storage/async-storage \
                   react-native-document-picker \
                   @react-navigation/native \
                   @react-navigation/stack \
                   @react-navigation/bottom-tabs \
                   axios
        
        # iOS setup
        if [ -d "ios" ]; then
            echo "  Setting up iOS dependencies..."
            cd ios && pod install && cd ..
        fi
        
        echo "✅ React Native app created successfully"
        echo "   Next: Copy integration code from MOBILE_APP_INTEGRATION.md"
    else
        echo "  ✅ React Native app already exists"
    fi
    
    cd ../document-sharing-backend
}

# Create production deployment package
create_deployment_package() {
    echo "📦 Creating deployment package..."
    
    # Create deployment directory
    mkdir -p deployment-package
    
    # Copy necessary files
    cp -r models routes middleware services scripts deployment-package/
    cp server.js package.json hardhat.config.js deployment-package/
    cp deployment-mumbai.json deployment-package/ 2>/dev/null || true
    
    # Create production .env template
    cat > deployment-package/.env.production << EOF
NODE_ENV=production
PORT=3000

# Update with your production MongoDB URI
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/document_sharing

# Generate a strong JWT secret (min 32 characters)
JWT_SECRET=$JWT_SECRET

# Blockchain Configuration
POLYGON_RPC_URL=$POLYGON_RPC_URL
PRIVATE_KEY=$PRIVATE_KEY
CONTRACT_ADDRESS=$CONTRACT_ADDRESS

# IPFS Configuration (optional)
IPFS_PROJECT_ID=your_infura_ipfs_project_id
IPFS_PROJECT_SECRET=your_infura_ipfs_secret
EOF

    echo "✅ Deployment package created in deployment-package/"
    echo "   Copy this directory to your production server"
}

# Main deployment process
main() {
    echo "Starting deployment process..."
    echo ""
    
    # Load environment variables
    set -a
    source .env
    set +a
    
    # Run deployment steps
    check_env
    check_balance
    deploy_contract
    update_backend
    test_production
    create_mobile_app
    create_deployment_package
    
    echo ""
    echo "🎉 Production Deployment Completed Successfully!"
    echo "=============================================="
    echo ""
    echo "📋 Next Steps:"
    echo "1. Your wallet: $(node -e "console.log(new (require('ethers')).Wallet('$PRIVATE_KEY').address)")"
    echo "2. Contract deployed to: $CONTRACT_ADDRESS"
    echo "3. Copy deployment-package/ to your production server"
    echo "4. Set up production MongoDB (MongoDB Atlas)"
    echo "5. Deploy backend to Railway/Heroku"
    echo "6. Update mobile app API_BASE_URL"
    echo "7. Test end-to-end functionality"
    echo ""
    echo "📚 See DEPLOY_INSTRUCTIONS.md for detailed next steps"
}

# Run main function
main