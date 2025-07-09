
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  // Erstelle das Browser-Fenster
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png'),
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  // Lade die App
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    // Öffne DevTools in Development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Zeige Fenster wenn bereit
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Verhindere externe Links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Diese Methode wird aufgerufen, wenn Electron initialisiert wurde
app.whenReady().then(() => {
  createWindow();

  // Erstelle Application Menu
  const template = [
    {
      label: 'ElektroManager Pro',
      submenu: [
        {
          label: 'Über ElektroManager Pro',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Dienste',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'ElektroManager Pro ausblenden',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Andere ausblenden',
          accelerator: 'Command+Alt+H',
          role: 'hideothers'
        },
        {
          label: 'Alle einblenden',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Beenden',
          accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { label: 'Rückgängig', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Wiederholen', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Ausschneiden', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Kopieren', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Einfügen', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Entwicklertools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Vollbild', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Fenster',
      submenu: [
        { label: 'Minimieren', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Schließen', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// Beende App wenn alle Fenster geschlossen sind
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Sicherheit: Verhindere neue Fenster
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    navigationEvent.preventDefault();
    require('electron').shell.openExternal(navigationURL);
  });
});
