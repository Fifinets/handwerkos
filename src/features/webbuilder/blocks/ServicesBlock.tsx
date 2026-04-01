
import React from 'react';
import { Block } from '../context/useWebBuilderStore';
import { Hammer, CheckCircle, PenTool, Zap, Wrench, ShieldCheck } from "lucide-react";

const Icons: Record<string, React.ComponentType<any>> = {
    Hammer, CheckCircle, PenTool, Zap, Wrench, ShieldCheck
};

export const ServicesBlock = ({ block }: { block: Block }) => {
    const { title, items } = block.content;

    return (
        <div className="py-16 px-4 bg-[var(--bg-page)] text-[var(--text-main)]">
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold">{title}</h2>
                    <div className="h-1 w-20 mx-auto rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {items?.map((item: any, i: number) => {
                        const Icon = Icons[item.icon] || Wrench;
                        return (
                            <div
                                key={i}
                                className="p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                                style={{
                                    backgroundColor: 'var(--bg-card)',
                                    borderColor: 'var(--border-color)'
                                }}
                            >
                                <div
                                    className="h-12 w-12 rounded-lg flex items-center justify-center mb-4"
                                    style={{
                                        backgroundColor: 'var(--primary)',
                                        opacity: 0.9,
                                        color: '#ffffff'
                                    }}
                                >
                                    <Icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                                <p className="leading-relaxed text-[var(--text-muted)]">{item.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
