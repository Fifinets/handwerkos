// Re-export barrel for all API hooks
// Each domain has been split into its own file for maintainability
// Import from here for backward compatibility, or import directly from domain files

export { QUERY_KEYS, type UseApiQueryOptions, type UseApiMutationOptions } from './useQueryKeys';

// Customer hooks
export {
  useCustomers, useCustomer, useCustomerStats,
  useCreateCustomer, useUpdateCustomer, useDeleteCustomer,
  useSearchCustomers,
} from './useCustomerHooks';

// Order hooks
export {
  useOrders, useOrder, useCreateOrder,
  useStartOrder, useCompleteOrder, useCancelOrder, useOrderStats,
} from './useOrderHooks';

// Project hooks
export {
  useProjects, useProject, useProjectStats, useProjectTimeline,
  useCreateProject, useUpdateProject, useStartProject,
  useCompleteProject, useBlockProject, useSearchProjects,
} from './useProjectHooks';

// Timesheet hooks
export {
  useTimesheets, useTimesheet, useCreateTimesheet, useUpdateTimesheet,
  useApproveTimesheet, useBulkApproveTimesheets,
  useEmployeeTimesheetStats, useProjectTimesheetSummary,
} from './useTimesheetHooks';

// Stock & Materials hooks
export {
  useMaterials, useMaterial, useCreateMaterial, useUpdateMaterial,
  useAdjustStock, useAddStock, useRemoveStock,
  useLowStockMaterials, useMaterialStats, useSearchMaterials,
  useStockMovements, useStockValuation, useStockAnalytics,
} from './useStockHooks';

// Finance hooks
export {
  useInvoices, useInvoice, useCreateInvoice, useSendInvoice, useMarkInvoicePaid,
  useExpenses, useCreateExpense, useApproveExpense,
  useFinancialKpis, useRevenueByMonth, useExpensesByCategory, useProfitLossReport,
} from './useFinanceHooks';

// Document hooks
export {
  useDocuments, useDocument, useUploadDocument, useUpdateDocument, useDeleteDocument,
  useDocumentStats, useExpiringDocuments, useSearchDocuments, useGetDocumentDownloadUrl,
} from './useDocumentHooks';

// Employee hooks
export {
  useEmployees, useDeleteEmployee,
} from './useEmployeeHooks';

// Notification hooks
export {
  useNotifications, useNotificationStats, useCreateNotification,
  useMarkNotificationRead, useMarkAllNotificationsRead, useArchiveNotification,
} from './useNotificationHooks';

// Audit & Compliance hooks
export {
  useAuditLogs, useAuditTrail, useAuditStatistics,
  useImmutabilityCheck, useNumberSequence, useGetNextNumber,
  useMakeImmutable, useCreateDocumentHash, useVerifyDocumentIntegrity,
} from './useAuditHooks';

// German Accounting hooks
export {
  useGenerateDATEVExport, useDATEVAccountMapping, useSetDATEVAccountMapping,
  useGenerateGermanVATReturn, useGenerateGermanExpenseReport,
  useCalculateGermanDepreciation, useValidateGermanInvoiceCompliance,
  useCreateGermanAccountingPeriod,
} from './useGermanAccountingHooks';

// AI hooks
export {
  useAISearchDocuments, useIndexDocument, useGenerateAIResponse,
  useAnalyzeIntent, useExecuteIntent,
  useCreateAIEstimation, useQuickAIEstimate, useAIIndexingStatus,
  useBulkIndexEntities, useUpdateEstimationAccuracy, useEstimationStatistics,
} from './useAIHooks';

// Offer hooks
export {
  useOffers, useOffer, useOfferItems, useOfferTargets, useOfferStats,
  useCreateOffer, useUpdateOffer, useDeleteOffer,
  useSendOffer, useAcceptOffer, useRejectOffer,
  useReviseOffer, useCancelOffer, useDuplicateOffer,
  useAddOfferItem, useUpdateOfferItem, useDeleteOfferItem,
  useSyncOfferItems, useUpdateOfferTargets, useOfferTemplates,
} from './useOfferHooks';
