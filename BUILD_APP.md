# 📱 HandwerkOS App Build Anleitung

## Voraussetzungen

### Für Android:
- **Android Studio** installieren: https://developer.android.com/studio
- **Java JDK 17** (kommt meist mit Android Studio)
- Mindestens 8GB RAM empfohlen

### Für iOS (nur Mac):
- **Xcode** aus dem App Store
- **CocoaPods**: `sudo gem install cocoapods`
- Apple Developer Account ($99/Jahr für App Store)

## 🚀 App erstellen - Schritt für Schritt

### 1. Projekt bauen
```bash
npm run build
```

### 2. Capacitor synchronisieren
```bash
npx cap sync
```

### 3. Native Projekte hinzufügen (nur beim ersten Mal)
```bash
# Android
npx cap add android

# iOS (nur auf Mac)
npx cap add ios
```

### 4. Apps öffnen und bauen

#### Android:
```bash
# Android Studio öffnen
npx cap open android

# ODER direkt bauen:
cd android
./gradlew assembleDebug
# APK findest du in: android/app/build/outputs/apk/debug/
```

#### iOS (Mac):
```bash
# Xcode öffnen
npx cap open ios

# In Xcode:
# 1. Wähle dein Device/Simulator
# 2. Drücke Play Button
```

## 📲 App auf Handy installieren

### Android:
1. **Entwickleroptionen** auf Handy aktivieren
2. **USB-Debugging** einschalten
3. Handy per USB verbinden
4. `npx cap run android` ausführen

### iOS:
1. iPhone verbinden
2. In Xcode dein Device auswählen
3. Play drücken

## 🎯 Direkt-Installation (Alternative)

### Android APK:
```bash
# Debug APK bauen
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug

# APK ist hier:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Progressive Web App (PWA) - Ohne App Store:
Die App funktioniert bereits als PWA! Öffne einfach die Website auf dem Handy und:
- **Android**: Chrome Menu → "Zum Startbildschirm hinzufügen"
- **iOS**: Safari Share Button → "Zum Home-Bildschirm"

## 🔧 Nützliche Befehle

```bash
# Live Reload für Entwicklung
npx cap run android --livereload --external

# Logs anzeigen
npx cap run android --target [device-id] --livereload --consolelogs

# Alle Plattformen updaten
npm run build && npx cap sync
```

## ⚡ Capacitor Plugins für native Features

Bereits installiert:
- Camera (Fotos machen)
- Geolocation (Standort)
- Storage (Lokale Daten)
- Network (Online/Offline Status)

Weitere nützliche Plugins:
```bash
npm install @capacitor/push-notifications
npm install @capacitor/local-notifications  
npm install @capacitor/filesystem
npm install @capacitor/share
```

## 🚨 Häufige Probleme

### Android Studio findet SDK nicht:
1. File → Project Structure → SDK Location
2. Android SDK path setzen

### iOS Build Fehler:
```bash
cd ios/App
pod install
pod update
```

### Capacitor sync Fehler:
```bash
npx cap sync --deployment
```

## 📦 Release Build (für App Stores)

### Android (Google Play):
1. Erstelle Keystore: `keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000`
2. In `android/app/build.gradle` signieren konfigurieren
3. `./gradlew assembleRelease` oder `bundleRelease` für AAB

### iOS (App Store):
1. Apple Developer Account
2. Certificates & Provisioning Profiles in Xcode
3. Archive → Distribute App

## 💡 Tipps

- Teste immer auf echten Geräten
- Nutze Capacitor Live Reload für schnelle Entwicklung
- PWA ist oft ausreichend für interne Apps
- Capacitor hat bessere Web-Kompatibilität als Cordova