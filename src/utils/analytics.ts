import ReactGA from 'react-ga4'
import { Capacitor } from '@capacitor/core'

// Google Analytics Measurement ID
export const GA_MEASUREMENT_ID = 'G-M69SXHL9RX'

// Check if gtag is available
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

/**
 * Initializes and loads Google Analytics dynamically, ensuring it's only loaded once.
 * Also configures Google Consent Mode V2 to 'granted'.
 */
export const loadAnalytics = () => {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined') return;

  // Prevent duplicate injection if the script is already there
  if (document.querySelector('script[data-ga="true"]')) {
    updateConsentState('granted');
    return;
  }

  // Initialize dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  // Google Consent Mode V2 - Set initial state to granted since this function 
  // is only called AFTER the user explicitly opts in.
  window.gtag('consent', 'default', {
    'analytics_storage': 'granted',
    'ad_storage': 'denied', // We only use GA for analytics, no ads
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
  });

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // ReactGA handles this
    anonymize_ip: true,
    cookie_flags: 'SameSite=None;Secure'
  });

  // Inject the GA scripts
  const gtagScript = document.createElement('script');
  gtagScript.setAttribute('data-ga', 'true');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

  gtagScript.onload = () => {
    // Initialize ReactGA4 after the script has loaded
    ReactGA.initialize(GA_MEASUREMENT_ID, {
      gaOptions: {
        anonymize_ip: true,
        cookie_flags: 'SameSite=None;Secure'
      }
    });
  };

  document.head.appendChild(gtagScript);
};

/**
 * Updates the Google Consent Mode V2 state dynamically
 */
export const updateConsentState = (state: 'granted' | 'denied') => {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      'analytics_storage': state
    });
  }
};

/**
 * Disables tracking and attempts to remove existing GA cookies.
 * Used when a user revokes consent.
 */
export const removeAnalytics = () => {
  // Update Consent Mode V2 immediately
  updateConsentState('denied');

  // GA sets cookies on the primary domain and subdomains.
  // We attempt to delete the most common GA cookies (_ga, _gat, _gid, etc.)
  const cookies = document.cookie.split(';');
  const domain = window.location.hostname;
  const rootDomain = `.${domain.split('.').slice(-2).join('.')}`;
  const gaCookiesPrefixes = ['_ga', '_gid', '_gat'];

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const cookieNameWrapper = cookie.split('=')[0];
    if (!cookieNameWrapper) continue;

    const cookieName = cookieNameWrapper.trim();
    const isGaCookie = gaCookiesPrefixes.some(prefix => cookieName.startsWith(prefix));

    if (isGaCookie) {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      if (domain.includes('.')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${rootDomain};`;
      }
    }
  }

  // Force page reload to ensure scripts stop sending pulses and memory is cleared
  window.location.reload();
};

export const initGA = () => {
  // We no longer auto-initialize GA here.
  // It is now strictly handled by loadAnalytics() after user consent.
  console.log('initGA called but ignored; GA is now loaded via user consent.');
};

// Seiten-Tracking
export const trackPageView = (path: string, title?: string) => {
  // Nur auf Web-Plattform tracken
  if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
    try {
      // Versuche React-GA4
      ReactGA.send({
        hitType: 'pageview',
        page: path,
        title: title || document.title
      })
      console.log('Page view tracked:', path)
    } catch (error) {
      // Fallback: Direkt gtag verwenden
      if (typeof window.gtag !== 'undefined') {
        window.gtag('config', GA_MEASUREMENT_ID, {
          page_path: path,
          page_title: title || document.title
        })
        console.log('Page view tracked via gtag:', path)
      } else {
        console.error('Failed to track page view:', error)
      }
    }
  }
}

// Event-Tracking
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  // Nur auf Web-Plattform tracken
  if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
    try {
      // Versuche React-GA4
      ReactGA.event({
        category,
        action,
        label,
        value
      })
      console.log('Event tracked:', { category, action, label, value })
    } catch (error) {
      // Fallback: Direkt gtag verwenden
      if (typeof window.gtag !== 'undefined') {
        window.gtag('event', action, {
          event_category: category,
          event_label: label,
          value: value
        })
        console.log('Event tracked via gtag:', { category, action, label, value })
      } else {
        console.error('Failed to track event:', error)
      }
    }
  }
}

// User-Eigenschaften setzen (z.B. für User-Segmentierung)
export const setUserProperties = (properties: Record<string, any>) => {
  // Nur auf Web-Plattform
  if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
    try {
      ReactGA.set(properties)
    } catch (error) {
      console.error('Failed to set user properties:', error)
    }
  }
}

// Conversion-Tracking (z.B. für Registrierungen)
export const trackConversion = (conversionType: string, value?: number) => {
  trackEvent('Conversion', conversionType, undefined, value)
}

// Fehler-Tracking
export const trackError = (error: string, fatal: boolean = false) => {
  // Nur auf Web-Plattform
  if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
    try {
      ReactGA.event({
        category: 'Error',
        action: error,
        label: fatal ? 'Fatal' : 'Non-Fatal'
      })
    } catch (err) {
      console.error('Failed to track error:', err)
    }
  }
}

// Timing-Tracking (z.B. für Performance-Messungen)
export const trackTiming = (
  category: string,
  variable: string,
  value: number,
  label?: string
) => {
  // Nur auf Web-Plattform
  if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
    try {
      ReactGA.event({
        category: 'Timing',
        action: category,
        label: `${variable}${label ? `: ${label}` : ''}`,
        value: Math.round(value)
      })
    } catch (error) {
      console.error('Failed to track timing:', error)
    }
  }
}