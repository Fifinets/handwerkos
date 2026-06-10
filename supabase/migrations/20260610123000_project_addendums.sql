-- First-class Nachtrag workflow for projects.
-- Status flow: detected/draft -> pending_customer -> approved/rejected -> invoiced.

CREATE TABLE IF NOT EXISTS public.project_addendums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Nachtrag',
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'Stk',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount_net NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 19,
  status TEXT NOT NULL DEFAULT 'detected',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id UUID,
  detected_from TEXT,
  customer_note TEXT,
  approval_token UUID DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoiced_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_addendums_status_check CHECK (
    status IN ('detected', 'draft', 'pending_customer', 'approved', 'rejected', 'invoiced')
  ),
  CONSTRAINT project_addendums_quantity_check CHECK (quantity > 0),
  CONSTRAINT project_addendums_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT project_addendums_amount_net_check CHECK (amount_net >= 0)
);

CREATE INDEX IF NOT EXISTS idx_project_addendums_company_status
  ON public.project_addendums(company_id, status);

CREATE INDEX IF NOT EXISTS idx_project_addendums_project_status
  ON public.project_addendums(project_id, status);

CREATE INDEX IF NOT EXISTS idx_project_addendums_invoice
  ON public.project_addendums(invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_project_addendum_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.amount_net IS NULL OR NEW.amount_net = 0 THEN
    NEW.amount_net = ROUND((NEW.quantity * NEW.unit_price)::numeric, 2);
  END IF;
  IF NEW.status = 'invoiced' AND NEW.invoiced_at IS NULL THEN
    NEW.invoiced_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_project_addendums_updated_at ON public.project_addendums;
CREATE TRIGGER trigger_project_addendums_updated_at
  BEFORE INSERT OR UPDATE ON public.project_addendums
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_addendum_updated_at();

ALTER TABLE public.project_addendums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project addendums company select" ON public.project_addendums;
CREATE POLICY "Project addendums company select"
  ON public.project_addendums
  FOR SELECT
  USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Project addendums company insert" ON public.project_addendums;
CREATE POLICY "Project addendums company insert"
  ON public.project_addendums
  FOR INSERT
  WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Project addendums company update" ON public.project_addendums;
CREATE POLICY "Project addendums company update"
  ON public.project_addendums
  FOR UPDATE
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE ON public.project_addendums TO authenticated;

COMMENT ON TABLE public.project_addendums IS
  'Nachtraege pro Projekt, inklusive Freigabe- und Rechnungsstatus.';
