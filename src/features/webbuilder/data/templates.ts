export interface Template {
    id: string;
    name: string;
    industry: string;
    badge: string;
    preview_image: string;
    features: string[];
}

export const TEMPLATES: Template[] = [
    {
        id: '1',
        name: 'Atlas',
        industry: 'sanitär',
        badge: 'Sanitär & Heizung',
        preview_image: '',
        features: ['Mobil optimiert', 'Notdienst-Button', 'Clean-Look']
    },
    {
        id: '2',
        name: 'Nova',
        industry: 'elektro',
        badge: 'Elektrotechnik',
        preview_image: '',
        features: ['Dark Mode', 'Modernes UI', 'Projekt-Slider']
    },
    {
        id: '3',
        name: 'Orion',
        industry: 'holzbau',
        badge: 'Zimmerei & Holz',
        preview_image: '',
        features: ['Natürliche Farben', 'Galerie Fokus', 'Team Seite']
    },
    {
        id: '4',
        name: 'Forge',
        industry: 'bau',
        badge: 'Bauunternehmen',
        preview_image: '',
        features: ['Starke Typografie', 'Bauphasen', 'Zertifikate']
    },
    {
        id: '5',
        name: 'Zenith',
        industry: 'maler',
        badge: 'Maler & Lackierer',
        preview_image: '',
        features: ['Buntes Design', 'Portfolio-Grid', 'Angebots-Form']
    },
    {
        id: '6',
        name: 'Prime',
        industry: 'allgemein',
        badge: 'Universell',
        preview_image: '',
        features: ['Simples Layout', 'Schnelle Ladezeit', 'SEO Ready']
    }
];
