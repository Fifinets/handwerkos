import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useArticleSearch, useArticleCategories, useArticleSuppliers } from '@/hooks/useArticles';
import type { ArticleSearchResult } from '@/types/article';

interface ArticleSearchProps {
  onSelect?: (article: ArticleSearchResult) => void;
  showFilters?: boolean;
}

export function ArticleSearch({ onSelect, showFilters = true }: ArticleSearchProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [supplier, setSupplier] = useState<string | undefined>();

  const { data: results, isLoading } = useArticleSearch({
    query,
    category: category || undefined,
    supplier: supplier || undefined,
    limit: 50,
  });

  const { data: categories } = useArticleCategories();
  const { data: suppliers } = useArticleSuppliers();

  return (
    <div className="flex flex-col h-full">
      {/* Suchleiste */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Artikel suchen... (z.B. NYM-J 3x1.5)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="flex gap-2">
            <Select value={category || 'all'} onValueChange={(v) => setCategory(v === 'all' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Warengruppe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Warengruppen</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.code} value={cat.code}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={supplier || 'all'} onValueChange={(v) => setSupplier(v === 'all' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Lieferant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Lieferanten</SelectItem>
                {suppliers?.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Ergebnisse */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && query.length >= 2 && (
            <div className="text-sm text-center text-muted-foreground p-4">Suche...</div>
          )}

          {!isLoading && query.length >= 2 && results?.length === 0 && (
            <div className="text-sm text-center text-muted-foreground p-4">
              Keine Artikel gefunden.
            </div>
          )}

          {query.length < 2 && (
            <div className="text-sm text-center text-muted-foreground p-4">
              Mindestens 2 Zeichen eingeben...
            </div>
          )}

          {results?.map((article) => (
            <div
              key={article.id}
              className="border rounded-lg p-2.5 hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer transition-all"
              onClick={() => onSelect?.(article)}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{article.short_text1}</div>
                  {article.short_text2 && (
                    <div className="text-xs text-muted-foreground truncate">{article.short_text2}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      {article.article_number}
                    </span>
                    {article.supplier_name && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        {article.supplier_name}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-sm">
                    {article.list_price.toFixed(2)} EUR
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    pro {article.unit}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
