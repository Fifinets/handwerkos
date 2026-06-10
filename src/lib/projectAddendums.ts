export type ProjectAddendumStatus =
  | 'detected'
  | 'draft'
  | 'pending_customer'
  | 'approved'
  | 'rejected'
  | 'invoiced';

export type ProjectAddendum = {
  id: string;
  project_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount_net: number | null;
  vat_rate: number | null;
  status: ProjectAddendumStatus;
  invoice_id: string | null;
};

export type InvoiceLineInput = {
  invoiceId: string;
  companyId: string | null;
  position: number;
};

export type InvoiceDocumentLine = {
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  company_id: string | null;
};

const OPEN_STATUSES: ProjectAddendumStatus[] = ['detected', 'draft', 'pending_customer', 'approved'];

export const isOpenAddendum = (addendum: Pick<ProjectAddendum, 'status'>) => {
  return OPEN_STATUSES.includes(addendum.status);
};

export const isInvoiceableAddendum = (addendum: Pick<ProjectAddendum, 'status' | 'invoice_id'>) => {
  return addendum.status === 'approved' && !addendum.invoice_id;
};

export const getOpenAddendumCount = (addendums: Array<Pick<ProjectAddendum, 'status'>>) => {
  return addendums.filter(isOpenAddendum).length;
};

export const getInvoiceableAddendums = <T extends Pick<ProjectAddendum, 'status' | 'invoice_id'>>(addendums: T[]) => {
  return addendums.filter(isInvoiceableAddendum);
};

export const getAddendumTotal = (addendum: Pick<ProjectAddendum, 'amount_net' | 'quantity' | 'unit_price'>) => {
  return addendum.amount_net ?? addendum.quantity * addendum.unit_price;
};

export const toInvoiceLine = (addendum: ProjectAddendum, input: InvoiceLineInput): InvoiceDocumentLine => {
  return {
    invoice_id: input.invoiceId,
    position: input.position,
    description: `Nachtrag: ${addendum.description}`,
    quantity: addendum.quantity,
    unit: addendum.unit,
    unit_price: addendum.unit_price,
    total_price: getAddendumTotal(addendum),
    company_id: input.companyId,
  };
};
