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
export { eventBus } from './eventBus';

// Re-export types from eventBus
export type { EventType, EventData, EventHandler, EventSubscription } from './eventBus';