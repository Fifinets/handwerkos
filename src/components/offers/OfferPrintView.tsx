import React from 'react';

interface CompanySettings {
  company_name: string;
  company_address?: string;
  company_city?: string;
  company_postal_code?: string;
  company_country?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;
  tax_number?: string;
  vat_number?: string;
  logo_url?: string;
  bank_account_holder?: string;
  bank_iban?: string;
  bank_bic?: string;
  bank_name?: string;
}

interface OfferPrintData {
  offer_number: string;
  offer_date: string | null;
  valid_until: string | null;
  customer_name: string;
  customer_address: string | null;
  contact_person: string | null;
  project_name: string;
  project_location: string | null;
  intro_text: string | null;
  final_text: string | null;
  payment_terms: string | null;
  execution_period_text: string | null;
  warranty_text: string | null;
  discount_percent: number | null;
  snapshot_subtotal_net: number | null;
  snapshot_discount_amount: number | null;
  snapshot_net_total: number | null;
  snapshot_vat_rate: number | null;
  snapshot_vat_amount: number | null;
  snapshot_gross_total: number | null;
  status: string;
}

interface OfferPrintItem {
  id: string;
  position_number: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price_net: number;
  vat_rate: number;
  is_optional: boolean;
  total_net?: number;
}

interface OfferPrintViewProps {
  offer: OfferPrintData;
  items: OfferPrintItem[];
  companySettings: CompanySettings | null;
}

