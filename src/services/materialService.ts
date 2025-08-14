// Material service for HandwerkOS
// Handles CRUD operations for materials and inventory management

import { supabase } from '@/integrations/supabase/client';
import { 
  apiCall, 
  createQuery, 
  validateInput,
  getCurrentUserProfile,
  ApiError,
  API_ERROR_CODES 
} from '@/utils/api';
import {
  Material,
  MaterialCreate,
  MaterialUpdate,
  MaterialCreateSchema,
  MaterialUpdateSchema,
  PaginationQuery,
  PaginationResponse
} from '@/types';
import { eventBus } from './eventBus';

export class MaterialService {
  
  // Get all materials with pagination and filtering
  static async getMaterials(
    pagination?: PaginationQuery,
    filters?: {
      category?: string;
      supplier?: string;
      low_stock?: boolean;
      search?: string;
    }
  ): Promise<PaginationResponse<Material>> {
    return apiCall(async () => {
      let query = supabase
        .from('materials')
        .select('*', { count: 'exact' });
      
      // Apply filters
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters?.supplier) {
        query = query.eq('supplier', filters.supplier);
      }
      
      if (filters?.low_stock) {
        query = query.lt('stock_quantity', supabase.raw('minimum_stock'));
      }
      
      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,` +
          `description.ilike.%${filters.search}%,` +
          `sku.ilike.%${filters.search}%`
        );
      }
      
      // Apply pagination
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'name', { 
            ascending: pagination.sort_order === 'asc' 
          });
      } else {
        query = query.order('name', { ascending: true });
      }
      
      const { data, count } = await createQuery<Material>(query).executeWithCount();
      
      return {
        items: data,
        pagination: {
          page: pagination?.page || 1,
          limit: pagination?.limit || data.length,
          total_items: count,
          total_pages: Math.ceil(count / (pagination?.limit || 20)),
          has_next: pagination ? (pagination.page * pagination.limit < count) : false,
          has_prev: pagination ? pagination.page > 1 : false,
        },
      };
    }, 'Get materials');
  }
  
  // Get material by ID
  static async getMaterial(id: string): Promise<Material> {
    return apiCall(async () => {
      const query = supabase
        .from('materials')
        .select('*')
        .eq('id', id);
      
      return createQuery<Material>(query).executeSingle();
    }, `Get material ${id}`);
  }
  
  // Create new material
  static async createMaterial(data: MaterialCreate): Promise<Material> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(MaterialCreateSchema, data);
      
      // Set initial stock values
      if (validatedData.stock_quantity === undefined) {
        validatedData.stock_quantity = 0;
      }
      
      if (validatedData.minimum_stock === undefined) {
        validatedData.minimum_stock = 0;
      }
      
      const query = supabase
        .from('materials')
        .insert(validatedData)
        .select()
        .single();
      
      const material = await createQuery<Material>(query).executeSingle();
      
      // Emit event for inventory tracking
      eventBus.emit('MATERIAL_CREATED', {
        material,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return material;
    }, 'Create material');
  }
  
  // Update existing material
  static async updateMaterial(id: string, data: MaterialUpdate): Promise<Material> {
    return apiCall(async () => {
      // Get existing material
      const existingMaterial = await this.getMaterial(id);
      
      // Validate input
      const validatedData = validateInput(MaterialUpdateSchema, data);
      
      const query = supabase
        .from('materials')
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();
      
      const updatedMaterial = await createQuery<Material>(query).executeSingle();
      
      // Check for low stock alerts
      if (updatedMaterial.stock_quantity < updatedMaterial.minimum_stock) {
        eventBus.emit('MATERIAL_LOW_STOCK', {
          material: updatedMaterial,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });
      }
      
      // Emit general update event
      eventBus.emit('MATERIAL_UPDATED', {
        material: updatedMaterial,
        previous_material: existingMaterial,
        changes: validatedData,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return updatedMaterial;
    }, `Update material ${id}`);
  }
  
  // Adjust stock quantity (with reason)
  static async adjustStock(
    id: string, 
    adjustment: number, 
    reason: string,
    reference?: string
  ): Promise<Material> {
    return apiCall(async () => {
      const material = await this.getMaterial(id);
      const newQuantity = material.stock_quantity + adjustment;
      
      if (newQuantity < 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Bestand kann nicht negativ werden.',
          { currentStock: material.stock_quantity, adjustment }
        );
      }
      
      // Update stock quantity
      const query = supabase
        .from('materials')
        .update({ stock_quantity: newQuantity })
        .eq('id', id)
        .select()
        .single();
      
      const updatedMaterial = await createQuery<Material>(query).executeSingle();
      
      // Log stock movement
      await supabase
        .from('stock_movements')
        .insert({
          material_id: id,
          movement_type: adjustment > 0 ? 'in' : 'out',
          quantity: Math.abs(adjustment),
          reason,
          reference,
          previous_stock: material.stock_quantity,
          new_stock: newQuantity,
        });
      
      // Emit events
      eventBus.emit('STOCK_ADJUSTED', {
        material: updatedMaterial,
        adjustment,
        reason,
        reference,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      if (newQuantity < updatedMaterial.minimum_stock) {
        eventBus.emit('MATERIAL_LOW_STOCK', {
          material: updatedMaterial,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });
      }
      
      return updatedMaterial;
    }, `Adjust stock for material ${id}`);
  }
  
  // Add stock (purchase/delivery)
  static async addStock(
    id: string, 
    quantity: number, 
    unitCost?: number,
    supplier?: string,
    invoiceReference?: string
  ): Promise<Material> {
    return apiCall(async () => {
      const material = await this.getMaterial(id);
      
      // Update unit cost if provided
      const updateData: any = {
        stock_quantity: material.stock_quantity + quantity
      };
      
      if (unitCost !== undefined) {
        updateData.unit_cost = unitCost;
      }
      
      const query = supabase
        .from('materials')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const updatedMaterial = await createQuery<Material>(query).executeSingle();
      
      // Log stock movement
      await supabase
        .from('stock_movements')
        .insert({
          material_id: id,
          movement_type: 'in',
          quantity,
          reason: 'Wareneinkauf',
          reference: invoiceReference,
          unit_cost: unitCost,
          supplier,
          previous_stock: material.stock_quantity,
          new_stock: material.stock_quantity + quantity,
        });
      
      eventBus.emit('STOCK_RECEIVED', {
        material: updatedMaterial,
        quantity,
        unitCost,
        supplier,
        invoiceReference,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return updatedMaterial;
    }, `Add stock for material ${id}`);
  }
  
  // Remove stock (consumption/sale)
  static async removeStock(
    id: string, 
    quantity: number, 
    projectId?: string,
    reason: string = 'Verbrauch'
  ): Promise<Material> {
    return apiCall(async () => {
      const material = await this.getMaterial(id);
      
      if (material.stock_quantity < quantity) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nicht genügend Bestand verfügbar.',
          { 
            availableStock: material.stock_quantity, 
            requestedQuantity: quantity 
          }
        );
      }
      
      const newQuantity = material.stock_quantity - quantity;
      
      const query = supabase
        .from('materials')
        .update({ stock_quantity: newQuantity })
        .eq('id', id)
        .select()
        .single();
      
      const updatedMaterial = await createQuery<Material>(query).executeSingle();
      
      // Log stock movement
      await supabase
        .from('stock_movements')
        .insert({
          material_id: id,
          movement_type: 'out',
          quantity,
          reason,
          project_id: projectId,
          previous_stock: material.stock_quantity,
          new_stock: newQuantity,
        });
      
      // Emit events
      eventBus.emit('STOCK_CONSUMED', {
        material: updatedMaterial,
        quantity,
        projectId,
        reason,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      if (newQuantity < updatedMaterial.minimum_stock) {
        eventBus.emit('MATERIAL_LOW_STOCK', {
          material: updatedMaterial,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });
      }
      
      return updatedMaterial;
    }, `Remove stock for material ${id}`);
  }
  
  // Get stock movements for a material
  static async getStockMovements(
    materialId: string,
    pagination?: PaginationQuery
  ): Promise<PaginationResponse<any>> {
    return apiCall(async () => {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          projects (
            name,
            project_number
          )
        `, { count: 'exact' })
        .eq('material_id', materialId);
      
      // Apply pagination
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'created_at', { 
            ascending: pagination.sort_order === 'asc' 
          });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      
      const { data, count } = await createQuery(query).executeWithCount();
      
