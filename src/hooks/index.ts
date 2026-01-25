// Central export for all HandwerkOS hooks
// Provides a single import point for React hooks

// Workflow hooks (Angebot → Auftrag → Projekt → Lieferschein → Rechnung)
export { useWorkflow } from './useWorkflow';
export { useDeliveryNotes } from './useDeliveryNotes';
export { useInvoices } from './useInvoices';

// Auth & API
export { useAuth } from './useAuth';
export { useSupabaseAuth } from './useSupabaseAuth';

// Permissions
export { useEmployeePermissions } from './useEmployeePermissions';
export type { Permission, CurrentEmployee } from './useEmployeePermissions';

// Project
export { useProjectHealth } from './useProjectHealth';

// UI
export { useToast, toast } from './use-toast';
export { useMobile } from './use-mobile';
export { useCardTilt } from './useCardTilt';
export { useMagneticButton } from './useMagneticButton';
export { useParallax } from './useParallax';
export { useScrollReveal } from './useScrollReveal';
export { useSmoothScroll } from './useSmoothScroll';

// Integrations
export { useGmailConnection } from './useGmailConnection';
export { usePushNotifications } from './usePushNotifications';
