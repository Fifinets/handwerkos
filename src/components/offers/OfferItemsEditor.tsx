import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, GripVertical, Plus } from 'lucide-react';
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

// --- CSS Grid Layout Configuration ---
// Pos | Description (Grow) | Qty | Unit | Price | Total | Actions
const GRID_COLS = "grid-cols-[3rem_1fr_5rem_4rem_6rem_6rem_2rem]";
const GAP = "gap-4";

export type EditorOfferItem = (OfferItem | OfferItemCreate) & { temp_id?: string; id?: string };

interface OfferItemsEditorProps {
  items: EditorOfferItem[];
  onChange: (items: EditorOfferItem[]) => void;
  disabled?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  isReverseCharge?: boolean;
  showLaborShare?: boolean;
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

// --- Pure Measurement Wrapper ---
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

// --- Sortable Item Wrapper ---
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

// --- Helper Components ---
const TableHeader = () => (
  <div className={`grid ${GRID_COLS} ${GAP} items-center border-b-2 border-gray-900 pb-2 mb-4 text-xs font-bold uppercase tracking-wider text-gray-600 print:text-black`}>
    <div className="text-center">Pos.</div>
    <div>Bezeichnung</div>
    <div className="text-right">Menge</div>
    <div>Einheit</div>
    <div className="text-right">Einzelpreis</div>
    <div className="text-right">Gesamt</div>
    <div className="print:hidden"></div> {/* Actions placeholder */}
  </div>
);

// --- Item Render Component (Tabular) ---
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

  // Special Case: Page Break
  if (item.item_type === 'page_break') {
    return null; // Handled in parent loop as divider
  }

