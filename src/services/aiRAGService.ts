import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { auditLogService } from './auditLogService';
import { eventBus } from './eventBus';

// AI RAG types for document indexing and retrieval
export type DocumentType = 
  | 'invoice' 
  | 'quote' 
  | 'order' 
  | 'project' 
  | 'customer' 
  | 'material' 
  | 'timesheet'
  | 'expense'
  | 'knowledge_base'
  | 'email'
  | 'pdf_document';

export interface AIDocument {
  id: string;
  document_type: DocumentType;
  entity_id: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[]; // Vector embedding for semantic search
  language: 'de' | 'en';
  indexed_at: string;
  updated_at: string;
  created_by: string;
  search_tags: string[];
  importance_score: number; // 0-1 relevance score
}

export interface AISearchQuery {
  query: string;
  document_types?: DocumentType[];
  date_range?: {
    from: string;
    to: string;
  };
  language?: 'de' | 'en';
  limit?: number;
  similarity_threshold?: number; // 0-1 for vector similarity
  include_metadata?: boolean;
}

export interface AISearchResult {
  document: AIDocument;
  similarity_score: number;
  relevance_explanation: string;
  highlighted_content: string;
}

export interface AIRAGContext {
  id: string;
  query: string;
  retrieved_documents: AISearchResult[];
  context_summary: string;
  generated_response?: string;
  confidence_score: number;
  created_at: string;
  session_id: string;
}

export interface AIIndexingStatus {
  total_documents: number;
  indexed_documents: number;
  pending_documents: number;
  last_full_index: string | null;
  indexing_in_progress: boolean;
  estimated_completion: string | null;
}

// German business-specific embeddings and contexts
const GERMAN_HANDWERK_CONTEXTS = {
  CUSTOMER_COMMUNICATION: {
    keywords: ['kunde', 'angebot', 'rechnung', 'termin', 'beschwerde', 'zufriedenheit'],
    weight: 0.9,
    description: 'Kundenkommunikation und -beziehungen'
  },
  PROJECT_MANAGEMENT: {
    keywords: ['projekt', 'baustelle', 'zeitplan', 'material', 'fortschritt', 'deadline'],
    weight: 0.8,
    description: 'Projektmanagement und Baustellenabwicklung'
  },
  FINANCIAL_MATTERS: {
    keywords: ['rechnung', 'zahlung', 'kostenschätzung', 'budget', 'gewinn', 'verlust'],
    weight: 0.85,
    description: 'Finanzielle Angelegenheiten und Buchführung'
  },
  TECHNICAL_KNOWLEDGE: {
    keywords: ['handwerk', 'technik', 'werkzeug', 'verfahren', 'qualität', 'norm'],
    weight: 0.7,
    description: 'Technisches Know-how und Handwerkswissen'
  },
  LEGAL_COMPLIANCE: {
    keywords: ['gesetz', 'verordnung', 'haftung', 'versicherung', 'gobd', 'datev'],
    weight: 0.75,
    description: 'Rechtliche Bestimmungen und Compliance'
  }
};

// Zod schemas
const AIDocumentSchema = z.object({
  document_type: z.enum(['invoice', 'quote', 'order', 'project', 'customer', 'material', 'timesheet', 'expense', 'knowledge_base', 'email', 'pdf_document']),
  entity_id: z.string(),
  title: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.any()).default({}),
  language: z.enum(['de', 'en']).default('de'),
  search_tags: z.array(z.string()).default([]),
  importance_score: z.number().min(0).max(1).default(0.5),
});

const AISearchQuerySchema = z.object({
  query: z.string().min(1),
  document_types: z.array(z.enum(['invoice', 'quote', 'order', 'project', 'customer', 'material', 'timesheet', 'expense', 'knowledge_base', 'email', 'pdf_document'])).optional(),
  date_range: z.object({
    from: z.string(),
    to: z.string(),
  }).optional(),
  language: z.enum(['de', 'en']).default('de'),
  limit: z.number().min(1).max(100).default(10),
  similarity_threshold: z.number().min(0).max(1).default(0.7),
  include_metadata: z.boolean().default(true),
});

export class AIRAGService {

