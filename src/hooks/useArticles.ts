// TanStack Query hooks for article catalog

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ArticleService } from '@/services/articleService';
import type {
  Article,
  ArticleCreate,
  ArticleUpdate,
  ArticleFilter,
  ArticleSearchParams,
  ArticleSearchResult,
  ArticleCategory,
  DatanormImport,
  DatanormParseResult,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { ApiError } from '@/utils/api';

export const ARTICLE_QUERY_KEYS = {
  articles: ['articles'] as const,
  article: (id: string) => ['articles', id] as const,
  articleSearch: (params: ArticleSearchParams) => ['articles', 'search', params] as const,
  articleStats: ['articles', 'stats'] as const,
  articleCategories: ['articles', 'categories'] as const,
  articleSuppliers: ['articles', 'suppliers'] as const,
  datanormImports: ['datanorm-imports'] as const,
};

// ==========================================
// ARTICLE SEARCH (Volltextsuche)
// ==========================================

export const useArticleSearch = (params: ArticleSearchParams) => {
  return useQuery<ArticleSearchResult[], ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.articleSearch(params),
    queryFn: () => ArticleService.searchArticles(params),
    enabled: !!(params.query && params.query.length >= 2),
    staleTime: 30_000,
  });
};

// ==========================================
// ARTICLE LIST (mit Pagination + Filter)
// ==========================================

export const useArticles = (
  pagination?: PaginationQuery,
  filters?: ArticleFilter
) => {
  return useQuery<PaginationResponse<Article>, ApiError>({
    queryKey: [...ARTICLE_QUERY_KEYS.articles, pagination, filters],
    queryFn: () => ArticleService.getArticles(pagination, filters),
  });
};

export const useArticle = (id: string) => {
  return useQuery<Article, ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.article(id),
    queryFn: () => ArticleService.getArticle(id),
    enabled: !!id,
  });
};

// ==========================================
// ARTICLE MUTATIONS
// ==========================================

export const useCreateArticle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Article, ApiError, ArticleCreate>({
    mutationFn: (data) => ArticleService.createArticle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articles });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articleStats });
      toast({ title: 'Artikel erstellt', description: 'Neuer Artikel wurde angelegt.' });
    },
    onError: (error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateArticle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Article, ApiError, { id: string; data: ArticleUpdate }>({
    mutationFn: ({ id, data }) => ArticleService.updateArticle(id, data),
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articles });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.article(article.id) });
      toast({ title: 'Artikel aktualisiert' });
    },
    onError: (error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });
};

// ==========================================
// DATANORM IMPORT
// ==========================================

export const useImportDatanorm = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<
    DatanormImport,
    ApiError,
    { parseResult: DatanormParseResult; supplierName: string; fileName: string }
  >({
    mutationFn: ({ parseResult, supplierName, fileName }) =>
      ArticleService.importDatanormArticles(parseResult, supplierName, fileName),
    onSuccess: (importLog) => {
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articles });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articleStats });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.articleCategories });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.datanormImports });
      toast({
        title: 'Import abgeschlossen',
        description: `${importLog.articles_created} Artikel importiert.`,
      });
    },
    onError: (error) => {
      toast({ title: 'Import fehlgeschlagen', description: error.message, variant: 'destructive' });
    },
  });
};

export const useImportHistory = () => {
  return useQuery<DatanormImport[], ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.datanormImports,
    queryFn: () => ArticleService.getImportHistory(),
  });
};

// ==========================================
// CATEGORIES + SUPPLIERS + STATS
// ==========================================

export const useArticleCategories = () => {
  return useQuery<ArticleCategory[], ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.articleCategories,
    queryFn: () => ArticleService.getCategories(),
    staleTime: 5 * 60_000,
  });
};

export const useArticleSuppliers = () => {
  return useQuery<string[], ApiError>({
    queryKey: ARTICLE_QUERY_KEYS.articleSuppliers,
    queryFn: () => ArticleService.getSuppliers(),
    staleTime: 5 * 60_000,
  });
};

export const useArticleStats = () => {
  return useQuery({
    queryKey: ARTICLE_QUERY_KEYS.articleStats,
    queryFn: () => ArticleService.getArticleStats(),
  });
};
