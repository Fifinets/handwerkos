// Document service for HandwerkOS
// Handles file uploads, document management, and GoBD compliance

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
  PaginationQuery,
  PaginationResponse
} from '@/types';
import { eventBus } from './eventBus';

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  category: 'invoice' | 'contract' | 'receipt' | 'photo' | 'plan' | 'report' | 'other';
  legal_category?: 'invoice' | 'contract' | 'receipt' | 'tax_document' | 'correspondence';
  description?: string;
  tags: string[];
  project_id?: string;
  customer_id?: string;
  invoice_id?: string;
  expense_id?: string;
  storage_path: string;
  public_url?: string;
  is_public: boolean;
  retention_until?: string;
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentUpload {
  file: File;
  category: Document['category'];
  legal_category?: Document['legal_category'];
  description?: string;
  tags?: string[];
  project_id?: string;
  customer_id?: string;
  invoice_id?: string;
  expense_id?: string;
  is_public?: boolean;
}

export interface DocumentUpdate {
  description?: string;
  tags?: string[];
  category?: Document['category'];
  legal_category?: Document['legal_category'];
  is_public?: boolean;
}

export class DocumentService {
  
  // Get all documents with pagination and filtering
  static async getDocuments(
    pagination?: PaginationQuery,
    filters?: {
      category?: Document['category'];
      legal_category?: Document['legal_category'];
      project_id?: string;
      customer_id?: string;
      tags?: string[];
      uploaded_by?: string;
      date_from?: string;
      date_to?: string;
      search?: string;
    }
  ): Promise<PaginationResponse<Document>> {
    return apiCall(async () => {
      let query = supabase
        .from('documents')
        .select(`
          *,
          projects (
            name,
            project_number
          ),
          customers (
            company_name,
            contact_person
          ),
          uploaded_by_user:profiles!uploaded_by (
            first_name,
            last_name,
            email
          )
        `, { count: 'exact' });
      
      // Apply filters
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters?.legal_category) {
        query = query.eq('legal_category', filters.legal_category);
      }
      
      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      
      if (filters?.uploaded_by) {
        query = query.eq('uploaded_by', filters.uploaded_by);
      }
      
      if (filters?.tags?.length) {
        query = query.overlaps('tags', filters.tags);
      }
      
      if (filters?.date_from) {
        query = query.gte('uploaded_at', filters.date_from);
      }
      
      if (filters?.date_to) {
        query = query.lte('uploaded_at', filters.date_to);
      }
      
      if (filters?.search) {
        query = query.or(
          `filename.ilike.%${filters.search}%,` +
          `original_filename.ilike.%${filters.search}%,` +
          `description.ilike.%${filters.search}%`
        );
      }
      
      // Apply pagination
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'uploaded_at', { 
            ascending: pagination.sort_order === 'asc' 
          });
      } else {
        query = query.order('uploaded_at', { ascending: false });
      }
      
