import React from 'react';

interface Feature {
    title: string;
    description: string;
}

interface FeaturesBlockProps {
    block: {
        content: {
            headline: string;
            features: Feature[] | string[]; // Support both object and string arrays for backward compatibility
        };
    };
}

export const FeaturesBlock = ({ block }: FeaturesBlockProps) => {
    const { headline, features } = block.content;

    return (
        <section className="py-16" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-main)' }}>
            <div className="container mx-auto px-4">
                <h2 className="text-3xl font-bold text-center mb-12">{headline}</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {features?.map((feature, index) => {
                        // Handle both string and object formats
                        const title = typeof feature === 'string' ? feature : feature.title;
                        const description = typeof feature === 'string' ? '' : feature.description;

                        return (
                            <div
                                key={index}
                                className="p-6 rounded-lg border shadow-sm"
                                style={{
                                    backgroundColor: 'var(--bg-card)',
                                    borderColor: 'var(--border-color)'
                                }}
                            >
                                <h3 className="text-xl font-semibold mb-3">{title}</h3>
                                {description && (
                                    <p style={{ color: 'var(--text-muted)' }}>{description}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
