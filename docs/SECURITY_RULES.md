# Database Security Rules for AI

Immer wenn du (die KI) eine neue Tabelle in Supabase erstellst, RLS-Policies schreibst, oder Backend/Frontend-Code anpasst, MUSST du dich zwingend an die folgenden Sicherheitsregeln halten:

## 1. RLS (Row Level Security) ist IMMER Pflicht
Jede Tabelle MUSS Row Level Security aktiviert haben:
`ALTER TABLE public.tabellen_name ENABLE ROW LEVEL SECURITY;`

## 2. NIEMALS `USING (true)` für authentifizierte Nutzer
Schreibe unter keinen Umständen Policies wie:
`CREATE POLICY "Alle sehen alles" ON tabelle FOR SELECT TO authenticated USING (true);`
Das führt zu katastrophalen Datenlecks, da jeder eingeloggte Nutzer die Daten aller anderen Firmen sehen kann!

## 3. IMMER Company-Scope (Mandantenfähigkeit) verwenden
HandwerkOS ist ein B2B-System. Daten gehören einer Firma (`company_id`), nicht nur einem einzelnen Nutzer.
Jede Tabelle mit Geschäftsdaten MUSS eine Spalte `company_id` haben (Referenz auf `public.companies`).
Policies MÜSSEN den Zugriff über die Helferfunktion `public.user_has_company_access(company_id)` absichern:

```sql
-- RICHTIGES BEISPIEL FÜR EINE RLS POLICY:
CREATE POLICY "Company users can view own data"
  ON public.meine_tabelle
  FOR SELECT
  TO authenticated
  USING (public.user_has_company_access(company_id));

CREATE POLICY "Company users can insert data"
  ON public.meine_tabelle
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_company_access(company_id));
```

## 4. Keine sensiblen Rechte im Frontend (Kein Service-Role-Key)
Im Frontend (`.tsx`, `client.ts`) darf niemals der `service_role` Key verwendet werden oder als Fallback im Code stehen.
Verwende immer nur den `anon` Key aus der `.env`. Falls administrative Rechte für eine Aktion benötigt werden, schreibe eine `SECURITY DEFINER` RPC-Funktion in Supabase oder eine Edge Function, anstatt Frontend-Code Administrator-Rechte zu geben.

## 5. Zugriffe ohne Login (anon) nur über SECURITY DEFINER
Falls unauthentifizierte Nutzer auf bestimmte Daten zugreifen müssen (z.B. Einladungslink, Kontaktformular, öffentliches Angebot), erlaube NIEMALS generellen Lesezugriff auf eine Tabelle für die Rolle `anon`.
Stattdessen: Schreibe eine Plpgsql-Funktion (`SECURITY DEFINER`), die extrem spezifische Filterkriterien anwendet (z.B. exakter Match eines sicheren, langen Tokens) und rufe `supabase.rpc(...)` im Frontend auf.
