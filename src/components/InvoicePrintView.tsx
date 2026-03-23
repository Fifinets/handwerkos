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

interface Customer {
  company_name: string | null;
  contact_person: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
}

interface Project {
  name: string | null;
  project_number: string | null;
}

interface Invoice {
  invoice_number: string | null;
  title: string;
  description: string | null;
  status: string;
  invoice_type: string | null;
  invoice_date: string | null;
  due_date: string | null;
  net_amount: number | null;
  tax_amount: number | null;
  tax_rate: number | null;
  gross_amount: number | null;
  payment_terms: string | null;
  service_period_start: string | null;
  service_period_end: string | null;
  customers?: Customer | null;
  projects?: Project | null;
}

interface InvoiceItem {
  id: string;
  position_number: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number | null;
  total_net: number | null;
}

interface InvoicePrintViewProps {
  invoice: Invoice;
  items: InvoiceItem[];
  companySettings: CompanySettings | null;
  onItemClick?: (itemId: string) => void;
  highlightedItemId?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  final: 'Schlussrechnung',
  partial: 'Teilrechnung',
  advance: 'Abschlagsrechnung',
  credit: 'Gutschrift'
};

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

const InvoicePrintView: React.FC<InvoicePrintViewProps> = ({ invoice, items, companySettings, onItemClick, highlightedItemId }) => {
  const cs = companySettings;
  const customer = invoice.customers;

  return (
    <div
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

        {/* Invoice Type Label */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '18pt',
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.5px',
          }}>
            {invoice.invoice_type ? TYPE_LABELS[invoice.invoice_type] || 'Rechnung' : 'Rechnung'}
          </div>
          <div style={{ fontSize: '11pt', color: '#6b7280', marginTop: '1mm' }}>
            {invoice.invoice_number || 'Entwurf'}
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
          {customer ? (
            <>
              <div style={{ fontSize: '11pt', fontWeight: 600 }}>{customer.company_name}</div>
              {customer.contact_person && (
                <div style={{ fontSize: '10pt', color: '#4b5563' }}>{customer.contact_person}</div>
              )}
              {customer.address && (
                <div style={{ fontSize: '10pt', color: '#4b5563' }}>{customer.address}</div>
              )}
              {(customer.postal_code || customer.city) && (
                <div style={{ fontSize: '10pt', color: '#4b5563' }}>
                  {customer.postal_code} {customer.city}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#9ca3af' }}>Kein Kunde</div>
          )}
        </div>

        {/* Invoice Meta */}
        <div style={{ textAlign: 'right', fontSize: '9pt' }}>
          <table style={{ marginLeft: 'auto', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '1mm 4mm 1mm 0', color: '#6b7280', textAlign: 'left' }}>Rechnungsdatum:</td>
                <td style={{ padding: '1mm 0', fontWeight: 600, textAlign: 'right' }}>{formatDate(invoice.invoice_date)}</td>
              </tr>
              {invoice.due_date && (
                <tr>
                  <td style={{ padding: '1mm 4mm 1mm 0', color: '#6b7280', textAlign: 'left' }}>Fällig am:</td>
                  <td style={{ padding: '1mm 0', fontWeight: 600, textAlign: 'right' }}>{formatDate(invoice.due_date)}</td>
                </tr>
              )}
              {(invoice.service_period_start || invoice.service_period_end) && (
                <tr>
                  <td style={{ padding: '1mm 4mm 1mm 0', color: '#6b7280', textAlign: 'left' }}>Leistungszeitraum:</td>
                  <td style={{ padding: '1mm 0', fontWeight: 600, textAlign: 'right' }}>
                    {formatDate(invoice.service_period_start)} - {formatDate(invoice.service_period_end)}
                  </td>
                </tr>
              )}
              {invoice.projects?.project_number && (
                <tr>
                  <td style={{ padding: '1mm 4mm 1mm 0', color: '#6b7280', textAlign: 'left' }}>Projekt:</td>
                  <td style={{ padding: '1mm 0', fontWeight: 600, textAlign: 'right' }}>
                    {invoice.projects.project_number}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === TITLE === */}
      <div style={{ marginBottom: '6mm' }}>
        <div style={{ fontSize: '12pt', fontWeight: 700, color: '#111827' }}>
          {invoice.title}
        </div>
        {invoice.projects?.name && (
          <div style={{ fontSize: '9pt', color: '#6b7280', marginTop: '1mm' }}>
            Projekt: {invoice.projects.name}
          </div>
        )}
      </div>

      {/* === ITEMS TABLE === */}
      {(() => {
        // Detect if items use day-grouping (§DATE§ markers)
        const hasDayGroups = items.some(item => item.description.startsWith('§DATE§'));
        // Track real position numbers (excluding header rows)
        let realPos = 0;

        return (
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
                // Day section header row (§DATE§ marker)
                if (hasDayGroups && item.description.startsWith('§DATE§')) {
                  const parts = item.description.replace('§DATE§', '').split('§DESC§');
                  const dateLabel = parts[0];
                  const descText = parts[1] || '';
                  const isHighlighted = highlightedItemId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => onItemClick?.(item.id)}
                        style={{
                          backgroundColor: isHighlighted ? '#dbeafe' : '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          borderTop: idx > 0 ? '2px solid #cbd5e1' : undefined,
                          cursor: onItemClick ? 'pointer' : undefined,
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <td
                          colSpan={6}
                          style={{ padding: '3mm 2mm 1.5mm 2mm' }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '10pt', color: '#334155' }}>
                            {dateLabel}
                          </div>
                          {descText && (
                            <div style={{ fontSize: '9pt', color: '#64748b', marginTop: '0.5mm' }}>
                              {descText}
                            </div>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                }

                // Regular item row
                realPos++;
                const isHighlighted = highlightedItemId === item.id;

                return (
                  <tr
                    key={item.id}
                    onClick={() => onItemClick?.(item.id)}
                    style={{
                      borderBottom: idx === items.length - 1 ? '2px solid #111827' : '1px solid #e5e7eb',
                      backgroundColor: isHighlighted ? '#dbeafe' : undefined,
                      cursor: onItemClick ? 'pointer' : undefined,
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <td style={{ padding: '2.5mm 2mm', verticalAlign: 'top' }}>{realPos}</td>
                    <td style={{ padding: '2.5mm 2mm', verticalAlign: 'top' }}>{item.description}</td>
                    <td style={{ padding: '2.5mm 2mm', textAlign: 'right', verticalAlign: 'top' }}>
                      {item.quantity.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '2.5mm 2mm', textAlign: 'right', verticalAlign: 'top' }}>{item.unit}</td>
                    <td style={{ padding: '2.5mm 2mm', textAlign: 'right', verticalAlign: 'top' }}>
                      {formatCurrency(item.unit_price)} &euro;
                    </td>
                    <td style={{ padding: '2.5mm 2mm', textAlign: 'right', fontWeight: 500, verticalAlign: 'top' }}>
                      {formatCurrency(item.total_net || (item.quantity * item.unit_price))} &euro;
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })()}

      {/* === TOTALS === */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '10pt', minWidth: '65mm' }}>
          <tbody>
            <tr>
              <td style={{ padding: '1.5mm 6mm 1.5mm 0', color: '#4b5563' }}>Zwischensumme (netto)</td>
              <td style={{ padding: '1.5mm 0', textAlign: 'right', fontWeight: 500 }}>
                {formatCurrency(invoice.net_amount)} &euro;
              </td>
            </tr>
            <tr>
              <td style={{ padding: '1.5mm 6mm 1.5mm 0', color: '#4b5563' }}>
                MwSt. {invoice.tax_rate || 19}%
              </td>
              <td style={{ padding: '1.5mm 0', textAlign: 'right', fontWeight: 500 }}>
                {formatCurrency(invoice.tax_amount)} &euro;
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid #111827' }}>
              <td style={{ padding: '3mm 6mm 1.5mm 0', fontSize: '12pt', fontWeight: 700 }}>
                Gesamtbetrag
              </td>
              <td style={{ padding: '3mm 0 1.5mm 0', textAlign: 'right', fontSize: '12pt', fontWeight: 700 }}>
                {formatCurrency(invoice.gross_amount)} &euro;
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* === PAYMENT TERMS === */}
      {invoice.payment_terms && (
        <div style={{
          padding: '3mm 4mm',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '2mm',
          fontSize: '9pt',
          marginBottom: '4mm',
        }}>
          <span style={{ fontWeight: 600 }}>Zahlungsbedingungen: </span>
          {invoice.payment_terms}
        </div>
      )}

      {/* === NOTES === */}
      {invoice.description && (
        <div style={{ fontSize: '9pt', color: '#4b5563', marginBottom: '6mm', whiteSpace: 'pre-wrap' }}>
          {invoice.description}
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

export default InvoicePrintView;
