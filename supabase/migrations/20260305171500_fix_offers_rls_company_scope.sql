-- ============================================================
-- SECURITY FIX #2: Offers-Tabellen auf Company-Scope umstellen
-- + templates auf authenticated einschränken
-- 
-- Problem: offers/offer_items/offer_targets hatten USING(true)
-- → jeder authentifizierte Nutzer konnte alle Angebote aller
--   Firmen lesen, ändern und löschen.
--
-- Datum: 2026-03-05
-- ============================================================


-- ============================================================
-- 1. OFFERS / OFFER_ITEMS / OFFER_TARGETS
-- ============================================================

-- Alte unsichere Policies entfernen
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.offers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.offer_items;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.offer_targets;

-- Offers: nur eigene Company sehen und bearbeiten
CREATE POLICY "Company users can view own offers"
  ON public.offers
  FOR SELECT
  TO authenticated
  USING (public.user_has_company_access(company_id));

CREATE POLICY "Company users can insert offers"
  ON public.offers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "Company users can update own offers"
  ON public.offers
  FOR UPDATE
  TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "Company users can delete own offers"
  ON public.offers
  FOR DELETE
  TO authenticated
  USING (public.user_has_company_access(company_id));

-- Offer Items: über die offers-Tabelle absichern (kein eigenes company_id)
CREATE POLICY "Company users can view own offer items"
  ON public.offer_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_items.offer_id
        AND public.user_has_company_access(o.company_id)
    )
  );

CREATE POLICY "Company users can insert offer items"
  ON public.offer_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_items.offer_id
        AND public.user_has_company_access(o.company_id)
    )
  );

CREATE POLICY "Company users can update offer items"
  ON public.offer_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_items.offer_id
        AND public.user_has_company_access(o.company_id)
    )
  );

CREATE POLICY "Company users can delete offer items"
  ON public.offer_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_items.offer_id
        AND public.user_has_company_access(o.company_id)
    )
  );

-- Offer Targets: ebenfalls über offers absichern
CREATE POLICY "Company users can view own offer targets"
  ON public.offer_targets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_targets.offer_id
        AND public.user_has_company_access(o.company_id)
    )
  );

CREATE POLICY "Company users can insert offer targets"
  ON public.offer_targets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_targets.offer_id
        AND public.user_has_company_access(o.company_id)
    )
  );

CREATE POLICY "Company users can update offer targets"
  ON public.offer_targets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_targets.offer_id
        AND public.user_has_company_access(o.company_id)
    )
  );

CREATE POLICY "Company users can delete offer targets"
  ON public.offer_targets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_targets.offer_id
        AND public.user_has_company_access(o.company_id)
    )
  );


-- ============================================================
-- 2. WEBBUILDER TEMPLATES
-- ============================================================
-- Templates sind System-Vorlagen ohne Nutzerdaten.
-- Einschränkung auf authenticated ist ausreichend.

DROP POLICY IF EXISTS "Templates are viewable by everyone" ON public.templates;

CREATE POLICY "Authenticated users can view templates"
  ON public.templates
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('offers', 'offer_items', 'offer_targets', 'templates')
-- ORDER BY tablename, cmd;
