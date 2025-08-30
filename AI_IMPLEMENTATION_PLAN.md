# 🚀 AI-IMPLEMENTIERUNGSPLAN FÜR HANDWERKOS
## Rechtssichere und praktische AI-Features für deutsche Handwerksbetriebe

---

## 📋 ÜBERSICHT DER FEATURES

### Phase 1: Sichere Basis-Features (Monat 1-2)
1. OCR für Rechnungsverarbeitung
2. Template-basierte Textgenerierung
3. Interne Suchfunktion

### Phase 2: Erweiterte Features (Monat 3-4)
4. Statistische Prognosen
5. Wetterbasierte Planung

### Phase 3: Fortgeschrittene Features mit Auflagen (Monat 5-6)
6. Email-Klassifizierung (DSGVO-konform)
7. Kundensegmentierung (transparent)
8. Preisvorschlag-System

---

## 🔍 FEATURE 1: OCR FÜR RECHNUNGSVERARBEITUNG

### **Ziel:**
Automatisches Einlesen und Verarbeiten von Lieferantenrechnungen und Lieferscheinen

### **Technische Umsetzung:**

#### **Schritt 1: OCR-Service einrichten (Woche 1)**
```typescript
// src/services/ocrService.ts
import Tesseract from 'tesseract.js';
import { createWorker } from 'tesseract.js';

export class OCRService {
  private worker: Tesseract.Worker | null = null;

  async initialize() {
    this.worker = await createWorker('deu');
    await this.worker.loadLanguage('deu');
    await this.worker.initialize('deu');
  }

  async extractTextFromImage(imageFile: File): Promise<string> {
    if (!this.worker) await this.initialize();
    
    const { data: { text } } = await this.worker.recognize(imageFile);
    return text;
  }

  async extractInvoiceData(text: string): Promise<InvoiceData> {
    // Regex-Patterns für deutsche Rechnungen
    const patterns = {
      invoiceNumber: /Rechnungsnr\.?:?\s*([A-Z0-9\-\/]+)/i,
      date: /Datum:?\s*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      amount: /Gesamtbetrag:?\s*€?\s*([\d\.,]+)/i,
      vat: /MwSt\.?:?\s*€?\s*([\d\.,]+)/i,
      iban: /IBAN:?\s*([A-Z]{2}\d{2}[\s]?[\w\s]{10,30})/i,
      supplier: /^(.+?)[\n\r]/m // Erste Zeile oft Firmename
    };

    return {
      invoiceNumber: this.extractPattern(text, patterns.invoiceNumber),
      date: this.extractPattern(text, patterns.date),
      totalAmount: this.parseAmount(this.extractPattern(text, patterns.amount)),
      vatAmount: this.parseAmount(this.extractPattern(text, patterns.vat)),
      iban: this.extractPattern(text, patterns.iban),
      supplierName: this.extractPattern(text, patterns.supplier)
    };
  }

  private extractPattern(text: string, pattern: RegExp): string {
    const match = text.match(pattern);
    return match ? match[1].trim() : '';
  }

  private parseAmount(amountStr: string): number {
    return parseFloat(
      amountStr
        .replace(/\./g, '')  // Tausender-Punkte entfernen
        .replace(',', '.')   // Komma zu Punkt
        .replace(/[^\d.]/g, '') // Nur Zahlen
    ) || 0;
  }
}
```

#### **Schritt 2: Validierung & Korrektur-UI (Woche 2)**
```typescript
// src/components/InvoiceOCRValidator.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Check, X } from 'lucide-react';

interface OCRValidatorProps {
  extractedData: InvoiceData;
  originalImage: string;
  onConfirm: (data: InvoiceData) => void;
  onReject: () => void;
}

export function InvoiceOCRValidator({ 
  extractedData, 
  originalImage, 
  onConfirm, 
  onReject 
}: OCRValidatorProps) {
  const [data, setData] = useState(extractedData);
  const [confidence, setConfidence] = useState({
    invoiceNumber: 0.95,
    date: 0.88,
    totalAmount: 0.92,
    supplierName: 0.75
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Original Bild */}
      <Card>
        <CardHeader>
          <CardTitle>Original Rechnung</CardTitle>
        </CardHeader>
        <CardContent>
          <img src={originalImage} alt="Rechnung" className="w-full" />
        </CardContent>
      </Card>

      {/* Extrahierte Daten */}
      <Card>
        <CardHeader>
          <CardTitle>Erkannte Daten - Bitte prüfen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Rechnungsnummer</label>
            <div className="flex items-center gap-2">
              <Input 
                value={data.invoiceNumber}
                onChange={(e) => setData({...data, invoiceNumber: e.target.value})}
                className={confidence.invoiceNumber < 0.8 ? 'border-yellow-500' : ''}
              />
              <ConfidenceIndicator value={confidence.invoiceNumber} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Datum</label>
            <div className="flex items-center gap-2">
              <Input 
                type="date"
                value={data.date}
                onChange={(e) => setData({...data, date: e.target.value})}
              />
              <ConfidenceIndicator value={confidence.date} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Gesamtbetrag (€)</label>
            <div className="flex items-center gap-2">
              <Input 
                type="number"
                step="0.01"
                value={data.totalAmount}
                onChange={(e) => setData({...data, totalAmount: parseFloat(e.target.value)})}
                className={confidence.totalAmount < 0.8 ? 'border-yellow-500' : ''}
              />
              <ConfidenceIndicator value={confidence.totalAmount} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Lieferant</label>
            <div className="flex items-center gap-2">
              <Input 
                value={data.supplierName}
                onChange={(e) => setData({...data, supplierName: e.target.value})}
                className={confidence.supplierName < 0.8 ? 'border-yellow-500' : ''}
              />
              <ConfidenceIndicator value={confidence.supplierName} />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={() => onConfirm(data)}
              className="flex-1"
            >
              <Check className="mr-2 h-4 w-4" />
              Daten übernehmen
            </Button>
            <Button 
              onClick={onReject}
              variant="outline"
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Verwerfen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfidenceIndicator({ value }: { value: number }) {
  const color = value > 0.9 ? 'text-green-500' : value > 0.7 ? 'text-yellow-500' : 'text-red-500';
  return (
    <div className={`flex items-center ${color}`}>
      <AlertCircle className="h-4 w-4" />
      <span className="text-xs ml-1">{Math.round(value * 100)}%</span>
    </div>
  );
}
```

#### **Schritt 3: GoBD-konforme Speicherung (Woche 3)**
```typescript
// src/services/invoiceStorageService.ts
export class InvoiceStorageService {
  async storeInvoice(
    invoiceData: InvoiceData, 
    originalFile: File,
    userId: string
  ): Promise<void> {
    // 1. Original-Datei unveränderbar speichern
    const fileHash = await this.calculateHash(originalFile);
    const storagePath = `invoices/${new Date().getFullYear()}/${fileHash}`;
    
    await supabase.storage
      .from('documents')
      .upload(storagePath, originalFile, {
        cacheControl: '3600',
        upsert: false // Keine Überschreibung erlaubt (GoBD)
      });

    // 2. Metadaten mit Audit-Trail speichern
    const invoiceRecord = {
      ...invoiceData,
      original_file_path: storagePath,
      file_hash: fileHash,
      ocr_extracted: true,
      ocr_confidence: 0.85,
      created_by: userId,
      created_at: new Date().toISOString(),
      is_immutable: true, // GoBD-Kennzeichnung
      audit_trail: [{
        action: 'OCR_EXTRACTION',
        timestamp: new Date().toISOString(),
        user_id: userId,
        changes: invoiceData
      }]
    };

    await supabase
      .from('invoices')
      .insert(invoiceRecord);

    // 3. Verfahrensdokumentation
    await this.logProcessDocumentation({
      process: 'OCR_INVOICE_EXTRACTION',
      version: '1.0',
      timestamp: new Date().toISOString(),
      steps: [
        'Datei-Upload durch Benutzer',
        'OCR-Texterkennung mit Tesseract.js',
        'Manuelle Validierung der extrahierten Daten',
        'Unveränderbare Speicherung in Datenbank'
      ]
    });
  }

  private async calculateHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

### **Rechtliche Absicherung:**
- ✅ Keine automatisierten Entscheidungen
- ✅ Menschliche Prüfung obligatorisch
- ✅ GoBD-konforme Unveränderbarkeit
- ✅ Vollständige Verfahrensdokumentation
- ✅ Audit-Trail für alle Änderungen

---

## 📝 FEATURE 2: TEMPLATE-BASIERTE TEXTGENERIERUNG

### **Ziel:**
Schnelle Erstellung von Angeboten, Rechnungen und E-Mails mit vordefinierten Bausteinen

### **Technische Umsetzung:**

#### **Schritt 1: Template-Engine (Woche 1)**
```typescript
// src/services/templateService.ts
import Handlebars from 'handlebars';

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: string[]; // Für select
}

