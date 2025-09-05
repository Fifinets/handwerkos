#!/bin/bash

# HandwerkOS Android Build Script
echo "🔨 Building HandwerkOS Android App..."

# Check if Capacitor CLI is installed
if ! command -v npx cap &> /dev/null; then
    echo "❌ Capacitor CLI nicht gefunden. Installiere @capacitor/cli..."
    npm install -g @capacitor/cli
fi

# Check if Android Studio/SDK is available
if [ ! -d "$ANDROID_HOME" ]; then
    echo "❌ ANDROID_HOME nicht gesetzt. Stelle sicher, dass Android SDK installiert ist."
    echo "   Setze ANDROID_HOME Umgebungsvariable oder installiere Android Studio."
    exit 1
fi

# Step 1: Build web assets
echo "📦 Building web assets..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Web Build fehlgeschlagen"
    exit 1
fi

# Step 2: Copy web assets to Android
echo "📱 Copying web assets to Android..."
npx cap copy android

if [ $? -ne 0 ]; then
    echo "❌ Copy to Android fehlgeschlagen"
    exit 1
fi

# Step 3: Update Android dependencies and plugins
echo "🔄 Updating Android dependencies..."
npx cap update android

if [ $? -ne 0 ]; then
    echo "❌ Android Update fehlgeschlagen"
    exit 1
fi

# Step 4: Sync Android project
echo "🔄 Syncing Android project..."
npx cap sync android

if [ $? -ne 0 ]; then
    echo "❌ Android Sync fehlgeschlagen"
    exit 1
fi

# Step 5: Build Android APK
echo "🏗️  Building Android APK..."

# Check if gradlew exists
if [ -f "android/gradlew" ]; then
    cd android
    
    # Make gradlew executable
    chmod +x gradlew
    
    # Clean build
    echo "🧹 Cleaning previous builds..."
    ./gradlew clean
    
    # Build debug APK
    echo "📦 Building debug APK..."
    ./gradlew assembleDebug
    
    if [ $? -eq 0 ]; then
        echo "✅ Android Debug APK erfolgreich erstellt!"
        echo "📁 APK Pfad: android/app/build/outputs/apk/debug/app-debug.apk"
        
        # Check if APK exists and show size
        if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
            APK_SIZE=$(du -h app/build/outputs/apk/debug/app-debug.apk | cut -f1)
            echo "📏 APK Größe: $APK_SIZE"
        fi
    else
        echo "❌ Android Build fehlgeschlagen"
        exit 1
    fi
    
    cd ..
else
    echo "❌ gradlew nicht gefunden. Android Projekt möglicherweise nicht korrekt initialisiert."
    echo "💡 Versuche: npx cap add android"
    exit 1
fi

# Step 6: Optional - Open in Android Studio
read -p "🤔 Android Studio öffnen? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Opening Android Studio..."
    npx cap open android
fi

echo ""
echo "🎉 Android Build abgeschlossen!"
echo ""
echo "📱 Zum Testen auf einem Gerät:"
echo "   adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "🏗️  Zum Erstellen einer Release-Version:"
echo "   cd android && ./gradlew assembleRelease"
echo ""
echo "📊 Native Android Features verfügbar:"
echo "   ✅ Offline Zeiterfassung mit GPS"
echo "   ✅ Native Lieferschein-Signierung"
echo "   ✅ Hintergrund-Synchronisation"
echo "   ✅ Native Notifications"
echo "   ✅ Batterieoptimierung"
echo ""