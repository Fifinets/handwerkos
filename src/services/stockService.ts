// Stock service for HandwerkOS
// Handles advanced stock management, transfers, and inventory operations

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
  PaginationQuery,
  PaginationResponse
} from '@/types';
import { eventBus } from './eventBus';
import { materialService } from './materialService';

export interface StockMovement {
  id: string;
  material_id: string;
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment' | 'damaged' | 'returned';
  quantity: number;
  unit_cost?: number;
  reason: string;
  reference?: string;
  project_id?: string;
  supplier?: string;
  previous_stock: number;
  new_stock: number;
  created_at: string;
  created_by: string;
}

export interface StockTransfer {
  id: string;
  from_location?: string;
  to_location?: string;
  transfer_date: string;
  notes?: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  items: StockTransferItem[];
  created_at: string;
  created_by: string;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  material_id: string;
  quantity: number;
  received_quantity?: number;
}

export interface InventoryCount {
  id: string;
  count_date: string;
  location?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  items: InventoryCountItem[];
  created_at: string;
  created_by: string;
}

export interface InventoryCountItem {
  id: string;
  count_id: string;
  material_id: string;
  expected_quantity: number;
  counted_quantity?: number;
  variance?: number;
  notes?: string;
}

export class StockService {
  
  // Get all stock movements with filtering
  static async getStockMovements(
    pagination?: PaginationQuery,
    filters?: {
      material_id?: string;
      movement_type?: StockMovement['movement_type'];
      project_id?: string;
      date_from?: string;
      date_to?: string;
    }
  ): Promise<PaginationResponse<StockMovement>> {
    return apiCall(async () => {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          materials (
            name,
            sku,
            unit
          ),
          projects (
            name,
            project_number
          )
        `, { count: 'exact' });
      
      // Apply filters
      if (filters?.material_id) {
        query = query.eq('material_id', filters.material_id);
      }
      
      if (filters?.movement_type) {
        query = query.eq('movement_type', filters.movement_type);
      }
      
      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      
      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      
      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }
      
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
      
      const { data, count } = await createQuery<StockMovement>(query).executeWithCount();
      
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
    }, 'Get stock movements');
  }
  
  // Create stock transfer
  static async createStockTransfer(data: {
    from_location?: string;
    to_location?: string;
    transfer_date: string;
    notes?: string;
    items: Array<{
      material_id: string;
      quantity: number;
    }>;
  }): Promise<StockTransfer> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      
      // Create transfer
      const { data: transfer } = await supabase
        .from('stock_transfers')
        .insert({
          from_location: data.from_location,
          to_location: data.to_location,
          transfer_date: data.transfer_date,
          notes: data.notes,
          status: 'pending',
          created_by: currentUser.id,
        })
        .select()
        .single();
      
      if (!transfer) {
        throw new ApiError(API_ERROR_CODES.DATABASE_ERROR, 'Failed to create transfer');
      }
      
      // Create transfer items
      const transferItems = data.items.map(item => ({
        transfer_id: transfer.id,
        material_id: item.material_id,
        quantity: item.quantity,
      }));
      
      const { data: items } = await supabase
        .from('stock_transfer_items')
        .insert(transferItems)
        .select();
      
      const completeTransfer = {
        ...transfer,
        items: items || [],
      };
      
      eventBus.emit('STOCK_TRANSFER_CREATED', {
        transfer: completeTransfer,
        user_id: currentUser.id,
      });
      
      return completeTransfer;
    }, 'Create stock transfer');
  }
  
  // Start stock transfer (remove from source location)
  static async startStockTransfer(transferId: string): Promise<StockTransfer> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      
      // Get transfer with items
      const { data: transfer } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          stock_transfer_items (
            id,
            material_id,
            quantity
          )
        `)
        .eq('id', transferId)
        .single();
      
      if (!transfer) {
        throw new ApiError(API_ERROR_CODES.NOT_FOUND, 'Transfer not found');
      }
      
      if (transfer.status !== 'pending') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Only pending transfers can be started'
        );
      }
      
      // Remove stock from source materials
      for (const item of transfer.stock_transfer_items) {
        await materialService.removeStock(
          item.material_id,
          item.quantity,
          undefined,
          `Transfer to ${transfer.to_location || 'other location'}`
        );
        
        // Log stock movement
        await supabase
          .from('stock_movements')
          .insert({
            material_id: item.material_id,
            movement_type: 'transfer',
            quantity: item.quantity,
            reason: 'Stock transfer out',
            reference: `Transfer-${transfer.id}`,
          });
      }
      
      // Update transfer status
      await supabase
        .from('stock_transfers')
        .update({ 
          status: 'in_transit',
          started_at: new Date().toISOString(),
        })
        .eq('id', transferId);
      
      const updatedTransfer = { ...transfer, status: 'in_transit' as const };
      
      eventBus.emit('STOCK_TRANSFER_STARTED', {
        transfer: updatedTransfer,
        user_id: currentUser.id,
      });
      
