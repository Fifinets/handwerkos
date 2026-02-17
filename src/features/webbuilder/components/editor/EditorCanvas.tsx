import React from 'react';
import { cn } from "@/lib/utils";
import { useWebBuilderStore } from '../../context/useWebBuilderStore';
import { COLOR_PRESETS } from '../../data/presets';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDroppable
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Block Components ---
import { HeroBlock } from '@/features/webbuilder/blocks/HeroBlock';
import { ServicesBlock } from '@/features/webbuilder/blocks/ServicesBlock';
import { FeaturesBlock } from '@/features/webbuilder/blocks/FeaturesBlock';
import { GalleryBlock } from '@/features/webbuilder/blocks/GalleryBlock';
import { TestimonialsBlock } from '@/features/webbuilder/blocks/TestimonialsBlock';
import { ContactBlock } from '@/features/webbuilder/blocks/ContactBlock';

// --- Sortable Block Wrapper ---
const SortableBlock = ({ id, children }: { id: string; children: React.ReactNode }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group touch-none">
            {/* Hover Border to indicate selection/hover */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-400 pointer-events-none z-10" />
            {children}
        </div>
    );
};

// --- Block Renderer ---
const BlockRenderer = ({ block }: { block: any }) => {
    switch (block.type) {
        case 'hero':
            return <HeroBlock block={block} />;
        case 'services':
            return <ServicesBlock block={block} />;
        case 'features':
            return <FeaturesBlock block={block} />;
        case 'gallery':
            return <GalleryBlock block={block} />;
        case 'testimonials':
            return <TestimonialsBlock block={block} />;
        case 'contact':
            return <ContactBlock block={block} />;
        default:
            return (
                <div className="p-8 border-b bg-white">
                    <p className="text-center text-gray-500">Unknown block type: {block.type}</p>
                </div>
            );
    }
};


const EditorCanvas = () => {
    const { deviceMode, pages, activePageId, moveBlock, siteConfig, selectedTemplate } = useWebBuilderStore();
    const activePage = pages.find(p => p.id === activePageId);

    // 1. Determine Colors
    const preset = COLOR_PRESETS.find(p => p.id === siteConfig.colorPreset);
    const primaryColor = siteConfig.customColors?.primary || preset?.primary || '#0ea5e9';
    const secondaryColor = siteConfig.customColors?.secondary || preset?.secondary || '#0f172a';
    const bgColor = siteConfig.customColors?.bg || preset?.bg || '#ffffff';

    // 2. Handle Template Specifics
    const isDarkMode = selectedTemplate?.features?.includes('Dark Mode');

    const themeStyles = {
        '--primary': primaryColor,
        '--secondary': secondaryColor,
        '--bg-page': isDarkMode ? '#1a1a1a' : bgColor,
        '--text-main': isDarkMode ? '#f8fafc' : '#0f172a',
        '--text-muted': isDarkMode ? '#94a3b8' : '#475569',
        '--bg-card': isDarkMode ? '#262626' : '#ffffff',
        '--border-color': isDarkMode ? '#404040' : '#e2e8f0',
    } as React.CSSProperties;

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            moveBlock(activePageId, active.id as string, over?.id as string);
        }
    };

    // Droppable area for the canvas
    const { setNodeRef } = useDroppable({
        id: 'editor-canvas',
    });

    return (
        <div
            className="flex-1 bg-slate-100/50 h-full ml-[300px] pt-16 flex items-start justify-center overflow-auto p-8 relative transition-colors duration-300"
            style={themeStyles}
        >
            <div
                ref={setNodeRef}
                className={cn(
                    "shadow-xl transition-all duration-300 min-h-[800px] relative origin-top",
                    "bg-[var(--bg-page)] text-[var(--text-main)]", // Use CSS variables
                    deviceMode === 'desktop' && "w-full max-w-[1200px]",
                    deviceMode === 'tablet' && "w-[768px]",
                    deviceMode === 'mobile' && "w-[375px] border-[8px] border-slate-800 rounded-[30px]"
                )}
            >
                {!activePage ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        No Page Selected
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={activePage.blocks.map(b => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {activePage.blocks.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-200 m-8 rounded-lg">
                                    Drop blocks here
                                </div>
                            ) : (
                                activePage.blocks.map((block) => (
                                    <SortableBlock key={block.id} id={block.id}>
                                        <div className="relative group">
                                            {/* Block Actions Overlay could go here */}
                                            <BlockRenderer block={block} />
                                        </div>
                                    </SortableBlock>
                                ))
                            )}
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
};

export default EditorCanvas;
