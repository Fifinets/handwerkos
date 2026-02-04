import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, GripVertical, Scissors } from 'lucide-react';
import {
  OfferItem,
  OfferItemCreate,
  OfferItemType,
  OFFER_ITEM_TYPE_LABELS,
  OFFER_ITEM_UNITS,
} from '@/types/offer';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// A4 Constants (96 DPI)
const A4_HEIGHT_PX = 1123;
const PADDING_Y_PX = 96; // 48px top + 48px bottom (p-12)
const CONTENT_HEIGHT_PX = A4_HEIGHT_PX - PADDING_Y_PX;

// Extended Type for DnD
// OfferItem has 'id', OfferItemCreate doesn't.
// We add temp_id to both for consistent handling during edit.
export type EditorOfferItem = (OfferItem | OfferItemCreate) & { temp_id?: string; id?: string };

interface OfferItemsEditorProps {
  items: EditorOfferItem[];
  onChange: (items: EditorOfferItem[]) => void;
  disabled?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

const calculateItemTotal = (item: OfferItem | OfferItemCreate): number => {
  return item.quantity * item.unit_price_net;
};

// --- Pure Measurement Wrapper (for Header/Footer) ---
const MeasurableItem = ({
  children,
  onHeightChange,
  id
}: {
  children: React.ReactNode;
  onHeightChange: (height: number) => void;
  id: string; // ID for dependencies
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        onHeightChange(height);
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onHeightChange, id]);

  return <div ref={ref}>{children}</div>;
};

