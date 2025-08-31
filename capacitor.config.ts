
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.handwerkos.app',
  appName: 'HandwerkOS',
  webDir: 'dist',
  // Entferne server config für lokale App
  // server: {
  //   url: 'https://ihre-domain.de',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 200,
      backgroundColor: '#3b82f6',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    Geolocation: {
      permissions: ['location']
    },
    Camera: {
      permissions: ['camera', 'photos']
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#3b82f6'
    }
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false
  }
};

export default config;
