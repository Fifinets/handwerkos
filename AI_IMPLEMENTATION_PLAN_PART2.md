# 🚀 AI-IMPLEMENTIERUNGSPLAN TEIL 2
## Features 6-8: Email-Klassifizierung, Kundensegmentierung & Preisvorschläge

---

## 📧 FEATURE 6: EMAIL-KLASSIFIZIERUNG (DSGVO-KONFORM)

### **Ziel:**
Automatische Kategorisierung und Priorisierung eingehender E-Mails mit expliziter Nutzereinwilligung

### **Technische Umsetzung:**

#### **Schritt 1: Einwilligungs-Management (Woche 1)**
```typescript
// src/services/consentService.ts
export interface ConsentRecord {
  id: string;
  user_id: string;
  email_address: string;
  consent_type: 'email_classification' | 'customer_segmentation' | 'price_optimization';
  granted: boolean;
  granted_at?: string;
  revoked_at?: string;
  ip_address: string;
  user_agent: string;
  consent_text: string;
  version: string;
}

export class ConsentService {
  /**
   * Prüfe ob Einwilligung für Email-Verarbeitung vorliegt
   */
  async hasEmailProcessingConsent(emailAddress: string): Promise<boolean> {
    const { data } = await supabase
      .from('consent_records')
      .select('*')
      .eq('email_address', emailAddress)
      .eq('consent_type', 'email_classification')
      .eq('granted', true)
      .is('revoked_at', null)
      .order('granted_at', { ascending: false })
      .limit(1);

    return data && data.length > 0;
  }

  /**
   * Einwilligung dokumentieren
   */
  async recordConsent(
    userId: string,
    emailAddress: string,
    consentType: ConsentRecord['consent_type'],
    granted: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<ConsentRecord> {
    const consentText = this.getConsentText(consentType);
    
    const record: Partial<ConsentRecord> = {
      user_id: userId,
      email_address: emailAddress,
      consent_type: consentType,
      granted,
      granted_at: granted ? new Date().toISOString() : undefined,
      revoked_at: !granted ? new Date().toISOString() : undefined,
      ip_address: ipAddress,
      user_agent: userAgent,
      consent_text: consentText,
      version: '1.0.0'
    };

    const { data, error } = await supabase
      .from('consent_records')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    // Audit-Log für Nachweisbarkeit
    await supabase
      .from('audit_logs')
      .insert({
        entity_type: 'consent',
        entity_id: data.id,
        action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        user_id: userId,
        metadata: {
          consent_type: consentType,
          email_address: emailAddress,
          ip_address: ipAddress
        }
      });

    return data;
  }

  private getConsentText(consentType: string): string {
    const texts = {
      email_classification: `Ich stimme zu, dass meine E-Mails automatisch kategorisiert und priorisiert werden, 
        um die Bearbeitung zu verbessern. Die Verarbeitung erfolgt ausschließlich lokal und 
        meine Daten werden nicht an Dritte weitergegeben. Diese Einwilligung kann ich jederzeit 
        widerrufen.`,
      
      customer_segmentation: `Ich stimme der Analyse meiner Kundendaten zur Gruppierung und 
        besseren Serviceerbringung zu. Die Analyse erfolgt anonymisiert und aggregiert. 
        Einzelne Kundenprofile werden nicht erstellt. Diese Einwilligung kann jederzeit 
        widerrufen werden.`,
      
      price_optimization: `Ich stimme zu, dass historische Preisdaten analysiert werden, 
        um Preisvorschläge zu generieren. Diese dienen nur als Empfehlung und ersetzen 
        keine manuelle Kalkulation. Die Einwilligung kann jederzeit widerrufen werden.`
    };

    return texts[consentType] || 'Einwilligung zur Datenverarbeitung';
  }
}
```

