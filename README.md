# HandwerkOS

AI-First Handwerk Management Platform mit GoBD-Compliance und DATEV-Integration.

## 🚀 Quick Start

### Voraussetzungen
- Node.js 18+ und npm
- Supabase CLI (`npm install -g supabase`)

### Lokale Entwicklung

```sh
# Repository klonen
git clone https://github.com/Fifinets/handwerkos.git
cd handwerkos

# Dependencies installieren  
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env mit eigenen Werten ausfüllen

# Datenbank-Migrations ausführen
npm run db:migrate

# Entwicklungsserver starten
npm run dev
```

### Verfügbare Scripts

- `npm run dev` - Entwicklungsserver starten
- `npm run build` - Production Build erstellen
- `npm run typecheck` - TypeScript Check
- `npm run lint` - ESLint ausführen
- `npm run test` - Tests ausführen
- `npm run db:migrate` - Datenbank-Migrations ausführen
- `npm run db:seed` - Demo-Daten laden

## 🏗️ Architektur

### Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Auth**: Supabase Auth mit JWT
- **Realtime**: Supabase Realtime
- **Mobile**: Capacitor (iOS/Android)

### Projektstruktur
```
src/
├── components/          # React Components
│   ├── ui/             # shadcn/ui Components
│   ├── projects/       # Project Management
│   └── emails/         # Email Integration
├── pages/              # Route Components
├── hooks/              # Custom React Hooks
├── types/              # TypeScript Types
├── utils/              # Utility Functions
└── integrations/       # External APIs

supabase/
├── migrations/         # SQL Migrations
└── functions/          # Edge Functions
```

## 🔧 Features

### Core Features
- 📊 **Projekt-Management**: Angebote → Aufträge → Projekte → Rechnungen
- 👥 **Team-Management**: Mitarbeiter, Zeiterfassung, Urlaubsverwaltung
- 📧 **Email-Integration**: Gmail-Sync, automatische Klassifizierung
- 💰 **Finanzen**: Budgets, KPIs, Rentabilitätsanalyse
- 📱 **Mobile App**: iOS/Android via Capacitor

### GoBD & DATEV (In Development)
- 🔒 **GoBD-Compliance**: Unveränderliche Belege, Audit-Trail
- 📄 **Nummerierte Belege**: Automatische Rechnungs-/Angebotsnummern  
- 💾 **DATEV-CSV Export**: Standard-konforme Buchhaltungsexporte
- 📋 **Audit-Log**: Vollständige Änderungshistorie

### AI Features (Roadmap)
- 🤖 **Intent-Parser**: Automatische Anfrage-Klassifizierung
- 💡 **Smart Estimates**: KI-gestützte Kostenschätzungen
- 📅 **Auto-Scheduling**: Optimierte Mitarbeiter-Planung

## 🔒 Sicherheit & Compliance

### Datenschutz
- DSGVO-konforme Datenhaltung
- Verschlüsselung aller sensiblen Daten
- Row Level Security (RLS) in Supabase

### GoBD-Anforderungen
- Unveränderlichkeit von Belegen nach Versand
- Vollständiger Audit-Trail aller Änderungen
- Nummerierte Belege (Rechnungen, Angebote)
- Archivierung als unveränderliche PDFs

## 📊 API

### REST Endpoints
```
GET    /api/projects          # Alle Projekte
POST   /api/projects          # Neues Projekt  
GET    /api/projects/:id/kpis # Projekt-KPIs
POST   /api/invoices          # Neue Rechnung
GET    /api/export/datev/csv  # DATEV-Export
```

### Realtime Events
- `PROJECT_UPDATED` - Projekt-Änderungen
- `BUDGET_90_REACHED` - Budget-Warnung
- `INVOICE_OVERDUE` - Überfällige Rechnung

## 🤝 Contributing

1. Feature Branch erstellen: `git checkout -b feat/mein-feature`
2. Änderungen committen: `git commit -m "feat: mein feature"`
3. Push: `git push origin feat/mein-feature`
4. Pull Request erstellen

### Commit Convention
- `feat:` - Neue Features
- `fix:` - Bugfixes  
- `docs:` - Dokumentation
- `chore:` - Build/Config Änderungen

## 📝 License

Proprietary - Alle Rechte vorbehalten.
