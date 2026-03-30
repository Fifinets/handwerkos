// Seitenleiste fuer den Angebotseditor — Artikel aus Katalog in Positionen uebernehmen

import React from 'react';
import { Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArticleSearch } from './ArticleSearch';
import type { ArticleSearchResult } from '@/types/article';

interface ArticlePickerProps {
  open: boolean;
  onClose: () => void;
  onSelectArticle: (article: {
    description: string;
    unit: string;
    unit_price_net: number;
    article_number: string;
    supplier_name: string | null;
  }) => void;
}

export function ArticlePicker({ open, onClose, onSelectArticle }: ArticlePickerProps) {
  if (!open) return null;

  const handleSelect = (article: ArticleSearchResult) => {
    const description = [
      article.short_text1,
      article.short_text2,
    ].filter(Boolean).join(' — ');

    onSelectArticle({
      description,
      unit: article.unit,
      unit_price_net: article.list_price,
      article_number: article.article_number,
      supplier_name: article.supplier_name,
    });
  };

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-sm">Artikelkatalog</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Suche */}
      <ArticleSearch onSelect={handleSelect} showFilters={true} />
    </div>
  );
}
