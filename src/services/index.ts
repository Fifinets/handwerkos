// Services index - exports all business logic services for HandwerkOS

export { customerService, CustomerService } from './customerService';
export { quoteService, QuoteService } from './quoteService';
export { orderService, OrderService } from './orderService';
export { projectService, ProjectService } from './projectService';
export { timesheetService, TimesheetService } from './timesheetService';
export { materialService, MaterialService } from './materialService';
export { stockService, StockService } from './stockService';
export { financeService, FinanceService } from './financeService';
export { documentService, DocumentService } from './documentService';
export { projectKPIService, ProjectKPIService } from './projectKPIService';
export { notificationService, NotificationService } from './notificationService';
export { workerService, WorkerService } from './workerService';
export { auditLogService, AuditLogService } from './auditLogService';
export { gobdService, GoBDService } from './gobdService';
export { gobdHooks, GoBDHooks } from './gobdHooks';
export { eventBus } from './eventBus';

// Re-export types from eventBus
export type { EventType, EventData, EventHandler, EventSubscription } from './eventBus';

// Re-export types from projectKPIService  
export type { ProjectKPIs, ProjectKPIsSummary } from './projectKPIService';

// Re-export types from notificationService
export type { 
  Notification, 
  NotificationCreate, 
  NotificationUpdate, 
  NotificationFilters, 
  NotificationStats, 
  NotificationType, 
  NotificationPriority 
} from './notificationService';

// Re-export types from workerService
export type { WorkerJob } from './workerService';

// Re-export types from auditLogService
export type { 
  AuditLog, 
  AuditLogCreate, 
  AuditLogFilters, 
  AuditTrail, 
  AuditAction, 
  AuditEntityType 
} from './auditLogService';

// Re-export types from gobdService
export type { 
  NumberSequence, 
  NumberSequenceGap, 
  GoBDDocument, 
  ImmutabilityCheck, 
  NumberSequenceType 
} from './gobdService';