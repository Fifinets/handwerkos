
export interface BlockTemplate {
    type: string;
    label: string;
    icon: string;
    category: 'structure' | 'content' | 'media';
    defaultContent: Record<string, any>;
}

export const BLOCK_TEMPLATES: BlockTemplate[] = [
    {
        type: 'hero',
        label: 'Hero Header',
        icon: 'LayoutTemplate',
        category: 'structure',
        defaultContent: {
            title: 'Meisterbetrieb für Qualität',
            subtitle: 'Ihr Partner für professionelle Handwerksleistungen in der Region.',
            cta: 'Jetzt Angebot anfordern',
            backgroundImage: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80',
        }
    },
    {
        type: 'services',
        label: 'Leistungen',
        icon: 'Hammer',
        category: 'content',
        defaultContent: {
            title: 'Unsere Leistungen',
            items: [
                { title: 'Reparaturen', description: 'Schnelle und zuverlässige Reparaturen aller Art.' },
                { title: 'Wartung', description: 'Regelmäßige Wartung für Werterhalt und Sicherheit.' },
                { title: 'Installation', description: 'Fachgerechte Installation neuer Anlagen.' }
            ]
        }
    },
    {
        type: 'features',
        label: 'Vorteile',
        icon: 'CheckCircle',
        category: 'content',
        defaultContent: {
            title: 'Warum wir?',
            features: [
                'Meisterbetrieb seit 20 Jahren',
                'Kostenlose Beratung',
                '24/7 Notdienst',
                'Faire Festpreise'
            ]
        }
    },
    {
        type: 'gallery',
        label: 'Galerie',
        icon: 'Image',
        category: 'media',
        defaultContent: {
            title: 'Unsere Referenzen',
            images: [
                'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1590674899505-1c5c41951f89?auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80'
            ]
        }
    },
    {
        type: 'testimonials',
        label: 'Kundenstimmen',
        icon: 'MessageSquare',
        category: 'content',
        defaultContent: {
            reviews: [
                { name: 'Max Mustermann', text: 'Hervorragende Arbeit. Pünktlich und sauber.', role: 'Privatkunde' },
                { name: 'Anna Schmidt', text: 'Sehr kompetente Beratung und Ausführung.', role: 'Geschäftskunde' }
            ]
        }
    },
    {
        type: 'contact',
        label: 'Kontakt',
        icon: 'Phone',
        category: 'structure',
        defaultContent: {
            title: 'Kontaktieren Sie uns',
            address: 'Musterstraße 123, 12345 Musterstadt',
            email: 'info@handwerk-muster.de',
            phone: '+49 123 456789'
        }
    },
    {
        type: 'text',
        label: 'Text',
        icon: 'Type',
        category: 'content',
        defaultContent: {
            text: 'Hier können Sie Ihren Text eingeben. Beschreiben Sie Ihre Dienstleistungen oder Ihr Unternehmen.'
        }
    }
];
