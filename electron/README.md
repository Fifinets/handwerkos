
# ElektroManager Pro Desktop App

## Setup für Desktop-Anwendung

### Voraussetzungen
- Node.js (Version 16 oder höher)
- npm oder yarn

### Installation

1. **Projekt exportieren** (GitHub Button in Lovable)
2. **Repository klonen** auf Ihren lokalen Computer
3. **Web-Dependencies installieren**:
   ```bash
   npm install
   ```

4. **Web-App builden**:
   ```bash
   npm run build
   ```

5. **In den Electron-Ordner wechseln**:
   ```bash
   cd electron
   ```

6. **Electron-Dependencies installieren**:
   ```bash
   npm install
   ```

### Entwicklung

**Desktop-App starten** (Development-Modus):
```bash
# Im Hauptordner: Web-App starten
npm run dev

# In einem neuen Terminal: Electron-App starten
cd electron
npm start
```

### Produktion

**Desktop-App für alle Plattformen bauen**:
```bash
cd electron
npm run dist
```

**Spezifische Plattformen**:
```bash
npm run dist-win    # Windows
npm run dist-mac    # macOS
npm run dist-linux  # Linux
```

Die fertigen Installer finden Sie im `electron/dist-electron` Ordner.

## Unterstützte Plattformen

- ✅ Windows (.exe Installer)
- ✅ macOS (.dmg und .app)
- ✅ Linux (AppImage)
- ✅ Web-Browser
- ✅ Mobile (iOS/Android via Capacitor)

## Funktionen

- Native Desktop-Menüs
- Automatische Updates möglich
- Plattformspezifische Icons
- Sicherheitskonfiguration
- Entwicklertools in Development-Modus
