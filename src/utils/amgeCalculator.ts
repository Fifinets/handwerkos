/**
 * AMGE-Kalkulator - Reine Berechnungsfunktionen
 * Berechnet den Verrechnungslohn aus Direktlohn über die Zuschlagskette:
 * Direktlohn → +LZK → +BGK → +AGK → +W+G = Verrechnungslohn
 */

import type { AMGEFormData, AMGECalculationSteps } from '@/types/amge';

/**
 * Berechnet alle Zwischenwerte und den Verrechnungslohn
 */
export function calculateAMGE(params: AMGEFormData): AMGECalculationSteps {
  const { direktlohn } = params;

  // 1. LZK berechnen
  const lzk_gesamt_prozent =
    params.lzk_sozialversicherung +
    params.lzk_urlaubsgeld +
    params.lzk_lohnfortzahlung +
    params.lzk_berufsgenossenschaft +
    params.lzk_winterbau +
    params.lzk_sonstige;

  const lzk_betrag = round(direktlohn * lzk_gesamt_prozent / 100);
  const lohn_mit_lzk = direktlohn + lzk_betrag;

  // 2. BGK berechnen (auf Basis Lohn + LZK)
  const bgk_gesamt_prozent =
    params.bgk_bauleitung +
    params.bgk_hilfsstoffe +
    params.bgk_geraete +
    params.bgk_transport +
    params.bgk_sonstige;

  const bgk_betrag = round(lohn_mit_lzk * bgk_gesamt_prozent / 100);
  const lohn_mit_bgk = lohn_mit_lzk + bgk_betrag;

  // 3. AGK berechnen (auf Basis Lohn + BGK)
  const agk_betrag = round(lohn_mit_bgk * params.agk_prozent / 100);
  const lohn_mit_agk = lohn_mit_bgk + agk_betrag;

  // 4. Eigene Zuschläge (auf Basis Lohn + AGK)
  const surcharges = (params.custom_surcharges || []);
  const custom_detail = surcharges.map(s => ({
    name: s.name,
    prozent: s.prozent,
    betrag: round(lohn_mit_agk * s.prozent / 100),
  }));
  const custom_surcharges_betrag = custom_detail.reduce((sum, s) => sum + s.betrag, 0);
  const lohn_mit_custom = lohn_mit_agk + custom_surcharges_betrag;

  // 5. W+G berechnen (auf Basis nach eigenen Zuschlägen)
  const wagnis_betrag = round(lohn_mit_custom * params.wagnis_prozent / 100);
  const gewinn_betrag = round(lohn_mit_custom * params.gewinn_prozent / 100);

  // 6. Verrechnungslohn
  const verrechnungslohn = lohn_mit_custom + wagnis_betrag + gewinn_betrag;

  return {
    direktlohn,
    lzk_gesamt_prozent: round(lzk_gesamt_prozent),
    lzk_betrag,
    lohn_mit_lzk,
    bgk_gesamt_prozent: round(bgk_gesamt_prozent),
    bgk_betrag,
    lohn_mit_bgk,
    agk_prozent: params.agk_prozent,
    agk_betrag,
    lohn_mit_agk,
    custom_surcharges: custom_detail,
    custom_surcharges_betrag,
    lohn_mit_custom,
    wagnis_prozent: params.wagnis_prozent,
    wagnis_betrag,
    gewinn_prozent: params.gewinn_prozent,
    gewinn_betrag,
    verrechnungslohn: round(verrechnungslohn),
  };
}

/**
 * Berechnet den Gesamtzuschlag in Prozent auf den Direktlohn
 */
export function calculateTotalMarkup(steps: AMGECalculationSteps): number {
  if (steps.direktlohn === 0) return 0;
  return round((steps.verrechnungslohn / steps.direktlohn - 1) * 100);
}

/**
 * Berechnet Marge aus Verrechnungslohn und tatsächlichem Stundensatz
 */
export function calculateMargin(verrechnungslohn: number, stundensatz: number): {
  absolut: number;
  prozent: number;
} {
  const absolut = round(stundensatz - verrechnungslohn);
  const prozent = stundensatz > 0 ? round((absolut / stundensatz) * 100) : 0;
  return { absolut, prozent };
}

function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
