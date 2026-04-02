export interface NotificationPayload {
  company_id: string;
  user_id: string;
  type: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  dedup_key?: string;
  data?: Record<string, any>;
}

export interface CheckResult {
  notifications: NotificationPayload[];
  checkName: string;
  itemsChecked: number;
}
