/**
 * AMGE-Kalkulator Types
 * Berechnung des Verrechnungslohns nach dem Schema:
 * Direktlohn → LZK → BGK → AGK → W+G → Verrechnungslohn
 */

// === Lohnzusatzkosten (LZK) ===
export interface LZKParams {
  sozialversicherung: number;  // AG-Anteil Sozialversicherung %
  urlaubsgeld: number;         // Urlaubsgeld %
  lohnfortzahlung: number;     // Lohnfortzahlung Krankheit %
  berufsgenossenschaft: number; // BG-Beitrag %
  winterbau: number;           // Winterbauumlage %
  sonstige: number;            // Sonstige LZK %
}

// === Baustellengemeinkosten (BGK) ===
export interface BGKParams {
  bauleitung: number;    // Bauleitung %
  hilfsstoffe: number;   // Hilfsstoffe %
  geraete: number;       // Gerätekosten %
  transport: number;     // Transport %
  sonstige: number;      // Sonstige BGK %
}

// === Eigener Zuschlag ===
export interface CustomSurcharge {
  name: string;
  prozent: number;
}

// === Berechnungsschritte ===
export interface AMGECalculationSteps {
  // 1. Direktlohn
  direktlohn: number;

  // 2. LZK
  lzk_gesamt_prozent: number;
  lzk_betrag: number;
  lohn_mit_lzk: number;

  // 3. BGK
  bgk_gesamt_prozent: number;
  bgk_betrag: number;
  lohn_mit_bgk: number;

  // 4. AGK
  agk_prozent: number;
  agk_betrag: number;
  lohn_mit_agk: number;

  // 4b. Eigene Zuschläge
  custom_surcharges: { name: string; prozent: number; betrag: number }[];
  custom_surcharges_betrag: number;
  lohn_mit_custom: number;

  // 5. W+G
  wagnis_prozent: number;
  wagnis_betrag: number;
  gewinn_prozent: number;
  gewinn_betrag: number;

  // Ergebnis
  verrechnungslohn: number;
}

// === Vollständige AMGE-Kalkulation (DB-Entität) ===
export interface AMGECalculation {
  id: string;
  company_id: string;

  // Metadaten
  name: string;
  description?: string;
  is_active: boolean;
  valid_from: string;
  valid_until?: string;

  // Direktlohn
  direktlohn: number;

  // LZK-Einzelwerte
  lzk_sozialversicherung: number;
  lzk_urlaubsgeld: number;
  lzk_lohnfortzahlung: number;
  lzk_berufsgenossenschaft: number;
  lzk_winterbau: number;
  lzk_sonstige: number;
  lzk_gesamt_prozent: number;

  // BGK-Einzelwerte
  bgk_bauleitung: number;
  bgk_hilfsstoffe: number;
  bgk_geraete: number;
  bgk_transport: number;
  bgk_sonstige: number;
  bgk_gesamt_prozent: number;

  // AGK
  agk_prozent: number;

  // W+G
  wagnis_prozent: number;
  gewinn_prozent: number;

  // Eigene Zuschläge
  custom_surcharges: CustomSurcharge[];

  // Berechnete Ergebniswerte
  lzk_betrag: number;
  lohn_mit_lzk: number;
  bgk_betrag: number;
  lohn_mit_bgk: number;
  agk_betrag: number;
  lohn_mit_agk: number;
  custom_surcharges_betrag: number;
  lohn_mit_custom: number;
  wagnis_betrag: number;
  gewinn_betrag: number;
  verrechnungslohn: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// === Formular-Daten (Create/Update) ===
export interface AMGEFormData {
  name: string;
  description?: string;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;

  direktlohn: number;

  // LZK
  lzk_sozialversicherung: number;
  lzk_urlaubsgeld: number;
  lzk_lohnfortzahlung: number;
  lzk_berufsgenossenschaft: number;
  lzk_winterbau: number;
  lzk_sonstige: number;

  // BGK
  bgk_bauleitung: number;
  bgk_hilfsstoffe: number;
  bgk_geraete: number;
  bgk_transport: number;
  bgk_sonstige: number;

  // AGK
  agk_prozent: number;

  // Eigene Zuschläge
  custom_surcharges: CustomSurcharge[];

  // W+G
  wagnis_prozent: number;
  gewinn_prozent: number;
}

// === Standard-Werte ===
export const AMGE_DEFAULTS: AMGEFormData = {
  name: 'Standard-Kalkulation',
  direktlohn: 22.00,

  // LZK Standardwerte (Baugewerbe-typisch)
  lzk_sozialversicherung: 20.6,
  lzk_urlaubsgeld: 11.4,
  lzk_lohnfortzahlung: 5.2,
  lzk_berufsgenossenschaft: 5.0,
  lzk_winterbau: 2.0,
  lzk_sonstige: 1.5,

  // BGK Standardwerte
  bgk_bauleitung: 5.0,
  bgk_hilfsstoffe: 2.0,
  bgk_geraete: 3.0,
  bgk_transport: 1.5,
  bgk_sonstige: 1.0,

  // AGK
  agk_prozent: 12.0,

  // Eigene Zuschläge
  custom_surcharges: [],

  // W+G
  wagnis_prozent: 2.0,
  gewinn_prozent: 5.0,
};
