# Phase 1: Production-Readiness

## Ziel
App von Development- auf Production-Qualität bringen: kleinere Bundles, schnelleres Laden, sauberer Code.

## Scope

### 1. Webbuilder komplett entfernen
- Alle 22 Dateien in `src/features/webbuilder/` löschen
- Alle Webbuilder-Imports und -Routes aus `App.tsx` entfernen
- Referenzen in anderen Dateien prüfen und entfernen

### 2. Build-Konfiguration optimieren (`vite.config.ts`)
- `minify: 'esbuild'` für Production (aktuell: `false`)
- `sourcemap: false` für Production (aktuell: `true`)
- Vendor-Chunk konfigurieren: React, Radix UI, Recharts etc. in separates Chunk
- CSS-Minifizierung aktivieren

### 3. Route-Based Code-Splitting (`App.tsx`)
- Alle Page-Imports auf `React.lazy()` umstellen
- `Suspense` mit Loading-Fallback wrappen
- Gruppen: Landing, Auth, Manager, Offers, Marketplace, Public, Legal

### 4. Console-Statements entfernen
- Alle `console.log` entfernen (~1000 Stück)
- `console.error` in catch-Blöcken behalten (echte Fehlerbehandlung)
- `console.warn` einzeln prüfen, sinnvolle behalten

## Nicht im Scope
- TypeScript strict mode (Phase 2)
- Refactoring großer Dateien (Phase 2)
- Tests (Phase 3)
- `as any` Assertions (Phase 2)

## Risiko
- Gering: Keine Logik-Änderungen, nur Build + Cleanup
- Webbuilder-Entfernung: Prüfen ob andere Module darauf referenzieren
