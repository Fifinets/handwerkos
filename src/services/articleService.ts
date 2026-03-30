// Article service for HandwerkOS
// Handles CRUD, Datanorm import, and full-text search for articles

import { supabase } from '@/integrations/supabase/client';
import {
  apiCall,
  createQuery,
  validateInput,
  getCurrentUserProfile,
} from '@/utils/api';
import type {
  Article,
  ArticleCreate,
  ArticleUpdate,
  ArticleCategory,
  DatanormImport,
  ParsedArticle,
  DatanormParseResult,
  ArticleSearchResult,
  ArticleSearchParams,
  ArticleFilter,
  PaginationQuery,
  PaginationResponse,
} from '@/types';
import { ArticleCreateSchema } from '@/types/article';
import { eventBus } from './eventBus';

const BATCH_SIZE = 500;

export class ArticleService {

  // ================================================================
  // SEARCH (Volltextsuche via RPC)
  // ================================================================

  static async searchArticles(params: ArticleSearchParams): Promise<ArticleSearchResult[]> {
    return apiCall(async () => {
      const profile = await getCurrentUserProfile();

      const { data, error } = await supabase.rpc('search_articles', {
        p_company_id: profile.company_id,
        p_query: params.query || '',
        p_category: params.category || null,
        p_supplier: params.supplier || null,
        p_limit: params.limit || 50,
        p_offset: params.offset || 0,
      });

      if (error) throw error;
      return data || [];
    }, 'Search articles');
  }

  // ================================================================
  // CRUD
  // ================================================================

  static async getArticles(
    pagination?: PaginationQuery,
    filters?: ArticleFilter
  ): Promise<PaginationResponse<Article>> {
    return apiCall(async () => {
      let query = supabase
        .from('articles' as any)
        .select('*', { count: 'exact' });

      if (filters?.category_code) {
        query = query.eq('category_code', filters.category_code);
      }
      if (filters?.supplier_name) {
        query = query.eq('supplier_name', filters.supplier_name);
      }
      if (filters?.source) {
        query = query.eq('source', filters.source);
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.search) {
        query = query.or(
          `short_text1.ilike.%${filters.search}%,` +
          `article_number.ilike.%${filters.search}%,` +
          `manufacturer.ilike.%${filters.search}%`
        );
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 50;
      const offset = (page - 1) * limit;

      query = query
        .range(offset, offset + limit - 1)
        .order(pagination?.sort_by || 'short_text1', {
          ascending: pagination?.sort_order !== 'desc',
        });

      const { data, count } = await createQuery<Article>(query).executeWithCount();

      const totalItems = count || 0;
      return {
        items: data,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: Math.ceil(totalItems / limit),
          has_next: page * limit < totalItems,
          has_prev: page > 1,
        },
      };
    }, 'Get articles');
  }

  static async getArticle(id: string): Promise<Article> {
    return apiCall(async () => {
      const query = supabase
        .from('articles' as any)
        .select('*')
        .eq('id', id);
      return createQuery<Article>(query).executeSingle();
    }, `Get article ${id}`);
  }