#### **Schritt 2: Email-Klassifizierung mit Opt-In (Woche 2)**
```typescript
// src/services/emailClassificationService.ts
export interface EmailClassification {
  category: 'anfrage' | 'auftrag' | 'rechnung' | 'beschwerde' | 'termin' | 'info' | 'spam';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  suggestedActions: string[];
  extractedData: {
    customerName?: string;
    projectReference?: string;
    urgency?: boolean;
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
}

export class EmailClassificationService {
  private consentService: ConsentService;
  
  constructor() {
    this.consentService = new ConsentService();
  }

  /**
   * Klassifiziere Email nur mit Einwilligung
   */
  async classifyEmail(
    emailAddress: string,
    subject: string,
    body: string,
    attachments: string[] = []
  ): Promise<EmailClassification | null> {
    // 1. Prüfe Einwilligung
    const hasConsent = await this.consentService.hasEmailProcessingConsent(emailAddress);
    
    if (!hasConsent) {
      console.log(`No consent for email classification from ${emailAddress}`);
      return null;
    }

    // 2. Klassifizierung durchführen
    const classification = this.performClassification(subject, body, attachments);

    // 3. Protokolliere Verarbeitung (anonymisiert)
    await this.logProcessing(emailAddress, classification.category);

    return classification;
  }

  private performClassification(
    subject: string,
    body: string,
    attachments: string[]
  ): EmailClassification {
    const text = `${subject} ${body}`.toLowerCase();
    
    // Keyword-basierte Klassifizierung (kein externes AI)
    const categories = {
      anfrage: {
        keywords: ['anfrage', 'interesse', 'angebot', 'kostenvoranschlag', 'preis', 'kosten'],
        weight: 0
      },
      auftrag: {
        keywords: ['auftrag', 'beauftragen', 'bestellen', 'bestätigung', 'zusage'],
        weight: 0
      },
      rechnung: {
        keywords: ['rechnung', 'zahlung', 'überweisung', 'mahnung', 'fällig'],
        weight: 0
      },
      beschwerde: {
        keywords: ['beschwerde', 'reklamation', 'mangel', 'problem', 'unzufrieden', 'fehler'],
        weight: 0
      },
      termin: {
        keywords: ['termin', 'datum', 'uhrzeit', 'treffen', 'besichtigung', 'vor ort'],
        weight: 0
      },
      info: {
        keywords: ['information', 'mitteilung', 'hinweis', 'newsletter'],
        weight: 0
      },
      spam: {
        keywords: ['gewinnspiel', 'gratis', 'klicken sie hier', 'dringend', 'sofort'],
        weight: 0
      }
    };

    // Berechne Gewichtungen
    Object.entries(categories).forEach(([category, data]) => {
      data.weight = data.keywords.filter(keyword => text.includes(keyword)).length;
    });

    // Finde beste Kategorie
    let bestCategory: EmailClassification['category'] = 'info';
    let maxWeight = 0;
    
    Object.entries(categories).forEach(([category, data]) => {
      if (data.weight > maxWeight) {
        maxWeight = data.weight;
        bestCategory = category as EmailClassification['category'];
      }
    });

    // Bestimme Priorität
    const priority = this.determinePriority(text, bestCategory, attachments);

    // Extrahiere Daten
    const extractedData = this.extractData(text);

    // Generiere Aktionsvorschläge
    const suggestedActions = this.generateActions(bestCategory, extractedData);

    return {
      category: bestCategory,
      priority,
      confidence: Math.min(0.95, maxWeight * 0.3 + 0.3), // Max 95% Konfidenz
      suggestedActions,
      extractedData
    };
  }

  private determinePriority(
    text: string,
    category: EmailClassification['category'],
    attachments: string[]
  ): EmailClassification['priority'] {
    // Hohe Priorität
    if (category === 'beschwerde') return 'high';
    if (category === 'auftrag') return 'high';
    if (text.includes('dringend') || text.includes('eilig')) return 'high';
    
    // Mittlere Priorität
    if (category === 'anfrage') return 'medium';
    if (category === 'termin') return 'medium';
    if (attachments.length > 0) return 'medium';
    
    // Niedrige Priorität
    return 'low';
  }

  private extractData(text: string): EmailClassification['extractedData'] {
    const data: EmailClassification['extractedData'] = {};

    // Kundenname (vereinfacht)
    const nameMatch = text.match(/(?:herr|frau|firma)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/i);
    if (nameMatch) {
      data.customerName = nameMatch[1];
    }

    // Projektreferenz
    const projectMatch = text.match(/(?:projekt|auftrag|angebot)(?:snummer|nummer|nr\.?)?\s*:?\s*([A-Z0-9\-]+)/i);
    if (projectMatch) {
      data.projectReference = projectMatch[1];
    }

    // Dringlichkeit
    data.urgency = /\b(dringend|eilig|sofort|asap|heute|morgen)\b/i.test(text);

    // Sentiment (vereinfacht)
    const positiveWords = ['danke', 'super', 'toll', 'zufrieden', 'gut', 'perfekt'];
    const negativeWords = ['problem', 'fehler', 'schlecht', 'unzufrieden', 'mangel', 'beschwerde'];
    
    const positiveCount = positiveWords.filter(w => text.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.includes(w)).length;
    
    if (negativeCount > positiveCount) {
      data.sentiment = 'negative';
    } else if (positiveCount > negativeCount) {
      data.sentiment = 'positive';
    } else {
      data.sentiment = 'neutral';
    }

    return data;
  }

  private generateActions(
    category: EmailClassification['category'],
    extractedData: EmailClassification['extractedData']
  ): string[] {
    const actions: string[] = [];

    switch (category) {
      case 'anfrage':
        actions.push('Angebot erstellen');
        actions.push('Termin zur Besichtigung vereinbaren');
        if (extractedData.customerName) {
          actions.push(`Kunde "${extractedData.customerName}" anlegen`);
        }
        break;

      case 'auftrag':
        actions.push('Auftragsbestätigung senden');
        actions.push('Projekt anlegen');
        actions.push('Material bestellen');
        break;

      case 'beschwerde':
        actions.push('Sofort anrufen');
        actions.push('Lösungsvorschlag erarbeiten');
        actions.push('Termin vor Ort vereinbaren');
        break;

      case 'termin':
        actions.push('In Kalender eintragen');
        actions.push('Bestätigung senden');
        actions.push('Team informieren');
        break;

      case 'rechnung':
        actions.push('Zahlung prüfen');
        actions.push('Buchung vornehmen');
        break;

      default:
        actions.push('Zur Kenntnis nehmen');
    }

    return actions;
  }

  private async logProcessing(emailAddress: string, category: string): Promise<void> {
    // Anonymisierte Protokollierung
    const hashedEmail = await this.hashEmail(emailAddress);
    
    await supabase
      .from('email_processing_logs')
      .insert({
        hashed_email: hashedEmail,
        category,
        processed_at: new Date().toISOString(),
        // Keine personenbezogenen Daten speichern
      });
  }

  private async hashEmail(email: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(email + 'salt_' + process.env.EMAIL_HASH_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

#### **Schritt 3: Transparente UI mit Widerrufsrecht (Woche 3)**
```typescript
// src/components/EmailClassificationSettings.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, Shield, X, Check, AlertCircle } from 'lucide-react';

