import React from 'react';
import { calculateProfitability, formatCurrency, ProfitabilityOffer } from './utils';

export interface ProfitabilitySummaryProps {
  offers: ProfitabilityOffer[];
  internalCost: number;
  materialCost: number;
  budgetPlanned?: number;
}

const ProfitabilitySummary: React.FC<ProfitabilitySummaryProps> = ({
  offers,
  internalCost,
  materialCost,
  budgetPlanned = 0,
}) => {
  const { acceptedCount, revenueNet, margin } = calculateProfitability(offers, internalCost);
  const hasAccepted = acceptedCount > 0;
  const isPositive = margin >= 0;
  const marginPercent = revenueNet > 0 ? Math.round((margin / revenueNet) * 100) : 0;
  const coveragePercent = internalCost > 0 ? Math.round((revenueNet / internalCost) * 100) : 0;

  return (
    <div className="flex-shrink-0 flex divide-x divide-slate-200 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Angebot (netto)</p>
        <p className="text-xl font-bold text-slate-900">{formatCurrency(revenueNet)}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{acceptedCount} akzeptiert</p>
      </div>
      <div
        className="px-4 py-2.5 text-right"
        title={`Lohn ${formatCurrency(internalCost - materialCost)} · Material ${formatCurrency(materialCost)}`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Interne Kosten</p>
        <p className="text-xl font-bold text-slate-900">{formatCurrency(internalCost)}</p>
        {budgetPlanned > 0 && (
          <p className="text-[10px] text-slate-400 mt-0.5">von {formatCurrency(budgetPlanned)} Budget</p>
        )}
      </div>
      <div className="px-4 py-2.5 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Deckungsbeitrag</p>
        {hasAccepted ? (
          <p className={`text-xl font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(margin)}
          </p>
        ) : (
          <p className="text-xl font-bold text-slate-300">—</p>
        )}
        <p className="text-[10px] text-slate-400 mt-0.5">
          {hasAccepted
            ? isPositive
              ? `Marge ${marginPercent} %`
              : `Erlös deckt ${coveragePercent} % der Kosten`
            : 'Kein akzeptiertes Angebot'}
        </p>
      </div>
    </div>
  );
};

export default ProfitabilitySummary;
