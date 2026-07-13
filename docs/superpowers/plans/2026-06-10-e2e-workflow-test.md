# E2E-Workflow-Test (Angebot → Rechnung) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playwright-E2E-Suite, die den kompletten Happy-Path Kunde → Angebot → Annahme/Projekt → Zeiterfassung+Lieferschein (Mitarbeiter) → Baustellendoku → Rechnung gegen eine lokale Supabase-Instanz testet.

**Architecture:** Playwright mit eigenem `e2e/`-Ordner neben den Vitest-Tests. `global-setup.ts` seedet pro Lauf eine frische Firma + Manager- und Mitarbeiter-User über die lokale Admin-API (Keys zur Laufzeit aus `npx supabase status`, nichts hardcoded). Ein Setup-Projekt loggt beide Rollen per UI ein und cached die Sessions als `storageState`. Der Workflow-Test läuft seriell mit zwei Browser-Contexts; End-Assertions prüfen die Datenkette per Admin-Client direkt in der DB.

**Tech Stack:** @playwright/test, @supabase/supabase-js (Admin-Client), lokale Supabase (CLI), Vite-Dev-Server (Port 8080).

**Spec:** `docs/superpowers/specs/2026-06-10-e2e-workflow-test-design.md`

**Abweichungen von der Spec (begründet, beim Implementieren beibehalten):**
1. **Lieferschein erstellt der Mitarbeiter, nicht der Manager.** Die App führt den Mitarbeiter nach „Zeit erfassen" direkt in den Lieferschein-Dialog („Zeit gespeichert → Lieferschein erstellen?", `DesktopEmployeePage.tsx:1213-1236`). Der Test folgt der echten App-Führung; das deckt Spec-Schritt 5+7 in einem natürlichen Flow ab.
2. **„Rechnung finalisieren"** = Rechnungserstellung mit Nummernvergabe. Es gibt keinen separaten Festschreibe-Button in der UI (geprüft: kein „Finalisieren"/„Festschreiben" in `src/components`). Assertion: Rechnung existiert mit `invoice_number` + korrektem Betrag.

---

## Verifizierte Codebase-Fakten (Grundlage aller Selektoren)

