-- Härtung der INSERT-Attribution für employee_material_usage und project_comments.
--
-- Ausgangslage:
--   Beide Tabellen hatten je eine `FOR ALL`-Policy, die nur firmenweit scopte.
--   Da bei `FOR ALL` ohne separates WITH CHECK die USING-Bedingung auch für
--   INSERT gilt, konnte ein Firmenmitglied Zeilen mit fremder `employee_id`
--   bzw. fremdem `created_by` einfügen (Zuschreibung an Kollegen), solange das
--   Projekt zur eigenen Firma gehört.
--
-- Ziel:
--   - Sichtbarkeit (SELECT) bleibt firmenweit — Manager/Kollegen sehen weiterhin
--     das gesamte Projekt-Material bzw. alle Projekt-Notizen.
--   - INSERT erzwingt Selbst-Attribution: created_by = auth.uid() und (bei
--     Material) employee_id = eigener Mitarbeiter, Projekt in eigener Firma.
--   - UPDATE/DELETE nur auf eigene Zeilen.
--
-- Kein USING(true); Zugriff strikt firmengebunden (docs/SECURITY_RULES.md).

-- =====================================================================
-- employee_material_usage
-- =====================================================================
DROP POLICY IF EXISTS "Employees can record their material usage" ON employee_material_usage;

-- Sichtbarkeit: firmenweit über das Projekt
CREATE POLICY "emu_select_company" ON employee_material_usage
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid())
    )
  );

-- Einfügen: nur eigene Attribution und Projekt der eigenen Firma
CREATE POLICY "emu_insert_self" ON employee_material_usage
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    AND project_id IN (
      SELECT id FROM projects
      WHERE company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid())
    )
  );

-- Ändern: nur eigene Einträge
CREATE POLICY "emu_update_own" ON employee_material_usage
  FOR UPDATE TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- Löschen: nur eigene Einträge
CREATE POLICY "emu_delete_own" ON employee_material_usage
  FOR DELETE TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- =====================================================================
-- project_comments
-- =====================================================================
-- Die bestehende SELECT-Policy "Users can view comments for their company
-- projects" bleibt unverändert (firmenweite Sichtbarkeit).
-- Nur die zu weit gefasste FOR-ALL-"manage"-Policy wird durch granulare
-- INSERT/UPDATE/DELETE-Policies ersetzt.
DROP POLICY IF EXISTS "Users can manage comments for their company projects" ON project_comments;

-- Einfügen: eigene Attribution + Projekt der eigenen Firma
CREATE POLICY "pc_insert_self" ON project_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON p.company_id = pr.company_id
      WHERE pr.id = auth.uid()
    )
  );

-- Ändern: nur eigene Notizen
CREATE POLICY "pc_update_own" ON project_comments
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Löschen: nur eigene Notizen
CREATE POLICY "pc_delete_own" ON project_comments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
