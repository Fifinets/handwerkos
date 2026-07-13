/**
 * Repair UTF-8 → Latin-1 → UTF-8 mojibake.
 *
 * Symptom: emails arrive with "We're" displayed as "Weâ□□re" or German
 * umlauts ("Käse") shown as "KÃ¤se". Root cause: the upstream ingest
 * (sync-gmail-emails for our case) decodes the MIME body as Latin-1 when
 * the real encoding is UTF-8, then re-encodes as UTF-8 — so the bytes are
 * permanently mangled in the DB.
 *
 * This function reverses the damage on the client by reinterpreting each
 * JavaScript char as a single byte and decoding the byte sequence as
 * UTF-8. Only runs when classic mojibake markers are present, and only
 * keeps the result if it actually has fewer markers than the original
 * (so correctly-encoded text isn't mangled).
 *
 * Real fix belongs in sync-gmail-emails (respect the MIME charset header,
 * default to UTF-8 not Latin-1). This is a rescue for what's already stored.
 */

// Two mojibake families:
//   â + (0x80..0x9F)   — `â` followed by C1 control char (the unrenderable
//                              squares from e.g. an em-dash that got broken).
//   Ã + (0x80..0xBF)   — `Ã{vowel}`, classic mojibake of German umlauts /
//                              accented Latin chars.
//   Â + (0xA0..0xBF)   — `Â{punct}`, e.g. `Â ` for non-breaking-space,
//                              `Â€` for the euro sign in receipts/invoices.
const MOJIBAKE_MARKERS_SOURCE = '\\u00e2[\\u0080-\\u009f]|\\u00c3[\\u0080-\\u00bf]|\\u00c2[\\u00a0-\\u00bf]';

export function looksLikeMojibake(s: string): boolean {
  return new RegExp(MOJIBAKE_MARKERS_SOURCE).test(s);
}

function countMojibake(s: string): number {
  const matches = s.match(new RegExp(MOJIBAKE_MARKERS_SOURCE, 'g'));
  return matches ? matches.length : 0;
}

export function repairMojibake(s: string | null | undefined): string {
  if (!s) return s ?? '';
  if (!looksLikeMojibake(s)) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      if (code > 0xff) return s; // not Latin-1-shaped, abort
      bytes[i] = code;
    }
    const repaired = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return countMojibake(repaired) < countMojibake(s) ? repaired : s;
  } catch {
    return s;
  }
}
