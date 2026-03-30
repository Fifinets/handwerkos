// Protocol number formatting and parsing utility for VDE inspection protocols
// Format: PRF-YYYY-NNNN (e.g. PRF-2026-0001)

export function formatProtocolNumber(year: number, sequence: number): string {
  return `PRF-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parseProtocolNumber(num: string): { year: number; sequence: number } | null {
  const m = num.match(/^PRF-(\d{4})-(\d+)$/);
  return m ? { year: parseInt(m[1]), sequence: parseInt(m[2]) } : null;
}
