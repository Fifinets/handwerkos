// supabase/functions/generate-zugferd-invoice/zugferd-xml.ts

export interface ZugferdSeller {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  vatId: string;
  taxNumber: string;
  email: string;
  phone: string;
  iban: string;
  bic: string;
  bankName: string;
}

export interface ZugferdBuyer {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  vatId?: string;
  email?: string;
}

export interface ZugferdLineItem {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
}

export interface ZugferdInvoice {
  invoiceNumber: string;
  invoiceDate: string;    // yyyy-MM-dd
  dueDate: string;        // yyyy-MM-dd
  currency: string;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  vatRate: number;
  paymentTerms: string;
  seller: ZugferdSeller;
  buyer: ZugferdBuyer;
  items: ZugferdLineItem[];
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapUnit(unit: string | null): string {
  const unitMap: Record<string, string> = {
    'Stk': 'C62', 'Std': 'HUR', 'm': 'MTR', 'm²': 'MTK',
    'm³': 'MTQ', 'kg': 'KGM', 'l': 'LTR', 'psch': 'C62', 'Tag': 'DAY',
  };
  return unitMap[unit || ''] || 'C62';
}

export function generateZugferdXml(invoice: ZugferdInvoice): string {
  const lines = invoice.items.map((item, i) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${item.position}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${item.unitPrice.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${mapUnit(item.unit)}">${item.quantity.toFixed(4)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${item.vatRate.toFixed(2)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${item.totalPrice.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoice.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDate(invoice.invoiceDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(invoice.seller.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(invoice.seller.street)}</ram:LineOne>
          <ram:PostcodeCode>${escapeXml(invoice.seller.postalCode)}</ram:PostcodeCode>
          <ram:CityName>${escapeXml(invoice.seller.city)}</ram:CityName>
          <ram:CountryID>${escapeXml(invoice.seller.country)}</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(invoice.seller.vatId)}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${escapeXml(invoice.seller.taxNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(invoice.buyer.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(invoice.buyer.street)}</ram:LineOne>
          <ram:PostcodeCode>${escapeXml(invoice.buyer.postalCode)}</ram:PostcodeCode>
          <ram:CityName>${escapeXml(invoice.buyer.city)}</ram:CityName>
          <ram:CountryID>${escapeXml(invoice.buyer.country)}</ram:CountryID>
        </ram:PostalTradeAddress>${invoice.buyer.vatId ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(invoice.buyer.vatId)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatDate(invoice.invoiceDate)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${invoice.currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${escapeXml(invoice.paymentTerms)}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDate(invoice.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(invoice.seller.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${escapeXml(invoice.seller.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${invoice.taxAmount.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${invoice.netAmount.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${invoice.vatRate.toFixed(2)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${invoice.netAmount.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${invoice.netAmount.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${invoice.currency}">${invoice.taxAmount.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${invoice.grossAmount.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${invoice.grossAmount.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
${lines}
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