| Was | Wo | Detail |
|---|---|---|
| Login-Form | `src/pages/Auth.tsx` | Inputs `#email`, `#password`, Submit-Button „Jetzt anmelden", danach `navigate('/manager2')` |
| Manager-App | Route `/manager2` → `IndexV2` | Module Kunden/Angebote/Projekte über interne Navigation |
| Kunde anlegen | `CustomerModuleV2.tsx:118` Button „Neuer Kunde" → `AddCustomerDialog.tsx` | Pflichtfelder: `#company_name` („Firmenname *"), `#email` („E-Mail *"); Submit „Kunde hinzufügen" (Zeile 507) |
| Angebots-Editor | Route `/offers/new/edit` → `OfferEditorPage.tsx` | Annehmen über Menüpunkt „Annehmen (Projekt erstellen)" (Zeile 483) |
| Annahme-Logik | `offerService.acceptOffer` (`offerService.ts:543`) | **Verlangt `targets.planned_hours_total > 0` und `targets.target_end_date`**, ruft RPC `accept_offer_and_create_project`, gibt `projectId` zurück |
| Mitarbeiter-Ansicht | Route `/employee` → `DesktopEmployeePage.tsx` | Tabs: dashboard, projects, delivery-notes, timesheet, vacation, profile |
| Projekt-Sichtbarkeit Mitarbeiter | `DesktopEmployeePage.tsx:206` | Über Tabelle `project_team_assignments` (Spalten `project_id`, `employee_id`) — **Manager muss zuweisen** |
| Zeit erfassen | `DesktopEmployeePage.tsx:1152-1211` | Dialog „Zeit erfassen": Select „Projekt wählen...", Inputs Datum/Von/Bis/Pause (Label „Datum", „Von", „Bis", „Pause (min)"), Textarea „Was wurde gemacht?", Button „Speichern & weiter" → insert in `time_entries` |
| Lieferschein-Prompt | `DesktopEmployeePage.tsx:1213-1236` | Nach Speichern: Dialog „Zeit gespeichert" mit Button „Lieferschein erstellen" → `DeliveryNoteForm` |
| Baustellendoku | `SiteDocModule` in `ProjectDetailView.tsx:1225` | Tabelle `site_documentation_entries`, Storage-Bucket `site-documentation` |
| Rechnung aus Projekt | `CreateInvoiceFromProjectDialog` in `ProjectDetailView.tsx:1410` | 2-Schritt-Dialog: Quellen wählen (Angebote/Lieferscheine/Zeiten) → Button „Rechnung erstellen" (Zeile 1349) |
| Seed-Schema | `supabase/setup_user.sql` | `companies(name)` → `profiles(id, first_name, last_name, company_id)` (upsert!, Trigger kann Profil schon angelegt haben) → `user_roles(user_id, role)` mit role `manager`/`employee` → `employees(user_id, company_id, first_name, last_name, email, position, status='active')` |
| Env-Variablen Frontend | `src/integrations/supabase/client.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; bereits gesetzte Prozess-Env-Vars haben in Vite Vorrang vor `.env` |

**Arbeitsweise bei UI-Schritten:** Die Selektoren oben sind aus dem Code verifiziert. Für Stellen, die der Plan nicht zeilengenau kennt (IndexV2-Navigation, OfferEditorPage-Formular, Team-Tab, SiteDocModule-Form, DeliveryNoteForm), gilt: Schritt mit dem angegebenen Code schreiben, Test mit `npx playwright test --headed` (oder `--debug`) laufen lassen, bei Selector-Fehlschlag den tatsächlichen DOM prüfen (Playwright-Trace / Inspector) und den Selektor anpassen. Lässt sich ein Element nicht stabil über Rolle/Label/Text adressieren (z. B. mehrere gleichnamige Buttons), stattdessen ein `data-testid` an der Komponente ergänzen (laut Spec ausdrücklich erlaubt — minimal-invasiv, keine Logik-Änderung) und im selben Task committen. Das ist Teil des jeweiligen Tasks, kein separates Ticket.

## File Structure

```
playwright.config.ts                      # Config: webServer-Wrapper, globalSetup, Projekte setup→workflow
e2e/
  global-setup.ts                         # Seed: Firma, Manager, Mitarbeiter, Bucket; schreibt .auth/seed.json
  auth.setup.ts                           # UI-Login beider Rollen → storageState-Dateien
  workflow.spec.ts                        # Der serielle Happy-Path (2 Browser-Contexts)
  helpers/
    localSupabase.ts                      # Liest URL/Keys aus `npx supabase status -o env`
    seed.ts                               # Seed-Funktionen (Admin-Client)
    testData.ts                           # Typ + Laden von .auth/seed.json
  scripts/
    start-dev.mjs                         # Startet Vite mit lokalen Supabase-Env-Vars
  fixtures/
    site-photo.png                        # 1x1-PNG für Foto-Upload
  .auth/                                  # (gitignored) seed.json, manager.json, employee.json
package.json                              # + test:e2e, test:e2e:headed; devDep @playwright/test
.gitignore                                # + e2e/.auth/, playwright-report/, test-results/
CLAUDE.md                                 # Commands-Abschnitt um test:e2e ergänzen
```

---

### Task 1: Lokale Supabase verifizieren (Gate)

Ohne laufende lokale Instanz mit sauber angewendeten Migrationen ist alles Weitere sinnlos. Dieser Task produziert keinen Code, nur Gewissheit.

**Files:** keine

- [ ] **Step 1: Docker & Supabase starten**

Run: `npx supabase start`
Expected: Endet mit Ausgabe der lokalen URLs/Keys (`API URL: http://127.0.0.1:54321` …). Falls Docker nicht läuft: Docker Desktop starten, erneut versuchen.

- [ ] **Step 2: Migrationen frisch anwenden**

Run: `npx supabase db reset`
Expected: Alle Migrationen aus `supabase/migrations/` laufen durch, Ende mit `Finished supabase db reset`.

**Falls eine Migration fehlschlägt:** Fehlermeldung + Migrationsdatei notieren, Migration minimal-invasiv fixen (idempotent machen / fehlende Voraussetzung ergänzen), `npx supabase db reset` wiederholen. Fix als eigener Commit (`fix: make migration <name> run on fresh local db`). Erst weitermachen, wenn reset grün ist.

- [ ] **Step 3: Status-Ausgabe prüfen (Format für Parser)**

Run: `npx supabase status -o env`
Expected: Zeilen der Form `API_URL="http://127.0.0.1:54321"`, `ANON_KEY="eyJ…"`, `SERVICE_ROLE_KEY="eyJ…"`. Exakte Variablennamen notieren — der Parser in Task 3 muss dazu passen (neuere CLI-Versionen nutzen ggf. `SERVICE_ROLE_KEY` vs. andere Namen).

---

### Task 2: Playwright installieren + Grundgerüst

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `e2e/scripts/start-dev.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Dependencies installieren**

Run: `npm install -D @playwright/test && npx playwright install chromium`
Expected: Beide Befehle erfolgreich; Chromium-Browser heruntergeladen.

- [ ] **Step 2: Dev-Server-Wrapper schreiben**

`e2e/scripts/start-dev.mjs` — startet Vite mit Env-Vars der lokalen Supabase (Prozess-Env schlägt `.env`-Datei):

```js
// Startet den Vite-Dev-Server gegen die lokale Supabase-Instanz.
// Liest URL + anon key zur Laufzeit aus `supabase status` — keine Keys im Repo.
import { execSync, spawn } from 'node:child_process';

function readLocalSupabaseEnv() {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
  const vars = {};
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z_]+)="(.*)"\s*$/);
    if (m) vars[m[1]] = m[2];
  }
  if (!vars.API_URL || !vars.ANON_KEY) {
    throw new Error('Lokale Supabase läuft nicht? `npx supabase start` ausführen. Ausgabe war:\n' + out);
  }
  return vars;
}

