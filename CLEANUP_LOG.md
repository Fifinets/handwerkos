# HandwerkOS Cleanup Log

**Datum:** 2026-03-10

---

## Sicherheitsmassnahmen

### KRITISCH: .env-Dateien aus Git-Tracking entfernt
- `.env` — war in Git getrackt, jetzt entfernt (`git rm --cached`)
- `.env.production` — war in Git getrackt, jetzt entfernt (`git rm --cached`)
- `netlify.toml` — `[context.production.environment]` Section mit echten Keys entfernt
  - Entfernte Keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Sicherheitshinweise (SOFORT HANDELN)
1. **Supabase ANON KEY rotieren** — der Key war in netlify.toml im Klartext und damit in der Git-History
   - Supabase Dashboard → Project Settings → API → anon key regenerieren
2. **Supabase URL** bleibt gleich, aber nach Key-Rotation neue Werte in Netlify Environment Variables setzen
3. **Netlify Environment Variables konfigurieren** (anstatt Keys in netlify.toml):
   - `VITE_SUPABASE_URL` = deine Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = neuer anon key nach Rotation
4. **Git History bereinigen** (optional, aber empfohlen):
   - `git filter-branch` oder `git-filter-repo` um Keys aus der gesamten History zu entfernen

---

## Geloeschte Dateien

### Legacy Module (src/components/)
- `src/components/AppSidebar.tsx` — ersetzt durch AppSidebarV2
- `src/components/ExecutiveDashboard.tsx` — legacy dashboard
- `src/components/CustomerModule.tsx` — legacy modul
- `src/components/ProjectModule.tsx` — legacy modul
- `src/components/PersonalModule.tsx` — legacy modul
- `src/components/MaterialModule.tsx` — legacy modul
- `src/components/FinanceModule.tsx` — legacy modul
- `src/components/PlannerModule.tsx` — legacy modul
- `src/components/TimeTrackingModule.tsx` — legacy modul
- `src/components/OfferModule.tsx` — legacy modul
- `src/components/EmailModule.tsx` — legacy modul
- `src/components/EmailModuleBroken.tsx` — broken/legacy
- `src/components/EmailModuleModern.tsx` — legacy modul
- `src/components/EmailModuleOld.tsx` — legacy modul

### Legacy Pages (src/pages/)
- `src/pages/Index.tsx` — ersetzt durch IndexV2 (Route /manager redirectet auf /manager2)
- `src/pages/Index_backup.tsx` — backup, nicht mehr benoetigt

### Debug-/Temp-Dateien (Root)
- `error.txt`
- `push_error.txt`
- `push_out.txt`
- `push_out2.txt`
- `push_out3.txt`
- `db_help.txt`
- `list.txt`
- `test-dark.html`
- `debug-dark-mode.html`
- `create_logo_variants.html`
- `migration_list_output.txt`
- `create_customer.mjs`
- `apply-sql.js`
- `critical-logic-fixes.md`
- `critical-security-fix-steps.md`
- `security-fix-steps.md`
- `temp_handwerkos_files.txt`

---

## Verschobene Dateien

### SQL-Dateien → supabase/archive/
(Keine exakten Entsprechungen in supabase/migrations/ gefunden — archiviert statt geloescht)
- `add_hourly_wage_to_employees.sql` → `supabase/archive/`
- `add_vacation_system.sql` → `supabase/archive/`
- `add_vacation_system_final.sql` → `supabase/archive/`
- `fix_customer_rls.sql` → `supabase/archive/`
- `fix_employee_invitations_security.sql` → `supabase/archive/`
- `fix_security_issues.sql` → `supabase/archive/`

---

## Geaenderte Dateien

### netlify.toml
- `[context.production.environment]` Section entfernt (enthielt echte API Keys)

### .gitignore
- Eintraege hinzugefuegt: `.env`, `.env.*`, `!.env.example`
- Debug/Temp-Patterns hinzugefuegt
- Backup-Verzeichnisse hinzugefuegt

### package.json
- `name` von `vite_react_shadcn_ts` zu `handwerkos` umbenannt
- Echo-only Scripts entfernt: `worker`, `api:test`, `api:docs`, `export:datev`, `backup:db`, `audit:compliance`
- `test` Script auf `vitest` gesetzt (war placeholder echo)
- `db:seed` vereinfacht

### src/App.tsx
- Toten Import `import Index from "./pages/Index"` entfernt

---

## Naechste Schritte

1. **SOFORT: Supabase Keys rotieren** (siehe Sicherheitshinweise oben)
2. **Netlify Environment Variables setzen** mit neuen Keys
3. **Git History bereinigen** mit `git-filter-repo` um alte Keys aus History zu loeschen
4. **IndexV2 pruefen** — ist die aktive Manager-App, sicherstellen dass alle Module korrekt eingebunden sind
5. **supabase/archive/ pruefen** — SQL-Dateien koennen geloescht werden wenn die Inhalte bereits in Migrations enthalten sind
6. **TypeScript Build pruefen** — `npm run typecheck` nach dem Cleanup ausfuehren
7. **.env.example aktuell halten** — alle neuen Environment-Variablen dort als Platzhalter dokumentieren
