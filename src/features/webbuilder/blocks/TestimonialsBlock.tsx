import React from 'react';
import { Star } from 'lucide-react';

interface TestimonialsBlockProps {
    block: {
        content: {
            headline: string;
            testimonials: { name: string; text: string; role?: string }[];
        };
    };
}

export const TestimonialsBlock = ({ block }: TestimonialsBlockProps) => {
    const { headline, testimonials } = block.content;
    const defaultTestimonials = [
        { name: "Fam. Müller", text: "Sehr saubere Arbeit und pünktlich. Gerne wieder!", role: "Privatkunde" },
        { name: "Büro Schmidt", text: "Professionelle Abwicklung unseres Großprojekts.", role: "Gewerbekunde" },
        { name: "Lisa W.", text: "Super Beratung und transparente Kosten.", role: "Privatkunde" }
    ];

    const displayTestimonials = testimonials && testimonials.length > 0 ? testimonials : defaultTestimonials;

    return (
        <section className="py-16" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-main)' }}>
            <div className="container mx-auto px-4">
                <h2 className="text-3xl font-bold text-center mb-12">{headline || "Was unsere Kunden sagen"}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {displayTestimonials.map((t, idx) => (
                        <div
                            key={idx}
                            className="p-8 rounded-xl border shadow-sm relative"
                            style={{
                                backgroundColor: 'var(--bg-card)',
                                borderColor: 'var(--border-color)'
                            }}
                        >
                            <div className="flex text-yellow-400 mb-4">
                                {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                            </div>
                            <p className="mb-6 italic" style={{ color: 'var(--text-muted)' }}>"{t.text}"</p>
                            <div>
                                <p className="font-bold">{t.name}</p>
                                {t.role && <p className="text-xs opacity-70">{t.role}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
