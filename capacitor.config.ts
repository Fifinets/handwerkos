
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.handwerkos.employee',
  appName: 'HandwerkOS Employee',
  webDir: 'dist',
  server: {
    url: 'https://ihre-domain.de/employee',
    cleartext: true
  },
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
