// src/hooks/useMachineData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';

export interface MachineDevice {
  id: string;
  device_name: string;
  device_type: 'anlage' | 'geraet';
  category: 'werkzeug' | 'fahrzeug' | 'messgeraet';
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  current_location: string | null;
  status: 'active' | 'inactive' | 'disposed';
  condition: 'gut' | 'maessig' | 'schlecht' | 'defekt';
  operating_hours: number;
  next_inspection_date: string | null;
  inspection_interval_months: number;
  purchase_date: string | null;
  purchase_price: number | null;
  created_at: string;
}

export interface EquipmentAssignment {
  id: string;
  device_id: string;
  project_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  projects?: { name: string; status: string };
}

export function useMachineData() {
  const { companyId } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const devicesQuery = useQuery({
    queryKey: QUERY_KEYS.machines,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_devices')
        .select('*')
        .eq('company_id', companyId!)
        .neq('status', 'disposed');
      if (error) throw error;
      return (data || []) as MachineDevice[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.machines });
  };

  return {
    devices: devicesQuery.data || [],
    isLoading: devicesQuery.isLoading,
    invalidateAll,
    companyId,
  };
}

export function useDeviceAssignments(deviceId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.machineAssignments(deviceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_assignments')
        .select('*, projects(name, status)')
        .eq('device_id', deviceId)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as EquipmentAssignment[];
    },
    enabled: !!deviceId,
    staleTime: 30_000,
  });
}