  /**
   * Index a document for AI retrieval
   */
  static async indexDocument(
    documentType: DocumentType,
    entityId: string,
    title: string,
    content: string,
    metadata: Record<string, any> = {},
    searchTags: string[] = []
  ): Promise<AIDocument> {
    return apiCall(async () => {
      const validatedData = validateInput(AIDocumentSchema, {
        document_type: documentType,
        entity_id: entityId,
        title,
        content,
        metadata,
        search_tags: searchTags,
        importance_score: this.calculateImportanceScore(documentType, content),
      });

      const currentUser = await getCurrentUserProfile();

      // Generate embedding (simplified - in production would use actual AI service)
      const embedding = await this.generateEmbedding(content, title);

      // Extract additional search tags from content
      const extractedTags = this.extractSearchTags(content, documentType);
      const allTags = [...new Set([...searchTags, ...extractedTags])];

      const documentData = {
        ...validatedData,
        embedding: embedding,
        search_tags: allTags,
        indexed_at: new Date().toISOString(),
        created_by: currentUser.id,
      };

      const query = supabase
        .from('ai_documents')
        .upsert(documentData, { onConflict: 'document_type,entity_id' })
        .select()
        .single();

      const document = await createQuery<AIDocument>(query).executeSingle();

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: documentType as any,
        entity_id: entityId,
        action: 'CREATE',
        new_values: {
          ai_indexed: true,
          title,
          content_length: content.length,
          search_tags: allTags,
        },
        reason: 'Dokument für AI-Suche indexiert',
        is_automated: true,
      });

      // Emit event
      eventBus.emit('DOCUMENT_INDEXED', {
        document_id: document.id,
        document_type: documentType,
        entity_id: entityId,
        user_id: currentUser.id,
      });

      return document;
    }, 'Index document for AI');
  }

  /**
   * Perform semantic search across indexed documents
   */
  static async searchDocuments(searchQuery: AISearchQuery): Promise<{
    results: AISearchResult[];
    total_results: number;
    query_context: AIRAGContext;
  }> {
    return apiCall(async () => {
      const validatedQuery = validateInput(AISearchQuerySchema, searchQuery);
      const currentUser = await getCurrentUserProfile();

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(validatedQuery.query);

      // Build search query
      let query = supabase
        .from('ai_documents')
        .select('*');

      // Apply filters
      if (validatedQuery.document_types?.length) {
        query = query.in('document_type', validatedQuery.document_types);
      }

      if (validatedQuery.date_range) {
        query = query
          .gte('indexed_at', validatedQuery.date_range.from)
          .lte('indexed_at', validatedQuery.date_range.to);
      }

      if (validatedQuery.language) {
        query = query.eq('language', validatedQuery.language);
      }

      const documents = await createQuery<AIDocument>(query).execute();

      // Calculate semantic similarity and rank results
      const results = await this.rankDocumentsByRelevance(
        documents,
        validatedQuery.query,
        queryEmbedding,
        validatedQuery.similarity_threshold
      );

      // Limit results
      const limitedResults = results.slice(0, validatedQuery.limit);

      // Create context for potential response generation
      const contextSummary = this.generateContextSummary(limitedResults, validatedQuery.query);

      const ragContext: Omit<AIRAGContext, 'id' | 'created_at'> = {
        query: validatedQuery.query,
        retrieved_documents: limitedResults,
        context_summary: contextSummary,
        confidence_score: this.calculateContextConfidence(limitedResults),
        session_id: this.generateSessionId(),
      };

      // Save RAG context for future reference
      const contextQuery = supabase
        .from('ai_rag_contexts')
        .insert(ragContext)
        .select()
        .single();

      const savedContext = await createQuery<AIRAGContext>(contextQuery).executeSingle();

      // Create audit log for search
      await auditLogService.createAuditLog({
        entity_type: 'document',
        entity_id: savedContext.id,
        action: 'VIEW',
        new_values: {
          search_query: validatedQuery.query,
          results_count: limitedResults.length,
          confidence_score: ragContext.confidence_score,
        },
        reason: `AI-Dokumentensuche durchgeführt: "${validatedQuery.query}"`,
      });

      return {
        results: limitedResults,
        total_results: results.length,
        query_context: savedContext,
      };
    }, 'Search documents with AI');
  }

  /**
   * Generate AI response based on retrieved context
   */
  static async generateContextualResponse(
    contextId: string,
    question: string,
    responseLanguage: 'de' | 'en' = 'de'
  ): Promise<{
    response: string;
    confidence_score: number;
    sources_used: string[];
    reasoning: string;
  }> {
    return apiCall(async () => {
      // Get RAG context
      const contextQuery = supabase
        .from('ai_rag_contexts')
        .select('*')
        .eq('id', contextId)
        .single();

      const context = await createQuery<AIRAGContext>(contextQuery).executeSingle();

      // Generate response using retrieved documents
      const response = await this.generateResponseFromContext(
        question,
        context.retrieved_documents,
        responseLanguage
      );

      // Update context with generated response
      await supabase
        .from('ai_rag_contexts')
        .update({
          generated_response: response.response,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contextId);

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: 'document',
        entity_id: contextId,
        action: 'UPDATE',
        new_values: {
          question,
          response_generated: true,
          confidence_score: response.confidence_score,
          response_language: responseLanguage,
        },
        reason: `AI-Antwort generiert basierend auf Kontext`,
      });

      return response;
    }, 'Generate contextual AI response');
  }

  /**
   * Get indexing status and statistics
   */
  static async getIndexingStatus(): Promise<AIIndexingStatus> {
    return apiCall(async () => {
      // Get document counts
      const totalQuery = supabase
        .from('ai_documents')
        .select('id', { count: 'exact' });

      const { count: totalDocuments } = await createQuery(totalQuery).executeWithCount();

      // Get recent indexing activity
      const recentQuery = supabase
        .from('ai_documents')
        .select('indexed_at')
        .order('indexed_at', { ascending: false })
        .limit(1);

      const recentDocs = await createQuery(recentQuery).execute();
      const lastIndex = recentDocs[0]?.indexed_at || null;

      return {
        total_documents: totalDocuments,
        indexed_documents: totalDocuments,
        pending_documents: 0,
        last_full_index: lastIndex,
        indexing_in_progress: false,
        estimated_completion: null,
      };
    }, 'Get indexing status');
  }

  /**
   * Bulk index documents from database entities
   */
  static async bulkIndexEntities(
    entityTypes: DocumentType[] = ['invoice', 'quote', 'order', 'project', 'customer']
  ): Promise<{
    indexed_count: number;
    errors: Array<{ entity_type: string; entity_id: string; error: string }>;
  }> {
    return apiCall(async () => {
      let indexedCount = 0;
      const errors: Array<{ entity_type: string; entity_id: string; error: string }> = [];

      for (const entityType of entityTypes) {
        try {
          const entities = await this.getEntitiesForIndexing(entityType);
          
          for (const entity of entities) {
            try {
              const { title, content, metadata } = this.extractDocumentData(entityType, entity);
              
              await this.indexDocument(
                entityType,
                entity.id,
                title,
                content,
                metadata
              );
              
              indexedCount++;
            } catch (error) {
              errors.push({
                entity_type: entityType,
                entity_id: entity.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        } catch (error) {
          console.error(`Failed to bulk index ${entityType}:`, error);
        }
      }

      // Emit event
      eventBus.emit('BULK_INDEXING_COMPLETED', {
        indexed_count: indexedCount,
        error_count: errors.length,
        entity_types: entityTypes,
      });

      return { indexed_count: indexedCount, errors };
    }, 'Bulk index entities');
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private static async generateEmbedding(text: string, title?: string): Promise<number[]> {
    // Simplified embedding generation - in production, use actual AI service
    // This would typically call OpenAI, Cohere, or local embedding model
    
    const combinedText = title ? `${title} ${text}` : text;
    const words = combinedText.toLowerCase().split(/\s+/);
    
    // Create a simple hash-based embedding (300 dimensions)
    const embedding = new Array(300).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = this.simpleHash(word);
      const index = Math.abs(hash) % 300;
      embedding[index] += 1 / Math.sqrt(words.length);
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  private static calculateImportanceScore(documentType: DocumentType, content: string): number {
    const typeWeights = {
      invoice: 0.9,
      quote: 0.8,
      order: 0.85,
      project: 0.7,
      customer: 0.6,
      material: 0.4,
      timesheet: 0.3,
      expense: 0.5,
      knowledge_base: 0.8,
      email: 0.4,
      pdf_document: 0.6,
    };

    const baseScore = typeWeights[documentType] || 0.5;
    const contentLength = content.length;
    const lengthBonus = Math.min(0.2, contentLength / 5000); // Bonus for longer content

    return Math.min(1, baseScore + lengthBonus);
  }

  private static extractSearchTags(content: string, documentType: DocumentType): string[] {
    const tags: string[] = [];
    const lowercaseContent = content.toLowerCase();

    // Extract context-based tags
    Object.entries(GERMAN_HANDWERK_CONTEXTS).forEach(([contextKey, context]) => {
      const matchCount = context.keywords.filter(keyword => 
        lowercaseContent.includes(keyword)
      ).length;

      if (matchCount >= 2) {
        tags.push(context.description);
      }
    });

    // Extract currency amounts
    const amounts = content.match(/€\s*\d+[.,]\d*/g);
    if (amounts && amounts.length > 0) {
      tags.push('financial_amounts');
    }

    // Extract dates
    const dates = content.match(/\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}/g);
    if (dates && dates.length > 0) {
      tags.push('contains_dates');
    }

    // Extract email addresses
    const emails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emails && emails.length > 0) {
      tags.push('contains_email');
    }

    return tags;
  }

  private static async rankDocumentsByRelevance(
    documents: AIDocument[],
    query: string,
    queryEmbedding: number[],
    threshold: number
  ): Promise<AISearchResult[]> {
    const results: AISearchResult[] = [];

    for (const doc of documents) {
      // Calculate semantic similarity
      const similarity = doc.embedding 
        ? this.cosineSimilarity(queryEmbedding, doc.embedding)
        : 0;

      // Calculate keyword similarity
      const keywordScore = this.calculateKeywordSimilarity(query, doc.content + ' ' + doc.title);

      // Combine scores
      const combinedScore = (similarity * 0.7) + (keywordScore * 0.3);

      if (combinedScore >= threshold) {
        results.push({
          document: doc,
          similarity_score: combinedScore,
          relevance_explanation: this.generateRelevanceExplanation(doc, query, similarity, keywordScore),
          highlighted_content: this.highlightRelevantContent(doc.content, query),
        });
      }
    }

    // Sort by relevance score
    return results.sort((a, b) => b.similarity_score - a.similarity_score);
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  private static calculateKeywordSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    const matches = queryWords.filter(word => 
      contentWords.some(contentWord => 
        contentWord.includes(word) || word.includes(contentWord)
      )
    ).length;

    return matches / queryWords.length;
  }

  private static generateRelevanceExplanation(
    document: AIDocument, 
    query: string, 
    semanticScore: number, 
    keywordScore: number
  ): string {
    const reasons = [];

    if (semanticScore > 0.8) {
      reasons.push('hohe semantische Ähnlichkeit');
    } else if (semanticScore > 0.6) {
      reasons.push('mittlere semantische Ähnlichkeit');
    }

    if (keywordScore > 0.5) {
      reasons.push('direkte Keyword-Übereinstimmungen');
    }

    if (document.importance_score > 0.7) {
      reasons.push('wichtiges Dokument');
    }

    if (document.document_type === 'invoice' || document.document_type === 'quote') {
      reasons.push('finanziell relevantes Dokument');
    }

    return reasons.length > 0 
      ? `Relevant aufgrund: ${reasons.join(', ')}`
      : 'Grundlegende Textähnlichkeit';
  }

  private static highlightRelevantContent(content: string, query: string): string {
    const queryWords = query.toLowerCase().split(/\s+/);
    let highlighted = content;

    queryWords.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });

    // Return first 300 characters with highlights
    return highlighted.length > 300 
      ? highlighted.substring(0, 300) + '...'
      : highlighted;
  }

  private static generateContextSummary(results: AISearchResult[], query: string): string {
    if (results.length === 0) {
      return `Keine relevanten Dokumente für "${query}" gefunden.`;
    }

    const documentTypes = [...new Set(results.map(r => r.document.document_type))];
    const avgConfidence = results.reduce((sum, r) => sum + r.similarity_score, 0) / results.length;

    return `Gefunden: ${results.length} relevante Dokumente (${documentTypes.join(', ')}) ` +
           `mit durchschnittlicher Relevanz von ${(avgConfidence * 100).toFixed(1)}% für Anfrage "${query}".`;
  }

  private static calculateContextConfidence(results: AISearchResult[]): number {
    if (results.length === 0) return 0;
    
    const avgScore = results.reduce((sum, r) => sum + r.similarity_score, 0) / results.length;
    const countBonus = Math.min(0.2, results.length / 10);
    
    return Math.min(1, avgScore + countBonus);
  }

  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private static async getEntitiesForIndexing(entityType: DocumentType): Promise<any[]> {
    const tableMap = {
      invoice: 'invoices',
      quote: 'quotes',
      order: 'orders',
      project: 'projects',
      customer: 'customers',
      material: 'materials',
      timesheet: 'time_entries',
      expense: 'expenses',
    };

    const tableName = tableMap[entityType as keyof typeof tableMap];
    if (!tableName) return [];

    const query = supabase.from(tableName).select('*').limit(100);
    return await createQuery(query).execute();
  }

  private static extractDocumentData(
    entityType: DocumentType, 
    entity: any
  ): { title: string; content: string; metadata: Record<string, any> } {
    switch (entityType) {
      case 'invoice':
        return {
          title: `Rechnung ${entity.invoice_number}`,
          content: `${entity.description || ''} Betrag: €${entity.amount} Status: ${entity.status}`,
          metadata: {
            amount: entity.amount,
            status: entity.status,
            due_date: entity.due_date,
            customer_id: entity.customer_id,
          }
        };

      case 'quote':
        return {
          title: `Angebot ${entity.quote_number}`,
          content: `${entity.description || ''} Wert: €${entity.total_amount} Status: ${entity.status}`,
          metadata: {
            total_amount: entity.total_amount,
            status: entity.status,
            valid_until: entity.valid_until,
            customer_id: entity.customer_id,
          }
        };

      case 'project':
        return {
          title: entity.name,
          content: `${entity.description || ''} Status: ${entity.status} Budget: €${entity.budget}`,
          metadata: {
            status: entity.status,
            budget: entity.budget,
            start_date: entity.start_date,
            end_date: entity.end_date,
            customer_id: entity.customer_id,
          }
        };

      case 'customer':
        return {
          title: entity.company_name || `${entity.first_name} ${entity.last_name}`,
          content: `${entity.company_name || ''} ${entity.address || ''} ${entity.notes || ''}`,
          metadata: {
            customer_number: entity.customer_number,
            email: entity.email,
            phone: entity.phone,
          }
        };

      default:
        return {
          title: entity.name || entity.title || `${entityType} ${entity.id}`,
          content: entity.description || entity.content || JSON.stringify(entity),
          metadata: { entity_type: entityType, entity_id: entity.id }
        };
    }
  }

  private static async generateResponseFromContext(
    question: string,
    documents: AISearchResult[],
    language: 'de' | 'en'
  ): Promise<{
    response: string;
    confidence_score: number;
    sources_used: string[];
    reasoning: string;
  }> {
    // Simplified response generation - in production would use actual LLM
    const topDocuments = documents.slice(0, 3);
    const sources = topDocuments.map(d => d.document.title);
    
    const contextInfo = topDocuments.map(d => 
      `${d.document.title}: ${d.highlighted_content}`
    ).join('\n\n');

    const response = language === 'de' 
      ? `Basierend auf den verfügbaren Dokumenten:\n\n${contextInfo}\n\nZusammenfassung: ${topDocuments.length} relevante Dokumente wurden gefunden, die sich auf "${question}" beziehen.`
      : `Based on available documents:\n\n${contextInfo}\n\nSummary: Found ${topDocuments.length} relevant documents related to "${question}".`;

    const confidence = documents.length > 0 
      ? documents.reduce((sum, d) => sum + d.similarity_score, 0) / documents.length
      : 0;

    return {
      response,
      confidence_score: confidence,
      sources_used: sources,
      reasoning: language === 'de' 
        ? `Antwort basiert auf ${topDocuments.length} Dokumenten mit durchschnittlicher Relevanz von ${(confidence * 100).toFixed(1)}%`
        : `Response based on ${topDocuments.length} documents with average relevance of ${(confidence * 100).toFixed(1)}%`
    };
  }
}

export const aiRAGService = AIRAGService;