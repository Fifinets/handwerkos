
import React from 'react';
import { Block } from '../context/useWebBuilderStore';
import { Hammer, CheckCircle, PenTool, Zap, Wrench, ShieldCheck } from "lucide-react";

const Icons: Record<string, React.ComponentType<any>> = {
    Hammer, CheckCircle, PenTool, Zap, Wrench, ShieldCheck
};

export const ServicesBlock = ({ block }: { block: Block }) => {
    const { title, items } = block.content;

    return (
        <div className="py-16 px-4 bg-slate-50">
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{title}</h2>
                    <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {items?.map((item: any, i: number) => {
                        const Icon = Icons[item.icon] || Wrench;
                        return (
                            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                                    <Icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                                <p className="text-slate-600 leading-relaxed">{item.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