  static async createArticle(data: ArticleCreate): Promise<Article> {
    return apiCall(async () => {
      const validated = validateInput(ArticleCreateSchema, data);
      const { data: article, error } = await supabase
        .from('articles' as any)
        .insert(validated)
        .select()
        .single();

      if (error) throw error;

      eventBus.emit('ARTICLE_CREATED', {
        article,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return article as Article;
    }, 'Create article');
  }

  static async updateArticle(id: string, data: ArticleUpdate): Promise<Article> {
    return apiCall(async () => {
      const { data: article, error } = await supabase
        .from('articles' as any)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      eventBus.emit('ARTICLE_UPDATED', {
        article,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return article as Article;
    }, `Update article ${id}`);
  }

  // ================================================================
  // DATANORM IMPORT
  // ================================================================

  static async importDatanormArticles(
    parseResult: DatanormParseResult,
    supplierName: string,
    fileName: string
  ): Promise<DatanormImport> {
    return apiCall(async () => {
      const profile = await getCurrentUserProfile();
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // 1. Import-Log erstellen
      const { data: importLog, error: logError } = await supabase
        .from('datanorm_imports' as any)
        .insert({
          company_id: profile.company_id,
          file_name: fileName,
          supplier_name: supplierName,
          total_records: parseResult.articles.length,
          status: 'processing',
          started_at: new Date().toISOString(),
          imported_by: userId,
          error_log: parseResult.errors,
        })
        .select()
        .single();

      if (logError) throw logError;

      eventBus.emit('DATANORM_IMPORT_STARTED', {
        importId: importLog.id,
        supplier: supplierName,
        articleCount: parseResult.articles.length,
      });

      let articlesCreated = 0;
      let articlesUpdated = 0;
      let pricesUpdated = 0;
      const importErrors: any[] = [...parseResult.errors];

      try {
        // 2. Kategorien importieren (upsert)
        if (parseResult.categories.length > 0) {
          const categoryRows = parseResult.categories.map(cat => ({
            company_id: profile.company_id,
            code: cat.groupCode,
            name: cat.groupName,
            discount_percent: cat.discountPercent,
          }));

          await supabase
            .from('article_categories' as any)
            .upsert(categoryRows, { onConflict: 'company_id,code' });
        }

        // 3. Artikel in Batches importieren
        const batches = chunkArray(parseResult.articles, BATCH_SIZE);

        for (const batch of batches) {
          const articleRows = batch.map((art: ParsedArticle) => ({
            company_id: profile.company_id,
            article_number: art.articleNumber,
            short_text1: art.shortText1,
            short_text2: art.shortText2 || null,
            long_text: art.longText || null,
            list_price: art.listPrice,
            price_unit: art.priceUnit || 'C',
            unit: art.unit,
            category_code: art.categoryCode || art.discountGroup || null,
            discount_group: art.discountGroup || null,
            supplier_name: supplierName,
            datanorm_import_id: importLog.id,
            source: 'datanorm' as const,
          }));

          const { data: upserted, error: upsertError } = await supabase
            .from('articles' as any)
            .upsert(articleRows, {
              onConflict: 'company_id,article_number,supplier_name',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            importErrors.push({
              line: 0,
              content: 'Batch insert error',
              error: upsertError.message,
            });
          } else {
            articlesCreated += upserted?.length || 0;
          }

          // 4. Preishistorie schreiben
          for (const art of batch) {
            if (art.prices && art.prices.length > 0) {
              const { data: existing } = await supabase
                .from('articles' as any)
                .select('id')
                .eq('company_id', profile.company_id)
                .eq('article_number', art.articleNumber)
                .eq('supplier_name', supplierName)
                .single();

              if (existing) {
                const priceRows = art.prices.map(p => ({
                  article_id: existing.id,
                  list_price: p.price,
                  price_unit: p.priceUnit,
                  valid_from: p.validFrom || new Date().toISOString().split('T')[0],
                  source: 'datanorm',
                }));

                const { error: priceError } = await supabase
                  .from('article_prices' as any)
                  .insert(priceRows);

                if (!priceError) {
                  pricesUpdated += priceRows.length;
                }
              }
            }
          }
        }

        // 5. Import-Log abschliessen
        const { data: completedImport } = await supabase
          .from('datanorm_imports' as any)
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            articles_created: articlesCreated,
            articles_updated: articlesUpdated,
            prices_updated: pricesUpdated,
            errors: importErrors.length,
            error_log: importErrors,
          })
          .eq('id', importLog.id)
          .select()
          .single();

        eventBus.emit('DATANORM_IMPORT_COMPLETED', {
          importId: importLog.id,
          articlesCreated,
          articlesUpdated,
          pricesUpdated,
        });

        return (completedImport || importLog) as DatanormImport;
      } catch (error) {
        await supabase
          .from('datanorm_imports' as any)
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            errors: importErrors.length + 1,
            error_log: [
              ...importErrors,
              { error: error instanceof Error ? error.message : 'Unknown error' },
            ],
          })
          .eq('id', importLog.id);

        eventBus.emit('DATANORM_IMPORT_FAILED', {
          importId: importLog.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    }, 'Import Datanorm articles');
  }

  // ================================================================
  // IMPORT HISTORY
  // ================================================================

  static async getImportHistory(): Promise<DatanormImport[]> {
    return apiCall(async () => {
      const query = supabase
        .from('datanorm_imports' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      return createQuery<DatanormImport>(query).execute();
    }, 'Get import history');
  }

  // ================================================================
  // CATEGORIES
  // ================================================================

  static async getCategories(): Promise<ArticleCategory[]> {
    return apiCall(async () => {
      const query = supabase
        .from('article_categories' as any)
        .select('*')
        .order('name');

      return createQuery<ArticleCategory>(query).execute();
    }, 'Get article categories');
  }

  // ================================================================
  // SUPPLIERS (distinct aus articles)
  // ================================================================

  static async getSuppliers(): Promise<string[]> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('articles' as any)
        .select('supplier_name')
        .not('supplier_name', 'is', null)
        .order('supplier_name');

      if (error) throw error;

      const unique = [...new Set((data || []).map((d: any) => d.supplier_name).filter(Boolean))];
      return unique as string[];
    }, 'Get article suppliers');
  }

  // ================================================================
  // STATS
  // ================================================================

  static async getArticleStats(): Promise<{
    total_articles: number;
    suppliers: number;
    categories: number;
    last_import: string | null;
  }> {
    return apiCall(async () => {
      const [articles, cats, imports] = await Promise.all([
        supabase.from('articles' as any).select('id, supplier_name', { count: 'exact' }),
        supabase.from('article_categories' as any).select('id', { count: 'exact' }),
        supabase.from('datanorm_imports' as any).select('created_at').order('created_at', { ascending: false }).limit(1),
      ]);

      const supplierSet = new Set(
        (articles.data || []).map((a: any) => a.supplier_name).filter(Boolean)
      );

      return {
        total_articles: articles.count || 0,
        suppliers: supplierSet.size,
        categories: cats.count || 0,
        last_import: imports.data?.[0]?.created_at || null,
      };
    }, 'Get article stats');
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