const env = readLocalSupabaseEnv();
const child = spawn('npx', ['vite', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_SUPABASE_URL: env.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: env.ANON_KEY,
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
```

- [ ] **Step 3: Playwright-Config schreiben**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'de-DE',
  },
  webServer: {
    command: 'node e2e/scripts/start-dev.mjs',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'workflow', testMatch: /workflow\.spec\.ts/, dependencies: ['setup'] },
  ],
});
```

- [ ] **Step 4: npm-Scripts + .gitignore**

In `package.json` unter `scripts` ergänzen:

```json
"test:e2e": "playwright test",
"test:e2e:headed": "playwright test --headed"
```

In `.gitignore` ergänzen:

```
e2e/.auth/
playwright-report/
test-results/
```

- [ ] **Step 5: Verifizieren, dass Playwright lauffähig ist**

Run: `npx playwright test --list`
Expected: Läuft ohne Fehler durch (noch 0 Tests gefunden ist OK; sobald global-setup existiert, darf dieser Befehl nicht crashen — global-setup wird bei `--list` nicht ausgeführt).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e/scripts/start-dev.mjs .gitignore
git commit -m "feat(e2e): add Playwright setup with local-supabase dev server wrapper"
```

---

### Task 3: Supabase-Helper + Seed-Logik

**Files:**
- Create: `e2e/helpers/localSupabase.ts`
- Create: `e2e/helpers/seed.ts`
- Create: `e2e/helpers/testData.ts`

- [ ] **Step 1: Env-Reader schreiben**

`e2e/helpers/localSupabase.ts`:

```ts
import { execSync } from 'node:child_process';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface LocalSupabaseEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function readLocalSupabaseEnv(): LocalSupabaseEnv {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
  const vars: Record<string, string> = {};
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z_]+)="(.*)"\s*$/);
    if (m) vars[m[1]] = m[2];
  }
  const apiUrl = vars.API_URL;
  const anonKey = vars.ANON_KEY;
  const serviceRoleKey = vars.SERVICE_ROLE_KEY;
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Lokale Supabase-Keys nicht gefunden — läuft `npx supabase start`? Gefundene Variablen: ' +
        Object.keys(vars).join(', ')
    );
  }
  return { apiUrl, anonKey, serviceRoleKey };
}

export function createAdminClient(env = readLocalSupabaseEnv()): SupabaseClient {
  return createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

**Hinweis:** Falls Task 1 Step 3 andere Variablennamen ergab (CLI-Version!), hier anpassen.

- [ ] **Step 2: Seed-Datenstruktur definieren**

`e2e/helpers/testData.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SeedUser {
  email: string;
  password: string;
  userId: string;
  employeeId: string; // id in public.employees
}

export interface SeedData {
  runId: string;
  companyId: string;
  companyName: string;
  manager: SeedUser;
  employee: SeedUser;
}

export const AUTH_DIR = join(__dirname, '..', '.auth');
export const SEED_FILE = join(AUTH_DIR, 'seed.json');
export const MANAGER_STATE = join(AUTH_DIR, 'manager.json');
export const EMPLOYEE_STATE = join(AUTH_DIR, 'employee.json');

export function loadSeed(): SeedData {
  return JSON.parse(readFileSync(SEED_FILE, 'utf8'));
}
```

- [ ] **Step 3: Seed-Funktion schreiben**

`e2e/helpers/seed.ts`:

```ts
import { SupabaseClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AUTH_DIR, SEED_FILE, SeedData, SeedUser } from './testData';

const PASSWORD = 'E2e-Test-Passwort-1!';

async function createUser(
  admin: SupabaseClient,
  opts: {
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    role: 'manager' | 'employee';
    position: string;
  }
): Promise<SeedUser> {
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: opts.email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userErr || !created.user) throw new Error(`auth.createUser ${opts.email}: ${userErr?.message}`);
  const userId = created.user.id;

  // Profil kann durch DB-Trigger schon existieren → upsert (Muster aus supabase/setup_user.sql)
  const { error: profErr } = await admin.from('profiles').upsert({
    id: userId,
    email: opts.email,
    first_name: opts.firstName,
    last_name: opts.lastName,
    company_id: opts.companyId,
  });
  if (profErr) throw new Error(`profiles upsert: ${profErr.message}`);

  const { error: roleErr } = await admin
    .from('user_roles')
    .upsert({ user_id: userId, role: opts.role }, { onConflict: 'user_id' });
  if (roleErr) throw new Error(`user_roles upsert: ${roleErr.message}`);

  const { data: emp, error: empErr } = await admin
    .from('employees')
    .insert({
      user_id: userId,
      company_id: opts.companyId,
      first_name: opts.firstName,
      last_name: opts.lastName,
      email: opts.email,
      position: opts.position,
      status: 'active',
    })
    .select('id')
    .single();
  if (empErr || !emp) throw new Error(`employees insert: ${empErr?.message}`);

  return { email: opts.email, password: PASSWORD, userId, employeeId: emp.id };
}

export async function seedTestEnvironment(admin: SupabaseClient): Promise<SeedData> {
  const runId = Date.now().toString();
  const companyName = `E2E Test GmbH ${runId}`;

  const { data: company, error: compErr } = await admin
    .from('companies')
    .insert({ name: companyName })
    .select('id')
    .single();
  if (compErr || !company) throw new Error(`companies insert: ${compErr?.message}`);

  const manager = await createUser(admin, {
    email: `e2e-manager-${runId}@test.local`,
    firstName: 'Eva',
    lastName: 'Managerin',
    companyId: company.id,
    role: 'manager',
    position: 'Geschäftsführung',
  });

  const employee = await createUser(admin, {
    email: `e2e-monteur-${runId}@test.local`,
    firstName: 'Max',
    lastName: 'Monteur',
    companyId: company.id,
    role: 'employee',
    position: 'Monteur',
  });

  // Storage-Bucket für Baustellendoku sicherstellen (existiert ggf. schon via Migration)
  const { error: bucketErr } = await admin.storage.createBucket('site-documentation', { public: false });
  if (bucketErr && !/already exists/i.test(bucketErr.message)) {
    throw new Error(`createBucket site-documentation: ${bucketErr.message}`);
  }

  const seed: SeedData = { runId, companyId: company.id, companyName, manager, employee };
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
  return seed;
}
```

**Hinweis:** Falls `user_roles` keinen Unique-Constraint auf `user_id` hat, schlägt `onConflict: 'user_id'` fehl → dann einfaches `insert` verwenden. Falls Spalten abweichen (z. B. `profiles` ohne `email`-Spalte): Fehlermeldung lesen, Spalte weglassen — Schema-Wahrheit ist `src/types/database.ts`.

- [ ] **Step 4: Seed isoliert testen (Smoke via Node)**

Run: `npx tsx -e "import('./e2e/helpers/localSupabase').then(async m => { const a = m.createAdminClient(); const s = await (await import('./e2e/helpers/seed')).seedTestEnvironment(a); console.log(JSON.stringify(s, null, 2)); })"` — falls `tsx` nicht installiert: `npm i -D tsx` (oder den Test in Step 5 von Task 4 integrieren und hier überspringen).
Expected: JSON mit companyId + zwei Usern; `e2e/.auth/seed.json` existiert.

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers/
git commit -m "feat(e2e): add local supabase env reader and test data seeding"
```

---

### Task 4: global-setup + Login-Setup (storageState)

**Files:**
- Create: `e2e/global-setup.ts`
- Create: `e2e/auth.setup.ts`

- [ ] **Step 1: global-setup schreiben**

`e2e/global-setup.ts`:

```ts
import { createAdminClient } from './helpers/localSupabase';
import { seedTestEnvironment } from './helpers/seed';

export default async function globalSetup() {
  const admin = createAdminClient();
  const seed = await seedTestEnvironment(admin);
  console.log(`[e2e] Seeded company "${seed.companyName}" (${seed.companyId})`);
  console.log(`[e2e] Manager: ${seed.manager.email} / Mitarbeiter: ${seed.employee.email}`);
}
```

- [ ] **Step 2: Login-Setup-Spec schreiben**

`e2e/auth.setup.ts`:

```ts
import { test as setup, expect, Page } from '@playwright/test';
import { loadSeed, MANAGER_STATE, EMPLOYEE_STATE } from './helpers/testData';

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Jetzt anmelden' }).click();
  // Auth.tsx navigiert nach Login immer nach /manager2
  await page.waitForURL('**/manager2', { timeout: 20_000 });
}