const formatCurrency = (amount: number | null) => {
  return (amount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const OfferPrintView: React.FC<OfferPrintViewProps> = ({ offer, items, companySettings }) => {
  const cs = companySettings;

  // Calculate totals from items if no snapshot
  const nonOptional = items.filter(i => !i.is_optional);
  const subtotalNet = offer.snapshot_subtotal_net ?? nonOptional.reduce((s, i) => s + i.quantity * i.unit_price_net, 0);
  const discountAmount = offer.snapshot_discount_amount ?? 0;
  const netTotal = offer.snapshot_net_total ?? (subtotalNet - discountAmount);
  const vatRate = offer.snapshot_vat_rate ?? 19;
  const vatAmount = offer.snapshot_vat_amount ?? (netTotal * vatRate / 100);
  const grossTotal = offer.snapshot_gross_total ?? (netTotal + vatAmount);

  return (
    <div
      id="offer-print-content"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm 20mm 25mm 20mm',
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: '10pt',
        color: '#1a1a1a',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* === HEADER: Company Info === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8mm' }}>
        <div>
          {cs?.logo_url && (
            <img
              src={cs.logo_url}
              alt="Logo"
              style={{ height: '16mm', maxWidth: '50mm', objectFit: 'contain', marginBottom: '3mm' }}
            />
          )}
          <div style={{ fontSize: '14pt', fontWeight: 700, color: '#111827' }}>
            {cs?.company_name || 'Firma'}
          </div>
          {cs?.company_address && (
            <div style={{ fontSize: '9pt', color: '#6b7280', marginTop: '1mm' }}>
              {cs.company_address}
              {cs.company_postal_code && `, ${cs.company_postal_code}`}
              {cs.company_city && ` ${cs.company_city}`}
            </div>
          )}
          <div style={{ fontSize: '9pt', color: '#6b7280' }}>
            {cs?.company_phone && `Tel: ${cs.company_phone}`}
            {cs?.company_phone && cs?.company_email && ' | '}
            {cs?.company_email && `${cs.company_email}`}
          </div>
          {(cs?.tax_number || cs?.vat_number) && (
            <div style={{ fontSize: '9pt', color: '#6b7280', marginTop: '1mm' }}>
              {cs.tax_number && `Steuernr.: ${cs.tax_number}`}
              {cs.tax_number && cs.vat_number && ' | '}
              {cs.vat_number && `USt-IdNr.: ${cs.vat_number}`}
            </div>
          )}
        </div>

        {/* Document Type Label */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '18pt',
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.5px',
          }}>
            Angebot
          </div>
          <div style={{ fontSize: '11pt', color: '#6b7280', marginTop: '1mm' }}>
            {offer.offer_number || 'Entwurf'}
          </div>
        </div>
      </div>

      {/* === Sender line (small, above customer address) === */}
      <div style={{
        fontSize: '7pt',
        color: '#9ca3af',
        borderBottom: '1px solid #d1d5db',
        paddingBottom: '1mm',
        marginBottom: '3mm',
        maxWidth: '85mm',
      }}>
        {cs?.company_name}
        {cs?.company_address && ` - ${cs.company_address}`}
        {cs?.company_postal_code && ` - ${cs.company_postal_code}`}
        {cs?.company_city && ` ${cs.company_city}`}
      </div>

      {/* === ADDRESSES ROW === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10mm' }}>
        {/* Customer Address */}
        <div style={{ maxWidth: '85mm' }}>
          <div style={{ fontSize: '11pt', fontWeight: 600 }}>{offer.customer_name}</div>
          {offer.contact_person && (
            <div style={{ fontSize: '10pt', color: '#4b5563' }}>{offer.contact_person}</div>
          )}
          {offer.customer_address && (
            <div style={{ fontSize: '10pt', color: '#4b5563', whiteSpace: 'pre-line' }}>{offer.customer_address}</div>
          )}
        </div>

        {/* Offer Meta */}
        <div style={{ textAlign: 'right', fontSize: '9pt' }}>
          <table style={{ marginLeft: 'auto', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '1mm 4mm 1mm 0', color: '#6b7280', textAlign: 'left' }}>Angebotsdatum:</td>
                <td style={{ padding: '1mm 0', fontWeight: 600, textAlign: 'right' }}>{formatDate(offer.offer_date)}</td>
              </tr>
              {offer.valid_until && (
                <tr>
                  <td style={{ padding: '1mm 4mm 1mm 0', color: '#6b7280', textAlign: 'left' }}>Gültig bis:</td>
                  <td style={{ padding: '1mm 0', fontWeight: 600, textAlign: 'right' }}>{formatDate(offer.valid_until)}</td>
                </tr>
              )}
              {offer.project_location && (
                <tr>
                  <td style={{ padding: '1mm 4mm 1mm 0', color: '#6b7280', textAlign: 'left' }}>Projektort:</td>
                  <td style={{ padding: '1mm 0', fontWeight: 600, textAlign: 'right' }}>{offer.project_location}</td>
                </tr>
              )}
              {offer.execution_period_text && (
                <tr>
                  <td style={{ padding: '1mm 4mm 1mm 0', color: '#6b7280', textAlign: 'left' }}>Ausführung:</td>
                  <td style={{ padding: '1mm 0', fontWeight: 600, textAlign: 'right' }}>{offer.execution_period_text}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === TITLE === */}
      <div style={{ marginBottom: '4mm' }}>
        <div style={{ fontSize: '12pt', fontWeight: 700, color: '#111827' }}>
          {offer.project_name}
        </div>
      </div>

      {/* === INTRO TEXT === */}
      {offer.intro_text && (
        <div style={{ fontSize: '9.5pt', color: '#374151', marginBottom: '6mm', lineHeight: '1.5' }}>
          {offer.intro_text}
        </div>
      )}

      {/* === ITEMS TABLE === */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '6mm',
        fontSize: '9pt',
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #111827' }}>
            <th style={{ textAlign: 'left', padding: '2mm 2mm', fontWeight: 600, width: '8%' }}>Pos.</th>
            <th style={{ textAlign: 'left', padding: '2mm 2mm', fontWeight: 600, width: '42%' }}>Beschreibung</th>
            <th style={{ textAlign: 'right', padding: '2mm 2mm', fontWeight: 600, width: '10%' }}>Menge</th>
            <th style={{ textAlign: 'right', padding: '2mm 2mm', fontWeight: 600, width: '10%' }}>Einheit</th>
            <th style={{ textAlign: 'right', padding: '2mm 2mm', fontWeight: 600, width: '15%' }}>Einzelpreis</th>
            <th style={{ textAlign: 'right', padding: '2mm 2mm', fontWeight: 600, width: '15%' }}>Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const total = item.total_net ?? (item.quantity * item.unit_price_net);
            return (
              <tr
                key={item.id}
                style={{
                  borderBottom: idx === items.length - 1 ? '2px solid #111827' : '1px solid #e5e7eb',
                  opacity: item.is_optional ? 0.6 : 1,
                }}
              >
                <td style={{ padding: '2.5mm 2mm', verticalAlign: 'top' }}>
                  {item.position_number}
                </td>
                <td style={{ padding: '2.5mm 2mm', verticalAlign: 'top' }}>
                  {item.description}
                  {item.is_optional && (
                    <span style={{ fontSize: '8pt', color: '#9ca3af', marginLeft: '4px' }}>(Optional)</span>
                  )}
                </td>
                <td style={{ padding: '2.5mm 2mm', textAlign: 'right', verticalAlign: 'top' }}>
                  {item.quantity.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '2.5mm 2mm', textAlign: 'right', verticalAlign: 'top' }}>{item.unit}</td>
                <td style={{ padding: '2.5mm 2mm', textAlign: 'right', verticalAlign: 'top' }}>
                  {formatCurrency(item.unit_price_net)} &euro;
                </td>
                <td style={{ padding: '2.5mm 2mm', textAlign: 'right', fontWeight: 500, verticalAlign: 'top' }}>
                  {formatCurrency(total)} &euro;
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* === TOTALS === */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '10pt', minWidth: '65mm' }}>
          <tbody>
            <tr>
              <td style={{ padding: '1.5mm 6mm 1.5mm 0', color: '#4b5563' }}>Zwischensumme (netto)</td>
              <td style={{ padding: '1.5mm 0', textAlign: 'right', fontWeight: 500 }}>
                {formatCurrency(subtotalNet)} &euro;
              </td>
            </tr>
            {(offer.discount_percent ?? 0) > 0 && (
              <tr>
                <td style={{ padding: '1.5mm 6mm 1.5mm 0', color: '#16a34a' }}>
                  Rabatt {offer.discount_percent}%
                </td>
                <td style={{ padding: '1.5mm 0', textAlign: 'right', fontWeight: 500, color: '#16a34a' }}>
                  -{formatCurrency(discountAmount)} &euro;
                </td>
              </tr>
            )}
            {(offer.discount_percent ?? 0) > 0 && (
              <tr>
                <td style={{ padding: '1.5mm 6mm 1.5mm 0', color: '#4b5563' }}>Nettosumme</td>
                <td style={{ padding: '1.5mm 0', textAlign: 'right', fontWeight: 500 }}>
                  {formatCurrency(netTotal)} &euro;
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '1.5mm 6mm 1.5mm 0', color: '#4b5563' }}>
                MwSt. {vatRate}%
              </td>
              <td style={{ padding: '1.5mm 0', textAlign: 'right', fontWeight: 500 }}>
                {formatCurrency(vatAmount)} &euro;
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid #111827' }}>
              <td style={{ padding: '3mm 6mm 1.5mm 0', fontSize: '12pt', fontWeight: 700 }}>
                Gesamtbetrag
              </td>
              <td style={{ padding: '3mm 0 1.5mm 0', textAlign: 'right', fontSize: '12pt', fontWeight: 700 }}>
                {formatCurrency(grossTotal)} &euro;
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* === FINAL TEXT === */}
      {offer.final_text && (
        <div style={{ fontSize: '9.5pt', color: '#374151', marginBottom: '4mm', lineHeight: '1.5' }}>
          {offer.final_text}
        </div>
      )}

      {/* === PAYMENT & WARRANTY TERMS === */}
      {(offer.payment_terms || offer.warranty_text) && (
        <div style={{
          padding: '3mm 4mm',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '2mm',
          fontSize: '9pt',
          marginBottom: '4mm',
        }}>
          {offer.payment_terms && (
            <div>
              <span style={{ fontWeight: 600 }}>Zahlungsbedingungen: </span>
              {offer.payment_terms}
            </div>
          )}
          {offer.warranty_text && (
            <div style={{ marginTop: offer.payment_terms ? '2mm' : 0 }}>
              <span style={{ fontWeight: 600 }}>Gewährleistung: </span>
              {offer.warranty_text}
            </div>
          )}
        </div>
      )}

      {/* === FOOTER: Bank Details + Tax Info === */}
      <div style={{
        position: 'absolute',
        bottom: '15mm',
        left: '20mm',
        right: '20mm',
        borderTop: '1px solid #d1d5db',
        paddingTop: '3mm',
        fontSize: '8pt',
        color: '#6b7280',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        {/* Bank Details */}
        <div>
          {cs?.bank_iban && (
            <>
              <div style={{ fontWeight: 600, marginBottom: '1mm' }}>Bankverbindung</div>
              {cs.bank_account_holder && <div>Kontoinhaber: {cs.bank_account_holder}</div>}
              <div>IBAN: {cs.bank_iban}</div>
              {cs.bank_bic && <div>BIC: {cs.bank_bic}</div>}
              {cs.bank_name && <div>Bank: {cs.bank_name}</div>}
            </>
          )}
        </div>

        {/* Company Info */}
        <div style={{ textAlign: 'center' }}>
          <div>{cs?.company_name}</div>
          {cs?.company_address && <div>{cs.company_address}, {cs.company_postal_code} {cs.company_city}</div>}
          {cs?.company_phone && <div>Tel: {cs.company_phone}</div>}
        </div>

        {/* Tax Info */}
        <div style={{ textAlign: 'right' }}>
          {cs?.tax_number && <div>Steuernr.: {cs.tax_number}</div>}
          {cs?.vat_number && <div>USt-IdNr.: {cs.vat_number}</div>}
          {cs?.company_email && <div>{cs.company_email}</div>}
          {cs?.company_website && <div>{cs.company_website}</div>}
        </div>
      </div>
    </div>
  );
};

export default OfferPrintView;
