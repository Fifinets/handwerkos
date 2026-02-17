
import React from 'react';
import { Button } from "@/components/ui/button";
import { Block } from '../context/useWebBuilderStore';

export const HeroBlock = ({ block }: { block: Block }) => {
    const { title, subtitle, cta, backgroundImage } = block.content;

    return (
        <div
            className="relative h-[500px] flex items-center justify-center text-center text-white bg-cover bg-center"
            style={{
                backgroundImage: `url(${backgroundImage || 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80'})`
            }}
        >
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative z-10 max-w-2xl px-4 space-y-6">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{title}</h1>
                <p className="text-xl md:text-2xl text-slate-200">{subtitle}</p>
                {cta && (
                    <Button
                        size="lg"
                        className="text-white font-semibold px-8 py-6 text-lg border-none hover:opacity-90"
                        style={{ backgroundColor: 'var(--primary)' }}
                    >
                        {cta}
                    </Button>
                )}
            </div>
        </div>
    );
};