setup('login manager', async ({ page }) => {
  const seed = loadSeed();
  await login(page, seed.manager.email, seed.manager.password);
  await page.context().storageState({ path: MANAGER_STATE });
});

setup('login employee', async ({ page }) => {
  const seed = loadSeed();
  await login(page, seed.employee.email, seed.employee.password);
  // Mitarbeiter arbeitet unter /employee — Session gilt domainweit
  await page.goto('/employee');
  await expect(page.getByText('Wird geladen...').first()).toBeHidden({ timeout: 15_000 });
  await page.context().storageState({ path: EMPLOYEE_STATE });
});
```

- [ ] **Step 3: Setup-Projekt laufen lassen**

Run: `npx playwright test --project=setup`
Expected: 2 passed. Dabei startet der webServer (Vite gegen lokale Supabase) automatisch. Bei Fehlschlag: `npx playwright test --project=setup --headed` und beobachten — typische Ursachen: Login-Redirect anders (URL prüfen), E-Mail-Bestätigung (Seed nutzt `email_confirm: true`, sollte nicht auftreten), RLS-Fehler beim Profil-Load (Seed-Daten gegen `src/types/database.ts` prüfen).

- [ ] **Step 4: Commit**

```bash
git add e2e/global-setup.ts e2e/auth.setup.ts
git commit -m "feat(e2e): seed on global setup and cache role sessions via storageState"
```

---

### Task 5: Workflow-Spec Teil 1 — Kunde anlegen (Manager)

Ab hier wächst `e2e/workflow.spec.ts` Task für Task. Grundgerüst + erster Schritt.

**Files:**
- Create: `e2e/workflow.spec.ts`
- Create: `e2e/fixtures/site-photo.png`

- [ ] **Step 1: Foto-Fixture erzeugen**

Run: `node -e "require('fs').mkdirSync('e2e/fixtures',{recursive:true}); require('fs').writeFileSync('e2e/fixtures/site-photo.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'))"`
Expected: `e2e/fixtures/site-photo.png` existiert (1×1-PNG, 70 Bytes).

- [ ] **Step 2: Spec-Grundgerüst + Schritt „Kunde anlegen"**

`e2e/workflow.spec.ts`:

```ts
import { test, expect, Page, BrowserContext } from '@playwright/test';
import { loadSeed, MANAGER_STATE, EMPLOYEE_STATE, SeedData } from './helpers/testData';
import { createAdminClient } from './helpers/localSupabase';

