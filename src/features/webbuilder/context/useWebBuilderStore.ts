import { create } from 'zustand';

// Define the state interface
interface WebBuilderState {
    currentStep: number;
    selectedTemplate: any | null; // Replace any with proper Template type later
    siteConfig: {
        colorPreset: string;
        webProfile: {
            companyName: string;
            cityRegion: string;
            services: string[];
            contact: {
                email: string;
                phone: string;
            }
        };
        legalProfile: {
            owner: string;
            address: string;
            vatId: string;
            email: string;
            phone: string;
        };
    };
    // Actions
    setStep: (step: number) => void;
    setSelectedTemplate: (template: any) => void;
    updateSiteConfig: (config: Partial<WebBuilderState['siteConfig']>) => void;
    updateWebProfile: (profile: Partial<WebBuilderState['siteConfig']['webProfile']>) => void;
    updateLegalProfile: (profile: Partial<WebBuilderState['siteConfig']['legalProfile']>) => void;
    resetBuilder: () => void;
}

export const useWebBuilderStore = create<WebBuilderState>((set) => ({
    currentStep: 0,
    selectedTemplate: null,
    siteConfig: {
        colorPreset: 'default',
        webProfile: {
            companyName: '',
            cityRegion: '',
            services: [],
            contact: { email: '', phone: '' }
        },
        legalProfile: {
            owner: '',
            address: '',
            vatId: '',
            email: '',
            phone: ''
        }
    },
    setStep: (step) => set({ currentStep: step }),
    setSelectedTemplate: (template) => set({ selectedTemplate: template }),
    updateSiteConfig: (config) =>
        set((state) => ({
            siteConfig: { ...state.siteConfig, ...config },
        })),
    updateWebProfile: (profile) =>
        set((state) => ({
            siteConfig: {
                ...state.siteConfig,
                webProfile: { ...state.siteConfig.webProfile, ...profile }
            }
        })),
    updateLegalProfile: (profile) =>
        set((state) => ({
            siteConfig: {
                ...state.siteConfig,
                legalProfile: { ...state.siteConfig.legalProfile, ...profile }
            }
        })),
    resetBuilder: () =>
        set({
            currentStep: 0,
            selectedTemplate: null,
            siteConfig: {
                colorPreset: 'default',
                webProfile: {
                    companyName: '',
                    cityRegion: '',
                    services: [],
                    contact: { email: '', phone: '' }
                },
                legalProfile: {
                    owner: '',
                    address: '',
                    vatId: '',
                    email: '',
                    phone: ''
                }
            },
        }),
}));