// --- Sortable Item Wrapper (Combines Measurement + DnD) ---
const SortableItemWrapper = ({
  id,
  children,
  onHeightChange
}: {
  id: string;
  children: React.ReactNode;
  onHeightChange?: (height: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative' as const,
  };

  const measureRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!measureRef.current || !onHeightChange) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        onHeightChange(height);
      }
    });
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    // @ts-ignore
    measureRef.current = node;
  };

  return (
    <div ref={setRefs} style={style} className="touch-none">
      {React.cloneElement(children as React.ReactElement, { dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
};

// Item Render Component (Isolated for Sortable and Overlay)
const ItemRender = ({
  item,
  index,
  displayNumber,
  updateItem,
  removeItem,
  disabled,
  dragHandleProps
}: {
  item: EditorOfferItem;
  index: number;
  displayNumber: string | number;
  updateItem?: (index: number, field: keyof OfferItemCreate, value: any) => void;
  removeItem?: (index: number) => void;
  disabled?: boolean;
  dragHandleProps?: any;
}) => {
  return (
    <div className="group relative pt-4 pb-4">
      {item.item_type === 'title' ? (
        <Card className="border-none shadow-none bg-transparent p-0">
          <div className="flex items-center gap-3">
            <div className="w-8 flex justify-center text-gray-400" {...dragHandleProps}>
              {!disabled && <GripVertical className="h-5 w-5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <Input
              value={item.description.replace(/<\/?b>/g, '')}
              onChange={(e) => updateItem && updateItem(index, 'description', `<b>${e.target.value}</b>`)}
              className="font-bold text-xl border-none shadow-none bg-transparent px-0 h-auto focus-visible:ring-0 placeholder:text-gray-300 text-gray-900"
              placeholder="Überschrift eingeben..."
              disabled={disabled}
            />
            {!disabled && removeItem && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="h-px bg-purple-100 mt-2 w-full" />
        </Card>
      ) : item.item_type === 'text' ? (
        <Card className="border-gray-200 bg-white shadow-sm hover:shadow-md transition-all">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-4">
              <div className="w-8 flex flex-col items-center gap-2 pt-2 text-gray-400">
                <div {...dragHandleProps}>
                  {!disabled && <GripVertical className="h-5 w-5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />}
                </div>
                <div className="text-sm font-semibold bg-gray-100 w-6 h-6 flex items-center justify-center rounded text-gray-600">
                  {displayNumber}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Textbaustein</Label>
                <Textarea
                  placeholder="Textbaustein hier eingeben..."
                  value={item.description}
                  onChange={(e) => updateItem && updateItem(index, 'description', e.target.value)}
                  disabled={disabled}
                  rows={3}
                  className="bg-white border-gray-200 focus-visible:ring-gray-200 resize-y min-h-[80px]"
                />
              </div>
              {!disabled && removeItem && (
                <div className="flex flex-col gap-2 pt-2">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className={`${item.is_optional ? 'border-dashed border-gray-300 bg-gray-50/50' : 'border-gray-200 bg-white'} shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-200`}>
          <CardContent className="p-5">
            <div className="flex gap-4">
              <div className="w-8 flex flex-col items-center gap-2 pt-1 text-gray-400">
                <div {...dragHandleProps}>
                  {!disabled && <GripVertical className="h-5 w-5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />}
                </div>
                <div className="text-sm font-semibold bg-gray-100 w-6 h-6 flex items-center justify-center rounded text-gray-600">
                  {displayNumber}
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <Textarea placeholder="Beschreibung..." value={item.description} onChange={(e) => updateItem && updateItem(index, 'description', e.target.value)} disabled={disabled} className="min-h-[60px] resize-y font-medium text-gray-800" />
                  </div>
                  <div className="w-[180px] space-y-2">
                    <Select value={item.item_type} onValueChange={(value) => updateItem && updateItem(index, 'item_type', value as OfferItemType)} disabled={disabled}>
                      <SelectTrigger className="h-8 text-xs bg-gray-50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(OFFER_ITEM_TYPE_LABELS).filter(([k]) => k !== 'page_break').map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2 pt-1 justify-end">
                      <Checkbox id={`opt-${index}`} checked={item.is_optional} onCheckedChange={(c) => updateItem && updateItem(index, 'is_optional', !!c)} disabled={disabled} className="h-4 w-4" />
                      <Label htmlFor={`opt-${index}`} className="text-xs text-gray-500 font-normal">Optional</Label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-4 items-end bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                  <div className="col-span-2">
                    <Label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Menge</Label>
                    <Input type="number" step="0.001" min="0" value={item.quantity} onChange={(e) => updateItem && updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} disabled={disabled} className="h-8 mt-1 bg-white" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Einheit</Label>
                    <Select value={item.unit} onValueChange={(v) => updateItem && updateItem(index, 'unit', v)} disabled={disabled}>
                      <SelectTrigger className="h-8 mt-1 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>{OFFER_ITEM_UNITS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Einzelpreis (netto)</Label>
                    <div className="relative mt-1">
                      <Input type="number" step="0.01" min="0" value={item.unit_price_net} onChange={(e) => updateItem && updateItem(index, 'unit_price_net', parseFloat(e.target.value) || 0)} disabled={disabled} className="h-8 bg-white pr-8 text-right font-mono" />
                      <span className="absolute right-3 top-1.5 text-xs text-gray-400">€</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">MwSt</Label>
                    <Select value={String(item.vat_rate)} onValueChange={(v) => updateItem && updateItem(index, 'vat_rate', parseFloat(v))} disabled={disabled}>
                      <SelectTrigger className="h-8 mt-1 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="0">0%</SelectItem><SelectItem value="7">7%</SelectItem><SelectItem value="19">19%</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 text-right pb-1">
                    <Label className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider block mb-1">Gesamt</Label>
                    <span className={`text-lg font-bold font-mono ${item.is_optional ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{formatCurrency(calculateItemTotal(item))}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


export function OfferItemsEditor({
  items,
  onChange,
  disabled = false,
  header,
  footer,
}: OfferItemsEditorProps) {

  const [itemHeights, setItemHeights] = useState<Record<string, number>>({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateItem = (index: number, field: keyof OfferItemCreate, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    onChange(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    onChange(updatedItems);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => (item.id || item.temp_id) === active.id);
      const newIndex = items.findIndex((item) => (item.id || item.temp_id) === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(items, oldIndex, newIndex));
      }
    }
    setActiveDragId(null);
  };

  // Helper to get numbering
  const getItemDisplayNumber = (index: number) => {
    const item = items[index];
    if (!item || item.item_type === 'page_break') return '';

    const titleCount = items.slice(0, index + 1).filter(i => i.item_type === 'title').length;

    if (titleCount >= 1) {
      let major = 0; let minor = 0;
      for (let i = 0; i <= index; i++) {
        const type = items[i].item_type;
        if (type === 'page_break') continue;
        if (type === 'title') { major++; minor = 0; }
        else { if (major === 0) major = 1; minor++; }
      }
      if (item.item_type !== 'title') return `${major}.${minor}`;
    } else {
      let count = 0;
      for (let i = 0; i <= index; i++) {
        if (items[i].item_type !== 'title' && items[i].item_type !== 'page_break') count++;
      }
      if (item.item_type !== 'title') return count;
    }
    return '';
  };

  const totalNet = items
    .filter(item => !item.is_optional && item.item_type !== 'page_break')
    .reduce((sum, item) => sum + calculateItemTotal(item), 0);

  // --- Pagination Logic ---
  const pages = useMemo(() => {
    const _pages: { items: { item: EditorOfferItem; index: number }[] }[] = [];
    let currentPageItems: { item: EditorOfferItem; index: number }[] = [];

    let currentY = 0;
    // Page 1 has Header
    let maxPageHeight = CONTENT_HEIGHT_PX - (headerHeight || 0);
    if (maxPageHeight < 200) maxPageHeight = 200;

    items.forEach((item, index) => {
      // Manual Page Break -> Force new page
      if (item.item_type === 'page_break') {
        _pages.push({ items: currentPageItems });
        currentPageItems = [];

        currentY = 0;
        maxPageHeight = CONTENT_HEIGHT_PX;
        return;
      }

      // Height lookup using Stable ID
      const itemId = item.id || item.temp_id || `temp_${index}`;
      const itemH = itemHeights[itemId] || 100; // Default estimate

      // Check overflow
      if (currentY + itemH > maxPageHeight && currentPageItems.length > 0) {
        _pages.push({ items: currentPageItems });
        currentPageItems = [];

        currentY = 0;
        maxPageHeight = CONTENT_HEIGHT_PX;
      }

      currentPageItems.push({ item, index });
      currentY += itemH;
    });

    _pages.push({ items: currentPageItems });

    // Check Footer overflow logic
    if (_pages.length > 0) {
      if (currentY + footerHeight > maxPageHeight) {
        _pages.push({ items: [] });
      }
    }

    // Ensure at least one page exists (for empty state)
    if (_pages.length === 0) {
      _pages.push({ items: [] });
    }

    return _pages;
  }, [items, itemHeights, headerHeight, footerHeight]);

  const itemIds = useMemo(() => items.map(i => i.id || i.temp_id || 'ERROR'), [items]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {pages.map((page, pageIndex) => (
            <React.Fragment key={pageIndex}>
              {/* Page Container */}
              <div
                className="bg-white shadow-lg rounded-xl flex flex-col relative print:shadow-none print:break-after-page overflow-hidden transition-all duration-300 mx-auto"
                style={{ height: `${A4_HEIGHT_PX}px`, width: '100%' }}
              >

                {/* Header (Page 1 only) */}
                {pageIndex === 0 && header && (
                  <div className="px-12 pt-12">
                    <MeasurableItem id="header-wrapper" onHeightChange={setHeaderHeight}>
                      <div>{header}</div>
                    </MeasurableItem>
                  </div>
                )}

                {/* Page Content Area */}
                <div className="px-12 py-4 flex-1">
                  <div className="space-y-4">
                    {page.items.map(({ item, index }) => {
                      const itemId = item.id || item.temp_id || `temp_${index}`;
                      return (
                        <SortableItemWrapper
                          key={itemId}
                          id={itemId}
                          onHeightChange={(h) => {
                            if (Math.abs((itemHeights[itemId] || 0) - h) > 1) {
                              setItemHeights(prev => ({ ...prev, [itemId]: h }));
                            }
                          }}
                        >
                          <ItemRender
                            item={item}
                            index={index}
                            displayNumber={getItemDisplayNumber(index)}
                            updateItem={updateItem}
                            removeItem={removeItem}
                            disabled={disabled}
                          />
                        </SortableItemWrapper>
                      );
                    })}
                  </div>

                  {/* Summary / Footer (Last Page) */}
                  {pageIndex === pages.length - 1 && (
                    <MeasurableItem id={`footer-${pageIndex}`} onHeightChange={setFooterHeight}>
                      <div className="mt-8">
                        <div className="flex justify-end pt-6">
                          <div className="bg-gray-900 text-white p-6 rounded-xl min-w-[300px] shadow-lg">
                            <div className="flex justify-between items-center mb-2 text-gray-400 text-sm"><span>Netto</span><span>{formatCurrency(totalNet)}</span></div>
                            <div className="flex justify-between items-center mb-4 text-gray-400 text-sm"><span>MwSt (19%)</span><span>{formatCurrency(totalNet * 0.19)}</span></div>
                            <div className="h-px bg-gray-700 my-4" />
                            <div className="flex justify-between items-end"><span className="text-lg font-semibold">Gesamtsumme</span><span className="text-3xl font-bold text-white">{formatCurrency(totalNet * 1.19)}</span></div>
                          </div>
                        </div>

                        {footer && (
                          <div className="pt-8 text-sm text-gray-500">
                            {footer}
                          </div>
                        )}
                      </div>
                    </MeasurableItem>
                  )}
                </div>
              </div>

              {/* Page Break Control */}
              {pageIndex < pages.length - 1 && (
                /* Page break UI logic */
                (() => {
                  const lastItemOfPage = page.items[page.items.length - 1];
                  const nextItemIndex = lastItemOfPage ? lastItemOfPage.index + 1 : -1;
                  const nextItem = items[nextItemIndex];

                  const isManualBreak = nextItem && nextItem.item_type === 'page_break';

                  return (
                    <div className="flex items-center justify-center gap-4 py-4 group">
                      <div className="h-px bg-gray-300 flex-1 border-dashed border-t-2 border-gray-300"></div>

                      {isManualBreak ? (
                        <div className="flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium border border-purple-200">
                          <Scissors className="h-3 w-3" />
                          Manueller Seitenumbruch
                          <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:text-red-500 hover:bg-purple-200" onClick={() => removeItem(nextItemIndex)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-[10px] font-medium border border-gray-100 uppercase tracking-wider">
                          Automatischer Umbruch
                        </div>
                      )}

                      <div className="h-px bg-gray-300 flex-1 border-dashed border-t-2 border-gray-300"></div>
                    </div>
                  );
                })()
              )}
            </React.Fragment>
          ))}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeDragId ? (() => {
          const index = items.findIndex(i => (i.id || i.temp_id) === activeDragId);
          const item = items[index];
          if (!item) return null;
          return (
            <div className="bg-white shadow-2xl rounded-lg opacity-90 scale-105 pointer-events-none ring-2 ring-blue-500">
              <ItemRender
                item={item}
                index={index}
                displayNumber={getItemDisplayNumber(index)}
              // No actions in overlay
              />
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
}

export default OfferItemsEditor;