      return {
        items: data,
        pagination: {
          page: pagination?.page || 1,
          limit: pagination?.limit || data.length,
          total_items: count,
          total_pages: Math.ceil(count / (pagination?.limit || 20)),
          has_next: pagination ? (pagination.page * pagination.limit < count) : false,
          has_prev: pagination ? pagination.page > 1 : false,
        },
      };
    }, `Get stock movements for material ${materialId}`);
  }
  
  // Get materials with low stock
  static async getLowStockMaterials(): Promise<Material[]> {
    return apiCall(async () => {
      const query = supabase
        .from('materials')
        .select('*')
        .lt('stock_quantity', supabase.raw('minimum_stock'))
        .order('name');
      
      return createQuery<Material>(query).execute();
    }, 'Get low stock materials');
  }
  
  // Get material statistics
  static async getMaterialStats(): Promise<{
    total_materials: number;
    total_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
    categories: Record<string, number>;
  }> {
    return apiCall(async () => {
      const materials = await createQuery<Material>(
        supabase.from('materials').select('*')
      ).execute();
      
      const stats = materials.reduce(
        (acc, material) => {
          acc.total_materials++;
          acc.total_value += (material.stock_quantity || 0) * (material.unit_cost || 0);
          
          if ((material.stock_quantity || 0) === 0) {
            acc.out_of_stock_count++;
          } else if ((material.stock_quantity || 0) < (material.minimum_stock || 0)) {
            acc.low_stock_count++;
          }
          
          const category = material.category || 'Sonstige';
          acc.categories[category] = (acc.categories[category] || 0) + 1;
          
          return acc;
        },
        {
          total_materials: 0,
          total_value: 0,
          low_stock_count: 0,
          out_of_stock_count: 0,
          categories: {} as Record<string, number>,
        }
      );
      
      return stats;
    }, 'Get material statistics');
  }
  
  // Search materials
  static async searchMaterials(query: string, limit: number = 10): Promise<Material[]> {
    return apiCall(async () => {
      const searchQuery = supabase
        .from('materials')
        .select('*')
        .or(
          `name.ilike.%${query}%,` +
          `description.ilike.%${query}%,` +
          `sku.ilike.%${query}%`
        )
        .order('name')
        .limit(limit);
      
      return createQuery<Material>(searchQuery).execute();
    }, `Search materials: ${query}`);
  }
  
  // Get materials by category
  static async getMaterialsByCategory(category: string): Promise<Material[]> {
    return apiCall(async () => {
      const query = supabase
        .from('materials')
        .select('*')
        .eq('category', category)
        .order('name');
      
      return createQuery<Material>(query).execute();
    }, `Get materials by category: ${category}`);
  }
  
  // Get materials by supplier
  static async getMaterialsBySupplier(supplier: string): Promise<Material[]> {
    return apiCall(async () => {
      const query = supabase
        .from('materials')
        .select('*')
        .eq('supplier', supplier)
        .order('name');
      
      return createQuery<Material>(query).execute();
    }, `Get materials by supplier: ${supplier}`);
  }
  
  // Delete material (with safety checks)
  static async deleteMaterial(id: string): Promise<void> {
    return apiCall(async () => {
      const material = await this.getMaterial(id);
      
      // Check if material has stock
      if (material.stock_quantity > 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Materialien mit Lagerbestand können nicht gelöscht werden.',
          { stockQuantity: material.stock_quantity }
        );
      }
      
      // Check if material has been used in projects
      const { data: usedInProjects } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('material_id', id)
        .limit(1);
      
      if (usedInProjects && usedInProjects.length > 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Materialien mit Bestandsbewegungen können nicht gelöscht werden.'
        );
      }
      
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      // Emit event for audit trail
      eventBus.emit('MATERIAL_DELETED', {
        material,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
    }, `Delete material ${id}`);
  }
}

// Export singleton instance
export const materialService = new MaterialService();