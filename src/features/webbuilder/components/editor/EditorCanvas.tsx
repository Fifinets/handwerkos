import React from 'react';
import { cn } from "@/lib/utils";
import { useWebBuilderStore } from '../../context/useWebBuilderStore';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// --- Block Components ---
import { HeroBlock } from '@/features/webbuilder/blocks/HeroBlock';
import { ServicesBlock } from '@/features/webbuilder/blocks/ServicesBlock';

// --- Block Renderer ---
const BlockRenderer = ({ block }: { block: any }) => {
    switch (block.type) {
        case 'hero':
            return <HeroBlock block={block} />;
        case 'services':
            return <ServicesBlock block={block} />;
        default:
            return (
                <div className="p-8 border-b bg-white">
                    <h3 className="text-lg font-bold">{block.type.toUpperCase()} BLOCK</h3>
                    <pre className="text-xs text-slate-500 mt-2 overflow-auto max-h-40">
                        {JSON.stringify(block.content, null, 2)}
                    </pre>
                </div>
            );
    }
};


const EditorCanvas = () => {
    const { deviceMode, pages, activePageId, moveBlock } = useWebBuilderStore();

    const activePage = pages.find(p => p.id === activePageId);
    const blocks = activePage?.blocks || [];

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
                            items={blocks.map(b => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {blocks.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-200 m-8 rounded-lg">
                                    Drop blocks here
                                </div>
                            ) : (
                                blocks.map((block) => (
                                    <SortableBlock key={block.id} id={block.id}>
                                        <BlockRenderer block={block} />
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
