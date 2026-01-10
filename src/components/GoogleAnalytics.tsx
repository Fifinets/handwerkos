import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, trackPageView } from '@/utils/analytics';
import { Capacitor } from '@capacitor/core';

export const GoogleAnalytics = () => {
  const location = useLocation();

  // Initialisiere GA beim ersten Mount (nur Web)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      initGA();
    }
  }, []);

  // Tracke Seitenwechsel (nur Web)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Tracke den aktuellen Pfad
      trackPageView(location.pathname + location.search);
    }
  }, [location]);

  return null;
};