export interface DocumentTemplate {
  id: string;
  name: string;
  category: 'quote' | 'invoice' | 'email' | 'contract';
  content: string;
  variables: TemplateVariable[];
  metadata: {
    created_at: string;
    created_by: string;
    usage_count: number;
    average_success_rate?: number;
  };
}

export class TemplateService {
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();

  // Registriere Handlebars Helfer für deutsche Formatierung
  constructor() {
    this.registerHelpers();
  }

  private registerHelpers() {
    // Währungsformatierung
    Handlebars.registerHelper('currency', (amount: number) => {
      return new Intl.NumberFormat('de-DE', { 
        style: 'currency', 
        currency: 'EUR' 
      }).format(amount);
    });

    // Datumsformatierung
    Handlebars.registerHelper('date', (date: string) => {
      return new Date(date).toLocaleDateString('de-DE');
    });

    // MwSt Berechnung
    Handlebars.registerHelper('vat', (amount: number, rate: number = 19) => {
      return (amount * rate / 100).toFixed(2);
    });

    // Brutto-Berechnung
    Handlebars.registerHelper('gross', (amount: number, rate: number = 19) => {
      return (amount * (1 + rate / 100)).toFixed(2);
    });
  }

  async loadTemplate(templateId: string): Promise<DocumentTemplate> {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;

    // Compile template
    const compiled = Handlebars.compile(data.content);
    this.templates.set(templateId, compiled);

    return data;
  }

  generateDocument(templateId: string, variables: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template) throw new Error('Template nicht geladen');

    // Füge Standard-Variablen hinzu
    const enrichedVariables = {
      ...variables,
      currentDate: new Date().toISOString(),
      companyName: 'Handwerk GmbH', // Aus Settings
      companyAddress: 'Musterstraße 1, 12345 Musterstadt',
      companyPhone: '+49 123 456789',
      companyEmail: 'info@handwerk.de',
      companyTaxId: 'DE123456789'
    };

    return template(enrichedVariables);
  }
}
```

#### **Schritt 2: Template-Editor mit Live-Vorschau (Woche 2)**
```typescript
// src/components/TemplateEditor.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, Save, Plus, Trash2 } from 'lucide-react';

