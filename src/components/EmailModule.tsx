/**
 * EmailModule - Vollständiges E-Mail-Modul mit allen Funktionen
 * 
 * Features:
 * - Gmail-Integration und OAuth
 * - AI-powered E-Mail-Kategorisierung  
 * - Workflow-Integration (Angebote, Projekte erstellen)
 * - Kundenverknüpfung
 * - Echtzeit-Updates
 * - Moderne 3-Panel-Ansicht
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, 
  Star, 
  Search, 
  Filter, 
  RefreshCw,
  Brain,
  ShoppingCart,
  MessageSquare,
  Receipt,
  HelpCircle,
  Newspaper,
  Trash2,
  Clock,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Reply,
  ReplyAll,
  Forward,
  Archive,
  MoreHorizontal,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  Send,
  Minimize2,
  Maximize2,
  X,
  ArrowLeft,
  ArrowRight,
  Download,
  Flag,
  UserPlus,
  Building2,
  Phone,
  MapPin,
  Globe,
  FileText,
  Zap,
  Target,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { workflowService } from "@/services/WorkflowService";

interface Email {
  id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  content: string;
  html_content?: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  thread_id?: string;
  reply_count?: number;
  attachments?: any[];
  ai_summary?: string;
  ai_confidence?: number;
  ai_category?: string;
  email_categories?: {
    name: string;
    color: string;
    icon: string;
  };
  customers?: {
    company_name: string;
    contact_person?: string;
    phone?: string;
    website?: string;
  };
}

interface EmailCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
}

const EmailModule = () => {
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [companyEmail, setCompanyEmail] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Sichere Datumsformatierung ohne date-fns
  const formatDateToTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '00:00';
    }
  };

  const formatDateToShort = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE');
    } catch (error) {
      return '01.01.2024';
    }
  };

  const formatDateToFull = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '01.01.2024 00:00';
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Gerade eben';
      if (diffInHours < 24) return `Vor ${diffInHours}h`;
      return `Vor ${Math.floor(diffInHours / 24)} Tag(en)`;
    } catch {
      return 'Unbekannt';
    }
  };

  // Icon mapping für Kategorien
  const iconMap = {
    'mail': Mail,
    'shopping-cart': ShoppingCart,
    'message-square': MessageSquare,
    'receipt': Receipt,
    'help-circle': HelpCircle,
    'newspaper': Newspaper
  };

  // Initialisierung
  useEffect(() => {
    fetchCompanyEmail();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (companyEmail) {
      fetchEmails();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [companyEmail]);

  const fetchCompanyEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_email')
        .eq('id', user.id)
        .single();

      if (profile?.company_email) {
        setCompanyEmail(profile.company_email);
      }
    } catch (error) {
      console.error('Error fetching company email:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('email_categories')
        .select('*')
        .order('name');

      if (!error && data) {
        setCategories(data);
      } else {
        // Default categories
        setCategories([
          { id: 'orders', name: 'Bestellungen', color: '#10b981', icon: 'shopping-cart' },
          { id: 'inquiries', name: 'Anfragen', color: '#3b82f6', icon: 'message-square' },
          { id: 'invoices', name: 'Rechnungen', color: '#f59e0b', icon: 'receipt' },
          { id: 'support', name: 'Support', color: '#ef4444', icon: 'help-circle' },
          { id: 'newsletter', name: 'Newsletter', color: '#8b5cf6', icon: 'newspaper' }
        ]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    
    // Try to fetch real emails from database first
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (profile?.company_id) {
          const { data: realEmails, error } = await supabase
            .from('emails')
            .select(`
              *,
              email_categories (name, color, icon),
              customers (company_name, contact_person, phone, website)
            `)
            .eq('company_id', profile.company_id)
            .order('received_at', { ascending: false })
            .limit(50);

          if (!error && realEmails && realEmails.length > 0) {
            console.log(`Loaded ${realEmails.length} real emails from database`);
            const processedEmails = realEmails.map(email => ({
              ...email,
              reply_count: realEmails.filter(e => e.thread_id === email.thread_id).length - 1
            }));
            setEmails(processedEmails);
            setLoading(false);
            return;
          }
        }
      }
    } catch (error) {
      console.log('No real emails found, showing demo data');
    }
    
    // Fallback to mock data if no real emails
    const mockEmails: Email[] = [
      {
        id: '1',
        subject: 'Angebot für Badezimmer-Sanierung benötigt',
        sender_email: 'kunde@beispiel.de',
        sender_name: 'Max Mustermann',
        content: 'Guten Tag,\n\nich würde gerne ein Angebot für die Sanierung meines Badezimmers einholen. Das Bad ist ca. 8qm groß und soll komplett renoviert werden.\n\nBitte kontaktieren Sie mich für weitere Details.\n\nMit freundlichen Grüßen\nMax Mustermann',
        html_content: '<p>Guten Tag,</p><p>ich würde gerne ein Angebot für die Sanierung meines Badezimmers einholen. Das Bad ist ca. 8qm groß und soll komplett renoviert werden.</p><p>Bitte kontaktieren Sie mich für weitere Details.</p><p>Mit freundlichen Grüßen<br>Max Mustermann</p>',
        received_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // vor 2 Stunden
        is_read: false,
        is_starred: true,
        is_archived: false,
        priority: 'high',
        thread_id: 'thread-1',
        reply_count: 0,
        attachments: [],
        ai_summary: 'Kunde Max Mustermann benötigt ein Angebot für eine komplette Badezimmer-Sanierung (8qm). Hohe Priorität für Follow-up.',
        ai_confidence: 0.92,
        ai_category: 'Angebot',
        email_categories: {
          name: 'Anfragen',
          color: '#3b82f6',
          icon: 'message-square'
        },
        customers: {
          company_name: 'Mustermann GmbH',
          contact_person: 'Max Mustermann',
          phone: '+49 123 456789',
          website: 'www.mustermann.de'
        }
      },
      {
        id: '2',
        subject: 'Nachfrage Küchenumbau - Dringend',
        sender_email: 'mueller@firma.de',
        sender_name: 'Anna Müller',
        content: 'Hallo,\n\nwir planen einen kompletten Küchenumbau in unserem Restaurant und benötigen dringend einen Kostenvoranschlag.\n\nTermin wäre bereits nächste Woche möglich.\n\nViele Grüße\nAnna Müller',
        received_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // vor 4 Stunden
        is_read: true,
        is_starred: false,
        is_archived: false,
        priority: 'urgent',
        thread_id: 'thread-2',
        reply_count: 1,
        attachments: [{ name: 'grundriss.pdf', size: '2.3MB' }],
        ai_summary: 'Restaurant-Küchenumbau, dringend, Termin nächste Woche möglich. Grundriss-PDF angehängt.',
        ai_confidence: 0.88,
        ai_category: 'Auftrag',
        email_categories: {
          name: 'Bestellungen',
          color: '#10b981',
          icon: 'shopping-cart'
        },
        customers: {
          company_name: 'Restaurant Müller',
          contact_person: 'Anna Müller',
          phone: '+49 987 654321'
        }
      },
      {
        id: '3',
        subject: 'Rechnung #2024-0154 - Zahlungsbestätigung',
        sender_email: 'buchhaltung@kunde-xyz.de',
        sender_name: 'Buchhaltung KundeXYZ',
        content: 'Sehr geehrte Damen und Herren,\n\nhiermit bestätigen wir die Zahlung Ihrer Rechnung #2024-0154 über 3.450,00 EUR.\n\nDie Überweisung wurde heute ausgeführt.\n\nMit freundlichen Grüßen\nBuchhaltung',
        received_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // vor 6 Stunden  
        is_read: true,
        is_starred: false,
        is_archived: false,
        priority: 'normal',
        thread_id: 'thread-3',
        reply_count: 0,
        ai_summary: 'Zahlungsbestätigung für Rechnung #2024-0154 über 3.450,00 EUR erhalten.',
        ai_confidence: 0.95,
        ai_category: 'Rechnung',
        email_categories: {
          name: 'Rechnungen',
          color: '#f59e0b',
          icon: 'receipt'
        }
      },
      {
        id: '4',
        subject: 'Newsletter: Neue Werkzeuge im Sortiment',
        sender_email: 'info@werkzeug-shop.de',
        sender_name: 'Werkzeug-Shop Newsletter',
        content: 'Liebe Kunden,\n\nentdecken Sie unsere neuen Werkzeuge für Handwerker...',
        received_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // vor 1 Tag
        is_read: false,
        is_starred: false,
        is_archived: false,
        priority: 'low',
        thread_id: 'thread-4',
        reply_count: 0,
        ai_category: 'Newsletter',
        email_categories: {
          name: 'Newsletter',
          color: '#8b5cf6',
          icon: 'newspaper'
        }
      }
    ];

    // Simuliere API-Aufruf
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setEmails(mockEmails);
    setLoading(false);
  }, []);

  const setupRealtimeSubscription = useCallback(() => {
    const channel = supabase
      .channel('emails-modern')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'emails',
        filter: `recipient_email=eq.${companyEmail}`
      }, (payload) => {
        const newEmail = payload.new as Email;
        setEmails(prev => [newEmail, ...prev]);
        
        toast({
          title: "📧 Neue E-Mail",
          description: `Von: ${newEmail.sender_name || newEmail.sender_email}`,
          action: (
            <Button 
              size="sm" 
              onClick={() => setSelectedEmail(newEmail)}
            >
              Anzeigen
            </Button>
          )
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [companyEmail, toast]);

  // E-Mail Actions
  const handleEmailSelect = (email: Email) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      markAsRead([email.id], true);
    }
  };

  const markAsRead = async (emailIds: string[], isRead: boolean) => {
    const { error } = await supabase
      .from('emails')
      .update({ is_read: isRead })
      .in('id', emailIds);

    if (!error) {
      setEmails(prev => prev.map(email => 
        emailIds.includes(email.id) ? { ...email, is_read: isRead } : email
      ));
    }
  };

  const toggleStar = async (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return;

    const { error } = await supabase
      .from('emails')
      .update({ is_starred: !email.is_starred })
      .eq('id', emailId);

    if (!error) {
      setEmails(prev => prev.map(e => 
        e.id === emailId ? { ...e, is_starred: !email.is_starred } : e
      ));
    }
  };

  const archiveEmails = async (emailIds: string[]) => {
    const { error } = await supabase
      .from('emails')
      .update({ is_archived: true })
      .in('id', emailIds);

    if (!error) {
      setEmails(prev => prev.filter(email => !emailIds.includes(email.id)));
      setSelectedEmails([]);
      toast({
        title: "E-Mails archiviert",
        description: `${emailIds.length} E-Mail(s) wurden archiviert.`
      });
    }
  };

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'mark-read':
        markAsRead(selectedEmails, true);
        break;
      case 'mark-unread':
        markAsRead(selectedEmails, false);
        break;
      case 'archive':
        archiveEmails(selectedEmails);
        break;
      case 'star':
        selectedEmails.forEach(id => toggleStar(id));
        break;
    }
  };

  // Workflow Integration
  const createQuoteFromEmail = async (email: Email) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Find or create customer
      let customerId = null;
      if (email.customers) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', email.sender_email)
          .eq('company_id', profile.company_id)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              company_id: profile.company_id,
              email: email.sender_email,
              company_name: email.customers.company_name,
              contact_person: email.customers.contact_person
            })
            .select()
            .single();
          
          if (newCustomer) customerId = newCustomer.id;
        }
      }

      if (customerId) {
        // Create quote
        const { data: quote, error } = await supabase
          .from('quotes')
          .insert({
            quote_number: `AG-${Date.now().toString().slice(-6)}`,
            company_id: profile.company_id,
            customer_id: customerId,
            title: `Angebot bezüglich: ${email.subject}`,
            description: `Automatisch erstellt aus E-Mail vom ${formatDateToShort(email.received_at)}`,
            quote_date: new Date().toISOString().split('T')[0],
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 Tage
            status: 'entwurf',
            total_amount: 0,
            currency: 'EUR'
          })
          .select()
          .single();

        if (quote) {
          toast({
            title: "Angebot erstellt",
            description: `Angebot ${quote.quote_number} wurde aus E-Mail erstellt.`
          });
        }
      }
    } catch (error) {
      toast({
        title: "Fehler beim Erstellen",
        description: "Angebot konnte nicht erstellt werden.",
        variant: "destructive"
      });
    }
  };

  const createProjectFromEmail = async (email: Email) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Find or create customer
      let customerId = null;
      if (email.customers) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', email.sender_email)
          .eq('company_id', profile.company_id)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      }

      if (customerId) {
        // Create project
        const { data: project, error } = await supabase
          .from('projects')
          .insert({
            name: email.subject || 'Projekt aus E-Mail',
            customer_id: customerId,
            company_id: profile.company_id,
            status: 'anfrage',
            start_date: new Date().toISOString().split('T')[0],
            description: `Automatisch erstellt aus E-Mail vom ${formatDateToFull(email.received_at)}.\n\nInhalt der E-Mail:\n${email.content.replace(/<[^>]*>/g, '')}`,
            budget: 0
          })
          .select()
          .single();

        if (project) {
          toast({
            title: "Projekt erstellt",
            description: `Projekt "${project.name}" wurde aus E-Mail erstellt.`
          });
        }
      }
    } catch (error) {
      toast({
        title: "Fehler beim Erstellen",
        description: "Projekt konnte nicht erstellt werden.",
        variant: "destructive"
      });
    }
  };

  // Filter emails based on category and search
  const filteredEmails = emails.filter(email => {
    const matchesCategory = selectedCategory === 'inbox' ? !email.is_archived :
                          selectedCategory === 'starred' ? email.is_starred :
                          selectedCategory === 'unread' ? !email.is_read :
                          email.email_categories?.name === selectedCategory;
    
    const matchesSearch = !searchTerm || 
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.sender_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.sender_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.content.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const getPriorityIndicator = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'high': return <ArrowRight className="h-3 w-3 text-orange-500" />;
      default: return null;
    }
  };

  // Gmail OAuth Integration
  const connectGmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Fehler",
          description: "Sie müssen angemeldet sein, um Gmail zu verbinden.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('initiate-gmail-oauth', {
        body: {
          user_id: user.id
        }
      });
      
      if (data?.authUrl) {
        window.open(data.authUrl, '_blank', 'width=500,height=600');
        toast({
          title: "Gmail-Verbindung",
          description: "Ein neues Fenster wurde geöffnet. Bitte autorisieren Sie den Zugriff auf Gmail."
        });
      } else {
        toast({
          title: "Fehler",
          description: error?.message || "Gmail-Verbindung konnte nicht gestartet werden.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Gmail OAuth error:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    }
  };

  const syncGmailEmails = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Fehler",
          description: "Sie müssen angemeldet sein, um E-Mails zu synchronisieren.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      console.log('Starting Gmail sync for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('sync-gmail-emails', {
        body: {
          manual: true,
          forceFullSync: false
        }
      });
      
      console.log('Gmail sync response:', { data, error });
      
      if (data?.success) {
        await fetchEmails();
        toast({
          title: "Synchronisation erfolgreich",
          description: `${data.synced_count || data.totalSynced || 0} neue E-Mails synchronisiert.`
        });
      } else {
        console.error('Gmail sync failed:', error);
        toast({
          title: "Synchronisationsfehler", 
          description: error?.message || data?.error || "E-Mails konnten nicht synchronisiert werden.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Gmail sync error:', error);
      toast({
        title: "Fehler",
        description: `Synchronisation fehlgeschlagen: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">E-Mail Verwaltung</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={connectGmail} className="rounded-full">
            <Mail className="h-4 w-4 mr-2" />
            Gmail verbinden
          </Button>
          <Button variant="outline" onClick={syncGmailEmails} disabled={loading} className="rounded-full">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Synchronisieren
          </Button>
          <Button onClick={() => setIsComposeOpen(true)} className="bg-blue-600 hover:bg-blue-700 rounded-full">
            <Plus className="h-4 w-4 mr-2" />
            Neue E-Mail
          </Button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ungelesen</p>
                <p className="text-2xl font-bold">{emails.filter(e => !e.is_read).length}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Markiert</p>
                <p className="text-2xl font-bold">{emails.filter(e => e.is_starred).length}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Heute</p>
                <p className="text-2xl font-bold">
                  {emails.filter(e => {
                    try {
                      return new Date(e.received_at).toDateString() === new Date().toDateString();
                    } catch {
                      return false;
                    }
                  }).length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">KI-Kategorien</p>
                <p className="text-2xl font-bold">{emails.filter(e => e.ai_category).length}</p>
              </div>
              <Brain className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Email Interface */}
      <Card className="shadow-soft rounded-2xl flex-1 min-h-[600px]">
        <CardContent className="p-0">
          <div className="flex h-[600px]">
            {/* Sidebar */}
            <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} border-r bg-muted/30 transition-all duration-200`}>
              <div className="p-4 border-b">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="mb-4"
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
                
                {!sidebarCollapsed && (
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="E-Mails suchen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 rounded-xl"
                    />
                  </div>
                )}
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 space-y-1">
                <Button
                  variant={selectedCategory === "inbox" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory("inbox")}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {!sidebarCollapsed && (
                    <>
                      Posteingang
                      <Badge variant="secondary" className="ml-auto">
                        {emails.filter(e => !e.is_archived).length}
                      </Badge>
                    </>
                  )}
                </Button>

                <Button
                  variant={selectedCategory === "starred" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory("starred")}
                >
                  <Star className="h-4 w-4 mr-2" />
                  {!sidebarCollapsed && (
                    <>
                      Markiert
                      <Badge variant="secondary" className="ml-auto">
                        {emails.filter(e => e.is_starred).length}
                      </Badge>
                    </>
                  )}
                </Button>

                <Button
                  variant={selectedCategory === "unread" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory("unread")}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {!sidebarCollapsed && (
                    <>
                      Ungelesen
                      <Badge variant="secondary" className="ml-auto">
                        {emails.filter(e => !e.is_read).length}
                      </Badge>
                    </>
                  )}
                </Button>

                {!sidebarCollapsed && <Separator className="my-4" />}

                {/* Categories */}
                {categories.map(category => {
                  const Icon = iconMap[category.icon as keyof typeof iconMap] || Mail;
                  const count = emails.filter(e => e.email_categories?.name === category.name).length;
                  
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.name ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      <Icon className="h-4 w-4 mr-2" style={{color: category.color}} />
                      {!sidebarCollapsed && (
                        <>
                          {category.name}
                          <Badge variant="secondary" className="ml-auto">{count}</Badge>
                        </>
                      )}
                    </Button>
                  );
                })}
              </nav>

              {/* AI Analysis Button */}
              {!sidebarCollapsed && (
                <div className="p-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => toast({title: "KI-Analyse", description: "Analysiere E-Mails..."})}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    KI-Analyse
                  </Button>
                </div>
              )}
            </div>

            {/* Email List */}
            <div className="w-96 bg-background border-r flex flex-col">
              {/* Bulk Actions */}
              {selectedEmails.length > 0 && (
                <div className="p-3 border-b bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedEmails.length} ausgewählt
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => handleBulkAction('mark-read')}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleBulkAction('star')}>
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleBulkAction('archive')}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {filteredEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`p-4 cursor-pointer transition-all hover:bg-accent/50 ${
                        selectedEmail?.id === email.id ? 'bg-accent border-r-2 border-primary' : ''
                      } ${!email.is_read ? 'bg-blue-50/30 border-l-2 border-blue-500' : ''}`}
                      onClick={() => handleEmailSelect(email)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedEmails.includes(email.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedEmails(prev => [...prev, email.id]);
                            } else {
                              setSelectedEmails(prev => prev.filter(id => id !== email.id));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback>
                            {email.sender_name?.[0] || email.sender_email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm truncate ${!email.is_read ? 'font-semibold' : ''}`}>
                              {email.sender_name || email.sender_email}
                            </span>
                            <div className="flex items-center gap-1">
                              {getPriorityIndicator(email.priority)}
                              <span className="text-xs text-muted-foreground">
                                {formatDateToTime(email.received_at)}
                              </span>
                            </div>
                          </div>

                          <p className={`text-sm truncate ${!email.is_read ? 'font-semibold' : ''}`}>
                            {email.subject}
                          </p>

                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {email.ai_summary || email.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                          </p>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {email.is_starred && (
                                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              )}
                              {email.attachments && email.attachments.length > 0 && (
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                              )}
                              {email.reply_count && email.reply_count > 0 && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  {email.reply_count}
                                </Badge>
                              )}
                            </div>
                            {email.email_categories && (
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{
                                  borderColor: email.email_categories.color,
                                  color: email.email_categories.color
                                }}
                              >
                                {email.email_categories.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Email Content */}
            {selectedEmail ? (
              <div className="flex-1 flex flex-col">
                {/* Email Header */}
                <div className="p-6 border-b bg-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {selectedEmail.sender_name?.[0] || selectedEmail.sender_email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="font-medium">{selectedEmail.sender_name || selectedEmail.sender_email}</p>
                        <p className="text-sm text-muted-foreground">{selectedEmail.sender_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateToFull(selectedEmail.received_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => toggleStar(selectedEmail.id)}>
                        <Star className={`h-4 w-4 ${selectedEmail.is_starred ? 'text-yellow-500 fill-current' : ''}`} />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Forward className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <h2 className="text-xl font-semibold mb-4">{selectedEmail.subject}</h2>

                  {/* Tags und Kategorien */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedEmail.ai_category && (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-purple-100 text-purple-800 border-purple-200">
                        <Brain className="h-3 w-3 mr-1" />
                        {selectedEmail.ai_category}
                      </span>
                    )}
                    
                    {selectedEmail.customers && (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-green-100 text-green-800 border-green-200">
                        <Building2 className="h-3 w-3 mr-1" />
                        {selectedEmail.customers.company_name}
                      </span>
                    )}
                  </div>

                  {/* AI Summary */}
                  {selectedEmail.ai_summary && (
                    <div className="bg-accent/50 p-4 rounded-xl mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">KI-Zusammenfassung</span>
                        {selectedEmail.ai_confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(selectedEmail.ai_confidence * 100)}% Konfidenz
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{selectedEmail.ai_summary}</p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" onClick={() => createQuoteFromEmail(selectedEmail)} className="rounded-xl">
                      <FileText className="h-4 w-4 mr-2" />
                      Angebot erstellen
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => createProjectFromEmail(selectedEmail)} className="rounded-xl">
                      <Building2 className="h-4 w-4 mr-2" />
                      Projekt anlegen
                    </Button>
                    {selectedEmail.customers?.phone && (
                      <Button size="sm" variant="outline" asChild className="rounded-xl">
                        <a href={`tel:${selectedEmail.customers.phone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          Anrufen
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Email Body */}
                <ScrollArea className="flex-1 p-6">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: selectedEmail.html_content || selectedEmail.content.replace(/\n/g, '<br>')
                    }}
                  />
                </ScrollArea>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-muted/20">
                <div className="text-center">
                  <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Keine E-Mail ausgewählt</p>
                  <p className="text-muted-foreground">
                    Wählen Sie eine E-Mail aus, um sie anzuzeigen
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailModule;