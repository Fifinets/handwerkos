import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export interface MaterialItem {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
}

interface ReorderSuggestionsProps {
  materials: MaterialItem[];
}

const ReorderSuggestions = ({ materials }: ReorderSuggestionsProps) => {
  const lowStockItems = materials.filter((m) => m.currentStock <= m.minStock);

  if (lowStockItems.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bestellvorschl\xC3\xA4ge</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b pb-1 text-left">Material</th>
              <th className="border-b pb-1 text-right">akt. Bestand</th>
              <th className="border-b pb-1 text-right">Mindestbestand</th>
              <th className="border-b pb-1 text-right">Vorschlag</th>
            </tr>
          </thead>
          <tbody>
            {lowStockItems.map((item) => {
              const reorderQty = item.maxStock - item.currentStock;
              return (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-1 pr-2">{item.name}</td>
                  <td className="py-1 pr-2 text-right">
                    {item.currentStock} {item.unit}
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {item.minStock} {item.unit}
                  </td>
                  <td className="py-1 text-right font-medium">
                    {reorderQty} {item.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

export default ReorderSuggestions;
