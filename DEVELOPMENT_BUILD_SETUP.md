# Expo Development Build Setup Guide

## Why Development Build?

Expo SDK 53+ removed remote push notifications from Expo Go. To use remote push notifications (which allow notifications even when the app is closed), you need a **development build**.

## Prerequisites

-  Expo account (create free at https://expo.dev)
-  Physical device (Android or iOS) for testing
-  USB cable for first-time installation

## Step-by-Step Setup

### Step 1: Install EAS CLI

Open a **new terminal** in your mobile directory and run:

```bash
cd /Users/sumukhamlbhat/Desktop/SmartMeds/mobile
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
eas login
```

Follow the prompts to log in with your Expo account. If you don't have one, create it at https://expo.dev

### Step 3: Configure Your Project

```bash
eas build:configure
```

This will create an `eas.json` file. Select:
- Platform: Choose **Android** (easier for first build) or **iOS** (requires Apple Developer account)

### Step 4: Build the Development Build

For **Android**:
```bash
eas build --profile development --platform android
```

For **iOS** (requires Apple Developer account):
```bash
eas build --profile development --platform ios
```

**Note:** The first build will take 10-20 minutes (builds on Expo servers).

### Step 5: Install on Your Device

After the build completes:

**Android:**
1. Download the APK from the Expo website link provided
2. Transfer to your phone
3. Install the APK (enable "Install from Unknown Sources" if needed)

**iOS:**
1. Register your device UDID at https://expo.dev
2. Download IPA and install via Xcode or TestFlight

### Step 6: Start Development Server

In your mobile directory, run:
```bash
npx expo start --dev-client
```

### Step 7: Open App on Device

1. Open the **SmartMeds** app you just installed (NOT Expo Go)
2. Scan the QR code from the terminal
3. App will load with full push notification support 

## Testing Push Notifications

Once the development build is running:

1. **Log in** to the app
2. **Grant notification permissions** when prompted
3. Check terminal/logs for your push token
4. Test medicine reminders and caregiver notifications

## Troubleshooting

### Build fails
- Make sure you're logged in: `eas whoami`
- Check your internet connection
- Try clearing cache: `expo start -c`

### Can't install APK on Android
- Enable "Install from Unknown Sources" in Settings
- Make sure USB debugging is enabled

### Push token not generated
- Check device permissions for notifications
- Restart the app after granting permissions
- Check Firebase console for any errors

## Next Steps

After the development build is working, we'll:
1. Implement caregiver notifications for medicine dispensing
2. Test all notification flows
3. Update documentation

---

**Quick Reference:**
- EAS Docs: https://docs.expo.dev/develop/development-builds/introduction/
- Push Notifications: https://docs.expo.dev/push-notifications/overview/