      const { data, count } = await createQuery<Document>(query).executeWithCount();
      
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
    }, 'Get documents');
  }
  
  // Get document by ID
  static async getDocument(id: string): Promise<Document> {
    return apiCall(async () => {
      const query = supabase
        .from('documents')
        .select(`
          *,
          projects (
            name,
            project_number
          ),
          customers (
            company_name,
            contact_person
          ),
          uploaded_by_user:profiles!uploaded_by (
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', id);
      
      return createQuery<Document>(query).executeSingle();
    }, `Get document ${id}`);
  }
  
  // Upload new document
  static async uploadDocument(uploadData: DocumentUpload): Promise<Document> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      const file = uploadData.file;
      
      // Validate file
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Dateigröße darf 50MB nicht überschreiten.',
          { fileSize: file.size }
        );
      }
      
      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || '';
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const filename = `${timestamp}_${randomString}.${fileExtension}`;
      
      // Determine storage folder based on category
      const folder = this.getStorageFolder(uploadData.category);
      const storagePath = `${folder}/${filename}`;
      
      // Upload file to Supabase Storage
      const { data: uploadResult, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        throw new ApiError(
          API_ERROR_CODES.STORAGE_ERROR,
          `Fehler beim Upload: ${uploadError.message}`,
          { uploadError }
        );
      }
      
      // Get public URL if document is public
      let publicUrl: string | undefined;
      if (uploadData.is_public) {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storagePath);
        publicUrl = urlData.publicUrl;
      }
      
      // Calculate retention date for legal documents
      let retentionUntil: string | undefined;
      if (uploadData.legal_category) {
        const retentionYears = this.getRetentionPeriod(uploadData.legal_category);
        retentionUntil = new Date(Date.now() + retentionYears * 365 * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
      }
      
      // Create database record
      const documentData = {
        filename,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        category: uploadData.category,
        legal_category: uploadData.legal_category,
        description: uploadData.description,
        tags: uploadData.tags || [],
        project_id: uploadData.project_id,
        customer_id: uploadData.customer_id,
        invoice_id: uploadData.invoice_id,
        expense_id: uploadData.expense_id,
        storage_path: storagePath,
        public_url: publicUrl,
        is_public: uploadData.is_public || false,
        retention_until: retentionUntil,
        uploaded_by: currentUser.id,
        uploaded_at: new Date().toISOString(),
      };
      
      const query = supabase
        .from('documents')
        .insert(documentData)
        .select()
        .single();
      
      const document = await createQuery<Document>(query).executeSingle();
      
      // Log to immutable files for GoBD compliance
      if (uploadData.legal_category) {
        await supabase
          .from('immutable_files')
          .insert({
            document_id: document.id,
            filename: document.filename,
            file_hash: await this.calculateFileHash(file),
            file_size: file.size,
            legal_category: uploadData.legal_category,
            uploaded_by: currentUser.id,
          });
      }
      
      // Emit event for audit trail
      eventBus.emit('DOCUMENT_UPLOADED', {
        document,
        user_id: currentUser.id,
      });
      
      return document;
    }, 'Upload document');
  }
  
  // Update document metadata
  static async updateDocument(id: string, data: DocumentUpdate): Promise<Document> {
    return apiCall(async () => {
      // Get existing document
      const existingDocument = await this.getDocument(id);
      
      // Validate user permissions
      const currentUser = await getCurrentUserProfile();
      if (existingDocument.uploaded_by !== currentUser.id && !currentUser.is_admin) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Sie können nur Ihre eigenen Dokumente bearbeiten.'
        );
      }
      
      // Update retention period if legal category changed
      let retentionUntil = existingDocument.retention_until;
      if (data.legal_category && data.legal_category !== existingDocument.legal_category) {
        const retentionYears = this.getRetentionPeriod(data.legal_category);
        retentionUntil = new Date(Date.now() + retentionYears * 365 * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
      }
      
      const updateData = {
        ...data,
        retention_until: retentionUntil,
      };
      
      const query = supabase
        .from('documents')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const updatedDocument = await createQuery<Document>(query).executeSingle();
      
      // Emit event for audit trail
      eventBus.emit('DOCUMENT_UPDATED', {
        document: updatedDocument,
        previous_document: existingDocument,
        changes: data,
        user_id: currentUser.id,
      });
      
      return updatedDocument;
    }, `Update document ${id}`);
  }
  
  // Get download URL for document
  static async getDownloadUrl(id: string, expiresIn: number = 3600): Promise<string> {
    return apiCall(async () => {
      const document = await this.getDocument(id);
      
      // Check permissions
      const currentUser = await getCurrentUserProfile();
      if (!document.is_public && 
          document.uploaded_by !== currentUser.id && 
          !currentUser.is_admin) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Keine Berechtigung zum Download dieses Dokuments.'
        );
      }
      
      // Generate signed URL
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.storage_path, expiresIn);
      
      if (error || !data) {
        throw new ApiError(
          API_ERROR_CODES.STORAGE_ERROR,
          'Fehler beim Generieren der Download-URL.',
          { error }
        );
      }
      
      // Log download for audit trail
      eventBus.emit('DOCUMENT_DOWNLOADED', {
        document,
        user_id: currentUser.id,
      });
      
      return data.signedUrl;
    }, `Get download URL for document ${id}`);
  }
  
  // Delete document (with safety checks)
  static async deleteDocument(id: string): Promise<void> {
    return apiCall(async () => {
      const document = await this.getDocument(id);
      
      // Check permissions
      const currentUser = await getCurrentUserProfile();
      if (document.uploaded_by !== currentUser.id && !currentUser.is_admin) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Sie können nur Ihre eigenen Dokumente löschen.'
        );
      }
      
      // Check if document has legal retention requirements
      if (document.retention_until && 
          new Date(document.retention_until) > new Date()) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Dokument kann aufgrund gesetzlicher Aufbewahrungspflicht nicht gelöscht werden.',
          { retentionUntil: document.retention_until }
        );
      }
      
      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.storage_path]);
      
      if (storageError) {
        throw new ApiError(
          API_ERROR_CODES.STORAGE_ERROR,
          `Fehler beim Löschen der Datei: ${storageError.message}`,
          { storageError }
        );
      }
      
      // Delete database record
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);
      
      if (dbError) {
        throw dbError;
      }
      
      // Emit event for audit trail
      eventBus.emit('DOCUMENT_DELETED', {
        document,
        user_id: currentUser.id,
      });
    }, `Delete document ${id}`);
  }
  
  // Get document statistics
  static async getDocumentStats(): Promise<{
    total_documents: number;
    total_size: number;
    by_category: Record<string, { count: number; size: number }>;
    by_legal_category: Record<string, { count: number; size: number }>;
    retention_expiring: number;
  }> {
    return apiCall(async () => {
      const documents = await createQuery<Document>(
        supabase.from('documents').select('*')
      ).execute();
      
      const stats = documents.reduce(
        (acc, doc) => {
          acc.total_documents++;
          acc.total_size += doc.file_size;
          
          // By category
          if (!acc.by_category[doc.category]) {
            acc.by_category[doc.category] = { count: 0, size: 0 };
          }
          acc.by_category[doc.category].count++;
          acc.by_category[doc.category].size += doc.file_size;
          
          // By legal category
          if (doc.legal_category) {
            if (!acc.by_legal_category[doc.legal_category]) {
              acc.by_legal_category[doc.legal_category] = { count: 0, size: 0 };
            }
            acc.by_legal_category[doc.legal_category].count++;
            acc.by_legal_category[doc.legal_category].size += doc.file_size;
          }
          
          // Check retention expiry
          if (doc.retention_until) {
            const expiryDate = new Date(doc.retention_until);
            const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            if (expiryDate <= thirtyDaysFromNow) {
              acc.retention_expiring++;
            }
          }
          
          return acc;
        },
        {
          total_documents: 0,
          total_size: 0,
          by_category: {} as Record<string, { count: number; size: number }>,
          by_legal_category: {} as Record<string, { count: number; size: number }>,
          retention_expiring: 0,
        }
      );
      
      return stats;
    }, 'Get document statistics');
  }
  
  // Search documents by content (if OCR/text extraction is available)
  static async searchDocuments(query: string, limit: number = 20): Promise<Document[]> {
    return apiCall(async () => {
      const searchQuery = supabase
        .from('documents')
        .select(`
          *,
          projects (
            name,
            project_number
          ),
          customers (
            company_name
          )
        `)
        .or(
          `filename.ilike.%${query}%,` +
          `original_filename.ilike.%${query}%,` +
          `description.ilike.%${query}%`
        )
        .order('uploaded_at', { ascending: false })
        .limit(limit);
      
      return createQuery<Document>(searchQuery).execute();
    }, `Search documents: ${query}`);
  }
  
  // Get documents expiring soon (for retention management)
  static async getExpiringDocuments(days: number = 30): Promise<Document[]> {
    return apiCall(async () => {
      const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      
      const query = supabase
        .from('documents')
        .select('*')
        .not('retention_until', 'is', null)
        .lte('retention_until', expiryDate)
        .order('retention_until', { ascending: true });
      
      return createQuery<Document>(query).execute();
    }, `Get expiring documents (${days} days)`);
  }
  
  // Helper methods
  private static getStorageFolder(category: Document['category']): string {
    const folderMap: Record<Document['category'], string> = {
      'invoice': 'invoices',
      'contract': 'contracts',
      'receipt': 'receipts',
      'photo': 'photos',
      'plan': 'plans',
      'report': 'reports',
      'other': 'other',
    };
    
    return folderMap[category] || 'other';
  }
  
  private static getRetentionPeriod(legalCategory: string): number {
    // German GoBD retention periods in years
    const retentionMap: Record<string, number> = {
      'invoice': 10,
      'contract': 10,
      'receipt': 10,
      'tax_document': 10,
      'correspondence': 6,
    };
    
    return retentionMap[legalCategory] || 10;
  }
  
  private static async calculateFileHash(file: File): Promise<string> {
    // Simple hash calculation for audit purposes
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Export singleton instance
export const documentService = DocumentService;