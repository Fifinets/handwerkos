
export interface TemplateContent {
    hero: {
        headline: string;
        subheadline: string;
        cta: string;
    };
    services: {
        title: string;
        items: Array<{
            title: string;
            description: string;
            icon?: string;
        }>;
    };
    about: {
        headline: string;
        text: string;
        stats: Array<{ label: string; value: string }>;
    };
}

export interface Template {
    id: string;
    name: string;
    industry: string;
    badge: string;
    preview_image: string;
    features: string[];
    content: TemplateContent;
}

export const TEMPLATES: Template[] = [
    {
        id: '1',
        name: 'Atlas',
        industry: 'sanitär',
        badge: 'Sanitär & Heizung',
        preview_image: '',
        features: ['Mobil optimiert', 'Notdienst-Button', 'Clean-Look'],
        content: {
            hero: {
                headline: "Wärme & Wasser in Perfektion",
                subheadline: "Ihr Meisterbetrieb für moderne Bäder und effiziente Heizsysteme in der Region.",
                cta: "Kostenloses Angebot anfordern"
            },
            services: {
                title: "Unsere Leistungen",
                items: [
                    { title: "Badsanierung", description: "Vom Gäste-WC bis zur Wellness-Oase – alles aus einer Hand." },
                    { title: "Heizung & Energie", description: "Wärmepumpen, Gas-Hybrid und Solaranlagen fachgerecht installiert." },
                    { title: "24/7 Notdienst", description: "Schnelle Hilfe bei Rohrbruch und Heizungsausfall." }
                ]
            },
            about: {
                headline: "Qualität seit Generationen",
                text: "Wir verbinden traditionelles Handwerk mit modernster Technik. Unser Anspruch ist es, langlebige und nachhaltige Lösungen für Ihr Zuhause zu schaffen.",
                stats: [
                    { label: "Jahre Erfahrung", value: "25+" },
                    { label: "Zufriedene Kunden", value: "1.500+" },
                    { label: "Mitarbeiter", value: "12" }
                ]
            }
        }
    },
    {
        id: '2',
        name: 'Nova',
        industry: 'elektro',
        badge: 'Elektrotechnik',
        preview_image: '',
        features: ['Dark Mode', 'Modernes UI', 'Projekt-Slider'],
        content: {
            hero: {
                headline: "Intelligente Elektrotechnik für die Zukunft",
                subheadline: "Smart Home, E-Mobilität und Photovoltaik – Wir bringen Spannung in Ihr Projekt.",
                cta: "Beratungstermin vereinbaren"
            },
            services: {
                title: "Kompetenz & Innovation",
                items: [
                    { title: "Smart Home", description: "Intelligente Gebäudesteuerung mit KNX und Loxone." },
                    { title: "Photovoltaik", description: "Gewinnen Sie Ihren eigenen Strom – Planung und Montage." },
                    { title: "E-Mobilität", description: "Wallboxen und Ladeinfrastruktur für Ihr E-Auto." }
                ]
            },
            about: {
                headline: "Ihr Partner für Energie",
                text: "Strom ist mehr als nur Licht. Wir planen und realisieren komplexe elektrische Anlagen für Gewerbe und Privatkunden mit höchstem Sicherheitsanspruch.",
                stats: [
                    { label: "Projekte/Jahr", value: "200+" },
                    { label: "Meister", value: "3" },
                    { label: "Notdienst", value: "24h" }
                ]
            }
        }
    },
    {
        id: '3',
        name: 'Orion',
        industry: 'holzbau',
        badge: 'Zimmerei & Holz',
        preview_image: '',
        features: ['Natürliche Farben', 'Galerie Fokus', 'Team Seite'],
        content: {
            hero: {
                headline: "Wir bauen mit der Natur",
                subheadline: "Nachhaltiger Holzbau, Dachstühle und Carports in meisterhafter Qualität.",
                cta: "Projekt besprechen"
            },
            services: {
                title: "Handwerk mit Holz",
                items: [
                    { title: "Dachstühle", description: "Konstruktion und Aufschlag für Neubau und Sanierung." },
                    { title: "Holzrahmenbau", description: "Ökologische Häuser und Anbauten aus Holz." },
                    { title: "Carports & Terrassen", description: "Individuelle Lösungen für Ihren Außenbereich." }
                ]
            },
            about: {
                headline: "Aus Liebe zum Holz",
                text: "Holz ist unser Element. Als Zimmerei-Meisterbetrieb setzen wir auf nachhaltige Forstwirtschaft und traditionelle Verbindungen, kombiniert mit moderner CNC-Technik.",
                stats: [
                    { label: "Gegründet", value: "1998" },
                    { label: "Holz verbaut", value: "5000 m³" },
                    { label: "Team", value: "8" }
                ]
            }
        }
    },
    {
        id: '4',
        name: 'Forge',
        industry: 'bau',
        badge: 'Bauunternehmen',
        preview_image: '',
        features: ['Starke Typografie', 'Bauphasen', 'Zertifikate'],
        content: {
            hero: {
                headline: "Fundamente für die Ewigkeit",
                subheadline: "Ihr Bauunternehmen für Hoch- und Tiefbau. Verlässlich, termintreu, massiv.",
                cta: "Bauvorhaben anfragen"
            },
            services: {
                title: "Massiv & Beständig",
                items: [
                    { title: "Rohbau", description: "Maurer- und Betonarbeiten auf höchstem Niveau." },
                    { title: "Sanierung", description: "Werterhalt und Modernisierung von Bestandsimmobilien." },
                    { title: "Außenanlagen", description: "Pflasterarbeiten und Gestaltung von Außenbereichen." }
                ]
            },
            about: {
                headline: "Wir bauen Zukunft",
                text: "Ob Einfamilienhaus oder Gewerbeobjekt – wir realisieren Ihren Bautraum Stein auf Stein. Qualität und Sicherheit stehen dabei an erster Stelle.",
                stats: [
                    { label: "Erfahrung", value: "40 Jahre" },
                    { label: "Maschinenpark", value: "Modern" },
                    { label: "Referenzen", value: "300+" }
                ]
            }
        }
    },
    {
        id: '5',
        name: 'Zenith',
        industry: 'maler',
        badge: 'Maler & Lackierer',
        preview_image: '',
        features: ['Buntes Design', 'Portfolio-Grid', 'Angebots-Form'],
        content: {
            hero: {
                headline: "Farbe bekennen",
                subheadline: "Kreative Raumgestaltung, Fassadensanierung und Lackierarbeiten vom Profi.",
                cta: "Farbberatung buchen"
            },
            services: {
                title: "Design & Schutz",
                items: [
                    { title: "Innenräume", description: "Tapezieren, Streichen und kreative Spachteltechniken." },
                    { title: "Fassaden", description: "Anstrich, Verputz und Wärmedämmung (WDVS)." },
                    { title: "Bodenbeläge", description: "Verlegung von Laminat, Vinyl und Designböden." }
                ]
            },
            about: {
                headline: "Meister der Farben",
                text: "Wir bringen Leben in Ihre Räume. Mit hochwertigen Materialien und einem Auge für Details gestalten wir Ihr Zuhause neu.",
                stats: [
                    { label: "Farbtöne", value: "∞" },
                    { label: "Quadratmeter", value: "100k+" },
                    { label: "Lächeln", value: "Garantiert" }
                ]
            }
        }
    },
    {
        id: '6',
        name: 'Prime',
        industry: 'allgemein',
        badge: 'Universell',
        preview_image: '',
        features: ['Simples Layout', 'Schnelle Ladezeit', 'SEO Ready'],
        content: {
            hero: {
                headline: "Handwerk mit Leidenschaft",
                subheadline: "Ihr zuverlässiger Partner für professionelle Handwerksdienstleistungen.",
                cta: "Kontakt aufnehmen"
            },
            services: {
                title: "Unsere Services",
                items: [
                    { title: "Beratung", description: "Individuelle Lösungen für Ihr Anliegen." },
                    { title: "Ausführung", description: "Fachgerechte und saubere Umsetzung." },
                    { title: "Service", description: "Auch nach dem Projekt für Sie da." }
                ]
            },
            about: {
                headline: "Über Uns",
                text: "Wir sind ein erfahrener Handwerksbetrieb, der Wert auf Zuverlässigkeit, Pünktlichkeit und faire Preise legt. Ihre Zufriedenheit ist unser Ziel.",
                stats: [
                    { label: "Erfahrung", value: "Langjährig" },
                    { label: "Service", value: "Top" },
                    { label: "Kunden", value: "Zufrieden" }
                ]
            }
        }
    }
];