  // Special Case: Title (Headlines)
  if (item.item_type === 'title') {
    return (
      <div className="group relative py-2">
        <div className={`grid ${GRID_COLS} ${GAP} items-center`}>
          {/* 1. Pos */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-semibold text-gray-900 print:text-black">{displayNumber}</span>
            <div className="text-gray-400 print:hidden cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100" {...dragHandleProps}>
              {!disabled && <GripVertical className="h-4 w-4" />}
            </div>
          </div>

          {/* Content Spanning Remaining Cols */}
          <div className="col-span-6 flex items-center gap-2">
            <Input
              value={item.description.replace(/<\/?b>/g, '')}
              onChange={(e) => updateItem && updateItem(index, 'description', `<b>${e.target.value}</b>`)}
              className="font-bold text-lg border-none shadow-none bg-transparent px-0 h-auto focus-visible:ring-0 placeholder:text-gray-300 text-gray-900 print:text-black w-full"
              placeholder="Überschrift eingeben..."
              disabled={disabled}
            />
            {!disabled && removeItem && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50 ml-auto print:hidden">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Special Case: Pure Text
  if (item.item_type === 'text') {
    return (
      <div className="group relative py-2">
        <div className={`grid ${GRID_COLS} ${GAP} items-start`}>
          {/* 1. Pos */}
          <div className="flex flex-col items-center gap-1 pt-2">
            <span className="font-semibold text-gray-900 print:text-black">{displayNumber}</span>
            <div className="text-gray-400 print:hidden cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100" {...dragHandleProps}>
              {!disabled && <GripVertical className="h-4 w-4" />}
            </div>
          </div>

          {/* Content Spanning Remaining Cols */}
          <div className="col-span-6 flex items-start gap-2">
            <div className="flex-1">
              <Textarea
                placeholder="Textbaustein hier eingeben..."
                value={item.description}
                onChange={(e) => updateItem && updateItem(index, 'description', e.target.value)}
                disabled={disabled}
                className="bg-transparent border-none shadow-none focus-visible:ring-0 resize-y min-h-[40px] px-0 py-1 text-gray-700 w-full print:text-black"
              />
            </div>
            {!disabled && removeItem && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50 print:hidden">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard Item Row (Labor, Material, etc.)
  return (
    <div className={`group relative py-2 border-b border-gray-100 last:border-0 print:border-none hover:bg-gray-50/50 print:hover:bg-transparent -mx-2 px-2 rounded-md transition-colors`}>
      <div className={`grid ${GRID_COLS} ${GAP} items-start`}>

        {/* 1. Pos */}
        <div className="flex flex-col items-center gap-1 pt-1.5">
          <span className="font-semibold text-gray-900 print:text-black">{displayNumber}</span>
          <div className="text-gray-400 print:hidden cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100" {...dragHandleProps}>
            {!disabled && <GripVertical className="h-4 w-4" />}
          </div>
        </div>

        {/* 2. Description */}
        <div className="space-y-1">
          <Textarea
            placeholder="Beschreibung der Leistung..."
            value={item.description}
            onChange={(e) => updateItem && updateItem(index, 'description', e.target.value)}
            disabled={disabled}
            className="min-h-[2.5rem] resize-y bg-transparent border-none shadow-none p-0 focus-visible:ring-0 font-medium text-gray-800 print:text-black print:resize-none"
          />
          {/* Optional Controls (Hidden in Print) */}
          <div className="flex gap-2 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
            <Select value={item.item_type} onValueChange={(value) => updateItem && updateItem(index, 'item_type', value as OfferItemType)} disabled={disabled}>
              <SelectTrigger className="h-6 text-[10px] w-24 bg-gray-50 border-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(OFFER_ITEM_TYPE_LABELS).filter(([k]) => k !== 'page_break').map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-1">
              <Checkbox id={`opt-${index}`} checked={item.is_optional} onCheckedChange={(c) => updateItem && updateItem(index, 'is_optional', !!c)} disabled={disabled} className="h-3 w-3" />
              <label htmlFor={`opt-${index}`} className="text-[10px] text-gray-500 cursor-pointer">Optional</label>
            </div>
          </div>
          {item.is_optional && <div className="text-xs text-blue-600 print:text-gray-500 italic mt-1 font-medium">* Optional (Nicht in der Summe)</div>}
        </div>

        {/* 3. Quantity */}
        <div className="pt-0.5">
          <Input
            type="number" step="0.001" min="0"
            value={item.quantity}
            onChange={(e) => updateItem && updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
            disabled={disabled}
            className="h-8 text-right bg-transparent border-gray-200 focus:bg-white focus:border-blue-500 print:border-none print:p-0 print:h-auto font-mono"
          />
        </div>

        {/* 4. Unit */}
        <div className="pt-0.5">
          <Select value={item.unit} onValueChange={(v) => updateItem && updateItem(index, 'unit', v)} disabled={disabled}>
            <SelectTrigger className="h-8 bg-transparent border-gray-200 focus:bg-white focus:border-blue-500 print:border-none print:p-0 print:h-auto print:!bg-transparent [&>svg]:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OFFER_ITEM_UNITS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* 5. Unit Price */}
        <div className="pt-0.5 relative group/price">
          <Input
            type="number" step="0.01" min="0"
            value={item.unit_price_net}
            onChange={(e) => updateItem && updateItem(index, 'unit_price_net', parseFloat(e.target.value) || 0)}
            disabled={disabled}
            className="h-8 text-right bg-transparent border-gray-200 focus:bg-white focus:border-blue-500 print:border-none print:p-0 print:h-auto font-mono pr-6 print:pr-0"
          />
          <span className="absolute right-2 top-2 text-xs text-gray-400 pointer-events-none print:hidden">€</span>

          {/* VAT Selector on Hover (Hidden in Print) */}
          <div className="absolute right-0 -bottom-6 z-10 hidden group-hover/price:block print:hidden">
            <Select value={String(item.vat_rate)} onValueChange={(v) => updateItem && updateItem(index, 'vat_rate', parseFloat(v))} disabled={disabled}>
              <SelectTrigger className="h-5 text-[10px] w-16 bg-white border shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="0">0%</SelectItem><SelectItem value="7">7%</SelectItem><SelectItem value="19">19%</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        {/* 6. Total */}
        <div className="text-right pt-1.5 font-mono font-medium">
          <span className={`${item.is_optional ? 'text-gray-400 line-through' : 'text-gray-900 print:text-black'}`}>
            {formatCurrency(calculateItemTotal(item))}
          </span>
        </div>

        {/* 7. Actions */}
        <div className="pt-0.5 text-right print:hidden">
          {!disabled && removeItem && (
            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

      </div>
    </div>
  );
};


export function OfferItemsEditor({
  items,
  onChange,
  disabled = false,
  header,
  footer,
  isReverseCharge = false,
  showLaborShare = true,
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
      return `${major}`; // Return major number for titles
    } else {
      let count = 0;
      for (let i = 0; i <= index; i++) {
        if (items[i].item_type !== 'title' && items[i].item_type !== 'page_break') count++;
      }
      if (item.item_type !== 'title') return count;
    }
    return '';
  };

  // Calculate totals grouped by VAT rate
  const totals = useMemo(() => {
    const netTotal = items
      .filter(item => !item.is_optional && item.item_type !== 'page_break')
      .reduce((sum, item) => sum + calculateItemTotal(item), 0);

    const vatGroups = items
      .filter(item => !item.is_optional && item.item_type !== 'page_break')
      .reduce((acc, item) => {
        const rate = item.vat_rate || 0; // Default to 0 if undefined
        const net = calculateItemTotal(item);
        const vat = net * (rate / 100);

        if (!acc[rate]) acc[rate] = { net: 0, vat: 0 };
        acc[rate].net += net;
        acc[rate].vat += vat;
        return acc;
      }, {} as Record<number, { net: number; vat: number }>);

    const totalVat = isReverseCharge ? 0 : Object.values(vatGroups).reduce((sum, group) => sum + group.vat, 0);
    const grossTotal = netTotal + totalVat;

    const laborTotal = items
      .filter(item => item.item_type === 'labor' && !item.is_optional)
      .reduce((sum, item) => sum + calculateItemTotal(item), 0);

    return { netTotal, vatGroups, totalVat, grossTotal, laborTotal };
  }, [items, isReverseCharge]);

  // --- Pagination Logic ---
  const pages = useMemo(() => {
    const _pages: { items: { item: EditorOfferItem; index: number }[] }[] = [];
    let currentPageItems: { item: EditorOfferItem; index: number }[] = [];

    let currentY = 0;
    // Page 1 has Header
    let maxPageHeight = CONTENT_HEIGHT_PX - (headerHeight || 0) - 100; // Extra buffer
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
      const itemH = itemHeights[itemId] || 60; // Default estimate lower for table rows

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
                  {/* Table Header (Show on first page after header, or every page?) 
                       Usually strictly below the header on first page, then visually continued.
                       For simplicity/clarity let's show it on every page top if it has items.
                   */}
                  {page.items.length > 0 && <TableHeader />}

                  <div className="space-y-0">
                    {page.items.map(({ item, index }) => {
                      const itemId = item.id || item.temp_id || `temp_${index}`;
                      return (
                        <SortableItemWrapper
                          key={itemId}
                          id={itemId}
                          onHeightChange={(h) => {
                            if (Math.abs((itemHeights[itemId] || 0) - h) > 2) {
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
                      <div className="mt-8 break-inside-avoid">
                        <div className="flex justify-end pt-6">
                          {/* Summary Block */}
                          <div className="min-w-[300px] text-sm">
                            <div className="flex justify-between items-center mb-2 text-gray-600 print:text-black">
                              <span>Netto</span>
                              <span>{formatCurrency(totals.netTotal)}</span>
                            </div>

                            {/* Render VAT groups */}
                            {Object.entries(totals.vatGroups).map(([rate, group]) => (
                              parseFloat(rate) > 0 && (
                                <div key={rate} className="flex justify-between items-center mb-1 text-gray-600 print:text-black">
                                  <span>zzgl. MwSt {rate}%</span>
                                  <span>{formatCurrency(group.vat)}</span>
                                </div>
                              )
                            ))}

                            <div className="h-px bg-gray-900 my-2" />
                            <div className="flex justify-between items-end">
                              <span className="font-bold text-lg">Gesamtsumme</span>
                              <span className="text-xl font-bold bg-gray-100 print:bg-transparent px-2 py-0.5 rounded text-gray-900 print:text-black">{formatCurrency(totals.grossTotal)}</span>
                            </div>

                            {/* Reverse Charge Note */}
                            {isReverseCharge && (
                              <div className="mt-4 text-xs italic text-gray-600 print:text-black border-t pt-2">
                                Hinweis: Steuerschuldnerschaft des Leistungsempfängers nach §13b UStG (Reverse Charge).
                              </div>
                            )}

                            {/* Labor Share Note */}
                            {showLaborShare && totals.laborTotal > 0 && (
                              <div className="mt-2 text-xs text-gray-500 print:text-black">
                                Darin enthaltene Lohnkosten: {formatCurrency(totals.laborTotal)} (netto)
                              </div>
                            )}
                          </div>
                        </div>

                        {footer && (
                          <div className="pt-12 text-sm text-gray-500">
                            {footer}
                          </div>
                        )}
                      </div>
                    </MeasurableItem>
                  )}
                </div>
              </div>

              {/* Page Break Control (Visual only for editing) */}
              {pageIndex < pages.length - 1 && (
                /* Page break UI logic */
                (() => {
                  const lastItemOfPage = page.items[page.items.length - 1];
                  const nextItemIndex = lastItemOfPage ? lastItemOfPage.index + 1 : -1;
                  const nextItem = items[nextItemIndex];

                  const isManualBreak = nextItem && nextItem.item_type === 'page_break';

                  return (
                    <div className="flex items-center justify-center gap-4 py-4 group print:hidden">
                      <div className="h-px bg-gray-300 flex-1 border-dashed border-t-2 border-gray-300"></div>

                      {isManualBreak ? (
                        <div className="flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium border border-purple-200">
                          <div className="h-3 w-3">✂️</div>
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
            <div className="bg-white shadow-2xl rounded-lg opacity-90 scale-105 pointer-events-none ring-2 ring-blue-500 p-2">
              <div className="flex items-center gap-4">
                <span className="font-bold">{item.item_type}</span>
                <span>{item.description.substring(0, 20)}...</span>
              </div>
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
}

export default OfferItemsEditor;
