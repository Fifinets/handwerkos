// Inspection service for HandwerkOS
// Handles CRUD operations for VDE inspection protocols, devices, measurements, defects, and schedules

import { supabase } from '@/integrations/supabase/client';
import { apiCall, ApiError, API_ERROR_CODES } from '@/utils/api';
import { AuditLogService } from './auditLogService';
import type {
  InspectionDevice,
  InspectionDeviceCreate,
  InspectionDeviceUpdate,
  InspectionProtocol,
  InspectionProtocolCreate,
  InspectionProtocolUpdate,
  ProtocolWithRelations,
  InspectionMeasurement,
  InspectionMeasurementCreate,
  InspectionDefect,
  InspectionDefectCreate,
  InspectionDefectUpdate,
  InspectionSchedule,
  InspectionScheduleCreate,
  InspectionFilter,
} from '@/types/inspection';

class InspectionService {

  // ============================================================================
  // HELPERS
  // ============================================================================

  private static async getCompanyId(): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new ApiError(API_ERROR_CODES.UNAUTHORIZED, 'Nicht angemeldet');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.user.id)
      .single();

    if (profile?.company_id) {
      return profile.company_id;
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.user.id)
      .single();

    if (employee?.company_id) {
      return employee.company_id;
    }

    return '00000000-0000-0000-0000-000000000000';
  }

  // ============================================================================
  // DEVICE CRUD
  // ============================================================================

  static async getDevices(customerId?: string): Promise<InspectionDevice[]> {
    return apiCall(async () => {
      let query = supabase
        .from('inspection_devices')
        .select('*')
        .order('device_name', { ascending: true });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }, 'Get inspection devices');
  }

  static async getDevice(id: string): Promise<InspectionDevice> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('inspection_devices')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    }, `Get inspection device ${id}`);
  }

  static async createDevice(input: InspectionDeviceCreate): Promise<InspectionDevice> {
    return apiCall(async () => {
      const companyId = await this.getCompanyId();

      const { data, error } = await supabase
        .from('inspection_devices')
        .insert({ ...input, company_id: companyId })
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Create inspection device');
  }

  static async updateDevice(id: string, input: InspectionDeviceUpdate): Promise<InspectionDevice> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('inspection_devices')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, `Update inspection device ${id}`);
  }

  static async deleteDevice(id: string): Promise<void> {
    return apiCall(async () => {
      const { error } = await supabase
        .from('inspection_devices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }, `Delete inspection device ${id}`);
  }

  // ============================================================================
  // PROTOCOL CRUD
  // ============================================================================

  static async getProtocols(filters?: InspectionFilter): Promise<InspectionProtocol[]> {
    return apiCall(async () => {
      let query = supabase
        .from('inspection_protocols')
        .select('*')
        .order('inspection_date', { ascending: false });

      if (filters?.protocol_type) {
        query = query.eq('protocol_type', filters.protocol_type);
      }
      if (filters?.overall_result) {
        query = query.eq('overall_result', filters.overall_result);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.device_id) {
        query = query.eq('device_id', filters.device_id);
      }
      if (filters?.from_date) {
        query = query.gte('inspection_date', filters.from_date);
      }
      if (filters?.to_date) {
        query = query.lte('inspection_date', filters.to_date);
      }
      if (filters?.search) {
        query = query.or(
          `protocol_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }, 'Get inspection protocols');
  }

  static async getProtocol(id: string): Promise<ProtocolWithRelations> {
    return apiCall(async () => {
      const { data: protocol, error: protocolError } = await supabase
        .from('inspection_protocols')
        .select('*')
        .eq('id', id)
        .single();

      if (protocolError) throw protocolError;

      const { data: measurements } = await supabase
        .from('inspection_measurements')
        .select('*')
        .eq('protocol_id', id)
        .order('created_at', { ascending: true });

      const { data: defects } = await supabase
        .from('inspection_defects')
        .select('*')
        .eq('protocol_id', id)
        .order('created_at', { ascending: true });

      const { data: photos } = await supabase
        .from('inspection_photos')
        .select('*')
        .eq('protocol_id', id)
        .order('created_at', { ascending: true });

      let device = undefined;
      if (protocol.device_id) {
        const { data: deviceData } = await supabase
          .from('inspection_devices')
          .select('*')
          .eq('id', protocol.device_id)
          .single();
        device = deviceData ?? undefined;
      }

      return {
        ...protocol,
        measurements: measurements || [],
        defects: defects || [],
        photos: photos || [],
        device,
      } as ProtocolWithRelations;
    }, `Get inspection protocol ${id}`);
  }

  static async createProtocol(input: InspectionProtocolCreate): Promise<InspectionProtocol> {
    return apiCall(async () => {
      const companyId = await this.getCompanyId();

      // Get next protocol number via DB function
      // @ts-ignore
      const { data: seqNum, error: seqError } = await supabase.rpc(
        'next_protocol_number',
        { p_company_id: companyId }
      );

      if (seqError) throw seqError;

      const year = new Date().getFullYear();
      const protocolNumber = `PRF-${year}-${String(seqNum).padStart(4, '0')}`;

      const { data, error } = await supabase
        .from('inspection_protocols')
        .insert({
          ...input,
          company_id: companyId,
          protocol_number: protocolNumber,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Create inspection protocol');
  }

  static async updateProtocol(id: string, input: InspectionProtocolUpdate): Promise<InspectionProtocol> {
    return apiCall(async () => {
      // Block edits on finalized protocols
      const { data: existing, error: fetchError } = await supabase
        .from('inspection_protocols')
        .select('is_finalized')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (existing.is_finalized) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Finalisierte Protokolle koennen nicht mehr bearbeitet werden.'
        );
      }

      const { data, error } = await supabase
        .from('inspection_protocols')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, `Update inspection protocol ${id}`);
  }

  static async finalizeProtocol(id: string): Promise<InspectionProtocol> {
    return apiCall(async () => {
      const protocol = await this.getProtocol(id);

      if (protocol.is_finalized) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Protokoll ist bereits finalisiert.'
        );
      }

      // Auto-calculate overall_result from measurements and defects
      let overallResult: 'pass' | 'fail' | 'conditional' = 'pass';

      const measurements = protocol.measurements || [];
      const defects = protocol.defects || [];

      const hasFailedMeasurement = measurements.some(m => m.result === 'fail');
      const hasCriticalDefect = defects.some(d => d.severity === 'critical' && !d.resolved);
      const hasMajorDefect = defects.some(d => d.severity === 'major' && !d.resolved);
      const hasMinorDefect = defects.some(d => d.severity === 'minor' && !d.resolved);

      if (hasFailedMeasurement || hasCriticalDefect) {
        overallResult = 'fail';
      } else if (hasMajorDefect || hasMinorDefect) {
        overallResult = 'conditional';
      }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('inspection_protocols')
        .update({
          is_finalized: true,
          finalized_at: now,
          overall_result: overallResult,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update device next_inspection_date if linked
      if (protocol.device_id && protocol.device) {
        const intervalMonths = protocol.device.inspection_interval_months || 12;
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + intervalMonths);

        await supabase
          .from('inspection_devices')
          .update({ next_inspection_date: nextDate.toISOString().split('T')[0] })
          .eq('id', protocol.device_id);
      }

      // Log to audit
      const { data: user } = await supabase.auth.getUser();
      try {
        await AuditLogService.createAuditLog({
          entity_type: 'document',
          entity_id: id,
          action: 'finalize',
          user_id: user.user?.id || '',
          changes: {
            overall_result: overallResult,
            finalized_at: now,
            protocol_number: protocol.protocol_number,
          },
        });
      } catch {
        // Audit logging is best-effort, don't fail the finalization
      }

      return data;
    }, `Finalize inspection protocol ${id}`);
  }

  // ============================================================================
  // MEASUREMENTS
  // ============================================================================

  static async addMeasurement(input: InspectionMeasurementCreate): Promise<InspectionMeasurement> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('inspection_measurements')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Add inspection measurement');
  }

  static async deleteMeasurement(id: string): Promise<void> {
    return apiCall(async () => {
      const { error } = await supabase
        .from('inspection_measurements')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }, `Delete inspection measurement ${id}`);
  }

  // ============================================================================
  // DEFECTS
  // ============================================================================

  static async addDefect(input: InspectionDefectCreate): Promise<InspectionDefect> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('inspection_defects')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Add inspection defect');
  }

  static async updateDefect(id: string, input: InspectionDefectUpdate): Promise<InspectionDefect> {
    return apiCall(async () => {
      const updateData: any = { ...input };

      // Auto-set resolved_at when resolved=true
      if (input.resolved === true) {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('inspection_defects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, `Update inspection defect ${id}`);
  }

  // ============================================================================
  // SCHEDULING & OVERDUE
  // ============================================================================

  static async getUpcomingInspections(withinDays: number = 30): Promise<InspectionDevice[]> {
    return apiCall(async () => {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + withinDays);

      const { data, error } = await supabase
        .from('inspection_devices')
        .select('*')
        .eq('status', 'active')
        .not('next_inspection_date', 'is', null)
        .gte('next_inspection_date', today.toISOString().split('T')[0])
        .lte('next_inspection_date', futureDate.toISOString().split('T')[0])
        .order('next_inspection_date', { ascending: true });

      if (error) throw error;
      return data || [];
    }, 'Get upcoming inspections');
  }

  static async getOverdueInspections(): Promise<InspectionDevice[]> {
    return apiCall(async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('inspection_devices')
        .select('*')
        .eq('status', 'active')
        .not('next_inspection_date', 'is', null)
        .lt('next_inspection_date', today)
        .order('next_inspection_date', { ascending: true });

      if (error) throw error;
      return data || [];
    }, 'Get overdue inspections');
  }

  static async createSchedule(input: InspectionScheduleCreate): Promise<InspectionSchedule> {
    return apiCall(async () => {
      const companyId = await this.getCompanyId();

      const { data, error } = await supabase
        .from('inspection_schedules')
        .insert({ ...input, company_id: companyId })
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Create inspection schedule');
  }
  // ============================================================================
  // EQUIPMENT ASSIGNMENTS
  // ============================================================================

  static async assignDeviceToProject(deviceId: string, projectId: string, startDate: string | null, endDate: string | null, notes?: string) {
    const { data: existing } = await supabase
      .from('equipment_assignments')
      .select('id')
      .eq('device_id', deviceId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('equipment_assignments')
        .update({ start_date: startDate, end_date: endDate, is_active: true, notes: notes || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('equipment_assignments')
        .insert({ device_id: deviceId, project_id: projectId, start_date: startDate, end_date: endDate, is_active: true, notes: notes || null });
      if (error) throw error;
    }
  }

  static async unassignDeviceFromProject(deviceId: string, projectId: string) {
    const { error } = await supabase
      .from('equipment_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('device_id', deviceId)
      .eq('project_id', projectId);
    if (error) throw error;
  }

  static async updateDeviceCondition(deviceId: string, condition: string) {
    const { error } = await supabase
      .from('inspection_devices')
      .update({ condition, updated_at: new Date().toISOString() })
      .eq('id', deviceId);
    if (error) throw error;
  }

  static async updateOperatingHours(deviceId: string, hours: number) {
    const { error } = await supabase
      .from('inspection_devices')
      .update({ operating_hours: hours, updated_at: new Date().toISOString() })
      .eq('id', deviceId);
    if (error) throw error;
  }
}

export { InspectionService };