// Ein durchgängiger Geschäftsprozess — Schritte bauen aufeinander auf.
test.describe.configure({ mode: 'serial' });
test.describe('Workflow: Angebot → Projekt → Zeit/Doku → Lieferschein → Rechnung', () => {
  let seed: SeedData;
  let manager: Page;
  let employeeCtx: BrowserContext;
  let employee: Page;

  // Im Test erzeugte Geschäftsdaten
  const runTag = Date.now().toString().slice(-6);
  const customerName = `E2E Kunde GmbH ${runTag}`;
  const offerTitle = `E2E Elektroinstallation ${runTag}`;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    seed = loadSeed();
    const managerCtx = await browser.newContext({ storageState: MANAGER_STATE });
    manager = await managerCtx.newPage();
    employeeCtx = await browser.newContext({ storageState: EMPLOYEE_STATE });
    employee = await employeeCtx.newPage();
  });

  test('Schritt 1: Manager legt Kunden an', async () => {
    await manager.goto('/manager2');
    // Zum Kunden-Modul navigieren (Navigationseintrag „Kunden" in IndexV2)
    await manager.getByRole('button', { name: 'Kunden' }).or(manager.getByRole('link', { name: 'Kunden' })).first().click();
    await manager.getByRole('button', { name: 'Neuer Kunde' }).click();

    await manager.locator('#company_name').fill(customerName);
    await manager.locator('#email').fill(`kunde-${runTag}@test.local`);
    await manager.getByRole('button', { name: 'Kunde hinzufügen' }).click();

    // Kunde erscheint in der Liste
    await expect(manager.getByText(customerName).first()).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 3: Laufen lassen + Selektoren festziehen**

Run: `npx playwright test --project=workflow --headed`
Expected: Schritt 1 grün. Falls die Kunden-Navigation anders heißt/aufgebaut ist (IndexV2 wurde nicht zeilengenau verifiziert): Trace/Inspector nutzen, Selektor anpassen. Falls `AddCustomerDialog` weitere Pflichtfelder verlangt: Fehlermeldung im Dialog lesen, Felder ergänzen.

- [ ] **Step 4: Commit**

```bash
git add e2e/workflow.spec.ts e2e/fixtures/site-photo.png
git commit -m "feat(e2e): workflow step 1 — manager creates customer"
```

---

### Task 6: Workflow Teil 2 — Angebot erstellen mit Positionen + Targets

**Files:**
- Modify: `e2e/workflow.spec.ts`

- [ ] **Step 1: Vorab den Editor lesen**

`src/pages/offers/OfferEditorPage.tsx` (und ggf. dort verwendete Komponenten wie `OfferSidebar`) gezielt lesen: Wie heißen die Felder für **Kunde**, **Titel**, **Positionen** (Beschreibung/Menge/Einzelpreis) und die **Targets** („geplante Stunden", „Ziel-Enddatum" — Pflicht für Annahme, siehe `offerService.ts:560-572`)? Wie heißt der Speichern-Button? Selektoren im nächsten Step entsprechend konkretisieren.

- [ ] **Step 2: Test-Schritt anfügen**

In `workflow.spec.ts` ergänzen (Selektoren ggf. nach Step 1 angepasst):

```ts
  test('Schritt 2: Manager erstellt Angebot mit Position und Targets', async () => {
    await manager.goto('/offers/new/edit');

    // Kunde zuordnen
    await manager.getByRole('combobox').filter({ hasText: /Kunde/i }).first().click();
    await manager.getByRole('option', { name: customerName }).click();

    // Titel
    await manager.getByLabel(/Titel|Betreff/i).first().fill(offerTitle);

    // Position hinzufügen: 8h Elektroinstallation à 95 €
    await manager.getByRole('button', { name: /Position/i }).first().click();
    const row = manager.locator('[data-offer-item], tr, .offer-item').last();
    await row.getByPlaceholder(/Beschreibung|Bezeichnung/i).fill('Elektroinstallation Unterverteilung');
    await row.getByLabel(/Menge/i).fill('8');
    await row.getByLabel(/Preis|Einzelpreis/i).fill('95');

    // Targets — Pflicht für Annahme (offerService.acceptOffer)
    await manager.getByLabel(/[Gg]eplante Stunden/i).fill('8');
    await manager.getByLabel(/Ziel-?Enddatum/i).fill(
      new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10)
    );

    // Speichern
    await manager.getByRole('button', { name: /Speichern/i }).first().click();
    await manager.waitForURL(/\/offers\/[0-9a-f-]{36}\/edit/, { timeout: 20_000 });

    // Angebotssumme sichtbar (8 × 95 = 760 netto)
    await expect(manager.getByText(/760/).first()).toBeVisible();
  });
```

- [ ] **Step 3: Laufen lassen + festziehen**

Run: `npx playwright test --project=workflow --headed`
Expected: Schritte 1–2 grün. Das Angebotsformular ist die wahrscheinlichste Stelle für Selektor-Anpassungen — Zeit dafür einplanen, Trace nutzen. Wichtig: Am Ende muss die URL eine echte Offer-UUID enthalten (Beleg, dass gespeichert wurde).

- [ ] **Step 4: Commit**

```bash
git add e2e/workflow.spec.ts
git commit -m "feat(e2e): workflow step 2 — create offer with item and targets"
```

---

### Task 7: Workflow Teil 3 — Angebot annehmen → Projekt entsteht, Mitarbeiter zuweisen

**Files:**
- Modify: `e2e/workflow.spec.ts`

- [ ] **Step 1: Annahme-Schritt anfügen**

```ts
  test('Schritt 3: Manager nimmt Angebot an — Projekt entsteht', async () => {
    // Aktionsmenü im Editor öffnen (Menüpunkt aus OfferEditorPage.tsx:483)
    await manager.getByRole('button', { name: /Aktionen|Mehr|⋮/i }).first().click()
      .catch(async () => {
        // Fallback: generischer Menü-Trigger (DropdownMenu)
        await manager.locator('[data-state][aria-haspopup="menu"]').last().click();
      });
    await manager.getByRole('menuitem', { name: 'Annehmen (Projekt erstellen)' }).click();

    // Annahme bestätigt: Status/Erfolgsmeldung abwarten
    await expect(
      manager.getByText(/[Aa]ngenommen|Projekt.*erstellt/).first()
    ).toBeVisible({ timeout: 20_000 });

    // Projekt-ID aus der DB holen (robuster als UI-Parsing)
    const admin = createAdminClient();
    const { data: projects } = await admin
      .from('projects')
      .select('id, name, status')
      .eq('company_id', seed.companyId)
      .order('created_at', { ascending: false })
      .limit(1);
    expect(projects?.length, 'Projekt wurde durch Annahme erstellt').toBe(1);
    projectId = projects![0].id;
  });

  test('Schritt 4: Mitarbeiter wird dem Projekt zugewiesen', async () => {
    // Bevorzugt über die UI (ProjectDetailView → Team). Falls dort keine
    // Zuweisungs-UI existiert, ist der Admin-Insert der dokumentierte Fallback —
    // die Sichtbarkeit beim Mitarbeiter (Schritt 5) bleibt der echte Beweis.
    const admin = createAdminClient();
    const { error } = await admin.from('project_team_assignments').insert({
      project_id: projectId,
      employee_id: seed.employee.employeeId,
    });
    expect(error, `Zuweisung fehlgeschlagen: ${error?.message}`).toBeNull();
  });
```

- [ ] **Step 2: UI-Zuweisung prüfen (Soll-Weg)**

`ProjectDetailView.tsx` nach einer Team-/Mitarbeiter-Zuweisungs-UI durchsuchen (`Grep: Team|Mitarbeiter zuweisen|team_assignments` in `src/components/ProjectDetailView.tsx` und `src/components/project-detail/`). **Wenn vorhanden:** Schritt 4 auf UI-Bedienung umschreiben (Projekt öffnen → Team-Tab → Mitarbeiter wählen) und Admin-Insert entfernen. **Wenn nicht vorhanden:** Admin-Insert bleibt, mit Kommentar im Test.

- [ ] **Step 3: Laufen lassen**

Run: `npx playwright test --project=workflow --headed`
Expected: Schritte 1–4 grün. Falls der Annehmen-Menüpunkt woanders sitzt (z. B. erst nach „Versenden" sichtbar): `acceptOffer` erlaubt `draft` **und** `sent` (offerService.ts:551) — der Menüpunkt muss für Entwürfe da sein; sonst Trace prüfen, wo der Eintrag hängt.

- [ ] **Step 4: Commit**

```bash
git add e2e/workflow.spec.ts
git commit -m "feat(e2e): workflow steps 3-4 — accept offer creates project, assign employee"
```

---

### Task 8: Workflow Teil 4 — Mitarbeiter erfasst Zeit + erstellt Lieferschein

Selektoren hier sind aus `DesktopEmployeePage.tsx:1152-1236` verifiziert.

**Files:**
- Modify: `e2e/workflow.spec.ts`

- [ ] **Step 1: Test-Schritt anfügen**

```ts
  test('Schritt 5: Mitarbeiter erfasst Zeit und erstellt Lieferschein', async () => {
    await employee.goto('/employee');

    // Projekt ist durch Zuweisung sichtbar — Dashboard/Projekte-Tab laden lassen
    await expect(employee.getByText('Wird geladen...').first()).toBeHidden({ timeout: 15_000 });

    // „Zeit erfassen"-Dialog öffnen (Button existiert auf Dashboard UND Timesheet-Tab)
    await employee.getByRole('button', { name: 'Zeit erfassen' }).first().click();
    const dialog = employee.getByRole('dialog').filter({ hasText: 'Zeit erfassen' });

    // Projekt wählen (Radix-Select)
    await dialog.getByRole('combobox').first().click();
    await employee.getByRole('option', { name: offerTitle }).first().click()
      .catch(async () => {
        // Projektname kann vom Angebotstitel abweichen — erstes Projekt nehmen
        await employee.getByRole('option').first().click();
      });

    // Von / Bis / Beschreibung (Datum ist mit heute vorbelegt)
    await dialog.locator('input[type="time"]').nth(0).fill('08:00');
    await dialog.locator('input[type="time"]').nth(1).fill('16:30');
    await dialog.getByPlaceholder('Was wurde gemacht?').fill('UV montiert, Leitungen gezogen (E2E)');
    await dialog.getByRole('button', { name: 'Speichern & weiter' }).click();

    // Built-in Folge-Prompt: „Zeit gespeichert → Lieferschein erstellen?"
    const prompt = employee.getByRole('dialog').filter({ hasText: 'Zeit gespeichert' });
    await expect(prompt).toBeVisible({ timeout: 15_000 });
    await prompt.getByRole('button', { name: 'Lieferschein erstellen' }).click();

    // DeliveryNoteForm: minimal ausfüllen und speichern (Selektoren live verifizieren)
    const dnForm = employee.getByRole('dialog').last();
    await dnForm.getByRole('button', { name: /Speichern|Erstellen|Anlegen/i }).first().click();
    await expect(employee.getByRole('dialog').filter({ hasText: 'Zeit erfassen' })).toBeHidden();
  });
```

- [ ] **Step 2: DeliveryNoteForm lesen + festziehen**

`src/components/delivery-notes/DeliveryNoteForm.tsx` lesen: Pflichtfelder? Speichern-Button-Text? Test-Code entsprechend präzisieren (Ziel: Lieferschein mit `project_id` = unser Projekt entsteht).

- [ ] **Step 3: Laufen lassen**

Run: `npx playwright test --project=workflow --headed`
Expected: Schritte 1–5 grün. DB-Gegenprobe macht Task 10; hier reicht UI-Erfolg (Dialog zu, kein Fehler-Toast).

- [ ] **Step 4: Commit**

```bash
git add e2e/workflow.spec.ts
git commit -m "feat(e2e): workflow step 5 — employee logs time and creates delivery note"
```

---

### Task 9: Workflow Teil 5 — Baustellendoku + Rechnung

**Files:**
- Modify: `e2e/workflow.spec.ts`

- [ ] **Step 1: SiteDocModule lesen**

`src/components/site-docs/SiteDocModule.tsx` + `SiteDocEntryCard.tsx` lesen: Wie öffnet sich das Modul in `ProjectDetailView` (Tab-Name?), wie legt man einen Text-Eintrag an, wo ist der Foto-Upload (`input[type=file]`)? Außerdem klären, wie man vom Projekte-Modul in die `ProjectDetailView` kommt (Projektzeile klicken?). Selektoren in Step 2 konkretisieren.

- [ ] **Step 2: Doku-Schritt anfügen**

```ts
  test('Schritt 6: Baustellendoku mit Notiz und Foto', async () => {
    // Projekt-Detail öffnen
    await manager.goto('/manager2');
    await manager.getByRole('button', { name: 'Projekte' }).or(manager.getByRole('link', { name: 'Projekte' })).first().click();
    await manager.getByText(offerTitle).first().click()
      .catch(async () => {
        await manager.locator('table tbody tr, [data-project-card]').first().click();
      });

    // Doku-Tab im Projekt (Tab-Name nach Step 1 anpassen, z. B. „Doku"/„Baustellendoku")
    await manager.getByRole('tab', { name: /Doku/i }).first().click();

    // Notiz-Eintrag + Foto
    await manager.getByRole('button', { name: /Eintrag|Notiz|Hinzufügen/i }).first().click();
    await manager.getByRole('textbox').last().fill('Baufortschritt dokumentiert (E2E): UV fertig montiert.');
    await manager.locator('input[type="file"]').setInputFiles('e2e/fixtures/site-photo.png');
    await manager.getByRole('button', { name: /Speichern/i }).first().click();

    await expect(manager.getByText(/Baufortschritt dokumentiert/).first()).toBeVisible({ timeout: 15_000 });
  });
```

**Falls der Foto-Upload lokal an Storage-RLS scheitert:** Foto-Teil in einen `try/catch` mit Notiz-only-Fallback setzen und das als bekannte Lücke in den Testkommentar schreiben — Notiz-Eintrag bleibt Pflicht-Assertion.

- [ ] **Step 3: Rechnungs-Schritt anfügen**

```ts
  test('Schritt 7: Manager erstellt Rechnung aus dem Projekt', async () => {
    // Im Projekt-Detail: Dialog öffnen (Button-Name live prüfen, z. B. „Rechnung erstellen")
    await manager.getByRole('button', { name: /Rechnung/i }).first().click();
    const dialog = manager.getByRole('dialog').filter({ hasText: 'Rechnung erstellen' });
    await expect(dialog).toBeVisible();

    // Schritt „Quellen wählen": alles übernehmen (Angebot, Lieferschein, Zeiten)
    for (const name of [/Alle.*wählen|Alle übernehmen/i]) {
      const btns = dialog.getByRole('button', { name });
      const count = await btns.count();
      for (let i = 0; i < count; i++) await btns.nth(i).click();
    }

    // Weiter → erstellen (2-Schritt-Dialog, Button „Rechnung erstellen" CreateInvoiceFromProjectDialog:1349)
    await dialog.getByRole('button', { name: /Weiter|Vorschau/i }).click()
      .catch(() => {/* Dialog kann einstufig konfiguriert sein */});
    await dialog.getByRole('button', { name: 'Rechnung erstellen' }).click();

    await expect(dialog).toBeHidden({ timeout: 20_000 });
  });
```

- [ ] **Step 4: Laufen lassen + festziehen**

Run: `npx playwright test --project=workflow --headed`
Expected: Schritte 1–7 grün. Quellen-Auswahl-Buttons heißen laut Code „Alle wählen"-artig (`handleSelectAll` für offers/deliveryNotes/timeEntries, Zeilen 866/912/956) — exakten Text beim Lauf prüfen.

- [ ] **Step 5: Commit**

```bash
git add e2e/workflow.spec.ts
git commit -m "feat(e2e): workflow steps 6-7 — site documentation and invoice creation"
```

---

### Task 10: End-Assertions — die Datenkette als Beweis

**Files:**
- Modify: `e2e/workflow.spec.ts`

- [ ] **Step 1: Abschluss-Test anfügen**

```ts
  test('Schritt 8: Datenkette ist vollständig und konsistent', async () => {
    const admin = createAdminClient();

    // Angebot: angenommen
    const { data: offers } = await admin
      .from('offers').select('id, status, total_amount')
      .eq('company_id', seed.companyId);
    expect(offers?.length).toBe(1);
    expect(offers![0].status).toBe('accepted');

    // Projekt: existiert und gehört zur Firma
    const { data: project } = await admin
      .from('projects').select('id, status, customer_id')
      .eq('id', projectId).single();
    expect(project).not.toBeNull();

    // Zeiteintrag: 8,5h vom Mitarbeiter auf dem Projekt
    const { data: times } = await admin
      .from('time_entries').select('id, start_time, end_time, employee_id')
      .eq('project_id', projectId);
    expect(times?.length).toBeGreaterThanOrEqual(1);
    expect(times![0].employee_id).toBe(seed.employee.employeeId);

    // Baustellendoku: Eintrag vorhanden
    const { data: docs } = await admin
      .from('site_documentation_entries').select('id')
      .eq('project_id', projectId);
    expect(docs?.length).toBeGreaterThanOrEqual(1);

    // Lieferschein: vorhanden, mit Nummer
    const { data: notes } = await admin
      .from('delivery_notes').select('id, number, project_id')
      .eq('project_id', projectId);
    expect(notes?.length).toBeGreaterThanOrEqual(1);

    // Rechnung: vorhanden, nummeriert, Betrag plausibel (≥ Angebotsnetto 760)
    const { data: invoices } = await admin
      .from('invoices').select('id, invoice_number, amount, status')
      .eq('company_id', seed.companyId);
    expect(invoices?.length).toBe(1);
    expect(invoices![0].invoice_number, 'GoBD: Rechnungsnummer vergeben').toBeTruthy();
    expect(Number(invoices![0].amount)).toBeGreaterThanOrEqual(760);
  });
```

**Spaltennamen-Vorbehalt:** `total_amount`/`amount`/`number`/`invoice_number` vor dem Lauf gegen `src/types/database.ts` prüfen (Grep nach `delivery_notes: {`, `invoices: {`, `offers: {`) und exakt übernehmen — Konvention laut ARCHITECTURE_RULES ist `*_number`.

- [ ] **Step 2: Kompletten Lauf fahren**

Run: `npm run test:e2e`
Expected: `setup` (2 passed) + `workflow` (8 passed). Das ist der Abnahme-Lauf.

- [ ] **Step 3: Commit**

```bash
git add e2e/workflow.spec.ts
git commit -m "feat(e2e): end-to-end data chain assertions offer→invoice"
```

---

### Task 11: Doku + Aufräumen + Abschluss

**Files:**
- Modify: `CLAUDE.md`
- Create: `e2e/README.md`

- [ ] **Step 1: CLAUDE.md Commands ergänzen**

Im `## Commands`-Block nach der `npm run test`-Zeile einfügen:

```sh
npm run test:e2e     # Playwright E2E (braucht laufende lokale Supabase: npm run db:start)
```

- [ ] **Step 2: e2e/README.md schreiben**

```markdown
# E2E-Tests (Playwright)

Kompletter Workflow-Test: Kunde → Angebot → Annahme/Projekt → Zeiterfassung +
Lieferschein (Mitarbeiter) → Baustellendoku → Rechnung. Spec:
`docs/superpowers/specs/2026-06-10-e2e-workflow-test-design.md`.

## Voraussetzungen

1. Docker läuft
2. `npm run db:start` (lokale Supabase, Migrationen via `npx supabase db reset`)

## Ausführen

- `npm run test:e2e` — kompletter Lauf (Vite-Server startet automatisch gegen die lokale Instanz)
- `npm run test:e2e:headed` — mit sichtbarem Browser
- `npx playwright show-report` — HTML-Report nach einem Lauf

## Wie es funktioniert

- `global-setup.ts` seedet pro Lauf eine frische Firma (`E2E Test GmbH <timestamp>`)
  mit Manager + Monteur. Keys kommen zur Laufzeit aus `npx supabase status` —
  nichts ist hardcoded, es wird nie gegen die Remote-DB getestet.
- `auth.setup.ts` loggt beide Rollen einmal per UI ein (storageState-Cache in `e2e/.auth/`).
- `workflow.spec.ts` läuft seriell mit zwei Browser-Contexts (Manager + Mitarbeiter).
- End-Assertions prüfen die Datenkette per service_role direkt in der lokalen DB.

## Nicht abgedeckt (v1)

Sonderfälle (Ablehnung, Storno), PDF-Inhalte, E-Mail-Versand, Mobile App, CI.
```

- [ ] **Step 3: Verifikation Gesamtbild**

Run: `npm run test:e2e && npm run typecheck`
Expected: Alle E2E-Tests grün, Typecheck grün (e2e/-Ordner ggf. via `tsconfig`-Include prüfen — falls `tsc` über e2e-Dateien stolpert, e2e in `tsconfig.json` `exclude` aufnehmen; Playwright nutzt eigene Transpilierung).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md e2e/README.md
git commit -m "docs(e2e): document e2e workflow test setup and usage"
```

---

## Reihenfolge & Abhängigkeiten

Task 1 → 2 → 3 → 4 sind strikt sequenziell (Infrastruktur). Tasks 5–10 erweitern dieselbe Spec-Datei seriell — nicht parallelisieren. Task 11 zum Schluss.

## Verifikation (Abnahmekriterium)

`npm run db:start` (einmalig) + `npm run test:e2e` ⇒ **10 passed** (2 setup + 8 workflow), wiederholbar ohne manuelles Aufräumen (frische Firma pro Lauf).
