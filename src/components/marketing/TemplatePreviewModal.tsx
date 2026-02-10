import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TemplatePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: {
        name: string;
        image: string;
        id: string;
    } | null;
    onSelect: () => void;
}

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({ isOpen, onClose, template, onSelect }) => {

    // Close on ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!template) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        aria-hidden="true"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed z-50 w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-800">
                            <h2 id="modal-title" className="text-2xl font-bold text-white">{template.name}</h2>
                            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-0 bg-slate-950 aspect-video relative overflow-hidden group">
                            {/* Simple mock browser bar */}
                            <div className="absolute top-4 left-4 right-4 h-3 bg-slate-800 rounded-full opacity-50 z-10 w-20"></div>

                            <img
                                src={template.image}
                                alt={template.name}
                                className="w-full h-full object-cover object-top hover:object-bottom transition-[object-position] duration-[3000ms] ease-in-out cursor-ns-resize"
                            />

                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                                    Scrollt automatisch...
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-4">
                            <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">
                                Abbrechen
                            </Button>
                            <Button onClick={onSelect} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
                                <Check size={18} />
                                Dieses Template nutzen
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default TemplatePreviewModal;
