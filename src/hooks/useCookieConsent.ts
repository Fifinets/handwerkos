import { useState, useEffect } from 'react';

// Current version of our cookie consent policy
const CONSENT_VERSION = 1;
const STORAGE_KEY = 'handwerkos_cookie_consent';

export type ConsentStatus = 'accepted' | 'rejected' | 'pending';

export interface ConsentData {
    status: ConsentStatus;
    version: number;
    timestamp: number;
}

export function useCookieConsent() {
    const [consentStatus, setConsentStatus] = useState<ConsentStatus>('pending');
    const [isBannerVisible, setIsBannerVisible] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as ConsentData;
                // If the version matches, use the stored preference
                if (parsed.version === CONSENT_VERSION) {
                    setConsentStatus(parsed.status);
                    setIsBannerVisible(parsed.status === 'pending');
                } else {
                    // Version mismatch (policy updated) -> show banner again
                    setConsentStatus('pending');
                    setIsBannerVisible(true);
                }
            } else {
                // No stored data -> show banner
                setConsentStatus('pending');
                setIsBannerVisible(true);
            }
        } catch (e) {
            console.error("Error reading cookie consent from local storage", e);
            setConsentStatus('pending');
            setIsBannerVisible(true);
        }
    }, []);

    const saveConsent = (status: ConsentStatus) => {
        const data: ConsentData = {
            status,
            version: CONSENT_VERSION,
            timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setConsentStatus(status);
    };

    const acceptConsent = () => {
        saveConsent('accepted');
        setIsBannerVisible(false);
    };

    const rejectConsent = () => {
        saveConsent('rejected');
        setIsBannerVisible(false);
    };

    const openBanner = () => {
        setIsBannerVisible(true);
    };

    const closeBanner = () => {
        setIsBannerVisible(false);
    };

    return {
        consentStatus,
        isBannerVisible,
        acceptConsent,
        rejectConsent,
        saveConsent,
        openBanner,
        closeBanner,
        CONSENT_VERSION
    };
}
