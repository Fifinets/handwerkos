# HandwerkOS Android App

Diese native Android-App erweitert die HandwerkOS Web-App um plattformspezifische Funktionen für Handwerker.

## 🚀 Features

### ⏱️ Zeiterfassung
- **Offline-fähige Zeiterfassung** mit automatischer GPS-Lokalisierung
- **Hintergrund-Tracking** auch bei gesperrtem Bildschirm
- **Batterieoptimierung** für längere Laufzeit
- **Automatische Synchronisation** bei Internetverbindung

### 📋 Lieferscheine
- **Native Signatur-Erfassung** mit Touch-Unterstützung
- **Offline-Signierung** mit späterer Synchronisation
- **PDF-Generierung** auf dem Gerät
- **Foto-Anhänge** für Dokumentation

### 🔄 Offline-Synchronisation
- **Intelligente Warteschlange** für offline Aktionen
- **Konfliktlösung** bei Datenabweichungen
- **Netzwerk-Monitoring** mit automatischer Synchronisation
- **Datenintegrität** durch Transaktions-Management

## 🛠️ Native Android Plugins

### TimeTrackingPlugin
```java
// Zeiterfassung starten
TimeTracking.startTimeTracking({
  projectId: "project-123",
  projectName: "Baustelle Nord", 
  description: "Rohbau Arbeiten"
});

// Aktive Session abrufen
TimeTracking.getActiveTimeTracking();

// Zeiterfassung beenden
TimeTracking.stopTimeTracking({
  notes: "Fertigstellung Wand A"
});
```

### DeliveryNotesPlugin  
```java
// Ausstehende Lieferscheine abrufen
DeliveryNotes.getPendingDeliveryNotes();

// Lieferschein signieren
DeliveryNotes.signDeliveryNote({
  deliveryNoteId: "DN-2025-001",
  signerName: "Max Mustermann",
  signatureData: { /* Signature paths */ }
});
```

### OfflineSyncPlugin
```java
// Offline-Aktion hinzufügen
OfflineSync.addOfflineAction({
  actionType: "START_TIME",
  actionData: { projectId: "123" }
});

// Netzwerkstatus prüfen
OfflineSync.getNetworkStatus();

// Warteschlange verarbeiten
OfflineSync.getPendingActions();
```

## 🏗️ Build Prozess

### Voraussetzungen
- Node.js 18+
- Android Studio mit SDK 30+
- Java 11+
- Capacitor CLI

### Quick Start
```bash
# 1. Dependencies installieren
npm install

# 2. Web-App builden
npm run build

# 3. Android-App builden
./scripts/build-android.sh
```

### Manueller Build
```bash
# Web assets kopieren
npx cap copy android

# Android Projekt synchronisieren  
npx cap sync android

# In Android Studio öffnen
npx cap open android

# Oder APK direkt erstellen
cd android
./gradlew assembleDebug
```

## 📱 Installation & Testing

### Debug APK installieren
```bash
# Über ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Oder über Android Studio
# File → Open → android/ Ordner auswählen
```

### Testing auf Emulator
```bash
# Emulator starten
emulator -avd Pixel_API_30

# App installieren und testen
./scripts/build-android.sh
```

## 🔒 Berechtigungen

Die App benötigt folgende Android-Berechtigungen:

- **LOCATION**: GPS-Tracking für Zeiterfassung
- **WAKE_LOCK**: Hintergrund-Zeiterfassung
- **CAMERA**: Foto-Anhänge für Lieferscheine  
- **STORAGE**: Lokale Datenspeicherung
- **NETWORK**: Synchronisation mit Server
- **NOTIFICATIONS**: Status-Updates

## 🏃‍♂️ Performance

### Batterieoptimierung
- Intelligente GPS-Nutzung nur bei aktiver Zeiterfassung
- Minimale Background Services
- Effiziente Datensynchronisation

### Offline-Capabilities  
- Vollständige Funktionalität ohne Internet
- Automatische Synchronisation bei Verbindung
- Konfliktlösung bei Datenabweichungen

### Native Performance
- Java/Kotlin statt JavaScript für kritische Funktionen
- Native UI-Komponenten für bessere UX
- Hardware-beschleunigte Signatur-Erfassung

## 🐛 Troubleshooting

### Build Fehler
```bash
# Android SDK nicht gefunden
export ANDROID_HOME=/path/to/android-sdk

# Gradle Probleme
cd android && ./gradlew clean

# Capacitor Sync Probleme  
npx cap doctor
```

### Runtime Fehler
```bash
# Plugin nicht registriert
# → MainActivity.java prüfen

# Berechtigung nicht erteilt
# → AndroidManifest.xml prüfen

# Native Bridge Fehler
# → Capacitor Console logs prüfen
```

## 🔄 Updates

### App Updates
```bash
# Web-Code Updates
npm run build && npx cap copy android

# Plugin Updates  
npx cap sync android

# Vollständiger Rebuild
./scripts/build-android.sh
```

### Plugin Updates
Neue Plugin-Versionen in `MainActivity.java` registrieren:
```java
registerPlugin(NewPlugin.class);
```

## 📊 Monitoring

### Debug Logging
```bash
# Android Logs anzeigen
adb logcat | grep Capacitor

# Plugin-spezifische Logs
adb logcat | grep TimeTracking
```

### Performance Monitoring
- Android Studio Profiler nutzen
- Memory Leaks überwachen
- Battery Usage analysieren

## 🤝 Contributing

1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/android-enhancement`)  
3. Änderungen committen (`git commit -am 'Add Android feature'`)
4. Branch pushen (`git push origin feature/android-enhancement`)
5. Pull Request erstellen

## 📜 Lizenz

Diese Android-Implementierung folgt der gleichen Lizenz wie das Haupt-HandwerkOS Projekt.