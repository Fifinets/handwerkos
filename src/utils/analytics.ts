import ReactGA from 'react-ga4'
import { Capacitor } from '@capacitor/core'

/**
 * GOOGLE ANALYTICS CONFIGURATION
 * 
 * We use a custom loading mechanism to comply with GDPR/DSGVO.
 * No GA scripts are loaded or executed until the user grants consent via the CookieBanner.
 */

export const GA_MEASUREMENT_ID = 'G-M69SXHL9RX'

let isInitialized = false;
let pendingPageViews: string[] = [];

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    [key: string]: any;
  }
}

/**
 * Initializes and loads Google Analytics dynamically.
 * Configures Google Consent Mode V2.
 */
export const loadAnalytics = () => {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined') return;

  if (isInitialized || document.querySelector('script[data-ga="true"]')) {
    console.log('[Analytics] GA already loaded or initializing...');
    updateConsentState('granted');
    return;
  }

  console.log('[Analytics] Initializing Google Analytics with Consent Mode V2...');

  // 1. Initialize dataLayer and gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  // 2. Set Default Consent (to granted, because loadAnalytics is ONLY called after explicit user consent)
  window.gtag('consent', 'default', {
    'analytics_storage': 'granted',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'wait_for_update': 500
  });

  // 3. Basic gtag setup
  window.gtag('js', new Date());

  // 4. Load the script tag manually
  const gtagScript = document.createElement('script');
  gtagScript.setAttribute('data-ga', 'true');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

  gtagScript.onload = () => {
    console.log('[Analytics] GA Script loaded successfully.');

    try {
      // Initialize ReactGA4 - this will also trigger the 'config' call
      ReactGA.initialize(GA_MEASUREMENT_ID, {
        gaOptions: {
          anonymize_ip: true,
          cookie_flags: 'SameSite=None;Secure'
        }
      });

      isInitialized = true;
      console.log('[Analytics] ReactGA4 initialized.');

      // Process any pageviews that happened while we were loading
      if (pendingPageViews.length > 0) {
        console.log(`[Analytics] Processing ${pendingPageViews.length} pending page views.`);
        pendingPageViews.forEach(path => trackPageView(path));
        pendingPageViews = [];
      }
    } catch (err) {
      console.error('[Analytics] Failed to initialize ReactGA4:', err);
    }
  };

  gtagScript.onerror = () => {
    console.error('[Analytics] Failed to load GA script. Check network/AdBlock.');
  };

  document.head.appendChild(gtagScript);
};

export const updateConsentState = (state: 'granted' | 'denied') => {
  if (typeof window.gtag === 'function') {
    console.log(`[Analytics] Updating consent state to: ${state}`);
    window.gtag('consent', 'update', {
      'analytics_storage': state
    });
  }
};

export const removeAnalytics = () => {
  console.log('[Analytics] Revoking consent and removing analytics...');
  updateConsentState('denied');

  // Clear common GA cookies
  const cookies = document.cookie.split(';');
  const domain = window.location.hostname;
  const rootDomain = `.${domain.split('.').slice(-2).join('.')}`;

  cookies.forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    if (name.startsWith('_ga') || name.startsWith('_gid') || name.startsWith('_gat')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      if (domain.includes('.')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${rootDomain};`;
      }
    }
  });

  // Reload to ensure all trackers are dead
  window.location.reload();
};

export const initGA = () => {
  // Just a stub for backward compatibility
  console.log('[Analytics] initGA ignored - using consent-based loading.');
};

export const trackPageView = (path: string, title?: string) => {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined') return;

  if (!isInitialized) {
    console.log(`[Analytics] GA not ready. Queuing page view: ${path}`);
    pendingPageViews.push(path);
    return;
  }

  try {
    ReactGA.send({
      hitType: 'pageview',
      page: path,
      title: title || document.title
    });
    console.log(`[Analytics] Tracked page view: ${path}`);
  } catch (error) {
    console.error('[Analytics] Page view tracking failed:', error);
  }
};

export const trackEvent = (category: string, action: string, label?: string, value?: number) => {
  if (Capacitor.isNativePlatform() || !isInitialized) return;

  try {
    ReactGA.event({ category, action, label, value });
    console.log('[Analytics] Tracked event:', { category, action, label, value });
  } catch (error) {
    console.error('[Analytics] Event tracking failed:', error);
  }
};

// ... other export stubs for backward compatibility ...
export const setUserProperties = (props: any) => isInitialized && ReactGA.set(props);
export const trackConversion = (type: string, val?: number) => trackEvent('Conversion', type, undefined, val);
export const trackError = (err: string, fatal = false) => trackEvent('Error', err, fatal ? 'Fatal' : 'Non-Fatal');
export const trackTiming = (cat: string, varName: string, val: number, lab?: string) => trackEvent('Timing', cat, `${varName}${lab ? `: ${lab}` : ''}`, Math.round(val));
