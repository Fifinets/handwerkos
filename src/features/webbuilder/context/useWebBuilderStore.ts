import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// --- Types ---

export type BlockType = 'hero' | 'services' | 'testimonials' | 'text' | 'image' | 'features' | 'contact' | 'gallery';

export interface Block {
    id: string;
    type: BlockType;
    content: Record<string, any>;
    styles?: Record<string, any>;
}

export interface Page {
    id: string;
    slug: string;
    name: string;
    blocks: Block[];
    seo?: { title: string; description: string };
}

interface WebBuilderState {
    // UI State
    currentStep: number;
    activePageId: string;
    deviceMode: 'desktop' | 'tablet' | 'mobile';

    // Site Data
    siteId: string | null;
    selectedTemplate: any | null;
    siteConfig: {
        colorPreset: string;
        webProfile: {
            companyName: string;
            cityRegion: string;
            services: string[];
            contact: { email: string; phone: string };
        };
        legalProfile: {
            owner: string;
            address: string;
            vatId: string;
            email: string;
            phone: string;
        };
    };
    pages: Page[];

    // Actions
    setStep: (step: number) => void;
    setDeviceMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
    setSelectedTemplate: (template: any) => void;

    // Site Actions
    initializeSite: (siteData: any) => void; // Load from DB
    updateSiteConfig: (config: Partial<WebBuilderState['siteConfig']>) => void;
    updateWebProfile: (profile: Partial<WebBuilderState['siteConfig']['webProfile']>) => void;
    updateLegalProfile: (profile: Partial<WebBuilderState['siteConfig']['legalProfile']>) => void;

    // Page Actions
    addPage: (page: Omit<Page, 'id' | 'blocks'>) => void;
    setActivePage: (pageId: string) => void;

    // Block Actions
    addBlock: (pageId: string, type: BlockType, content?: Record<string, any>, index?: number) => void;
    updateBlock: (pageId: string, blockId: string, content: any) => void;
    moveBlock: (pageId: string, activeId: string, overId: string) => void;
    removeBlock: (pageId: string, blockId: string) => void;

    resetBuilder: () => void;
}

// --- Initial Data ---

const INITIAL_PAGES: Page[] = [
    { id: 'home', slug: '/', name: 'Home', blocks: [] },
    { id: 'services', slug: '/services', name: 'Leistungen', blocks: [] },
    { id: 'contact', slug: '/contact', name: 'Kontakt', blocks: [] },
    { id: 'imprint', slug: '/imprint', name: 'Impressum', blocks: [] },
];

export const useWebBuilderStore = create<WebBuilderState>((set, get) => ({
    // Initial State
    currentStep: 0,
    activePageId: 'home',
    deviceMode: 'desktop',
    siteId: null,
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
    pages: INITIAL_PAGES,

    // Actions
    setStep: (step) => set({ currentStep: step }),
    setDeviceMode: (mode) => set({ deviceMode: mode }),
    setSelectedTemplate: (template) => set({ selectedTemplate: template }),

    initializeSite: (siteData) => {
        // TODO: Map DB data to Store structure
        set({ siteId: siteData.id });
    },

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

    addPage: (page) => set((state) => ({
        pages: [...state.pages, { ...page, id: uuidv4(), blocks: [] }]
    })),

    setActivePage: (pageId) => set({ activePageId: pageId }),

    addBlock: (pageId, type, content, index) => set((state) => {
        const newBlock: Block = {
            id: uuidv4(),
            type,
            content: content || getDefaultContent(type),
        };

        const newPages = state.pages.map(p => {
            if (p.id !== pageId) return p;
            const blocks = [...p.blocks];
            if (index !== undefined) {
                blocks.splice(index, 0, newBlock);
            } else {
                blocks.push(newBlock);
            }
            return { ...p, blocks };
        });

        return { pages: newPages };
    }),

    updateBlock: (pageId, blockId, content) => set((state) => ({
        pages: state.pages.map(p => {
            if (p.id !== pageId) return p;
            return {
                ...p,
                blocks: p.blocks.map(b => b.id === blockId ? { ...b, content: { ...b.content, ...content } } : b)
            };
        })
    })),

    moveBlock: (pageId, activeId, overId) => set((state) => {
        const page = state.pages.find(p => p.id === pageId);
        if (!page) return state;

        const oldIndex = page.blocks.findIndex(b => b.id === activeId);
        const newIndex = page.blocks.findIndex(b => b.id === overId);

        if (oldIndex === -1 || newIndex === -1) return state;

        const newBlocks = [...page.blocks];
        const [movedBlock] = newBlocks.splice(oldIndex, 1);
        newBlocks.splice(newIndex, 0, movedBlock);

        return {
            pages: state.pages.map(p => p.id === pageId ? { ...p, blocks: newBlocks } : p)
        };
    }),

    removeBlock: (pageId, blockId) => set((state) => ({
        pages: state.pages.map(p => {
            if (p.id !== pageId) return p;
            return { ...p, blocks: p.blocks.filter(b => b.id !== blockId) };
        })
    })),

    resetBuilder: () =>
        set({
            currentStep: 0,
            selectedTemplate: null,
            activePageId: 'home',
            pages: INITIAL_PAGES,
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

// Helper to get default content for blocks (German Localization)
function getDefaultContent(type: BlockType) {
    switch (type) {
        case 'hero':
            return { headline: 'Meisterbetrieb Mustermann', subheadline: 'Ihr Partner für Qualität in der Region', ctaText: 'Angebot anfordern' };
        case 'services':
            return { headline: 'Unsere Leistungen', services: [{ title: 'Leistung 1', description: 'Beschreibung...' }] };
        case 'features':
            return { headline: 'Warum Wir?', features: ['Zuverlässig', 'Schnell', 'Fair'] };
        case 'text':
            return { text: 'Hier ist Platz für Ihren Text...' };
        case 'contact':
            return { headline: 'Kontaktieren Sie uns', email: 'info@beispiel.de' };
        default:
            return {};
    }
}
