#!/bin/bash

# SmartMeds Development Build Helper Script
# This script helps you build and install the development build for push notifications

echo "🚀 SmartMeds Development Build Helper"
echo "======================================"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "📦 Installing EAS CLI..."
    npm install -g eas-cli
else
    echo "✅ EAS CLI already installed"
fi

# Check if logged in
echo ""
echo "🔐 Checking EAS login status..."
if ! eas whoami &> /dev/null; then
    echo "Please log in to your Expo account:"
    eas login
else
    echo "✅ Already logged in as: $(eas whoami)"
fi

# Platform selection
echo ""
echo "📱 Select platform to build:"
echo "  1) Android (recommended - no Apple Developer account needed)"
echo "  2) iOS (requires Apple Developer account)"
echo "  3) Both"
read -p "Enter choice (1-3): " platform_choice

case $platform_choice in
    1)
        echo ""
        echo "🔨 Building Android development build..."
        eas build --profile development --platform android
        ;;
    2)
        echo ""
        echo "🔨 Building iOS development build..."
        eas build --profile development --platform ios
        ;;
    3)
        echo ""
        echo "🔨 Building Android and iOS development builds..."
        eas build --profile development --platform all
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo " Build started!"
echo ""
echo "Next steps:"
echo "  1. Wait for build to complete (~10-20 minutes)"
echo "  2. Download the APK/IPA from the link provided"
echo "  3. Install on your device"
echo "  4. Run: npx expo start --dev-client"
echo "  5. Open the SmartMeds app on your device (not Expo Go)"
echo "  6. Scan the QR code"
echo ""
echo " For detailed instructions, see: DEVELOPMENT_BUILD_SETUP.md"
