# Invoice Module Improvements - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the HandwerkOS invoice module §14 UStG compliant, add PDF generation, and create a professional invoice layout.

**Architecture:** Add bank details to company_settings via Supabase migration. Create a new `InvoicePrintView.tsx` component that renders a professional A4-styled invoice with all legally required fields. Use the existing `html2canvas` + `jsPDF` pipeline (`src/lib/pdfGenerator.ts`) for PDF download. Update `InvoiceDetailDialog.tsx` to load company settings, display all §14 fields, and wire up the print button.

**Tech Stack:** React, TypeScript, Supabase (migration + queries), shadcn/ui, Tailwind CSS, jsPDF + html2canvas (already installed)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260322000001_add_bank_details.sql` | Add bank columns to company_settings |
| Create | `src/components/InvoicePrintView.tsx` | Printable A4 invoice layout with all §14 UStG fields |
| Modify | `src/components/CompanySettingsModule.tsx` | Add bank details form section |
| Modify | `src/components/InvoiceDetailDialog.tsx` | Load company settings, wire print button, improve layout |

---

## Task 1: Add Bank Details to company_settings (Supabase Migration)

**Files:**
- Create: `supabase/migrations/20260322000001_add_bank_details.sql`

§14 UStG requires Bankverbindung on invoices. The `company_settings` table currently lacks bank fields.

- [x] **Step 1: Create migration file**

```sql
-- Add bank details for §14 UStG invoice compliance
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_iban TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_bic TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_name TEXT;
```

- [x] **Step 2: Apply migration via Supabase MCP**

Use `apply_migration` tool to run the SQL.

- [x] **Step 3: Verify columns exist**

Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name LIKE 'bank_%';`
Expected: 4 rows (bank_account_holder, bank_iban, bank_bic, bank_name)

---

## Task 2: Add Bank Details Form to CompanySettingsModule

**Files:**
- Modify: `src/components/CompanySettingsModule.tsx`

Add a "Bankverbindung" form section to the existing company settings page.

- [x] **Step 1: Add bank fields to CompanySettings interface**

Add to the `CompanySettings` interface (line ~13):
```typescript
bank_account_holder?: string;
bank_iban?: string;
bank_bic?: string;
bank_name?: string;
```

- [x] **Step 2: Add "Bankverbindung" card section**

Add a new Card after the existing tax/financial section with these fields:
- Kontoinhaber (bank_account_holder) - Input
- IBAN (bank_iban) - Input
- BIC (bank_bic) - Input
- Bank (bank_name) - Input

Use the same pattern as existing form cards: `<Card>` with `<CardHeader>` title "Bankverbindung" and icon `Landmark` from lucide-react.

- [x] **Step 3: Verify save works**

The existing `updateSettingsMutation` uses spread (`...updatedSettings`) so new fields are automatically included. Verify saving bank details persists to database.

---

## Task 3: Create InvoicePrintView Component

**Files:**
- Create: `src/components/InvoicePrintView.tsx`

A professional A4-proportioned invoice layout that includes ALL §14 UStG required fields. Rendered as a hidden div for PDF capture via `generateA4PDF()`.

- [x] **Step 1: Create InvoicePrintView component**

The component renders a professional German invoice with:

**Header:**
- Company logo (if available) + company name, address, contact
- Steuernummer / USt-IdNr

**Customer block (left):**
- Customer company name
- Contact person
- Full address (street, PLZ, city)

**Invoice meta (right):**
- Rechnungsnummer
- Rechnungsdatum
- Leistungszeitraum
- Kundennummer (if available)
- Projekt (if available)

**Title:**
- Invoice title (e.g., "Rechnung RE-2024-001")
- Invoice type badge (Schlussrechnung, Teilrechnung, etc.)

**Items table:**
- Pos. | Beschreibung | Menge | Einheit | Einzelpreis (netto) | Gesamt (netto)
- Clean borders, professional typography

**Totals:**
- Zwischensumme (netto)
- MwSt. X% auf Y
- Gesamtbetrag (brutto) - bold, prominent

**Footer:**
- Zahlungsbedingungen
- Bankverbindung: Kontoinhaber, IBAN, BIC, Bank
- Bemerkungen
- Small legal line: Steuernummer / USt-IdNr

**Props interface:**
```typescript
interface InvoicePrintViewProps {
  invoice: Invoice;
  items: InvoiceItem[];
  companySettings: CompanySettings | null;
}
```

Style with Tailwind: `w-[210mm]` container, `font-sans`, professional spacing, print-optimized colors (no gradients, solid borders).

- [x] **Step 2: Verify render**

Mount the component in InvoiceDetailDialog (hidden) with `id="invoice-print-view"` and take a screenshot or inspect visually.

---

## Task 4: Wire Up Print Button & Improve InvoiceDetailDialog

**Files:**
- Modify: `src/components/InvoiceDetailDialog.tsx`

- [x] **Step 1: Load company settings**

Add React Query to fetch company_settings inside InvoiceDetailDialog:
```typescript
const { data: companySettings } = useQuery({
  queryKey: ["company-settings"],
  queryFn: async () => {
    const { data } = await supabase
      .from("company_settings")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();
    return data;
  },
});
```

- [x] **Step 2: Add InvoicePrintView (hidden) to dialog**

Below the dialog content, add:
```tsx
{/* Hidden print view for PDF generation */}
<div className="fixed left-[-9999px] top-0">
  <div id="invoice-print-view">
    <InvoicePrintView
      invoice={fullInvoice}
      items={items}
      companySettings={companySettings}
    />
  </div>
</div>
```

- [x] **Step 3: Wire "Drucken" button to generateA4PDF**

Replace the placeholder print button with:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={async () => {
    const success = await generateA4PDF(
      'invoice-print-view',
      `${fullInvoice.invoice_number || 'Rechnung'}.pdf`
    );
    if (success) {
      toast({ title: "PDF erstellt", description: "Die Rechnung wurde als PDF heruntergeladen." });
    }
  }}
>
  <Printer className="h-4 w-4 mr-2" />
  Drucken
</Button>
```

- [x] **Step 4: Add company info section to detail view**

Add a small company info section showing:
- Steuernr / USt-IdNr
- Bankverbindung (IBAN)
This makes the §14 UStG info visible even in the dialog view, not just in PDF.

- [x] **Step 5: Verify end-to-end**

1. Open an invoice detail dialog
2. Click "Drucken" button
3. Verify PDF downloads with correct filename
4. Verify PDF contains: company info, customer info, items, totals, bank details, tax info

---

## §14 UStG Compliance Checklist

After implementation, every generated invoice must contain:

| # | Requirement | Source |
|---|------------|--------|
| 1 | Name + Anschrift Leistender | company_settings.company_name + address |
| 2 | Name + Anschrift Empfänger | customers.company_name + address |
| 3 | Steuernummer oder USt-IdNr | company_settings.tax_number / vat_number |
| 4 | Ausstellungsdatum | invoices.invoice_date |
| 5 | Fortlaufende Rechnungsnummer | invoices.invoice_number |
| 6 | Menge + Art der Leistung | invoice_items (qty, unit, description) |
| 7 | Zeitpunkt der Leistung | invoices.service_period_start/end |
| 8 | Entgelt (netto) | invoices.net_amount |
| 9 | Steuersatz + Steuerbetrag | invoices.tax_rate + tax_amount |
| 10 | Bankverbindung | company_settings.bank_* fields |
