
import React from 'react';
import { cn } from "@/lib/utils";

interface EditorCanvasProps {
    deviceMode: 'desktop' | 'tablet' | 'mobile';
    children?: React.ReactNode;
}

const EditorCanvas = ({ deviceMode, children }: EditorCanvasProps) => {
    return (
        <div className="flex-1 bg-slate-100/50 h-full ml-[300px] pt-16 flex items-start justify-center overflow-auto p-8 relative">
            <div
                className={cn(
                    "bg-white shadow-xl transition-all duration-300 min-h-[800px] relative origin-top",
                    deviceMode === 'desktop' && "w-full max-w-[1200px]",
                    deviceMode === 'tablet' && "w-[768px]",
                    deviceMode === 'mobile' && "w-[375px] border-[8px] border-slate-800 rounded-[30px]"
                )}
            >
                {children || (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        Select a template to start editing
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorCanvas;
