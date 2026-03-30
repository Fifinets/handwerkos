import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";

export interface MaterialsTabProps {
  deliveryNoteMaterials: any[];
}

const MaterialsTab: React.FC<MaterialsTabProps> = ({
  deliveryNoteMaterials,
}) => {
  return (
    <TabsContent value="materials" className="space-y-4 min-h-[600px] mt-0">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Material aus Lieferscheinen</h3>
        <p className="text-sm text-slate-500">{deliveryNoteMaterials.length} Positionen</p>
      </div>
      <Card>
        <CardContent className="p-4">
          {deliveryNoteMaterials.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Noch keine Materialien erfasst. Materialien werden über Lieferscheine hinzugefügt.</p>
          ) : (
            <div className="divide-y">
              {deliveryNoteMaterials.map((mat: any) => (
                <div key={mat.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">{mat.material_name}</p>
                    <p className="text-xs text-slate-500">
                      {mat.employee_name} · {new Date(mat.work_date).toLocaleDateString('de-DE')}
                      {mat.delivery_note_number && ` · ${mat.delivery_note_number}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {mat.material_quantity} {mat.material_unit}
                    </p>
                    {mat.unit_price && (
                      <p className="text-xs text-slate-500">
                        {((mat.unit_price || 0) * (mat.material_quantity || 0)).toFixed(2)} €
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {deliveryNoteMaterials.some((m: any) => m.unit_price) && (
                <div className="flex justify-between pt-3 font-medium text-sm">
                  <span>Gesamt</span>
                  <span>
                    {deliveryNoteMaterials.reduce((sum: number, m: any) =>
                      sum + ((m.unit_price || 0) * (m.material_quantity || 0)), 0
                    ).toFixed(2)} €
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default MaterialsTab;
