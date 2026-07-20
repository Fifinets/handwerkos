// Legacy type migration helpers
// Maps old interface types to new standardized core types

import type { Project as CoreProject, Customer as CoreCustomer } from './core';
import type { ProjectBaseData, UserRole } from './project';
import type { InvoiceData, CustomerData } from './financial';
import { normalizeProjectStatus, PROJECT_STATUSES } from '@/lib/projectStatus';

// Statusabbildung liegt zentral in src/lib/projectStatus.ts. Hier standen
// frueher zwei eigene Tabellen, die weder zur Datenbank noch zu core.ts passten
// und zusaetzlich ein 'blocked' kannten, das es nirgends sonst gab.
export const mapLegacyProjectStatus = (legacyStatus: string): CoreProject['status'] =>
  normalizeProjectStatus(legacyStatus).status;

// Convert legacy ProjectBaseData to Core Project
export const convertLegacyProject = (legacy: ProjectBaseData): Partial<CoreProject> => {
  return {
    id: legacy.id,
    company_id: legacy.company_id,
    name: legacy.project_name,
    description: legacy.project_description,
    customer_id: legacy.customer_id || undefined,
    status: mapLegacyProjectStatus(legacy.status),
    start_date: legacy.start_date,
    end_date: legacy.planned_end_date,
    // Map additional fields as needed
    created_at: new Date().toISOString(), // Placeholder
    updated_at: new Date().toISOString(), // Placeholder
  };
};

// Convert Core Project to legacy format for backward compatibility
export const convertCoreProject = (core: CoreProject): Partial<ProjectBaseData> => {
  return {
    id: core.id,
    company_id: core.company_id || '',
    project_name: core.name,
    project_description: core.description || '',
    customer_id: core.customer_id || '',
    // Beide Seiten fuehren jetzt denselben kanonischen Status — keine Rueckuebersetzung mehr.
    status: core.status,
    start_date: core.start_date || '',
    planned_end_date: core.end_date || '',
    project_address: '', // Default value, should be mapped from actual data
    linked_invoices: [], // Default value
    linked_offers: [], // Default value
  };
};

// Convert legacy CustomerData to Core Customer
export const convertLegacyCustomer = (legacy: CustomerData): Partial<CoreCustomer> => {
  return {
    id: legacy.id,
    company_name: legacy.name,
    contact_person: legacy.contact || '',
    email: legacy.email || '',
    phone: legacy.phone || '',
    address: legacy.address || '',
    status: 'Aktiv', // Default value
    created_at: new Date().toISOString(), // Placeholder
    updated_at: new Date().toISOString(), // Placeholder
  };
};

// Type guards for runtime type checking
export const isLegacyProject = (obj: any): obj is ProjectBaseData => {
  return obj && 
         typeof obj.id === 'string' &&
         typeof obj.project_name === 'string' &&
         typeof obj.status === 'string' &&
         !(PROJECT_STATUSES as readonly string[]).includes(obj.status);
};

export const isCoreProject = (obj: any): obj is CoreProject => {
  return obj && 
         typeof obj.id === 'string' &&
         typeof obj.name === 'string' &&
         typeof obj.status === 'string' &&
         (PROJECT_STATUSES as readonly string[]).includes(obj.status);
};

// Hook to safely migrate legacy data
export const useLegacyMigration = () => {
  const migrateProject = (data: unknown): CoreProject | null => {
    if (isCoreProject(data)) {
      return data;
    }
    
    if (isLegacyProject(data)) {
      return {
        ...convertLegacyProject(data),
        // Fill required fields with defaults
        name: data.project_name,
        status: mapLegacyProjectStatus(data.status),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CoreProject;
    }
    
    return null;
  };
  
  const migrateProjectArray = (data: unknown[]): CoreProject[] => {
    return data
      .map(migrateProject)
      .filter((project): project is CoreProject => project !== null);
  };
  
  return {
    migrateProject,
    migrateProjectArray,
  };
};

// Utility to check if migration is needed
export const needsMigration = (data: any): boolean => {
  if (Array.isArray(data)) {
    return data.some(item => isLegacyProject(item));
  }
  return isLegacyProject(data);
};

// Statusabbildungen bewusst nicht mehr hier: die einzige Quelle ist
// src/lib/projectStatus.ts (PROJECT_STATUS_LABELS, normalizeProjectStatus).
export const TYPE_MAPPINGS = {
  CUSTOMER_STATUS: {
    LEGACY_TO_CORE: {
      'aktiv': 'Aktiv',
      'premium': 'Premium',
      'inaktiv': 'Inaktiv',
    } as const,
  },
} as const;
