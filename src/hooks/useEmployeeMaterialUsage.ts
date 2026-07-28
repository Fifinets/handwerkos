// Material-Verbuchung durch Mitarbeiter auf ein Projekt.
// WICHTIG: Schreibt GENAU die real existierenden Spalten von employee_material_usage
// (quantity_used, usage_date, ...). Der ältere Hook src/hooks/useMaterials.ts schrieb
// nicht existierende Spalten (quantity, unit_price, used_at, location_*) und landete
// dadurch still im Offline-Queue — hier bewusst vermieden.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';
import { toast } from 'sonner';

export interface MaterialUsageInsert {
  project_id: string;
  material_id: string;
  employee_id: string;
  created_by: string;
  quantity_used: number;
  notes?: string;
  usage_date: string;
}

export function buildMaterialUsageInsert(p: {
  projectId: string;
  materialId: string;
  employeeId: string;
  userId: string;
  quantity: number;
  notes?: string;
  usageDate: string;
}): MaterialUsageInsert {
  return {
    project_id: p.projectId,
    material_id: p.materialId,
    employee_id: p.employeeId,
    created_by: p.userId,
    quantity_used: p.quantity,
    notes: p.notes || undefined,
    usage_date: p.usageDate,
  };
}

export function useProjectMaterialUsage(projectId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projectMaterialUsage(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_material_usage')
        .select(
          `id, quantity_used, notes, usage_date, created_at,
           material:materials ( name, unit, sku, unit_price ),
           employee:employees ( first_name, last_name )`
        )
        .eq('project_id', projectId)
        .order('usage_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordMaterialUsage(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insert: MaterialUsageInsert) => {
      const { error } = await supabase.from('employee_material_usage').insert(insert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Material verbucht');
      if (projectId) qc.invalidateQueries({ queryKey: QUERY_KEYS.projectMaterialUsage(projectId) });
    },
    onError: () => toast.error('Material konnte nicht verbucht werden'),
  });
}