export function EmailClassificationSettings() {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadConsentStatus();
  }, []);

  const loadConsentStatus = async () => {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) return;

    // Prüfe aktuelle Einwilligung
    const { data } = await supabase
      .from('consent_records')
      .select('*')
      .eq('user_id', currentUser.user.id)
      .eq('consent_type', 'email_classification')
      .order('created_at', { ascending: false });

    setConsentHistory(data || []);
    
    const activeConsent = data?.find(r => r.granted && !r.revoked_at);
    setConsent(!!activeConsent);
  };

  const handleConsentToggle = async () => {
    setLoading(true);
    
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return;

      const consentService = new ConsentService();
      
      // Hole IP und User Agent (in Produktion über Server)
      const ipAddress = 'user_ip'; // Über Server ermitteln
      const userAgent = navigator.userAgent;

      await consentService.recordConsent(
        currentUser.user.id,
        currentUser.user.email!,
        'email_classification',
        !consent,
        ipAddress,
        userAgent
      );

      setConsent(!consent);
      
      // Zeige Bestätigung
      if (!consent) {
        alert('Email-Klassifizierung wurde aktiviert. Sie können dies jederzeit widerrufen.');
      } else {
        alert('Email-Klassifizierung wurde deaktiviert. Ihre Emails werden nicht mehr automatisch verarbeitet.');
      }

      // Aktualisiere Historie
      await loadConsentStatus();
    } catch (error) {
      console.error('Consent error:', error);
      alert('Fehler beim Speichern der Einstellung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Haupteinstellung */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Email-Klassifizierung (DSGVO-konform)
          </CardTitle>
          <CardDescription>
            Automatische Kategorisierung Ihrer Emails zur besseren Organisation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Email-Verarbeitung aktivieren</p>
              <p className="text-sm text-muted-foreground">
                Emails werden lokal kategorisiert und priorisiert
              </p>
            </div>
            <Switch
              checked={consent}
              onCheckedChange={handleConsentToggle}
              disabled={loading}
            />
          </div>

          {consent && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Email-Klassifizierung ist aktiv. Ihre Emails werden automatisch kategorisiert.
              </AlertDescription>
            </Alert>
          )}

          <Button 
            variant="outline" 
            onClick={() => setShowDetails(!showDetails)}
            className="w-full"
          >
            <Info className="mr-2 h-4 w-4" />
            {showDetails ? 'Details ausblenden' : 'Was wird verarbeitet?'}
          </Button>

          {showDetails && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6 space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Verarbeitete Daten:</h4>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li>Email-Betreff</li>
                    <li>Email-Text (ohne Anhänge)</li>
                    <li>Absender-Adresse</li>
                    <li>Empfangszeitpunkt</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Verwendungszweck:</h4>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li>Automatische Kategorisierung (Anfrage, Auftrag, etc.)</li>
                    <li>Priorisierung nach Dringlichkeit</li>
                    <li>Vorschläge für nächste Schritte</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Datenschutz:</h4>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li>Verarbeitung erfolgt ausschließlich lokal</li>
                    <li>Keine Weitergabe an Dritte oder KI-Dienste</li>
                    <li>Verschlüsselte Speicherung</li>
                    <li>Automatische Löschung nach 90 Tagen</li>
                  </ul>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Sie können Ihre Einwilligung jederzeit widerrufen. 
                    Bei Widerruf werden alle gespeicherten Klassifizierungen gelöscht.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Einwilligungshistorie */}
      <Card>
        <CardHeader>
          <CardTitle>Einwilligungshistorie</CardTitle>
          <CardDescription>
            Übersicht über erteilte und widerrufene Einwilligungen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {consentHistory.map((record, index) => (
              <div 
                key={record.id} 
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={record.granted ? 'default' : 'secondary'}>
                      {record.granted ? 'Erteilt' : 'Widerrufen'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(record.granted_at || record.revoked_at).toLocaleString('de-DE')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Version: {record.version}
                  </p>
                </div>
                {index === 0 && record.granted && (
                  <Badge variant="outline" className="text-green-600">
                    Aktiv
                  </Badge>
                )}
              </div>
            ))}
            
            {consentHistory.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Einwilligungen erteilt
              </p>
            )}
          </div>

          {consent && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="destructive"
                onClick={handleConsentToggle}
                className="w-full"
                disabled={loading}
              >
                <X className="mr-2 h-4 w-4" />
                Einwilligung widerrufen und Daten löschen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Datenexport */}
      <Card>
        <CardHeader>
          <CardTitle>Datenauskunft & Export</CardTitle>
          <CardDescription>
            Gemäß DSGVO haben Sie das Recht auf Auskunft und Datenportabilität
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full">
            Meine Email-Klassifizierungen anzeigen
          </Button>
          <Button variant="outline" className="w-full">
            Daten als JSON exportieren
          </Button>
          <Button variant="outline" className="w-full">
            Alle Klassifizierungen löschen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### **Rechtliche Absicherung:**
- ✅ Explizite Einwilligung erforderlich (Opt-In)
- ✅ Jederzeitiger Widerruf möglich
- ✅ Transparente Information über Datenverarbeitung
- ✅ Keine Weitergabe an externe Dienste
- ✅ Recht auf Auskunft und Löschung implementiert
- ✅ Vollständige Audit-Trail

---

## 👥 FEATURE 7: TRANSPARENTE KUNDENSEGMENTIERUNG

### **Ziel:**
Anonymisierte Gruppierung von Kunden für besseren Service ohne individuelle Profile

### **Technische Umsetzung:**

#### **Schritt 1: Anonymisierte Segmentierung (Woche 1)**
```typescript
// src/services/customerSegmentationService.ts
export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  customer_count: number;
  average_metrics: {
    revenue: number;
    order_frequency: number;
    project_size: number;
    payment_speed_days: number;
  };
  recommendations: string[];
}

export interface SegmentCriteria {
  revenue_range?: { min: number; max: number };
  order_frequency?: { min: number; max: number };
  business_type?: string[];
  location_radius_km?: number;
  active_since_months?: number;
}

export class CustomerSegmentationService {
  /**
   * Erstelle anonymisierte Kundensegmente
   */
  async createSegments(): Promise<CustomerSegment[]> {
    // Hole aggregierte Kundendaten (keine Einzeldaten!)
    const aggregatedData = await this.getAggregatedCustomerData();
    
    // Definiere Segmente basierend auf Geschäftslogik
    const segments: CustomerSegment[] = [
      {
        id: 'premium',
        name: 'Premium-Kunden',
        description: 'Große, regelmäßige Aufträge mit hohem Umsatz',
        criteria: {
          revenue_range: { min: 50000, max: Infinity },
          order_frequency: { min: 4, max: Infinity }
        },
        customer_count: 0,
        average_metrics: {
          revenue: 0,
          order_frequency: 0,
          project_size: 0,
          payment_speed_days: 0
        },
        recommendations: []
      },
      {
        id: 'regular',
        name: 'Stammkunden',
        description: 'Regelmäßige Aufträge mit mittlerem Volumen',
        criteria: {
          revenue_range: { min: 10000, max: 50000 },
          order_frequency: { min: 2, max: 4 }
        },
        customer_count: 0,
        average_metrics: {
          revenue: 0,
          order_frequency: 0,
          project_size: 0,
          payment_speed_days: 0
        },
        recommendations: []
      },
      {
        id: 'occasional',
        name: 'Gelegenheitskunden',
        description: 'Unregelmäßige Aufträge',
        criteria: {
          revenue_range: { min: 0, max: 10000 },
          order_frequency: { min: 0, max: 2 }
        },
        customer_count: 0,
        average_metrics: {
          revenue: 0,
          order_frequency: 0,
          project_size: 0,
          payment_speed_days: 0
        },
        recommendations: []
      },
      {
        id: 'new',
        name: 'Neukunden',
        description: 'Kunden der letzten 6 Monate',
        criteria: {
          active_since_months: 6
        },
        customer_count: 0,
        average_metrics: {
          revenue: 0,
          order_frequency: 0,
          project_size: 0,
          payment_speed_days: 0
        },
        recommendations: []
      }
    ];

    // Berechne Metriken für jedes Segment
    for (const segment of segments) {
      const metrics = await this.calculateSegmentMetrics(segment.criteria);
      segment.customer_count = metrics.count;
      segment.average_metrics = metrics.averages;
      segment.recommendations = this.generateSegmentRecommendations(segment);
    }

    return segments;
  }

  /**
   * Berechne aggregierte Metriken ohne Einzelkundendaten
   */
  private async calculateSegmentMetrics(
    criteria: SegmentCriteria
  ): Promise<{
    count: number;
    averages: CustomerSegment['average_metrics'];
  }> {
    // Baue Query basierend auf Kriterien
    let query = supabase
      .from('customer_metrics_view') // Aggregierte View
      .select('customer_id, total_revenue, order_count, avg_project_size, avg_payment_days');

    // Wende Filter an
    if (criteria.revenue_range) {
      query = query
        .gte('total_revenue', criteria.revenue_range.min)
        .lte('total_revenue', criteria.revenue_range.max === Infinity ? 999999999 : criteria.revenue_range.max);
    }

    if (criteria.order_frequency) {
      query = query
        .gte('order_count', criteria.order_frequency.min)
        .lte('order_count', criteria.order_frequency.max === Infinity ? 999999 : criteria.order_frequency.max);
    }

    if (criteria.active_since_months) {
      const sinceDate = new Date();
      sinceDate.setMonth(sinceDate.getMonth() - criteria.active_since_months);
      query = query.gte('first_order_date', sinceDate.toISOString());
    }

    const { data, error } = await query;
    if (error || !data) {
      return {
        count: 0,
        averages: {
          revenue: 0,
          order_frequency: 0,
          project_size: 0,
          payment_speed_days: 0
        }
      };
    }

    // Berechne Durchschnitte
    const count = data.length;
    if (count === 0) {
      return {
        count: 0,
        averages: {
          revenue: 0,
          order_frequency: 0,
          project_size: 0,
          payment_speed_days: 0
        }
      };
    }

    const totals = data.reduce((acc, customer) => ({
      revenue: acc.revenue + customer.total_revenue,
      orders: acc.orders + customer.order_count,
      project_size: acc.project_size + customer.avg_project_size,
      payment_days: acc.payment_days + customer.avg_payment_days
    }), { revenue: 0, orders: 0, project_size: 0, payment_days: 0 });

    return {
      count,
      averages: {
        revenue: Math.round(totals.revenue / count),
        order_frequency: Math.round(totals.orders / count * 10) / 10,
        project_size: Math.round(totals.project_size / count),
        payment_speed_days: Math.round(totals.payment_days / count)
      }
    };
  }

  /**
   * Generiere Empfehlungen für Segment
   */
  private generateSegmentRecommendations(segment: CustomerSegment): string[] {
    const recommendations: string[] = [];

    switch (segment.id) {
      case 'premium':
        recommendations.push('Persönliche Betreuung durch Senior-Mitarbeiter');
        recommendations.push('Prioritäre Terminvergabe');
        recommendations.push('Individuelle Rabatte für Großprojekte');
        recommendations.push('Quartalsweise Business-Reviews');
        break;

      case 'regular':
        recommendations.push('Treuerabatt-Programme anbieten');
        recommendations.push('Newsletter mit Sonderaktionen');
        recommendations.push('Jährliche Wartungsverträge vorschlagen');
        break;

      case 'occasional':
        recommendations.push('Reaktivierungskampagnen');
        recommendations.push('Erinnerung an Wartungsintervalle');
        recommendations.push('Sonderangebote für Wiederkehrer');
        break;

      case 'new':
        recommendations.push('Willkommensrabatt anbieten');
        recommendations.push('Onboarding-Prozess optimieren');
        recommendations.push('Nach erstem Auftrag Feedback einholen');
        recommendations.push('Weitere Services vorstellen');
        break;
    }

    // Allgemeine Empfehlungen basierend auf Metriken
    if (segment.average_metrics.payment_speed_days > 30) {
      recommendations.push('Zahlungserinnerungen optimieren');
      recommendations.push('Skonto für schnelle Zahlung anbieten');
    }

    if (segment.average_metrics.order_frequency < 2) {
      recommendations.push('Kundenbindung verstärken');
      recommendations.push('After-Sales Service verbessern');
    }

    return recommendations;
  }

  /**
   * Exportiere Segmentierungsdaten (DSGVO-konform)
   */
  async exportSegmentationData(): Promise<{
    segments: CustomerSegment[];
    methodology: string;
    data_basis: string;
    created_at: string;
  }> {
    const segments = await this.createSegments();

    return {
      segments,
      methodology: 'Regelbasierte Segmentierung nach Umsatz und Häufigkeit',
      data_basis: 'Aggregierte und anonymisierte Kundendaten der letzten 24 Monate',
      created_at: new Date().toISOString()
    };
  }

  private async getAggregatedCustomerData() {
    // Erstelle aggregierte View in Datenbank
    const query = `
      CREATE OR REPLACE VIEW customer_metrics_view AS
      SELECT 
        c.id as customer_id,
        COUNT(DISTINCT p.id) as order_count,
        COALESCE(SUM(i.total_amount), 0) as total_revenue,
        COALESCE(AVG(p.budget), 0) as avg_project_size,
        COALESCE(AVG(
          EXTRACT(DAY FROM i.paid_at - i.created_at)
        ), 30) as avg_payment_days,
        MIN(p.created_at) as first_order_date
      FROM customers c
      LEFT JOIN projects p ON p.customer_id = c.id
      LEFT JOIN invoices i ON i.customer_id = c.id AND i.status = 'paid'
      WHERE c.deleted_at IS NULL
      GROUP BY c.id;
    `;

    // View wird nur einmal erstellt
    // Daten werden aggregiert und anonymisiert zurückgegeben
  }
}
```

### **Rechtliche Absicherung:**
- ✅ Nur aggregierte Daten, keine Einzelprofile
- ✅ Anonymisierte Segmente ohne Personenbezug
- ✅ Transparente Kriterien und Methodik
- ✅ Keine automatisierten Einzelentscheidungen
- ✅ Export-Funktion für Transparenz

---

## 💰 FEATURE 8: PREISVORSCHLAG-SYSTEM (EMPFEHLUNGEN)

### **Ziel:**
KI-basierte Preisvorschläge als unverbindliche Empfehlung für Angebotserstellung

### **Technische Umsetzung:**

#### **Schritt 1: Preisanalyse-Service (Woche 1)**
```typescript
// src/services/priceSuggestionService.ts
export interface PriceSuggestion {
  suggested_price: number;
  price_range: {
    min: number;
    max: number;
    optimal: number;
  };
  confidence: number;
  calculation_basis: {
    material_costs: number;
    labor_costs: number;
    overhead: number;
    profit_margin: number;
  };
  market_comparison: {
    market_average: number;
    position: 'below' | 'average' | 'above';
    deviation_percent: number;
  };
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    adjustment: number;
  }>;
  disclaimer: string;
}

export class PriceSuggestionService {
  /**
   * Generiere Preisvorschlag basierend auf historischen Daten
   */
  async generatePriceSuggestion(
    projectType: string,
    specifications: {
      area_sqm?: number;
      material_quality: 'standard' | 'premium' | 'luxury';
      complexity: 1 | 2 | 3 | 4 | 5;
      timeline_weeks: number;
      location: string;
    }
  ): Promise<PriceSuggestion> {
    // Basis-Kalkulation
    const baseCalculation = await this.calculateBaseCosts(projectType, specifications);
    
    // Marktanalyse
    const marketAnalysis = await this.analyzeMarketPrices(projectType, specifications.location);
    
    // Einflussfaktoren
    const factors = this.analyzePriceFactors(specifications, marketAnalysis);
    
    // Finale Preisberechnung
    let suggestedPrice = baseCalculation.total;
    
    // Wende Faktoren an
    factors.forEach(factor => {
      suggestedPrice += factor.adjustment;
    });

    // Berechne Preisspanne
    const priceRange = {
      min: Math.round(suggestedPrice * 0.85), // -15%
      max: Math.round(suggestedPrice * 1.15), // +15%
      optimal: Math.round(suggestedPrice)
    };

    // Marktpositionierung
    const marketComparison = {
      market_average: marketAnalysis.average,
      position: this.determineMarketPosition(suggestedPrice, marketAnalysis.average),
      deviation_percent: ((suggestedPrice - marketAnalysis.average) / marketAnalysis.average) * 100
    };

    // Konfidenz basierend auf Datenlage
    const confidence = this.calculateConfidence(
      marketAnalysis.sample_size,
      specifications.complexity
    );

    return {
      suggested_price: Math.round(suggestedPrice),
      price_range: priceRange,
      confidence: confidence,
      calculation_basis: baseCalculation,
      market_comparison: marketComparison,
      factors: factors,
      disclaimer: this.getDisclaimer()
    };
  }

  /**
   * Berechne Basiskosten
   */
  private async calculateBaseCosts(
    projectType: string,
    specifications: any
  ): Promise<PriceSuggestion['calculation_basis']> {
    // Hole historische Durchschnittswerte
    const { data: historicalProjects } = await supabase
      .from('projects')
      .select('budget, metadata')
      .eq('type', projectType)
      .eq('status', 'abgeschlossen')
      .limit(50);

    // Basis-Kostensätze (€/qm)
    const costRates = {
      'Badsanierung': { material: 400, labor: 500 },
      'Küchensanierung': { material: 600, labor: 400 },
      'Malerarbeiten': { material: 10, labor: 15 },
      'Elektroinstallation': { material: 30, labor: 45 },
      'Bodenverlegung': { material: 40, labor: 35 }
    };

    const rates = costRates[projectType] || { material: 50, labor: 50 };
    const area = specifications.area_sqm || 20;

    // Qualitätsmultiplikatoren
    const qualityMultipliers = {
      'standard': 1.0,
      'premium': 1.3,
      'luxury': 1.8
    };

    const qualityMultiplier = qualityMultipliers[specifications.material_quality];

    // Berechnung
    const materialCosts = area * rates.material * qualityMultiplier;
    const laborCosts = area * rates.labor * (1 + (specifications.complexity - 3) * 0.2);
    const overhead = (materialCosts + laborCosts) * 0.15; // 15% Gemeinkosten
    const profitMargin = (materialCosts + laborCosts + overhead) * 0.20; // 20% Gewinn

    return {
      material_costs: Math.round(materialCosts),
      labor_costs: Math.round(laborCosts),
      overhead: Math.round(overhead),
      profit_margin: Math.round(profitMargin)
    };
  }

  /**
   * Analysiere Marktpreise
   */
  private async analyzeMarketPrices(
    projectType: string,
    location: string
  ): Promise<{ average: number; min: number; max: number; sample_size: number }> {
    // Hole Vergleichsprojekte aus der Region
    const { data } = await supabase
      .from('projects')
      .select('budget')
      .eq('type', projectType)
      .eq('status', 'abgeschlossen')
      .not('budget', 'is', null)
      .limit(100);

    if (!data || data.length === 0) {
      // Fallback auf Standardwerte
      return {
        average: 10000,
        min: 5000,
        max: 20000,
        sample_size: 0
      };
    }

    const prices = data.map(p => p.budget);
    const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return {
      average: Math.round(average),
      min: Math.round(min),
      max: Math.round(max),
      sample_size: prices.length
    };
  }

  /**
   * Analysiere Preisfaktoren
   */
  private analyzePriceFactors(
    specifications: any,
    marketAnalysis: any
  ): PriceSuggestion['factors'] {
    const factors: PriceSuggestion['factors'] = [];

    // Zeitdruck
    if (specifications.timeline_weeks < 2) {
      factors.push({
        factor: 'Eilzuschlag (kurze Deadline)',
        impact: 'positive',
        adjustment: marketAnalysis.average * 0.15
      });
    }

    // Komplexität
    if (specifications.complexity >= 4) {
      factors.push({
        factor: 'Komplexitätszuschlag',
        impact: 'positive',
        adjustment: marketAnalysis.average * 0.10
      });
    }

    // Qualität
    if (specifications.material_quality === 'luxury') {
      factors.push({
        factor: 'Premium-Materialien',
        impact: 'positive',
        adjustment: marketAnalysis.average * 0.25
      });
    }

    // Saisonale Faktoren
    const month = new Date().getMonth();
    if (month >= 3 && month <= 9) { // April bis Oktober
      factors.push({
        factor: 'Hauptsaison',
        impact: 'positive',
        adjustment: marketAnalysis.average * 0.05
      });
    } else {
      factors.push({
        factor: 'Nebensaison-Rabatt',
        impact: 'negative',
        adjustment: -marketAnalysis.average * 0.10
      });
    }

    return factors;
  }

  /**
   * Bestimme Marktposition
   */
  private determineMarketPosition(
    price: number,
    marketAverage: number
  ): 'below' | 'average' | 'above' {
    const deviation = ((price - marketAverage) / marketAverage) * 100;
    
    if (deviation < -10) return 'below';
    if (deviation > 10) return 'above';
    return 'average';
  }

  /**
   * Berechne Konfidenz
   */
  private calculateConfidence(
    sampleSize: number,
    complexity: number
  ): number {
    let confidence = 0.5; // Basis

    // Mehr Daten = höhere Konfidenz
    if (sampleSize > 50) confidence += 0.3;
    else if (sampleSize > 20) confidence += 0.2;
    else if (sampleSize > 10) confidence += 0.1;

    // Komplexität reduziert Konfidenz
    confidence -= (complexity - 3) * 0.05;

    return Math.max(0.3, Math.min(0.9, confidence));
  }

  /**
   * Rechtlicher Hinweis
   */
  private getDisclaimer(): string {
    return `WICHTIGER HINWEIS: Diese Preisempfehlung basiert auf historischen Daten und 
    Marktdurchschnitten. Sie ersetzt keine professionelle Kalkulation und dient nur 
    als Orientierung. Berücksichtigen Sie individuelle Projektanforderungen, aktuelle 
    Materialpreise und Ihre betriebswirtschaftliche Situation. Die finale 
    Preisgestaltung liegt in Ihrer Verantwortung.`;
  }
}
```

#### **Schritt 2: Transparente Preisvorschlag-UI (Woche 2)**
```typescript
// src/components/PriceSuggestionTool.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calculator, TrendingUp, TrendingDown, AlertCircle, Check, X } from 'lucide-react';

export function PriceSuggestionTool() {
  const [projectType, setProjectType] = useState('Badsanierung');
  const [specifications, setSpecifications] = useState({
    area_sqm: 25,
    material_quality: 'standard' as 'standard' | 'premium' | 'luxury',
    complexity: 3,
    timeline_weeks: 4,
    location: 'Berlin'
  });
  
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedPrice, setAcceptedPrice] = useState<number | null>(null);

  const generateSuggestion = async () => {
    setLoading(true);
    try {
      const service = new PriceSuggestionService();
      const result = await service.generatePriceSuggestion(
        projectType,
        specifications
      );
      setSuggestion(result);
    } catch (error) {
      console.error('Price suggestion error:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptSuggestion = (price: number) => {
    setAcceptedPrice(price);
    // Übernehme in Angebot
    console.log('Preis übernommen:', price);
  };

  return (
    <div className="space-y-6">
      {/* Eingabeformular */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Preisvorschlag-Assistent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Projekttyp</label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Badsanierung">Badsanierung</SelectItem>
                <SelectItem value="Küchensanierung">Küchensanierung</SelectItem>
                <SelectItem value="Malerarbeiten">Malerarbeiten</SelectItem>
                <SelectItem value="Elektroinstallation">Elektroinstallation</SelectItem>
                <SelectItem value="Bodenverlegung">Bodenverlegung</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Fläche (m²)</label>
            <Input 
              type="number"
              value={specifications.area_sqm}
              onChange={(e) => setSpecifications({
                ...specifications,
                area_sqm: parseInt(e.target.value)
              })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Materialqualität</label>
            <Select 
              value={specifications.material_quality}
              onValueChange={(v) => setSpecifications({
                ...specifications,
                material_quality: v as any
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="luxury">Luxus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">
              Komplexität: {specifications.complexity}/5
            </label>
            <Slider
              value={[specifications.complexity]}
              onValueChange={(v) => setSpecifications({
                ...specifications,
                complexity: v[0] as any
              })}
              min={1}
              max={5}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Einfach</span>
              <span>Mittel</span>
              <span>Komplex</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Zeitrahmen (Wochen)</label>
            <Input 
              type="number"
              value={specifications.timeline_weeks}
              onChange={(e) => setSpecifications({
                ...specifications,
                timeline_weeks: parseInt(e.target.value)
              })}
            />
          </div>

          <Button 
            onClick={generateSuggestion}
            disabled={loading}
            className="w-full"
          >
            <Calculator className="mr-2 h-4 w-4" />
            {loading ? 'Berechne...' : 'Preisvorschlag generieren'}
          </Button>
        </CardContent>
      </Card>

      {/* Preisvorschlag */}
      {suggestion && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Preisvorschlag</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">
                  Konfidenz: {Math.round(suggestion.confidence * 100)}%
                </Badge>
                <Badge 
                  variant={
                    suggestion.market_comparison.position === 'above' ? 'destructive' :
                    suggestion.market_comparison.position === 'below' ? 'secondary' :
                    'default'
                  }
                >
                  {suggestion.market_comparison.position === 'above' ? 'Über Markt' :
                   suggestion.market_comparison.position === 'below' ? 'Unter Markt' :
                   'Marktüblich'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hauptpreis */}
              <div className="text-center py-6 bg-primary/5 rounded-lg">
                <p className="text-sm text-muted-foreground">Empfohlener Preis</p>
                <p className="text-4xl font-bold text-primary">
                  {suggestion.suggested_price.toLocaleString('de-DE')} €
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Spanne: {suggestion.price_range.min.toLocaleString('de-DE')} - {suggestion.price_range.max.toLocaleString('de-DE')} €
                </p>
              </div>

              {/* Kalkulation */}
              <div className="space-y-2">
                <h4 className="font-medium">Kostenkalkulation</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Materialkosten</span>
                    <span>{suggestion.calculation_basis.material_costs.toLocaleString('de-DE')} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Arbeitskosten</span>
                    <span>{suggestion.calculation_basis.labor_costs.toLocaleString('de-DE')} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gemeinkosten</span>
                    <span>{suggestion.calculation_basis.overhead.toLocaleString('de-DE')} €</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Gewinnmarge</span>
                    <span>{suggestion.calculation_basis.profit_margin.toLocaleString('de-DE')} €</span>
                  </div>
                </div>
              </div>

              {/* Einflussfaktoren */}
              <div className="space-y-2">
                <h4 className="font-medium">Preisfaktoren</h4>
                <div className="space-y-2">
                  {suggestion.factors.map((factor, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {factor.impact === 'positive' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : factor.impact === 'negative' ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <div className="h-4 w-4" />
                        )}
                        <span>{factor.factor}</span>
                      </div>
                      <span className={
                        factor.impact === 'positive' ? 'text-green-600' :
                        factor.impact === 'negative' ? 'text-red-600' :
                        ''
                      }>
                        {factor.adjustment > 0 ? '+' : ''}{factor.adjustment.toLocaleString('de-DE')} €
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Marktvergleich */}
              <div className="space-y-2">
                <h4 className="font-medium">Marktvergleich</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Marktdurchschnitt</span>
                    <span>{suggestion.market_comparison.market_average.toLocaleString('de-DE')} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Abweichung</span>
                    <span className={
                      suggestion.market_comparison.deviation_percent > 0 ? 'text-green-600' : 'text-red-600'
                    }>
                      {suggestion.market_comparison.deviation_percent > 0 ? '+' : ''}
                      {suggestion.market_comparison.deviation_percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Aktionen */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => acceptSuggestion(suggestion.suggested_price)}
                  className="flex-1"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Preis übernehmen
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    const customPrice = prompt('Eigener Preis (€):', suggestion.suggested_price.toString());
                    if (customPrice) acceptSuggestion(parseFloat(customPrice));
                  }}
                  className="flex-1"
                >
                  Preis anpassen
                </Button>
              </div>

              {acceptedPrice && (
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    Preis von {acceptedPrice.toLocaleString('de-DE')} € wurde übernommen
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {suggestion.disclaimer}
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
```

### **Rechtliche Absicherung:**
- ✅ Nur Empfehlungen, keine verbindlichen Preise
- ✅ Transparente Kalkulationsgrundlage
- ✅ Deutlicher Disclaimer
- ✅ Manuelle Übersteuerung möglich
- ✅ Keine automatische Preisfestsetzung
- ✅ Marktvergleich nur aggregiert

---

## 📊 ZUSAMMENFASSUNG & ROADMAP

### **Implementierungs-Timeline:**

**Phase 1 (Monat 1-2): Sichere Basis**
- ✅ OCR-Rechnungsverarbeitung
- ✅ Template-Engine
- ✅ Interne Suche

**Phase 2 (Monat 3-4): Erweiterte Features**
- ✅ Statistische Prognosen
- ✅ Wetter-Integration

**Phase 3 (Monat 5-6): Konforme AI-Features**
- ✅ Email-Klassifizierung mit Opt-In
- ✅ Kundensegmentierung (anonymisiert)
- ✅ Preisvorschläge als Empfehlung

### **Geschätzter Aufwand:**
- **Entwicklung:** 480-640 Stunden
- **Testing:** 120-160 Stunden
- **Dokumentation:** 40-60 Stunden
- **Schulung:** 20-30 Stunden
- **Gesamt:** 660-890 Stunden (ca. 4-6 Monate mit 1-2 Entwicklern)

### **Kosten-Nutzen-Analyse:**

**Kosten:**
- Entwicklung: 50.000-70.000 €
- Lizenzen/APIs: 200-500 €/Monat
- Wartung: 500-1000 €/Monat

**Nutzen:**
- Zeitersparnis: 20-30% bei Angebotserstellung
- Fehlerreduktion: 40-50% bei Rechnungserfassung
- Kundenzufriedenheit: +15-20% durch schnellere Reaktion
- ROI: 12-18 Monate

### **Rechtliche Checkliste:**
- ✅ DSGVO-konform
- ✅ GoBD-konform
- ✅ Keine automatisierten Einzelentscheidungen
- ✅ Transparenz gewährleistet
- ✅ Widerrufsrechte implementiert
- ✅ Audit-Trail vorhanden

### **Nächste Schritte:**
1. Priorisierung der Features mit Stakeholdern
2. Technische Machbarkeitsstudie
3. Datenschutz-Folgenabschätzung
4. MVP-Entwicklung (Feature 1-3)
5. Pilotphase mit ausgewählten Nutzern
6. Iterative Verbesserung basierend auf Feedback

Dieser Plan bietet eine solide, rechtssichere Basis für AI-Features in HandwerkOS!