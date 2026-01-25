/**
 * ProjectEconomyWidget - Mini-Widget für Wirtschaftlichkeit
 *
 * Zeigt: Ziel-Umsatz, aktuelle Kosten, Rohertrag und Marge
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Minus } from "lucide-react";
import type { EconomySummary } from "@/types/projectHealth";

interface ProjectEconomyWidgetProps {
  economy: EconomySummary;
  isLoading?: boolean;
}

const formatCurrency = (value: number | null): string => {
  if (value === null) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const ProjectEconomyWidget: React.FC<ProjectEconomyWidgetProps> = ({
  economy,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Wirtschaftlichkeit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { targetRevenue, actualCosts, grossProfit, grossMarginPct } = economy;

  // Marge-Farbe bestimmen
  let marginColor = "text-gray-600";
  let marginBg = "bg-gray-100";
  let MarginIcon = Minus;

  if (grossMarginPct !== null) {
    if (grossMarginPct >= 20) {
      marginColor = "text-green-700";
      marginBg = "bg-green-100";
      MarginIcon = TrendingUp;
    } else if (grossMarginPct >= 10) {
      marginColor = "text-yellow-700";
      marginBg = "bg-yellow-100";
      MarginIcon = TrendingUp;
    } else if (grossMarginPct >= 0) {
      marginColor = "text-orange-700";
      marginBg = "bg-orange-100";
      MarginIcon = Minus;
    } else {
      marginColor = "text-red-700";
      marginBg = "bg-red-100";
      MarginIcon = TrendingDown;
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          Wirtschaftlichkeit
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Ziel-Umsatz */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Ziel-Umsatz
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(targetRevenue)}
            </p>
          </div>

          {/* Aktuelle Kosten */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Ist-Kosten
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(actualCosts)}
            </p>
          </div>

          {/* Rohertrag */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Rohertrag
            </p>
            <p
              className={`text-lg font-semibold ${
                grossProfit !== null && grossProfit < 0
                  ? "text-red-600"
                  : "text-gray-900"
              }`}
            >
              {formatCurrency(grossProfit)}
            </p>
          </div>

          {/* Marge */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Marge
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold ${marginBg} ${marginColor}`}
              >
                <MarginIcon className="h-3.5 w-3.5" />
                {grossMarginPct !== null ? `${grossMarginPct}%` : "–"}
              </span>
            </div>
          </div>
        </div>

        {/* Hinweis wenn keine Ziel-Werte */}
        {targetRevenue === null && (
          <p className="text-xs text-gray-500 mt-3 italic">
            Ziel-Umsatz nicht definiert - Marge kann nicht berechnet werden.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectEconomyWidget;
