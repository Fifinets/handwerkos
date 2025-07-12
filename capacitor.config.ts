
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a0eb28b7447b47a280fca8181ec925b9',
  appName: 'handwerksmanager',
  webDir: 'dist',
  server: {
    url: 'https://a0eb28b7-447b-47a2-80fc-a8181ec925b9.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 200,
      backgroundColor: '#3b82f6',
      showSpinner: false
    },
    Geolocation: {
      permissions: ['location']
    }
  }
};

export default config;
