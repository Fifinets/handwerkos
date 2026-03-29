// AI module hooks extracted from useApi.ts
// AI RAG search, intent analysis, estimation

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { aiRAGService } from '@/services/aiRAGService';
import { aiIntentService } from '@/services/aiIntentService';
import { aiEstimationService } from '@/services/aiEstimationService';
import { QUERY_KEYS } from './useQueryKeys';

// ============================================
// AI MODULE HOOKS
// ============================================

/**
 * Search documents using AI RAG
 */
export const useAISearchDocuments = (
  options?: UseMutationOptions<any, Error, any>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (searchQuery: any) => aiRAGService.searchDocuments(searchQuery),
    onSuccess: (searchResult) => {
      queryClient.setQueryData([QUERY_KEYS.AI_SEARCH_RESULTS, searchResult.query_context.query], searchResult);

      toast({
        title: 'AI-Suche abgeschlossen',
        description: `${searchResult.results.length} relevante Dokumente gefunden.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei AI-Suche',
        description: error.message || 'Die Dokumentensuche konnte nicht durchgeführt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Index document for AI search
 */
export const useIndexDocument = (
  options?: UseMutationOptions<any, Error, {
    documentType: string;
    entityId: string;
    title: string;
    content: string;
    metadata?: Record<string, any>;
    searchTags?: string[];
  }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentType, entityId, title, content, metadata = {}, searchTags = [] }) =>
      aiRAGService.indexDocument(documentType as any, entityId, title, content, metadata, searchTags),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_DOCUMENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_INDEXING_STATUS] });

      toast({
        title: 'Dokument indexiert',
        description: `"${document.title}" wurde für AI-Suche indexiert.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Indexieren',
        description: 'Das Dokument konnte nicht für die AI-Suche indexiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Generate contextual AI response
 */
export const useGenerateAIResponse = (
  options?: UseMutationOptions<any, Error, {
    contextId: string;
    question: string;
    responseLanguage?: 'de' | 'en';
  }>
) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ contextId, question, responseLanguage = 'de' }) =>
      aiRAGService.generateContextualResponse(contextId, question, responseLanguage),
    onSuccess: (response) => {
      toast({
        title: 'AI-Antwort generiert',
        description: `Antwort mit ${(response.confidence_score * 100).toFixed(1)}% Konfidenz erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei AI-Antwort',
        description: 'Die AI-Antwort konnte nicht generiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Analyze user intent
 */
export const useAnalyzeIntent = (
  options?: UseMutationOptions<any, Error, string>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userInput: string) => aiIntentService.analyzeIntent(userInput),
    onSuccess: (analysis) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_INTENT_ANALYSES] });

      if (analysis.confidence_score < 0.6) {
        toast({
          title: 'Intent-Analyse abgeschlossen',
          description: `Intent "${analysis.detected_intent}" erkannt (Unsicher: ${(analysis.confidence_score * 100).toFixed(1)}%)`,
          variant: 'default',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Intent-Analyse',
        description: 'Die Benutzerabsicht konnte nicht analysiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Execute intent action
 */
export const useExecuteIntent = (
  options?: UseMutationOptions<any, Error, { intentId: string; userConfirmation?: boolean }>
) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ intentId, userConfirmation = false }) =>
      aiIntentService.executeIntent(intentId, userConfirmation),
    onSuccess: (action) => {
      if (action.status === 'COMPLETED') {
        toast({
          title: 'Aktion ausgeführt',
          description: `${action.action_type} für ${action.target_entity} erfolgreich abgeschlossen.`,
        });
      } else if (action.status === 'FAILED') {
        toast({
          title: 'Aktion fehlgeschlagen',
          description: action.error_message || 'Die Aktion konnte nicht ausgeführt werden.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Aktionsausführung',
        description: error.message || 'Die Aktion konnte nicht ausgeführt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Create project estimation using AI
 */
export const useCreateAIEstimation = (
  options?: UseMutationOptions<any, Error, any>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (estimationRequest: any) => aiEstimationService.createProjectEstimation(estimationRequest),
    onSuccess: (estimation) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_ESTIMATIONS] });

      toast({
        title: 'AI-Schätzung erstellt',
        description: `Projektkosten: €${estimation.estimated_costs.total.toLocaleString()} (${(estimation.confidence_score * 100).toFixed(1)}% Konfidenz)`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei AI-Schätzung',
        description: 'Die Projektschätzung konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Get quick cost estimate
 */
export const useQuickAIEstimate = (
  projectCategory: string,
  areaSqm: number,
  complexityLevel: 1 | 2 | 3 | 4 | 5,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: ['quick-ai-estimate', projectCategory, areaSqm, complexityLevel],
    queryFn: () => aiEstimationService.getQuickEstimate(projectCategory as any, areaSqm, complexityLevel),
    enabled: !!projectCategory && areaSqm > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

/**
 * Get AI indexing status
 */
export const useAIIndexingStatus = (
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.AI_INDEXING_STATUS],
    queryFn: () => aiRAGService.getIndexingStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Bulk index entities
 */
export const useBulkIndexEntities = (
  options?: UseMutationOptions<any, Error, string[]>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityTypes: string[]) => aiRAGService.bulkIndexEntities(entityTypes as any),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_INDEXING_STATUS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AI_DOCUMENTS] });

      toast({
        title: 'Bulk-Indexierung abgeschlossen',
        description: `${result.indexed_count} Dokumente indexiert, ${result.errors.length} Fehler.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Bulk-Indexierung',
        description: 'Die Dokumente konnten nicht indexiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Update estimation accuracy
 */
export const useUpdateEstimationAccuracy = (
  options?: UseMutationOptions<any, Error, {
    estimationId: string;
    actualCosts: { materials: number; labor: number; total: number };
    actualTimeline: { start_date: string; end_date: string; total_hours: number };
    lessonsLearned?: string[];
    feedbackNotes?: string;
  }>
) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ estimationId, actualCosts, actualTimeline, lessonsLearned = [], feedbackNotes = '' }) =>
      aiEstimationService.updateEstimationAccuracy(estimationId, actualCosts, actualTimeline, lessonsLearned, feedbackNotes),
    onSuccess: (accuracy) => {
      toast({
        title: 'Schätzungsgenauigkeit aktualisiert',
        description: `Genauigkeit: ${(accuracy.accuracy_score * 100).toFixed(1)}%, Abweichung: ${accuracy.variance_percentage.toFixed(1)}%`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler bei Genauigkeits-Update',
        description: 'Die Schätzungsgenauigkeit konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Get estimation statistics
 */
export const useEstimationStatistics = (
  dateRange?: { from: string; to: string },
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: ['estimation-statistics', dateRange],
    queryFn: () => aiEstimationService.getEstimationStatistics(dateRange),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};
