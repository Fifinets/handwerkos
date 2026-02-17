import React from 'react';

interface GalleryBlockProps {
    block: {
        content: {
            headline: string;
            images: { src: string; alt: string }[];
        };
    };
}

export const GalleryBlock = ({ block }: GalleryBlockProps) => {
    const { headline, images } = block.content;
    const defaultImages = [
        { src: "https://images.unsplash.com/photo-1581094794329-cd1096d7a43f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", alt: "Project 1" },
        { src: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", alt: "Project 2" },
        { src: "https://images.unsplash.com/photo-1590247813693-55be6048cc03?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", alt: "Project 3" },
        { src: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", alt: "Project 4" },
    ];

    const displayImages = images && images.length > 0 ? images : defaultImages;

    return (
        <section className="py-16" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-main)' }}>
            <div className="container mx-auto px-4">
                <h2 className="text-3xl font-bold text-center mb-12">{headline || "Unsere Referenzen"}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {displayImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square overflow-hidden rounded-lg hover:shadow-lg transition-shadow">
                            <img
                                src={img.src}
                                alt={img.alt}
                                className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
