import React, { useState } from 'react';
import {
  Package,
  Upload,
  Search,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useArticles,
  useArticleStats,
  useImportHistory,
  useArticleCategories,
} from '@/hooks/useArticles';
import { DatanormImport } from './DatanormImport';
import { ArticleSearch } from './ArticleSearch';
import type { ArticleFilter } from '@/types/article';
import { DATANORM_IMPORT_STATUS_LABELS } from '@/types/article';

export function ArticleModule() {
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState<ArticleFilter>({ is_active: true });
  const [page, setPage] = useState(1);

  const { data: stats } = useArticleStats();
  const { data: articlesResponse, isLoading } = useArticles(
    { page, limit: 50, sort_by: 'short_text1', sort_order: 'asc' },
    filters
  );
  const { data: imports } = useImportHistory();
  const { data: categories } = useArticleCategories();

  const articles = articlesResponse?.items || [];
  const pagination = articlesResponse?.pagination;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-600" />
            Artikeldatenbank
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Artikelkataloge aus Datanorm-Dateien importieren und durchsuchen
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Datanorm Import
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.total_articles.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Artikel</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.suppliers}</div>
              <div className="text-xs text-muted-foreground">Lieferanten</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.categories}</div>
              <div className="text-xs text-muted-foreground">Warengruppen</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-sm font-medium">
                {stats.last_import
                  ? new Date(stats.last_import).toLocaleDateString('de-DE')
                  : 'Noch kein Import'}
              </div>
              <div className="text-xs text-muted-foreground">Letzter Import</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search" className="gap-1">
            <Search className="h-3.5 w-3.5" /> Suche
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1">
            <Package className="h-3.5 w-3.5" /> Katalog
          </TabsTrigger>
          <TabsTrigger value="imports" className="gap-1">
            <History className="h-3.5 w-3.5" /> Import-Historie
          </TabsTrigger>
        </TabsList>

        {/* Volltextsuche */}
        <TabsContent value="search">
          <Card>
            <CardContent className="p-0 h-[500px]">
              <ArticleSearch showFilters={true} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Katalog-Ansicht */}
        <TabsContent value="catalog">
          <Card>
            <CardContent className="p-4">
              {/* Filter-Leiste */}
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Filtern..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="max-w-xs"
                />
                {categories && categories.length > 0 && (
                  <select
                    className="border rounded px-2 text-sm"
                    value={filters.category_code || ''}
                    onChange={(e) =>
                      setFilters(f => ({ ...f, category_code: e.target.value || undefined }))
                    }
                  >
                    <option value="">Alle Warengruppen</option>
                    {categories.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tabelle */}
              <ScrollArea className="h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Art.Nr.</th>
                      <th className="text-left p-2">Bezeichnung</th>
                      <th className="text-left p-2">Lieferant</th>
                      <th className="text-right p-2">Preis</th>
                      <th className="text-left p-2">ME</th>
                      <th className="text-left p-2">Warengruppe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={6} className="text-center p-8">Lade Artikel...</td></tr>
                    ) : articles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-muted-foreground">
                          Noch keine Artikel importiert.
                          <br />
                          <Button
                            variant="link"
                            onClick={() => setImportOpen(true)}
                            className="mt-2"
                          >
                            Jetzt Datanorm-Datei importieren
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      articles.map(art => (
                        <tr key={art.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 font-mono text-xs">{art.article_number}</td>
                          <td className="p-2">
                            <div className="font-medium">{art.short_text1}</div>
                            {art.short_text2 && (
                              <div className="text-xs text-muted-foreground">{art.short_text2}</div>
                            )}
                          </td>
                          <td className="p-2 text-xs">{art.supplier_name || '-'}</td>
                          <td className="p-2 text-right font-mono">
                            {art.list_price.toFixed(2)}
                          </td>
                          <td className="p-2">{art.unit}</td>
                          <td className="p-2">
                            {art.category_code && (
                              <Badge variant="outline" className="text-xs">{art.category_code}</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollArea>

              {/* Pagination */}
              {pagination && pagination.total_pages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t mt-3">
                  <span className="text-xs text-muted-foreground">
                    {pagination.total_items} Artikel
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.has_prev}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Zurueck
                    </Button>
                    <span className="text-sm px-2 py-1">
                      {pagination.page} / {pagination.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.has_next}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Weiter
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import-Historie */}
        <TabsContent value="imports">
          <Card>
            <CardContent className="p-4">
              {!imports || imports.length === 0 ? (
                <div className="text-center text-muted-foreground p-8">
                  Noch keine Imports durchgefuehrt.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Datum</th>
                      <th className="text-left p-2">Datei</th>
                      <th className="text-left p-2">Lieferant</th>
                      <th className="text-right p-2">Artikel</th>
                      <th className="text-right p-2">Fehler</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.map(imp => (
                      <tr key={imp.id} className="border-t">
                        <td className="p-2">
                          {new Date(imp.created_at).toLocaleDateString('de-DE')}
                        </td>
                        <td className="p-2 font-mono text-xs">{imp.file_name}</td>
                        <td className="p-2">{imp.supplier_name}</td>
                        <td className="p-2 text-right">{imp.articles_created}</td>
                        <td className="p-2 text-right">
                          {imp.errors > 0 ? (
                            <span className="text-red-600">{imp.errors}</span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={imp.status === 'completed' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {DATANORM_IMPORT_STATUS_LABELS[imp.status] || imp.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <DatanormImport open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
