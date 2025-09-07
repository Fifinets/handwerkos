import ReactGA from 'react-ga4'
import { Capacitor } from '@capacitor/core'

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = 'G-M69SXHL9RX'

// Check if gtag is available
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Initialisiere Google Analytics nur für Web, nicht für Mobile Apps
export const initGA = () => {
  // Nur auf Web-Plattform initialisieren, nicht in der mobilen App
  if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
    try {
      // Warte bis gtag verfügbar ist (vom HTML Script)
      if (typeof window.gtag !== 'undefined') {
        ReactGA.initialize(GA_MEASUREMENT_ID, {
          gaOptions: {
            anonymize_ip: true, // IP-Anonymisierung für DSGVO
            cookie_flags: 'SameSite=None;Secure' // Sichere Cookie-Einstellungen
          }
        })
        console.log('Google Analytics initialized with React-GA4')
      } else {
        console.warn('gtag not available, using fallback initialization')
        // Fallback: Direkt über gtag wenn React-GA4 nicht funktioniert
        setTimeout(() => initGA(), 100)
      }
    } catch (error) {
      console.error('Failed to initialize Google Analytics:', error)
    }
  }
}

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