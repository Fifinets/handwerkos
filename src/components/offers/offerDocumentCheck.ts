type CheckOffer = {
  offer_number?: string | null;
  project_name?: string | null;
  valid_until?: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  is_reverse_charge?: boolean | null;
};

type CheckCompany = {
  company_name?: string | null;
  street_address?: string | null;
  company_address?: string | null;
  postal_code?: string | null;
  company_postal_code?: string | null;
  city?: string | null;
  company_city?: string | null;
  tax_number?: string | null;
  vat_id?: string | null;
  vat_number?: string | null;
};

type CheckCustomer = {
  company_name?: string | null;
  display_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  tax_number?: string | null;
  vat_id?: string | null;
  vat_number?: string | null;
};

type CheckItem = {
  item_type?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price_net?: number | null;
  vat_rate?: number | null;
  is_optional?: boolean | null;
};

export type OfferDocumentCheckInput = {
  offer: CheckOffer;
  company?: CheckCompany | null;
  customer?: CheckCustomer | null;
  items: CheckItem[];
};

export type OfferDocumentCheckResult = {
  canSend: boolean;
  errors: string[];
  warnings: string[];
};

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const hasCompanyAddress = (company?: CheckCompany | null) =>
  Boolean(company && (hasText(company.street_address) || hasText(company.company_address)) && (hasText(company.city) || hasText(company.company_city)));

const hasCustomerAddress = (offer: CheckOffer, customer?: CheckCustomer | null) =>
  hasText(customer?.address) || hasText(offer.customer_address);

const isBillableItem = (item: CheckItem) =>
  item.item_type !== 'title'
  && item.item_type !== 'text'
  && item.item_type !== 'page_break'
  && !item.is_optional;

export function checkOfferBeforeSend(input: OfferDocumentCheckInput): OfferDocumentCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { offer, company, customer, items } = input;

  if (!hasText(company?.company_name)) errors.push('Firmenname fehlt.');
  if (!hasCompanyAddress(company)) errors.push('Firmenadresse fehlt.');
  if (!hasText(offer.customer_name) && !hasText(customer?.company_name) && !hasText(customer?.display_name)) {
    errors.push('Kunde fehlt.');
  }
  if (!hasCustomerAddress(offer, customer)) errors.push('Kundenadresse fehlt.');
  if (!hasText(offer.project_name)) errors.push('Betreff/Projektname fehlt.');
  if (!hasText(offer.valid_until)) errors.push('Gültigkeitsdatum fehlt.');
  if (!items.some(isBillableItem)) errors.push('Mindestens eine abrechenbare Position fehlt.');

  const hasTaxIdentifier = hasText(company?.tax_number) || hasText(company?.vat_id) || hasText(company?.vat_number);
  if (!hasTaxIdentifier) warnings.push('Steuernummer oder USt-IdNr. fehlt im Firmenprofil.');

  const hasZeroVatItem = items.some((item) => isBillableItem(item) && Number(item.vat_rate ?? 0) === 0);
  if (hasZeroVatItem && !offer.is_reverse_charge) {
    warnings.push('Mindestens eine Position hat 0% MwSt. Bitte Steuergrund prüfen.');
  }

  if (offer.is_reverse_charge && !hasText(customer?.tax_number) && !hasText(customer?.vat_id) && !hasText(customer?.vat_number)) {
    warnings.push('Reverse Charge ist aktiv. Bitte Kunden-USt-IdNr. bzw. Steuerangaben prüfen.');
  }

  return {
    canSend: errors.length === 0,
    errors,
    warnings,
  };
}