      return updatedTransfer;
    }, `Start stock transfer ${transferId}`);
  }
  
  // Complete stock transfer (add to destination location)
  static async completeStockTransfer(
    transferId: string,
    receivedItems: Array<{
      item_id: string;
      received_quantity: number;
    }>
  ): Promise<StockTransfer> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      
      // Get transfer with items
      const { data: transfer } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          stock_transfer_items (
            id,
            material_id,
            quantity
          )
        `)
        .eq('id', transferId)
        .single();
      
      if (!transfer) {
        throw new ApiError(API_ERROR_CODES.NOT_FOUND, 'Transfer not found');
      }
      
      if (transfer.status !== 'in_transit') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Only in-transit transfers can be completed'
        );
      }
      
      // Update received quantities and add stock
      for (const receivedItem of receivedItems) {
        const transferItem = transfer.stock_transfer_items.find(
          item => item.id === receivedItem.item_id
        );
        
        if (!transferItem) continue;
        
        // Update transfer item with received quantity
        await supabase
          .from('stock_transfer_items')
          .update({ received_quantity: receivedItem.received_quantity })
          .eq('id', receivedItem.item_id);
        
        // Add received stock to destination
        await materialService.addStock(
          transferItem.material_id,
          receivedItem.received_quantity,
          undefined,
          undefined,
          `Transfer-${transfer.id}`
        );
        
        // Log variance if any
        const variance = receivedItem.received_quantity - transferItem.quantity;
        if (variance !== 0) {
          await supabase
            .from('stock_movements')
            .insert({
              material_id: transferItem.material_id,
              movement_type: 'adjustment',
              quantity: Math.abs(variance),
              reason: variance > 0 ? 'Transfer overage' : 'Transfer shortage',
              reference: `Transfer-${transfer.id}-variance`,
            });
        }
      }
      
      // Update transfer status
      await supabase
        .from('stock_transfers')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', transferId);
      
      const updatedTransfer = { ...transfer, status: 'completed' as const };
      
      eventBus.emit('STOCK_TRANSFER_COMPLETED', {
        transfer: updatedTransfer,
        user_id: currentUser.id,
      });
      
      return updatedTransfer;
    }, `Complete stock transfer ${transferId}`);
  }
  
  // Create inventory count
  static async createInventoryCount(data: {
    count_date: string;
    location?: string;
    notes?: string;
    material_ids?: string[];
  }): Promise<InventoryCount> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      
      // Create inventory count
      const { data: count } = await supabase
        .from('inventory_counts')
        .insert({
          count_date: data.count_date,
          location: data.location,
          notes: data.notes,
          status: 'planned',
          created_by: currentUser.id,
        })
        .select()
        .single();
      
      if (!count) {
        throw new ApiError(API_ERROR_CODES.DATABASE_ERROR, 'Failed to create inventory count');
      }
      
      // Get materials to count
      let materialsQuery = supabase
        .from('materials')
        .select('id, stock_quantity');
      
      if (data.material_ids?.length) {
        materialsQuery = materialsQuery.in('id', data.material_ids);
      }
      
      const { data: materials } = await materialsQuery;
      
      if (!materials) {
        throw new ApiError(API_ERROR_CODES.DATABASE_ERROR, 'Failed to get materials');
      }
      
      // Create count items
      const countItems = materials.map(material => ({
        count_id: count.id,
        material_id: material.id,
        expected_quantity: material.stock_quantity || 0,
      }));
      
      const { data: items } = await supabase
        .from('inventory_count_items')
        .insert(countItems)
        .select();
      
      const completeCount = {
        ...count,
        items: items || [],
      };
      
      eventBus.emit('INVENTORY_COUNT_CREATED', {
        count: completeCount,
        user_id: currentUser.id,
      });
      
      return completeCount;
    }, 'Create inventory count');
  }
  
  // Update inventory count item
  static async updateInventoryCountItem(
    itemId: string,
    countedQuantity: number,
    notes?: string
  ): Promise<void> {
    return apiCall(async () => {
      const { data: item } = await supabase
        .from('inventory_count_items')
        .select('expected_quantity')
        .eq('id', itemId)
        .single();
      
      if (!item) {
        throw new ApiError(API_ERROR_CODES.NOT_FOUND, 'Inventory count item not found');
      }
      
      const variance = countedQuantity - item.expected_quantity;
      
      await supabase
        .from('inventory_count_items')
        .update({
          counted_quantity: countedQuantity,
          variance,
          notes,
        })
        .eq('id', itemId);
    }, `Update inventory count item ${itemId}`);
  }
  
  // Complete inventory count and apply adjustments
  static async completeInventoryCount(countId: string): Promise<InventoryCount> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      
      // Get count with items
      const { data: count } = await supabase
        .from('inventory_counts')
        .select(`
          *,
          inventory_count_items (
            id,
            material_id,
            expected_quantity,
            counted_quantity,
            variance
          )
        `)
        .eq('id', countId)
        .single();
      
      if (!count) {
        throw new ApiError(API_ERROR_CODES.NOT_FOUND, 'Inventory count not found');
      }
      
      if (count.status !== 'in_progress') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Only in-progress counts can be completed'
        );
      }
      
      // Apply stock adjustments for items with variance
      for (const item of count.inventory_count_items) {
        if (item.variance && item.variance !== 0 && item.counted_quantity !== null) {
          await materialService.adjustStock(
            item.material_id,
            item.variance,
            'Inventory count adjustment',
            `Count-${count.id}`
          );
        }
      }
      
      // Update count status
      await supabase
        .from('inventory_counts')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', countId);
      
      const updatedCount = { ...count, status: 'completed' as const };
      
      eventBus.emit('INVENTORY_COUNT_COMPLETED', {
        count: updatedCount,
        user_id: currentUser.id,
      });
      
      return updatedCount;
    }, `Complete inventory count ${countId}`);
  }
  
  // Get stock valuation report
  static async getStockValuation(location?: string): Promise<{
    total_value: number;
    by_category: Record<string, {
      quantity: number;
      value: number;
      items: number;
    }>;
    low_stock_value: number;
    obsolete_value: number;
  }> {
    return apiCall(async () => {
      let query = supabase
        .from('materials')
        .select('*');
      
      if (location) {
        query = query.eq('location', location);
      }
      
      const materials = await createQuery<Material>(query).execute();
      
      const valuation = materials.reduce(
        (acc, material) => {
          const value = (material.stock_quantity || 0) * (material.unit_cost || 0);
          const category = material.category || 'Uncategorized';
          
          acc.total_value += value;
          
          if (!acc.by_category[category]) {
            acc.by_category[category] = { quantity: 0, value: 0, items: 0 };
          }
          
          acc.by_category[category].quantity += material.stock_quantity || 0;
          acc.by_category[category].value += value;
          acc.by_category[category].items += 1;
          
          // Check for low stock
          if ((material.stock_quantity || 0) < (material.minimum_stock || 0)) {
            acc.low_stock_value += value;
          }
          
          // Check for obsolete stock (no movement in 6 months)
          // This would require checking stock_movements table
          
          return acc;
        },
        {
          total_value: 0,
          by_category: {} as Record<string, any>,
          low_stock_value: 0,
          obsolete_value: 0,
        }
      );
      
      return valuation;
    }, 'Get stock valuation');
  }
  
  // Get stock movement analytics
  static async getStockAnalytics(
    dateFrom: string,
    dateTo: string
  ): Promise<{
    total_movements: number;
    total_value_in: number;
    total_value_out: number;
    by_type: Record<string, number>;
    top_materials: Array<{
      material_id: string;
      material_name: string;
      movement_count: number;
      total_quantity: number;
    }>;
  }> {
    return apiCall(async () => {
      const { data: movements } = await supabase
        .from('stock_movements')
        .select(`
          *,
          materials (
            name,
            unit_cost
          )
        `)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);
      
      if (!movements) {
        return {
          total_movements: 0,
          total_value_in: 0,
          total_value_out: 0,
          by_type: {},
          top_materials: [],
        };
      }
      
      const analytics = movements.reduce(
        (acc, movement) => {
          acc.total_movements++;
          
          const value = movement.quantity * (movement.unit_cost || movement.materials?.unit_cost || 0);
          
          if (movement.movement_type === 'in') {
            acc.total_value_in += value;
          } else if (movement.movement_type === 'out') {
            acc.total_value_out += value;
          }
          
          acc.by_type[movement.movement_type] = (acc.by_type[movement.movement_type] || 0) + 1;
          
          // Track material usage
          const materialKey = `${movement.material_id}:${movement.materials?.name || 'Unknown'}`;
          if (!acc.material_usage[materialKey]) {
            acc.material_usage[materialKey] = {
              material_id: movement.material_id,
              material_name: movement.materials?.name || 'Unknown',
              movement_count: 0,
              total_quantity: 0,
            };
          }
          
          acc.material_usage[materialKey].movement_count++;
          acc.material_usage[materialKey].total_quantity += movement.quantity;
          
          return acc;
        },
        {
          total_movements: 0,
          total_value_in: 0,
          total_value_out: 0,
          by_type: {} as Record<string, number>,
          material_usage: {} as Record<string, any>,
        }
      );
      
      // Get top materials by movement count
      const topMaterials = Object.values(analytics.material_usage)
        .sort((a: any, b: any) => b.movement_count - a.movement_count)
        .slice(0, 10);
      
      return {
        total_movements: analytics.total_movements,
        total_value_in: analytics.total_value_in,
        total_value_out: analytics.total_value_out,
        by_type: analytics.by_type,
        top_materials: topMaterials,
      };
    }, 'Get stock analytics');
  }
}

// Export singleton instance
export const stockService = StockService;