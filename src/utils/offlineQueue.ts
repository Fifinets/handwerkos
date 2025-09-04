import { Capacitor, Storage } from './capacitorMocks';

export interface OfflineAction {
  id: string;
  type: 'START_TIME' | 'STOP_TIME' | 'SWITCH_TIME' | 'CREATE_DELIVERY_NOTE' | 'SIGN_DELIVERY_NOTE';
  data: any;
  timestamp: string;
  retryCount: number;
}

class OfflineQueueManager {
  private readonly QUEUE_KEY = 'offline_actions_queue';
  private readonly MAX_RETRIES = 3;

  async addAction(type: OfflineAction['type'], data: any): Promise<void> {
    const action: OfflineAction = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    const queue = await this.getQueue();
    queue.push(action);
    await this.saveQueue(queue);

    console.log(`Added offline action: ${type}`, action);
  }

  async getQueue(): Promise<OfflineAction[]> {
    try {
      const { value } = await Storage.get({ key: this.QUEUE_KEY });
      return value ? JSON.parse(value) : [];
    } catch (error) {
      console.error('Error getting offline queue:', error);
      return [];
    }
  }

  private async saveQueue(queue: OfflineAction[]): Promise<void> {
    try {
      await Storage.set({
        key: this.QUEUE_KEY,
        value: JSON.stringify(queue)
      });
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  async processQueue(supabase: any): Promise<void> {
    const queue = await this.getQueue();
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} offline actions`);

    const remainingActions: OfflineAction[] = [];

    for (const action of queue) {
      try {
        await this.executeAction(action, supabase);
        console.log(`Successfully processed action: ${action.type}`, action.id);
      } catch (error) {
        console.error(`Failed to process action: ${action.type}`, error);
        
        action.retryCount++;
        if (action.retryCount < this.MAX_RETRIES) {
          remainingActions.push(action);
        } else {
          console.warn(`Action ${action.id} exceeded max retries and will be discarded`);
        }
      }
    }

    await this.saveQueue(remainingActions);
  }

  private async executeAction(action: OfflineAction, supabase: any): Promise<void> {
    switch (action.type) {
      case 'START_TIME':
        await supabase.rpc('rpc_start_time_tracking', {
          p_employee_id: action.data.employee_id,
          p_project_id: action.data.project_id,
          p_notes: action.data.notes,
          p_location_lat: action.data.location?.lat,
          p_location_lng: action.data.location?.lng
        });
        break;

      case 'STOP_TIME':
        await supabase.rpc('rpc_stop_time_tracking', {
          p_employee_id: action.data.employee_id,
          p_notes: action.data.notes,
          p_location_lat: action.data.location?.lat,
          p_location_lng: action.data.location?.lng
        });
        break;

      case 'SWITCH_TIME':
        await supabase.rpc('rpc_switch_time_tracking', {
          p_employee_id: action.data.employee_id,
          p_project_id: action.data.project_id,
          p_notes: action.data.notes,
          p_location_lat: action.data.location?.lat,
          p_location_lng: action.data.location?.lng
        });
        break;

      case 'CREATE_DELIVERY_NOTE':
        await supabase.rpc('rpc_create_delivery_note', {
          p_employee_id: action.data.employee_id,
          p_customer_id: action.data.customer_id,
          p_project_id: action.data.project_id,
          p_time_segment_ids: action.data.time_segment_ids,
          p_delivery_note_items: action.data.items,
          p_notes: action.data.notes,
          p_location_lat: action.data.location?.lat,
          p_location_lng: action.data.location?.lng
        });
        break;

      case 'SIGN_DELIVERY_NOTE':
        await supabase.rpc('rpc_sign_delivery_note', {
          p_delivery_note_id: action.data.delivery_note_id,
          p_signature_data: action.data.signature_data,
          p_signer_name: action.data.signer_name,
          p_location_lat: action.data.location?.lat,
          p_location_lng: action.data.location?.lng
        });
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async clearQueue(): Promise<void> {
    await Storage.remove({ key: this.QUEUE_KEY });
  }

  async getQueueLength(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }
}

export const offlineQueue = new OfflineQueueManager();