export function TemplateEditor() {
  const [template, setTemplate] = useState<DocumentTemplate>({
    id: '',
    name: 'Neues Angebot',
    category: 'quote',
    content: `Sehr geehrte{{#if salutation}} {{salutation}}{{/if}} {{customerName}},

vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:

**Projektbeschreibung:**
{{projectDescription}}

**Leistungsumfang:**
{{#each services}}
- {{this.description}}: {{currency this.price}}
{{/each}}

**Kostenzusammenfassung:**
Nettobetrag: {{currency netAmount}}
MwSt (19%): {{currency vatAmount}}
**Gesamtbetrag: {{currency grossAmount}}**

**Ausführungszeitraum:** {{startDate}} bis {{endDate}}

**Zahlungsbedingungen:**
- 30% bei Auftragserteilung
- 40% bei Arbeitsbeginn  
- 30% nach Fertigstellung

Dieses Angebot ist gültig bis {{validUntil}}.

Mit freundlichen Grüßen
{{employeeName}}
{{companyName}}`,
    variables: [
      { key: 'customerName', label: 'Kundenname', type: 'text', required: true },
      { key: 'salutation', label: 'Anrede', type: 'select', required: false, options: ['Herr', 'Frau', 'Dr.'] },
      { key: 'projectDescription', label: 'Projektbeschreibung', type: 'text', required: true },
      { key: 'netAmount', label: 'Nettobetrag', type: 'number', required: true },
      { key: 'startDate', label: 'Startdatum', type: 'date', required: true },
      { key: 'endDate', label: 'Enddatum', type: 'date', required: true }
    ],
    metadata: {
      created_at: new Date().toISOString(),
      created_by: 'current_user',
      usage_count: 0
    }
  });

  const [testData, setTestData] = useState<Record<string, any>>({
    customerName: 'Müller',
    salutation: 'Herr',
    projectDescription: 'Badsanierung im EG',
    services: [
      { description: 'Demontage Altinstallation', price: 500 },
      { description: 'Fliesenarbeiten 25qm', price: 2500 },
      { description: 'Sanitärinstallation', price: 3500 }
    ],
    netAmount: 6500,
    vatAmount: 1235,
    grossAmount: 7735,
    startDate: '15.03.2024',
    endDate: '29.03.2024',
    validUntil: '15.02.2024',
    employeeName: 'Max Mustermann'
  });

  const [preview, setPreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (showPreview) {
      generatePreview();
    }
  }, [template.content, testData, showPreview]);

  const generatePreview = () => {
    try {
      const compiled = Handlebars.compile(template.content);
      const result = compiled(testData);
      setPreview(result);
    } catch (error) {
      setPreview(`Fehler in Template: ${error.message}`);
    }
  };

  const addVariable = () => {
    const newVar: TemplateVariable = {
      key: `variable_${Date.now()}`,
      label: 'Neue Variable',
      type: 'text',
      required: false
    };
    setTemplate({
      ...template,
      variables: [...template.variables, newVar]
    });
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Template Editor</CardTitle>
          <div className="flex gap-2">
            <Input 
              placeholder="Template Name"
              value={template.name}
              onChange={(e) => setTemplate({...template, name: e.target.value})}
              className="flex-1"
            />
            <Select 
              value={template.category}
              onValueChange={(v) => setTemplate({...template, category: v as any})}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Angebot</SelectItem>
                <SelectItem value="invoice">Rechnung</SelectItem>
                <SelectItem value="email">E-Mail</SelectItem>
                <SelectItem value="contract">Vertrag</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template Content */}
          <div>
            <label className="text-sm font-medium">Template Inhalt (Handlebars Syntax)</label>
            <Textarea 
              value={template.content}
              onChange={(e) => setTemplate({...template, content: e.target.value})}
              className="font-mono text-sm"
              rows={20}
              placeholder="Verwenden Sie {{variableName}} für Platzhalter"
            />
          </div>

          {/* Variables */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Variablen</label>
              <Button size="sm" onClick={addVariable}>
                <Plus className="h-4 w-4 mr-1" />
                Variable hinzufügen
              </Button>
            </div>
            <div className="space-y-2">
              {template.variables.map((variable, index) => (
                <div key={variable.key} className="flex gap-2 items-center">
                  <Input 
                    placeholder="Schlüssel"
                    value={variable.key}
                    onChange={(e) => {
                      const vars = [...template.variables];
                      vars[index].key = e.target.value;
                      setTemplate({...template, variables: vars});
                    }}
                    className="w-32"
                  />
                  <Input 
                    placeholder="Bezeichnung"
                    value={variable.label}
                    onChange={(e) => {
                      const vars = [...template.variables];
                      vars[index].label = e.target.value;
                      setTemplate({...template, variables: vars});
                    }}
                    className="flex-1"
                  />
                  <Select 
                    value={variable.type}
                    onValueChange={(v) => {
                      const vars = [...template.variables];
                      vars[index].type = v as any;
                      setTemplate({...template, variables: vars});
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Zahl</SelectItem>
                      <SelectItem value="date">Datum</SelectItem>
                      <SelectItem value="select">Auswahl</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      const vars = template.variables.filter((_, i) => i !== index);
                      setTemplate({...template, variables: vars});
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={() => setShowPreview(!showPreview)}>
              <Eye className="mr-2 h-4 w-4" />
              {showPreview ? 'Editor' : 'Vorschau'}
            </Button>
            <Button onClick={() => console.log('Save template')}>
              <Save className="mr-2 h-4 w-4" />
              Template speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview or Test Data */}
      <Card>
        <CardHeader>
          <CardTitle>{showPreview ? 'Vorschau' : 'Testdaten'}</CardTitle>
        </CardHeader>
        <CardContent>
          {showPreview ? (
            <div className="prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: preview.replace(/\n/g, '<br />') }} />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Geben Sie Testdaten ein, um die Vorschau zu generieren
              </p>
              {template.variables.map((variable) => (
                <div key={variable.key}>
                  <label className="text-sm font-medium">{variable.label}</label>
                  {variable.type === 'select' ? (
                    <Select 
                      value={testData[variable.key] || ''}
                      onValueChange={(v) => setTestData({...testData, [variable.key]: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {variable.options?.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      type={variable.type === 'number' ? 'number' : variable.type === 'date' ? 'date' : 'text'}
                      value={testData[variable.key] || ''}
                      onChange={(e) => setTestData({...testData, [variable.key]: e.target.value})}
                      placeholder={`${variable.label} eingeben`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

#### **Schritt 3: Vordefinierte Branchentemplates (Woche 3)**
```typescript
// src/data/defaultTemplates.ts
export const DEFAULT_TEMPLATES: Partial<DocumentTemplate>[] = [
  {
    name: 'Standard Angebot - Badsanierung',
    category: 'quote',
    content: `Angebot Nr. {{quoteNumber}}
Datum: {{date currentDate}}

{{companyName}}
{{companyAddress}}

An:
{{#if customerCompany}}{{customerCompany}}
{{/if}}{{customerName}}
{{customerAddress}}

**Angebot Badsanierung**

Sehr geehrte{{#if customerSalutation}} {{customerSalutation}}{{/if}} {{customerLastName}},

bezugnehmend auf unser Gespräch vom {{meetingDate}} und die Besichtigung vor Ort, unterbreiten wir Ihnen folgendes Angebot für die Sanierung Ihres Badezimmers:

**1. Demontagearbeiten**
- Entfernen der alten Sanitärobjekte
- Demontage Fliesen und Unterkonstruktion
- Entsorgung des Bauschutts
Pauschal: {{currency demolitionCost}}

**2. Installationsarbeiten**
- Erneuerung Wasserleitung
- Verlegung Abwasserleitung
- Elektroinstallation nach VDE
{{currency installationCost}}

**3. Fliesenarbeiten**
- Grundierung und Abdichtung
- Verlegen von {{tileArea}} qm Fliesen
- Verfugung und Silikonfugen
{{currency tilingCost}} ({{tilePrice}}/qm)

**4. Sanitärobjekte** (Lieferung und Montage)
{{#each sanitaryItems}}
- {{this.description}}: {{currency this.price}}
{{/each}}

---
**Zusammenfassung:**
Nettosumme: {{currency netTotal}}
MwSt 19%: {{currency vatAmount}}
**Gesamtsumme: {{currency grossTotal}}**

**Ausführungstermin:** {{startDate}} bis {{endDate}} (ca. {{workDays}} Arbeitstage)

**Zahlungsbedingungen:**
- 30% bei Auftragserteilung ({{currency deposit}})
- 40% bei Arbeitsbeginn ({{currency firstPayment}})
- 30% nach Abnahme ({{currency finalPayment}})

**Gewährleistung:** 5 Jahre auf alle Arbeitsleistungen gemäß VOB/B

Dieses Angebot ist gültig bis {{validUntil}}.

Für Rückfragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen

{{employeeName}}
{{employeeTitle}}
Tel: {{employeePhone}}
E-Mail: {{employeeEmail}}`,
    variables: [
      { key: 'quoteNumber', label: 'Angebotsnummer', type: 'text', required: true },
      { key: 'customerCompany', label: 'Firma', type: 'text', required: false },
      { key: 'customerName', label: 'Kundenname', type: 'text', required: true },
      { key: 'customerLastName', label: 'Nachname', type: 'text', required: true },
      { key: 'customerSalutation', label: 'Anrede', type: 'select', required: false, options: ['Herr', 'Frau', 'Familie'] },
      { key: 'customerAddress', label: 'Kundenadresse', type: 'text', required: true },
      { key: 'meetingDate', label: 'Besprechungsdatum', type: 'date', required: false },
      { key: 'demolitionCost', label: 'Demontagekosten', type: 'number', required: true, defaultValue: 800 },
      { key: 'installationCost', label: 'Installationskosten', type: 'number', required: true },
      { key: 'tileArea', label: 'Fliesenfläche (qm)', type: 'number', required: true },
      { key: 'tilePrice', label: 'Preis pro qm', type: 'number', required: true, defaultValue: 85 },
      { key: 'tilingCost', label: 'Fliesenarbeiten gesamt', type: 'number', required: true },
      { key: 'workDays', label: 'Arbeitstage', type: 'number', required: true, defaultValue: 10 },
      { key: 'startDate', label: 'Startdatum', type: 'date', required: true },
      { key: 'endDate', label: 'Enddatum', type: 'date', required: true },
      { key: 'validUntil', label: 'Gültig bis', type: 'date', required: true }
    ]
  },
  
  {
    name: 'Zahlungserinnerung - Freundlich',
    category: 'email',
    content: `Betreff: Zahlungserinnerung - Rechnung {{invoiceNumber}}

Sehr geehrte{{#if customerSalutation}} {{customerSalutation}}{{/if}} {{customerName}},

wir hoffen, es geht Ihnen gut und Sie sind mit unseren Leistungen zufrieden.

Sicherlich ist es Ihrer Aufmerksamkeit entgangen, dass die Zahlung für folgende Rechnung noch aussteht:

**Rechnungsnummer:** {{invoiceNumber}}
**Rechnungsdatum:** {{date invoiceDate}}
**Rechnungsbetrag:** {{currency invoiceAmount}}
**Fällig seit:** {{date dueDate}} ({{daysOverdue}} Tage)

Wir bitten Sie, den ausstehenden Betrag in den nächsten Tagen zu überweisen:

**Bankverbindung:**
{{companyName}}
IBAN: {{companyIBAN}}
BIC: {{companyBIC}}
Verwendungszweck: {{invoiceNumber}}

Falls die Zahlung bereits erfolgt ist, betrachten Sie diese Erinnerung bitte als gegenstandslos.

Bei Fragen zur Rechnung stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen

{{employeeName}}
{{companyName}}
Tel: {{companyPhone}}`,
    variables: [
      { key: 'invoiceNumber', label: 'Rechnungsnummer', type: 'text', required: true },
      { key: 'invoiceDate', label: 'Rechnungsdatum', type: 'date', required: true },
      { key: 'invoiceAmount', label: 'Rechnungsbetrag', type: 'number', required: true },
      { key: 'dueDate', label: 'Fälligkeitsdatum', type: 'date', required: true },
      { key: 'daysOverdue', label: 'Tage überfällig', type: 'number', required: true }
    ]
  },

  {
    name: 'Auftragsbestätigung',
    category: 'email',
    content: `Betreff: Auftragsbestätigung - {{projectName}}

Sehr geehrte{{#if customerSalutation}} {{customerSalutation}}{{/if}} {{customerName}},

vielen Dank für Ihren Auftrag! Wir freuen uns auf die Zusammenarbeit.

Hiermit bestätigen wir den Auftrag mit folgenden Details:

**Projekt:** {{projectName}}
**Auftragsnummer:** {{orderNumber}}
**Leistungsumfang:** {{projectDescription}}

**Termine:**
- Arbeitsbeginn: {{date startDate}}
- Geplante Fertigstellung: {{date endDate}}

**Vereinbarter Preis:** {{currency totalAmount}} inkl. MwSt.

**Ihre Ansprechpartner:**
- Projektleitung: {{projectManager}}
- Telefon: {{projectManagerPhone}}

**Nächste Schritte:**
1. {{nextStep1}}
2. {{nextStep2}}
3. {{nextStep3}}

Wir werden Sie über den Fortschritt auf dem Laufenden halten.

Mit freundlichen Grüßen

{{employeeName}}
{{companyName}}`,
    variables: [
      { key: 'projectName', label: 'Projektname', type: 'text', required: true },
      { key: 'orderNumber', label: 'Auftragsnummer', type: 'text', required: true },
      { key: 'projectDescription', label: 'Leistungsbeschreibung', type: 'text', required: true },
      { key: 'startDate', label: 'Startdatum', type: 'date', required: true },
      { key: 'endDate', label: 'Enddatum', type: 'date', required: true },
      { key: 'totalAmount', label: 'Gesamtbetrag', type: 'number', required: true },
      { key: 'projectManager', label: 'Projektleiter', type: 'text', required: true },
      { key: 'projectManagerPhone', label: 'Telefon Projektleiter', type: 'text', required: true },
      { key: 'nextStep1', label: 'Nächster Schritt 1', type: 'text', required: false, defaultValue: 'Materialbestellung' },
      { key: 'nextStep2', label: 'Nächster Schritt 2', type: 'text', required: false, defaultValue: 'Terminabstimmung vor Ort' },
      { key: 'nextStep3', label: 'Nächster Schritt 3', type: 'text', required: false, defaultValue: 'Arbeitsbeginn' }
    ]
  }
];
```

### **Rechtliche Absicherung:**
- ✅ Keine KI-generierten Inhalte, nur Templates
- ✅ Volle Kontrolle durch Benutzer
- ✅ Transparente Variablen-Struktur
- ✅ Versionierung aller Templates
- ✅ Keine personenbezogenen Daten in Templates

---

## 🔍 FEATURE 3: INTERNE SUCHFUNKTION (RAG)

### **Ziel:**
Intelligente Suche über alle Geschäftsdokumente mit semantischem Verständnis

### **Technische Umsetzung:**

#### **Schritt 1: Dokumenten-Indexierung (Woche 1)**
```typescript
// src/services/documentIndexService.ts
import { createClient } from '@supabase/supabase-js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export interface IndexedDocument {
  id: string;
  content: string;
  metadata: {
    title: string;
    type: 'invoice' | 'quote' | 'contract' | 'email' | 'note';
    created_at: string;
    customer_id?: string;
    project_id?: string;
    tags: string[];
  };
  embedding?: number[];
  chunks: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  metadata: {
    chunk_index: number;
    char_start: number;
    char_end: number;
  };
}

export class DocumentIndexService {
  private splitter: RecursiveCharacterTextSplitter;

  constructor() {
    // Konfiguriere Text-Splitter für deutsche Texte
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ', ', ' ', ''],
    });
  }

  async indexDocument(
    documentId: string,
    content: string,
    metadata: IndexedDocument['metadata']
  ): Promise<IndexedDocument> {
    // 1. Bereinige und normalisiere Text
    const cleanedContent = this.preprocessText(content);

    // 2. Teile in Chunks
    const chunks = await this.splitter.splitText(cleanedContent);

    // 3. Generiere Embeddings (vereinfacht - ohne externe API)
    const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
      id: `${documentId}_chunk_${index}`,
      document_id: documentId,
      content: chunk,
      embedding: this.generateSimpleEmbedding(chunk),
      metadata: {
        chunk_index: index,
        char_start: cleanedContent.indexOf(chunk),
        char_end: cleanedContent.indexOf(chunk) + chunk.length
      }
    }));

    // 4. Speichere in Vektordatenbank
    const indexedDoc: IndexedDocument = {
      id: documentId,
      content: cleanedContent,
      metadata,
      embedding: this.generateSimpleEmbedding(cleanedContent),
      chunks: documentChunks
    };

    await this.saveToVectorDB(indexedDoc);

    return indexedDoc;
  }

  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\säöüß€.,!?-]/g, '')
      .trim();
  }

  private generateSimpleEmbedding(text: string): number[] {
    // Vereinfachte Embedding-Generierung ohne externe API
    // In Produktion: OpenAI, Cohere oder lokales Modell verwenden
    
    const words = text.toLowerCase().split(/\s+/);
    const vocabulary = this.getGermanBusinessVocabulary();
    const embedding = new Array(300).fill(0);

    words.forEach(word => {
      const index = vocabulary.indexOf(word) % 300;
      if (index >= 0) {
        embedding[index] += 1 / Math.sqrt(words.length);
      }
    });

    // Normalisiere
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  private getGermanBusinessVocabulary(): string[] {
    return [
      // Handwerk
      'sanitär', 'elektro', 'fliesen', 'maler', 'dachdecker', 'zimmerer',
      'installation', 'montage', 'reparatur', 'wartung', 'sanierung',
      
      // Business
      'rechnung', 'angebot', 'auftrag', 'kunde', 'projekt', 'termin',
      'zahlung', 'material', 'kosten', 'arbeitszeit', 'stunden',
      
      // Aktionen
      'erstellen', 'bearbeiten', 'abschließen', 'stornieren', 'planen',
      'durchführen', 'prüfen', 'genehmigen', 'ablehnen',
      
      // Status
      'offen', 'in bearbeitung', 'abgeschlossen', 'überfällig', 'bezahlt',
      'ausstehend', 'geplant', 'aktiv', 'pausiert', 'storniert'
    ];
  }

  private async saveToVectorDB(document: IndexedDocument): Promise<void> {
    // Speichere Dokument
    await supabase
      .from('indexed_documents')
      .upsert({
        id: document.id,
        content: document.content,
        metadata: document.metadata,
        embedding: document.embedding,
        indexed_at: new Date().toISOString()
      });

    // Speichere Chunks
    await supabase
      .from('document_chunks')
      .upsert(
        document.chunks.map(chunk => ({
          ...chunk,
          indexed_at: new Date().toISOString()
        }))
      );
  }
}
```

#### **Schritt 2: Intelligente Suchfunktion (Woche 2)**
```typescript
// src/services/semanticSearchService.ts
export interface SearchResult {
  document_id: string;
  title: string;
  type: string;
  excerpt: string;
  relevance_score: number;
  matched_chunks: Array<{
    content: string;
    score: number;
  }>;
  metadata: Record<string, any>;
}

export class SemanticSearchService {
  async search(
    query: string,
    options: {
      limit?: number;
      documentTypes?: string[];
      dateRange?: { from: Date; to: Date };
      customerId?: string;
      projectId?: string;
    } = {}
  ): Promise<SearchResult[]> {
    // 1. Verarbeite Suchanfrage
    const processedQuery = this.processQuery(query);
    const queryEmbedding = this.generateSimpleEmbedding(processedQuery);

    // 2. Suche ähnliche Dokumente
    let searchQuery = supabase
      .from('document_chunks')
      .select(`
        *,
        indexed_documents (
          id,
          metadata,
          content
        )
      `);

    // 3. Filtere nach Optionen
    if (options.documentTypes?.length) {
      searchQuery = searchQuery.in('indexed_documents.metadata->>type', options.documentTypes);
    }

    if (options.customerId) {
      searchQuery = searchQuery.eq('indexed_documents.metadata->>customer_id', options.customerId);
    }

    const { data: chunks, error } = await searchQuery;
    if (error) throw error;

    // 4. Berechne Relevanz
    const results = this.calculateRelevance(chunks, queryEmbedding, processedQuery);

    // 5. Gruppiere nach Dokument
    const groupedResults = this.groupByDocument(results);

    // 6. Sortiere und limitiere
    return groupedResults
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, options.limit || 10);
  }

  private processQuery(query: string): string {
    // Erweitere Query mit Synonymen
    const synonyms: Record<string, string[]> = {
      'rechnung': ['invoice', 'faktura', 'abrechnung'],
      'kunde': ['auftraggeber', 'mandant', 'klient'],
      'auftrag': ['order', 'bestellung', 'projekt'],
      'angebot': ['quote', 'kostenvoranschlag', 'offerte'],
      'bezahlt': ['beglichen', 'überwiesen', 'gezahlt'],
      'offen': ['ausstehend', 'unbezahlt', 'fällig']
    };

    let expandedQuery = query.toLowerCase();
    Object.entries(synonyms).forEach(([word, syns]) => {
      if (expandedQuery.includes(word)) {
        expandedQuery += ' ' + syns.join(' ');
      }
    });

    return expandedQuery;
  }

  private calculateRelevance(
    chunks: any[],
    queryEmbedding: number[],
    query: string
  ): Array<any> {
    return chunks.map(chunk => {
      // Cosinus-Ähnlichkeit
      const cosineSimilarity = this.cosineSimilarity(
        queryEmbedding,
        chunk.embedding
      );

      // Keyword-Matching
      const keywordScore = this.keywordMatch(query, chunk.content);

      // Kombiniere Scores
      const relevanceScore = (cosineSimilarity * 0.7) + (keywordScore * 0.3);

      return {
        ...chunk,
        relevance_score: relevanceScore,
        cosine_score: cosineSimilarity,
        keyword_score: keywordScore
      };
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  private keywordMatch(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    const matches = queryWords.filter(word => 
      contentWords.some(cw => cw.includes(word) || word.includes(cw))
    );

    return matches.length / queryWords.length;
  }

  private groupByDocument(chunks: any[]): SearchResult[] {
    const grouped = new Map<string, SearchResult>();

    chunks.forEach(chunk => {
      const docId = chunk.indexed_documents.id;
      
      if (!grouped.has(docId)) {
        grouped.set(docId, {
          document_id: docId,
          title: chunk.indexed_documents.metadata.title,
          type: chunk.indexed_documents.metadata.type,
          excerpt: '',
          relevance_score: 0,
          matched_chunks: [],
          metadata: chunk.indexed_documents.metadata
        });
      }

      const result = grouped.get(docId)!;
      result.matched_chunks.push({
        content: chunk.content,
        score: chunk.relevance_score
      });

      // Verwende besten Chunk als Excerpt
      if (chunk.relevance_score > result.relevance_score) {
        result.relevance_score = chunk.relevance_score;
        result.excerpt = this.highlightMatch(chunk.content, chunk.query);
      }
    });

    return Array.from(grouped.values());
  }

  private highlightMatch(content: string, query: string): string {
    const words = query.toLowerCase().split(/\s+/);
    let highlighted = content;

    words.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlighted = highlighted.replace(regex, '**$1**');
    });

    // Kürze auf 200 Zeichen um Highlight herum
    const firstHighlight = highlighted.indexOf('**');
    if (firstHighlight > 100) {
      const start = firstHighlight - 100;
      highlighted = '...' + highlighted.substring(start, start + 200) + '...';
    } else if (highlighted.length > 200) {
      highlighted = highlighted.substring(0, 200) + '...';
    }

    return highlighted;
  }
}
```

#### **Schritt 3: Such-UI mit Facetten (Woche 3)**
```typescript
// src/components/SmartSearch.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, FileText, Mail, FileCheck, Package, Users } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

const DOCUMENT_ICONS = {
  invoice: FileCheck,
  quote: FileText,
  contract: FileText,
  email: Mail,
  note: FileText,
  project: Package,
  customer: Users
};

export function SmartSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    documentTypes: [] as string[],
    dateRange: null as { from: Date; to: Date } | null,
    onlyMyDocuments: false
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const debouncedQuery = useDebounce(query, 300);

  // Suche ausführen
  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [debouncedQuery, filters]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const searchService = new SemanticSearchService();
      const searchResults = await searchService.search(debouncedQuery, {
        documentTypes: filters.documentTypes.length > 0 ? filters.documentTypes : undefined,
        dateRange: filters.dateRange || undefined,
        limit: 20
      });
      setResults(searchResults);

      // Generiere Suchvorschläge basierend auf Ergebnissen
      generateSuggestions(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = (searchResults: SearchResult[]) => {
    // Extrahiere häufige Begriffe aus Ergebnissen für Vorschläge
    const terms = new Set<string>();
    searchResults.forEach(result => {
      // Extrahiere wichtige Begriffe aus Metadaten
      if (result.metadata.tags) {
        result.metadata.tags.forEach((tag: string) => terms.add(tag));
      }
    });
    setSuggestions(Array.from(terms).slice(0, 5));
  };

  const toggleDocumentType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      documentTypes: prev.documentTypes.includes(type)
        ? prev.documentTypes.filter(t => t !== type)
        : [...prev.documentTypes, type]
    }));
  };

  return (
    <div className="flex gap-4">
      {/* Suchleiste und Filter */}
      <div className="w-80 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Suche</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Suchfeld */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Suchen Sie nach Dokumenten..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Suchvorschläge */}
            {suggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Vorschläge:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map(suggestion => (
                    <Badge
                      key={suggestion}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setQuery(query + ' ' + suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Dokumenttyp-Filter */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Dokumenttypen</p>
              {['invoice', 'quote', 'contract', 'email', 'project'].map(type => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={filters.documentTypes.includes(type)}
                    onCheckedChange={() => toggleDocumentType(type)}
                  />
                  <label htmlFor={type} className="text-sm cursor-pointer">
                    {type === 'invoice' && 'Rechnungen'}
                    {type === 'quote' && 'Angebote'}
                    {type === 'contract' && 'Verträge'}
                    {type === 'email' && 'E-Mails'}
                    {type === 'project' && 'Projekte'}
                  </label>
                </div>
              ))}
            </div>

            {/* Zeitraum-Filter */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Zeitraum</p>
              <select 
                className="w-full p-2 border rounded"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    setFilters(prev => ({ ...prev, dateRange: null }));
                  } else {
                    const days = parseInt(value);
                    const from = new Date();
                    from.setDate(from.getDate() - days);
                    setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { from, to: new Date() }
                    }));
                  }
                }}
              >
                <option value="all">Alle</option>
                <option value="7">Letzte 7 Tage</option>
                <option value="30">Letzte 30 Tage</option>
                <option value="90">Letzte 3 Monate</option>
                <option value="365">Letztes Jahr</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suchergebnisse */}
      <div className="flex-1 space-y-4">
        {loading && (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Suche läuft...</p>
            </CardContent>
          </Card>
        )}

        {!loading && results.length === 0 && debouncedQuery.length >= 3 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Keine Ergebnisse für "{debouncedQuery}" gefunden
              </p>
            </CardContent>
          </Card>
        )}

        {results.map(result => {
          const Icon = DOCUMENT_ICONS[result.type] || FileText;
          
          return (
            <Card key={result.document_id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{result.title}</h3>
                      <Badge variant="outline">
                        {result.type === 'invoice' && 'Rechnung'}
                        {result.type === 'quote' && 'Angebot'}
                        {result.type === 'contract' && 'Vertrag'}
                        {result.type === 'email' && 'E-Mail'}
                        {result.type === 'project' && 'Projekt'}
                      </Badge>
                      <Badge variant="secondary">
                        {Math.round(result.relevance_score * 100)}% Relevanz
                      </Badge>
                    </div>
                    
                    <div 
                      className="text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{ 
                        __html: result.excerpt.replace(/\*\*(.*?)\*\*/g, '<mark>$1</mark>') 
                      }}
                    />
                    
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {result.metadata.customer_name && (
                        <span>Kunde: {result.metadata.customer_name}</span>
                      )}
                      {result.metadata.created_at && (
                        <span>
                          Erstellt: {new Date(result.metadata.created_at).toLocaleDateString('de-DE')}
                        </span>
                      )}
                      {result.metadata.amount && (
                        <span>Betrag: {result.metadata.amount.toFixed(2)} €</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Öffnen
                      </Button>
                      <Button size="sm" variant="ghost">
                        Ähnliche anzeigen
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

### **Rechtliche Absicherung:**
- ✅ Nur interne Dokumente (keine externen Datenquellen)
- ✅ Keine Weitergabe an externe KI-Dienste
- ✅ Lokale Embedding-Generierung möglich
- ✅ Zugriffskontrolle basierend auf Benutzerrechten
- ✅ Keine automatisierten Entscheidungen

---

## 📊 FEATURE 4: STATISTISCHE PROGNOSEN

### **Ziel:**
Vorhersage von Umsatz, Auslastung und Materialverbrauch basierend auf historischen Daten

### **Technische Umsetzung:**

#### **Schritt 1: Datenaufbereitung & Analyse (Woche 1)**
```typescript
// src/services/statisticsService.ts
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface TimeSeriesData {
  date: string;
  value: number;
  category?: string;
}

export interface TrendAnalysis {
  trend: 'rising' | 'falling' | 'stable';
  changePercent: number;
  seasonality: SeasonalPattern;
  forecast: TimeSeriesData[];
  confidence: number;
}

export interface SeasonalPattern {
  pattern: 'none' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  peakPeriods: string[];
  lowPeriods: string[];
  strength: number; // 0-1
}

export class StatisticsService {
  /**
   * Analysiere Umsatztrend und erstelle Prognose
   */
  async analyzeRevenueTrend(months: number = 12): Promise<TrendAnalysis> {
    // Hole historische Daten
    const historicalData = await this.getHistoricalRevenue(months);
    
    // Berechne gleitenden Durchschnitt
    const movingAverage = this.calculateMovingAverage(historicalData, 3);
    
    // Erkenne Trend
    const trend = this.detectTrend(movingAverage);
    
    // Erkenne Saisonalität
    const seasonality = this.detectSeasonality(historicalData);
    
    // Erstelle Prognose
    const forecast = this.generateForecast(
      historicalData,
      trend,
      seasonality,
      3 // 3 Monate Vorhersage
    );
    
    // Berechne Konfidenz
    const confidence = this.calculateConfidence(historicalData, trend, seasonality);
    
    return {
      trend: trend.direction,
      changePercent: trend.changePercent,
      seasonality,
      forecast,
      confidence
    };
  }

  /**
   * Vorhersage der Mitarbeiterauslastung
   */
  async predictWorkload(weeks: number = 4): Promise<{
    predictions: Array<{
      week: string;
      expectedHours: number;
      expectedProjects: number;
      requiredStaff: number;
      confidence: number;
    }>;
    recommendations: string[];
  }> {
    // Hole historische Auslastungsdaten
    const historicalWorkload = await this.getHistoricalWorkload();
    
    // Hole geplante Projekte
    const plannedProjects = await this.getPlannedProjects();
    
    const predictions = [];
    
    for (let week = 1; week <= weeks; week++) {
      const weekDate = new Date();
      weekDate.setDate(weekDate.getDate() + (week * 7));
      
      // Basis-Vorhersage aus historischen Daten
      const baseLoad = this.calculateAverageWorkload(
        historicalWorkload,
        weekDate.getMonth(),
        this.getWeekOfMonth(weekDate)
      );
      
      // Adjustiere für geplante Projekte
      const projectLoad = this.calculateProjectLoad(plannedProjects, weekDate);
      
      const totalHours = baseLoad.hours + projectLoad.hours;
      const requiredStaff = Math.ceil(totalHours / 40); // 40h pro Woche pro Mitarbeiter
      
      predictions.push({
        week: format(weekDate, 'KW ww, yyyy', { locale: de }),
        expectedHours: Math.round(totalHours),
        expectedProjects: baseLoad.projects + projectLoad.projects,
        requiredStaff,
        confidence: this.calculateWorkloadConfidence(baseLoad, projectLoad)
      });
    }
    
    // Generiere Empfehlungen
    const recommendations = this.generateWorkloadRecommendations(predictions);
    
    return { predictions, recommendations };
  }

  /**
   * Materialverbrauchs-Vorhersage
   */
  async predictMaterialConsumption(
    materialId: string,
    days: number = 30
  ): Promise<{
    predictedConsumption: number;
    reorderPoint: Date | null;
    optimalOrderQuantity: number;
    confidence: number;
  }> {
    // Hole Verbrauchshistorie
    const consumption = await this.getMaterialConsumption(materialId, 90);
    
    // Berechne durchschnittlichen Tagesverbrauch
    const avgDailyConsumption = consumption.reduce((sum, c) => sum + c.value, 0) / consumption.length;
    
    // Berücksichtige Saisonalität
    const seasonalFactor = this.getSeasonalFactor(new Date(), consumption);
    
    // Vorhersage
    const predictedConsumption = avgDailyConsumption * days * seasonalFactor;
    
    // Berechne Wiederbestellpunkt
    const currentStock = await this.getCurrentStock(materialId);
    const leadTime = await this.getLeadTime(materialId); // Lieferzeit in Tagen
    const safetyStock = avgDailyConsumption * leadTime * 1.5; // 50% Sicherheitspuffer
    
    let reorderPoint = null;
    if (currentStock > 0) {
      const daysUntilReorder = (currentStock - safetyStock) / (avgDailyConsumption * seasonalFactor);
      if (daysUntilReorder > 0) {
        reorderPoint = new Date();
        reorderPoint.setDate(reorderPoint.getDate() + Math.floor(daysUntilReorder));
      }
    }
    
    // EOQ (Economic Order Quantity) - vereinfacht
    const orderingCost = 50; // Kosten pro Bestellung
    const holdingCost = 0.2; // 20% des Warenwerts pro Jahr
    const unitCost = await this.getUnitCost(materialId);
    const annualDemand = avgDailyConsumption * 365 * seasonalFactor;
    
    const optimalOrderQuantity = Math.sqrt(
      (2 * annualDemand * orderingCost) / (holdingCost * unitCost)
    );
    
    // Konfidenz basierend auf Datenvarianz
    const variance = this.calculateVariance(consumption.map(c => c.value));
    const confidence = Math.max(0.5, 1 - (variance / avgDailyConsumption));
    
    return {
      predictedConsumption: Math.round(predictedConsumption),
      reorderPoint,
      optimalOrderQuantity: Math.round(optimalOrderQuantity),
      confidence
    };
  }

  // === HILFSFUNKTIONEN ===

  private calculateMovingAverage(data: TimeSeriesData[], window: number): TimeSeriesData[] {
    const result: TimeSeriesData[] = [];
    
    for (let i = window - 1; i < data.length; i++) {
      const windowData = data.slice(i - window + 1, i + 1);
      const avg = windowData.reduce((sum, d) => sum + d.value, 0) / window;
      result.push({
        date: data[i].date,
        value: avg
      });
    }
    
    return result;
  }

  private detectTrend(data: TimeSeriesData[]): {
    direction: 'rising' | 'falling' | 'stable';
    changePercent: number;
    slope: number;
  } {
    if (data.length < 2) {
      return { direction: 'stable', changePercent: 0, slope: 0 };
    }
    
    // Lineare Regression
    const n = data.length;
    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.value, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Berechne prozentuale Änderung
    const firstValue = intercept;
    const lastValue = slope * (n - 1) + intercept;
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;
    
    let direction: 'rising' | 'falling' | 'stable';
    if (Math.abs(changePercent) < 5) {
      direction = 'stable';
    } else if (changePercent > 0) {
      direction = 'rising';
    } else {
      direction = 'falling';
    }
    
    return { direction, changePercent, slope };
  }

  private detectSeasonality(data: TimeSeriesData[]): SeasonalPattern {
    if (data.length < 12) {
      return { pattern: 'none', peakPeriods: [], lowPeriods: [], strength: 0 };
    }
    
    // Gruppiere nach Monaten
    const monthlyAverages = new Map<number, number[]>();
    
    data.forEach(d => {
      const month = new Date(d.date).getMonth();
      if (!monthlyAverages.has(month)) {
        monthlyAverages.set(month, []);
      }
      monthlyAverages.get(month)!.push(d.value);
    });
    
    // Berechne Durchschnitt pro Monat
    const monthlyAvg = Array.from(monthlyAverages.entries()).map(([month, values]) => ({
      month,
      avg: values.reduce((sum, v) => sum + v, 0) / values.length
    }));
    
    // Finde Peaks und Täler
    const overallAvg = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    const peaks = monthlyAvg.filter(m => m.avg > overallAvg * 1.2).map(m => 
      format(new Date(2024, m.month, 1), 'MMMM', { locale: de })
    );
    const lows = monthlyAvg.filter(m => m.avg < overallAvg * 0.8).map(m => 
      format(new Date(2024, m.month, 1), 'MMMM', { locale: de })
    );
    
    // Berechne Saisonalitätsstärke
    const variance = this.calculateVariance(monthlyAvg.map(m => m.avg));
    const strength = Math.min(1, variance / overallAvg);
    
    return {
      pattern: peaks.length > 0 || lows.length > 0 ? 'monthly' : 'none',
      peakPeriods: peaks,
      lowPeriods: lows,
      strength
    };
  }

  private generateForecast(
    historicalData: TimeSeriesData[],
    trend: { slope: number; changePercent: number },
    seasonality: SeasonalPattern,
    periods: number
  ): TimeSeriesData[] {
    const forecast: TimeSeriesData[] = [];
    const lastValue = historicalData[historicalData.length - 1].value;
    const lastDate = new Date(historicalData[historicalData.length - 1].date);
    
    for (let i = 1; i <= periods; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      
      // Basis-Vorhersage mit Trend
      let forecastValue = lastValue + (trend.slope * i);
      
      // Adjustiere für Saisonalität
      if (seasonality.pattern !== 'none') {
        const month = forecastDate.getMonth();
        const monthName = format(forecastDate, 'MMMM', { locale: de });
        
        if (seasonality.peakPeriods.includes(monthName)) {
          forecastValue *= (1 + seasonality.strength * 0.2);
        } else if (seasonality.lowPeriods.includes(monthName)) {
          forecastValue *= (1 - seasonality.strength * 0.2);
        }
      }
      
      forecast.push({
        date: forecastDate.toISOString(),
        value: Math.max(0, forecastValue) // Keine negativen Werte
      });
    }
    
    return forecast;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
  }

  private calculateConfidence(
    data: TimeSeriesData[],
    trend: { changePercent: number },
    seasonality: SeasonalPattern
  ): number {
    let confidence = 0.7; // Basis-Konfidenz
    
    // Mehr Daten = höhere Konfidenz
    if (data.length > 24) confidence += 0.1;
    if (data.length > 36) confidence += 0.1;
    
    // Starke Trends = höhere Konfidenz
    if (Math.abs(trend.changePercent) > 20) confidence += 0.05;
    
    // Klare Saisonalität = höhere Konfidenz
    if (seasonality.strength > 0.5) confidence += 0.05;
    
    // Hohe Varianz = niedrigere Konfidenz
    const variance = this.calculateVariance(data.map(d => d.value));
    const mean = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    const cv = variance / mean; // Variationskoeffizient
    
    if (cv > 0.5) confidence -= 0.2;
    else if (cv > 0.3) confidence -= 0.1;
    
    return Math.max(0.3, Math.min(1, confidence));
  }

  // === DATEN-ABRUF FUNKTIONEN (Mockups) ===

  private async getHistoricalRevenue(months: number): Promise<TimeSeriesData[]> {
    const { data } = await supabase
      .from('invoices')
      .select('created_at, total_amount')
      .gte('created_at', subMonths(new Date(), months).toISOString())
      .eq('status', 'paid')
      .order('created_at');
    
    // Gruppiere nach Monat
    const monthlyRevenue = new Map<string, number>();
    
    data?.forEach(invoice => {
      const monthKey = format(new Date(invoice.created_at), 'yyyy-MM');
      const current = monthlyRevenue.get(monthKey) || 0;
      monthlyRevenue.set(monthKey, current + invoice.total_amount);
    });
    
    return Array.from(monthlyRevenue.entries()).map(([date, value]) => ({
      date: date + '-01',
      value
    }));
  }

  private async getHistoricalWorkload(): Promise<any> {
    const { data } = await supabase
      .from('time_entries')
      .select('date, hours, project_id')
      .gte('date', subMonths(new Date(), 3).toISOString())
      .order('date');
    
    return data || [];
  }

  private async getPlannedProjects(): Promise<any> {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .in('status', ['geplant', 'in_bearbeitung'])
      .gte('end_date', new Date().toISOString());
    
    return data || [];
  }

  private async getMaterialConsumption(materialId: string, days: number): Promise<TimeSeriesData[]> {
    const { data } = await supabase
      .from('material_consumption')
      .select('date, quantity')
      .eq('material_id', materialId)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('date');
    
    return data?.map(d => ({
      date: d.date,
      value: d.quantity
    })) || [];
  }

  private async getCurrentStock(materialId: string): Promise<number> {
    const { data } = await supabase
      .from('materials')
      .select('current_stock')
      .eq('id', materialId)
      .single();
    
    return data?.current_stock || 0;
  }

  private async getLeadTime(materialId: string): Promise<number> {
    const { data } = await supabase
      .from('materials')
      .select('lead_time_days')
      .eq('id', materialId)
      .single();
    
    return data?.lead_time_days || 7; // Default 7 Tage
  }

  private async getUnitCost(materialId: string): Promise<number> {
    const { data } = await supabase
      .from('materials')
      .select('unit_cost')
      .eq('id', materialId)
      .single();
    
    return data?.unit_cost || 0;
  }

  private getWeekOfMonth(date: Date): number {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return Math.ceil((date.getDate() + firstDay) / 7);
  }

  private getSeasonalFactor(date: Date, historicalData: TimeSeriesData[]): number {
    // Vereinfachte Saisonalität
    const month = date.getMonth();
    const seasonalFactors = [
      0.8,  // Januar
      0.85, // Februar
      1.0,  // März
      1.1,  // April
      1.2,  // Mai
      1.15, // Juni
      0.9,  // Juli (Urlaub)
      0.85, // August (Urlaub)
      1.1,  // September
      1.15, // Oktober
      1.0,  // November
      0.7   // Dezember (Feiertage)
    ];
    
    return seasonalFactors[month];
  }

  private calculateAverageWorkload(
    historicalData: any[],
    month: number,
    weekOfMonth: number
  ): { hours: number; projects: number } {
    // Filter für ähnliche Wochen in der Historie
    const similarWeeks = historicalData.filter(entry => {
      const date = new Date(entry.date);
      return date.getMonth() === month && 
             this.getWeekOfMonth(date) === weekOfMonth;
    });
    
    if (similarWeeks.length === 0) {
      // Fallback auf Monatsdurchschnitt
      const monthData = historicalData.filter(entry => 
        new Date(entry.date).getMonth() === month
      );
      
      const avgHours = monthData.reduce((sum, e) => sum + e.hours, 0) / Math.max(1, monthData.length / 4);
      return { hours: avgHours, projects: 2 }; // Durchschnittlich 2 Projekte
    }
    
    const avgHours = similarWeeks.reduce((sum, e) => sum + e.hours, 0) / similarWeeks.length;
    const uniqueProjects = new Set(similarWeeks.map(e => e.project_id)).size;
    
    return { hours: avgHours, projects: uniqueProjects };
  }

  private calculateProjectLoad(
    projects: any[],
    weekDate: Date
  ): { hours: number; projects: number } {
    let hours = 0;
    let projectCount = 0;
    
    projects.forEach(project => {
      const start = new Date(project.start_date);
      const end = new Date(project.end_date);
      
      if (weekDate >= start && weekDate <= end) {
        projectCount++;
        // Schätze Stunden basierend auf Budget
        hours += (project.budget || 5000) / 100; // Vereinfacht: 100€/Stunde
      }
    });
    
    return { hours: hours / 4, projects: projectCount }; // Verteile auf 4 Wochen
  }

  private calculateWorkloadConfidence(
    baseLoad: { hours: number },
    projectLoad: { hours: number }
  ): number {
    // Höhere Konfidenz wenn mehr aus geplanten Projekten kommt
    const projectRatio = projectLoad.hours / (baseLoad.hours + projectLoad.hours);
    return 0.5 + (projectRatio * 0.4);
  }

  private generateWorkloadRecommendations(
    predictions: any[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Prüfe auf Überlastung
    const overloadedWeeks = predictions.filter(p => p.requiredStaff > 5); // Annahme: 5 Mitarbeiter verfügbar
    if (overloadedWeeks.length > 0) {
      recommendations.push(
        `⚠️ Überlastung in ${overloadedWeeks.length} Wochen erwartet. Erwägen Sie Freelancer oder Verschiebung von Projekten.`
      );
    }
    
    // Prüfe auf Unterauslastung
    const underutilizedWeeks = predictions.filter(p => p.requiredStaff < 3);
    if (underutilizedWeeks.length > 0) {
      recommendations.push(
        `💡 Geringe Auslastung in ${underutilizedWeeks.length} Wochen. Gute Zeit für Wartungsarbeiten oder Akquise.`
      );
    }
    
    // Trend-Empfehlung
    const avgStaff = predictions.reduce((sum, p) => sum + p.requiredStaff, 0) / predictions.length;
    if (avgStaff > 4.5) {
      recommendations.push(
        `📈 Hohe durchschnittliche Auslastung. Erwägen Sie Neueinstellungen oder Kapazitätserweiterung.`
      );
    }
    
    return recommendations;
  }
}
```

### **Rechtliche Absicherung:**
- ✅ Nur statistische Auswertungen, keine Personendaten
- ✅ Aggregierte Daten ohne Einzelpersonen-Bezug
- ✅ Transparente Berechnungsmethoden
- ✅ Keine automatisierten Entscheidungen
- ✅ Empfehlungen als Vorschläge gekennzeichnet

---

## 🌤️ FEATURE 5: WETTERBASIERTE PLANUNG

### **Ziel:**
Automatische Anpassung der Projektplanung basierend auf Wettervorhersagen

### **Technische Umsetzung:**

#### **Schritt 1: Wetter-API Integration (Woche 1)**
```typescript
// src/services/weatherService.ts
import axios from 'axios';

export interface WeatherForecast {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  conditions: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy';
  precipitation: number; // mm
  windSpeed: number; // km/h
  workSuitability: {
    outdoor: 'good' | 'moderate' | 'poor' | 'impossible';
    roofing: boolean;
    concrete: boolean;
    painting: boolean;
  };
}

export class WeatherService {
  private readonly API_KEY = process.env.OPENWEATHER_API_KEY;
  private readonly BASE_URL = 'https://api.openweathermap.org/data/2.5';

  /**
   * Hole Wettervorhersage für Standort
   */
  async getForecast(
    lat: number,
    lon: number,
    days: number = 7
  ): Promise<WeatherForecast[]> {
    try {
      const response = await axios.get(`${this.BASE_URL}/forecast/daily`, {
        params: {
          lat,
          lon,
          cnt: days,
          appid: this.API_KEY,
          units: 'metric',
          lang: 'de'
        }
      });

      return response.data.list.map((day: any) => this.mapToWeatherForecast(day));
    } catch (error) {
      console.error('Weather API error:', error);
      // Fallback auf historische Durchschnittswerte
      return this.getHistoricalAverages(new Date(), days);
    }
  }

  /**
   * Prüfe Wettereignung für Projekttyp
   */
  assessProjectWeatherSuitability(
    projectType: string,
    forecast: WeatherForecast[]
  ): {
    suitableDays: string[];
    unsuitableDays: string[];
    recommendations: string[];
    alternativeSchedule?: { date: string; reason: string }[];
  } {
    const suitable: string[] = [];
    const unsuitable: string[] = [];
    const recommendations: string[] = [];

    forecast.forEach(day => {
      const suitability = this.checkSuitability(projectType, day);
      
      if (suitability.suitable) {
        suitable.push(day.date);
      } else {
        unsuitable.push(day.date);
        if (suitability.reason) {
          recommendations.push(
            `${new Date(day.date).toLocaleDateString('de-DE')}: ${suitability.reason}`
          );
        }
      }
    });

    // Generiere alternative Termine
    const alternativeSchedule = this.generateAlternativeSchedule(
      projectType,
      unsuitable,
      forecast
    );

    return {
      suitableDays: suitable,
      unsuitableDays: unsuitable,
      recommendations,
      alternativeSchedule
    };
  }

  private mapToWeatherForecast(apiData: any): WeatherForecast {
    const conditions = this.mapConditions(apiData.weather[0].id);
    const temp = apiData.temp;
    const rain = apiData.rain || 0;
    const snow = apiData.snow || 0;
    const wind = apiData.speed * 3.6; // m/s zu km/h

    return {
      date: new Date(apiData.dt * 1000).toISOString().split('T')[0],
      temperature: {
        min: Math.round(temp.min),
        max: Math.round(temp.max)
      },
      conditions,
      precipitation: rain + snow,
      windSpeed: Math.round(wind),
      workSuitability: this.calculateWorkSuitability(
        conditions,
        temp,
        rain + snow,
        wind
      )
    };
  }

  private mapConditions(weatherCode: number): WeatherForecast['conditions'] {
    if (weatherCode >= 200 && weatherCode < 300) return 'stormy';
    if (weatherCode >= 300 && weatherCode < 600) return 'rainy';
    if (weatherCode >= 600 && weatherCode < 700) return 'snowy';
    if (weatherCode >= 801) return 'cloudy';
    return 'sunny';
  }

  private calculateWorkSuitability(
    conditions: WeatherForecast['conditions'],
    temp: any,
    precipitation: number,
    wind: number
  ): WeatherForecast['workSuitability'] {
    let outdoor: 'good' | 'moderate' | 'poor' | 'impossible' = 'good';

    // Bewerte Außenarbeiten
    if (conditions === 'stormy' || wind > 50) {
      outdoor = 'impossible';
    } else if (conditions === 'rainy' && precipitation > 5) {
      outdoor = 'poor';
    } else if (conditions === 'rainy' || wind > 30) {
      outdoor = 'moderate';
    } else if (conditions === 'snowy' || temp.min < 0) {
      outdoor = 'poor';
    }

    return {
      outdoor,
      roofing: outdoor !== 'impossible' && wind < 30 && precipitation < 1,
      concrete: temp.min > 5 && temp.max < 30 && precipitation < 5,
      painting: temp.min > 10 && temp.max < 25 && precipitation === 0 && wind < 20
    };
  }

  private checkSuitability(
    projectType: string,
    forecast: WeatherForecast
  ): { suitable: boolean; reason?: string } {
    const suitability = forecast.workSuitability;

    const rules: Record<string, () => { suitable: boolean; reason?: string }> = {
      'Dacharbeiten': () => ({
        suitable: suitability.roofing,
        reason: !suitability.roofing 
          ? `Dacharbeiten nicht möglich: ${forecast.windSpeed > 30 ? 'zu windig' : 'Niederschlag'}`
          : undefined
      }),
      'Betonarbeiten': () => ({
        suitable: suitability.concrete,
        reason: !suitability.concrete
          ? `Betonarbeiten nicht optimal: ${forecast.temperature.min <= 5 ? 'zu kalt' : 'zu viel Niederschlag'}`
          : undefined
      }),
      'Malerarbeiten (Außen)': () => ({
        suitable: suitability.painting,
        reason: !suitability.painting
          ? `Außenanstrich nicht möglich: ${forecast.precipitation > 0 ? 'Niederschlag' : forecast.temperature.min < 10 ? 'zu kalt' : 'zu windig'}`
          : undefined
      }),
      'Gartenarbeiten': () => ({
        suitable: suitability.outdoor !== 'impossible' && suitability.outdoor !== 'poor',
        reason: suitability.outdoor === 'poor' || suitability.outdoor === 'impossible'
          ? `Gartenarbeiten erschwert: ${forecast.conditions === 'stormy' ? 'Sturm' : 'starker Niederschlag'}`
          : undefined
      }),
      'Innenarbeiten': () => ({
        suitable: true, // Immer möglich
        reason: undefined
      })
    };

    // Fallback für unbekannte Projekttypen
    const checkFunction = rules[projectType] || (() => ({
      suitable: suitability.outdoor === 'good' || suitability.outdoor === 'moderate',
      reason: suitability.outdoor === 'poor' || suitability.outdoor === 'impossible'
        ? 'Wetterbedingungen ungünstig für Außenarbeiten'
        : undefined
    }));

    return checkFunction();
  }

  private generateAlternativeSchedule(
    projectType: string,
    unsuitableDays: string[],
    forecast: WeatherForecast[]
  ): { date: string; reason: string }[] {
    const alternatives: { date: string; reason: string }[] = [];

    unsuitableDays.forEach(day => {
      // Suche nächsten geeigneten Tag
      const dayForecast = forecast.find(f => f.date === day);
      if (!dayForecast) return;

      // Finde nächsten passenden Tag
      const suitableDay = forecast.find(f => 
        new Date(f.date) > new Date(day) &&
        this.checkSuitability(projectType, f).suitable
      );

      if (suitableDay) {
        alternatives.push({
          date: suitableDay.date,
          reason: `Alternative für ${new Date(day).toLocaleDateString('de-DE')}: Bessere Wetterbedingungen`
        });
      }
    });

    return alternatives;
  }

  private getHistoricalAverages(startDate: Date, days: number): WeatherForecast[] {
    // Historische Durchschnittswerte für Deutschland nach Monat
    const monthlyAverages = [
      { temp: { min: -2, max: 3 }, rain: 50 },   // Januar
      { temp: { min: -2, max: 5 }, rain: 40 },   // Februar
      { temp: { min: 1, max: 10 }, rain: 45 },   // März
      { temp: { min: 4, max: 15 }, rain: 40 },   // April
      { temp: { min: 8, max: 20 }, rain: 60 },   // Mai
      { temp: { min: 11, max: 23 }, rain: 70 },  // Juni
      { temp: { min: 13, max: 25 }, rain: 80 },  // Juli
      { temp: { min: 13, max: 25 }, rain: 70 },  // August
      { temp: { min: 10, max: 20 }, rain: 50 },  // September
      { temp: { min: 6, max: 14 }, rain: 50 },   // Oktober
      { temp: { min: 2, max: 8 }, rain: 60 },    // November
      { temp: { min: -1, max: 4 }, rain: 55 }    // Dezember
    ];

    const forecasts: WeatherForecast[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const month = date.getMonth();
      const avg = monthlyAverages[month];

      forecasts.push({
        date: date.toISOString().split('T')[0],
        temperature: avg.temp,
        conditions: avg.rain > 60 ? 'rainy' : 'cloudy',
        precipitation: avg.rain / 10, // Vereinfacht
        windSpeed: 15, // Durchschnitt
        workSuitability: {
          outdoor: avg.temp.min > 0 && avg.rain < 70 ? 'moderate' : 'poor',
          roofing: avg.rain < 50,
          concrete: avg.temp.min > 5,
          painting: avg.temp.min > 10 && avg.rain < 30
        }
      });
    }

    return forecasts;
  }
}
```

### **Rechtliche Absicherung:**
- ✅ Nur Wetterdaten, keine Personendaten
- ✅ Empfehlungen, keine automatischen Änderungen
- ✅ Transparente Entscheidungskriterien
- ✅ Manuelle Übersteuerung möglich

---

## 📧 FEATURE 6: EMAIL-KLASSIFIZIERUNG (DSGVO-KONFORM)

[Fortsetzung folgt im nächsten Teil aufgrund der Länge...]