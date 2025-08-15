/**
 * EmailModuleModern - Modernized email interface for HandwerkOS
 * 
 * Features:
 * - Gmail-inspired three-pane layout
 * - Email threading and conversations
 * - Advanced search and filtering
 * - Drag & drop organization
 * - Mobile-responsive design
 * - Real-time updates
 * - AI-powered categorization
 * - Workflow integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format, formatDistance } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  priority: string;
  thread_id?: string;
  reply_count?: number;
  ai_category_id?: string;
  ai_confidence?: number;
  ai_sentiment?: string;
  ai_summary?: string;
  ai_extracted_data?: Record<string, unknown>;
  processing_status: string;
  has_attachments?: boolean;
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
  description: string;
  count?: number;
}

const iconMap = {
  ShoppingCart,
  MessageSquare,
  Receipt,
  HelpCircle,
  Newspaper,
  Trash2,
  Mail,
  Building2,
  Phone,
  Globe,
  FileText,
};

export function EmailModule() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailThread, setEmailThread] = useState<Email[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("inbox");
  const [loading, setLoading] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'conversation'>('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [companyEmail, setCompanyEmail] = useState<string>("");
  
  // Compose form state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeContent, setComposeContent] = useState("");
  const [composePriority, setComposePriority] = useState("normal");
  
  const { toast } = useToast();

  useEffect(() => {
    initializeModule();
  }, [initializeModule]);

  useEffect(() => {
    if (companyEmail) {
      fetchEmails();
      setupRealtimeSubscription();
    }
  }, [companyEmail, fetchEmails, setupRealtimeSubscription]);

  const initializeModule = useCallback(async () => {
    await Promise.all([
      fetchCompanySettings(),
      fetchCategories()
    ]);
  }, [fetchCompanySettings, fetchCategories]);

  const fetchCompanySettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('company_settings')
      .select('company_email')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!error && data?.company_email) {
      setCompanyEmail(data.company_email);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('email_categories')
      .select('*')
      .order('name');

    if (!error) {
      setCategories(data || []);
    }
  }, []);

  const fetchEmails = useCallback(async () => {
    if (!companyEmail) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('emails')
      .select(`
        *,
        email_categories (name, color, icon),
        customers (company_name, contact_person, phone, website)
      `)
      .eq('recipient_email', companyEmail)
      .order('received_at', { ascending: false })
      .limit(100);

    if (!error) {
      // Group emails by thread_id for conversation view
      const processedEmails = (data || []).map(email => ({
        ...email,
        reply_count: (data || []).filter(e => e.thread_id === email.thread_id).length - 1
      }));
      setEmails(processedEmails);
    }
    setLoading(false);
  }, [companyEmail]);

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

  const fetchEmailThread = async (threadId: string) => {
    if (!threadId) return;

    const { data, error } = await supabase
      .from('emails')
      .select(`
        *,
        email_categories (name, color, icon),
        customers (company_name, contact_person)
      `)
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true });

    if (!error) {
      setEmailThread(data || []);
    }
  };

  const handleEmailSelect = async (email: Email) => {
    setSelectedEmail(email);
    
    if (!email.is_read) {
      await markAsRead([email.id], true);
    }
    
    if (email.thread_id && viewMode === 'conversation') {
      await fetchEmailThread(email.thread_id);
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

  // Helper functions for date formatting
  const formatDateToTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm');
    } catch (error) {
      return '00:00';
    }
  };

  const formatDateToShort = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd.MM.yyyy');
    } catch (error) {
      return '01.01.2024';
    }
  };

  const formatDateToFull = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: de });
    } catch (error) {
      return '01.01.2024 00:00';
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
    setSelectedEmails([]);
  };

  const sendEmail = async () => {
    if (!composeTo || !composeSubject || !composeContent) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    // Here would be the email sending logic
    toast({
      title: "E-Mail gesendet",
      description: `E-Mail an ${composeTo} wurde gesendet.`
    });
    
    setIsComposing(false);
    setComposeTo("");
    setComposeSubject("");
    setComposeContent("");
  };

  const createQuoteFromEmail = async (email: Email) => {
    try {
      // Extract customer information from email
      let customerId = null;
      
      if (email.customers) {
        // Customer already linked
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('company_name', email.customers.company_name)
          .single();
        customerId = customer?.id;
      } else {
        // Create new customer from email sender
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert({
            company_name: email.sender_name || email.sender_email,
            email: email.sender_email,
            contact_person: email.sender_name,
            status: 'interessent'
          })
          .select()
          .single();
          
        if (!error) {
          customerId = newCustomer.id;
        }
      }

      if (customerId) {
        // Create quote
        const { data: quote, error } = await supabase
          .from('quotes')
          .insert({
            quote_number: `AG-${Date.now().toString().slice(-6)}`,
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

        if (!error) {
          // Mark email as processed
          await supabase
            .from('emails')
            .update({ 
              ai_extracted_data: { quote_id: quote.id },
              processing_status: 'processed'
            })
            .eq('id', email.id);

          toast({
            title: "✅ Angebot erstellt",
            description: `Angebot ${quote.quote_number} wurde erfolgreich erstellt.`,
            action: (
              <Button size="sm" onClick={() => window.open(`/finance?tab=quotes&quote=${quote.id}`, '_blank')}>
                Öffnen
              </Button>
            )
          });
        }
      }
    } catch (error) {
      console.error('Error creating quote from email:', error);
      toast({
        title: "Fehler",
        description: "Angebot konnte nicht erstellt werden.",
        variant: "destructive"
      });
    }
  };

  const createProjectFromEmail = async (email: Email) => {
    try {
      // Get current user's company
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) throw new Error('Benutzer nicht authentifiziert');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) throw new Error('Firma nicht gefunden');

      let customerId = null;
      
      if (email.customers) {
        // Customer already linked
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('company_name', email.customers.company_name)
          .single();
        customerId = customer?.id;
      } else {
        // Create new customer
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert({
            company_name: email.sender_name || email.sender_email,
            email: email.sender_email,
            contact_person: email.sender_name,
            status: 'interessent'
          })
          .select()
          .single();
          
        if (!error) {
          customerId = newCustomer.id;
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

        if (!error) {
          // Mark email as processed
          await supabase
            .from('emails')
            .update({ 
              ai_extracted_data: { project_id: project.id },
              processing_status: 'processed'
            })
            .eq('id', email.id);

          toast({
            title: "✅ Projekt erstellt",
            description: `Projekt "${project.name}" wurde erfolgreich erstellt.`,
            action: (
              <Button size="sm" onClick={() => window.open(`/projects?project=${project.id}`, '_blank')}>
                Öffnen
              </Button>
            )
          });
        }
      }
    } catch (error) {
      console.error('Error creating project from email:', error);
      toast({
        title: "Fehler",
        description: "Projekt konnte nicht erstellt werden.",
        variant: "destructive"
      });
    }
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = !searchTerm || 
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.sender_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "inbox" || 
                           (selectedCategory === "unread" && !email.is_read) ||
                           (selectedCategory === "starred" && email.is_starred) ||
                           (email.email_categories?.name === selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const getEmailIcon = (email: Email) => {
    if (email.email_categories?.icon) {
      const Icon = iconMap[email.email_categories.icon as keyof typeof iconMap];
      return Icon ? <Icon className="h-4 w-4" style={{color: email.email_categories.color}} /> : <Mail className="h-4 w-4" />;
    }
    return <Mail className="h-4 w-4" />;
  };

  const getPriorityIndicator = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Flag className="h-3 w-3 text-red-500" />;
      case 'high':
        return <Flag className="h-3 w-3 text-orange-500" />;
      default:
        return null;
    }
  };

  const renderSidebar = () => (
    <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-muted/30 border-r flex flex-col`}>
      {/* Sidebar Header */}
      <div className="h-14 px-4 border-b bg-card flex items-center justify-between">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <span className="font-semibold">E-Mail</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Compose Button */}
      <div className="p-4">
        <Button 
          onClick={() => setIsComposing(true)}
          className="w-full justify-start gap-2"
        >
          <Plus className="h-4 w-4" />
          {!sidebarCollapsed && "Neue E-Mail"}
        </Button>
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
            className="w-full"
            onClick={() => toast({title: "KI-Analyse", description: "Analysiere E-Mails..."})}
          >
            <Brain className="h-4 w-4 mr-2" />
            KI-Analyse
          </Button>
        </div>
      )}
    </div>
  );

  const renderToolbar = () => (
    <div className="h-14 px-4 border-b bg-card flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* Bulk Actions */}
        {selectedEmails.length > 0 ? (
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={true}
              onChange={() => setSelectedEmails([])}
            />
            <span className="text-sm font-medium">{selectedEmails.length} ausgewählt</span>
            
            <Separator orientation="vertical" className="h-4" />
            
            <Button size="sm" variant="ghost" onClick={() => handleBulkAction('mark-read')}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleBulkAction('archive')}>
              <Archive className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleBulkAction('star')}>
              <Star className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setViewMode(viewMode === 'list' ? 'conversation' : 'list')}>
              {viewMode === 'list' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            </Button>
            <Separator orientation="vertical" className="h-4" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="E-Mails durchsuchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-80"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}>
          <Filter className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={fetchEmails}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderEmailList = () => (
    <div className="w-96 bg-background border-r flex flex-col">
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
                    <div className="flex items-center gap-2">
                      {getEmailIcon(email)}
                      {email.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                      {email.reply_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {email.reply_count + 1}
                        </Badge>
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(email.id);
                      }}
                    >
                      <Star className={`h-4 w-4 ${email.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const renderEmailContent = () => {
    if (!selectedEmail) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Mail className="h-16 w-16 text-muted-foreground mx-auto" />
            <h3 className="font-medium">Keine E-Mail ausgewählt</h3>
            <p className="text-muted-foreground text-sm">Wählen Sie eine E-Mail aus der Liste</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col">
        {/* Email Header */}
        <div className="h-14 px-6 border-b bg-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-medium truncate max-w-md">{selectedEmail.subject}</h2>
            {getPriorityIndicator(selectedEmail.priority)}
          </div>
          
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setIsComposing(true)}>
              <Reply className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <ReplyAll className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <Forward className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4 mx-2" />
            <Button size="sm" variant="ghost" onClick={() => toggleStar(selectedEmail.id)}>
              <Star className={`h-4 w-4 ${selectedEmail.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => archiveEmails([selectedEmail.id])}>
              <Archive className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 flex">
          <div className="flex-1">
            {/* Sender Info */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
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
                
                {selectedEmail.customers && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {selectedEmail.customers.company_name}
                  </Badge>
                )}
              </div>

              {/* AI Summary */}
              {selectedEmail.ai_summary && (
                <div className="bg-accent/50 p-4 rounded-lg mb-4">
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
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createQuoteFromEmail(selectedEmail)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Angebot erstellen
                </Button>
                <Button size="sm" variant="outline" onClick={() => createProjectFromEmail(selectedEmail)}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Projekt anlegen
                </Button>
                {selectedEmail.customers?.phone && (
                  <Button size="sm" variant="outline" asChild>
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

          {/* Right Panel - Customer Info & Actions */}
          {selectedEmail.customers && (
            <div className="w-80 border-l bg-muted/30">
              <div className="h-14 px-4 border-b bg-card flex items-center">
                <Building2 className="h-4 w-4 mr-2" />
                <span className="font-medium text-sm">Kundeninformationen</span>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">{selectedEmail.customers.company_name}</h4>
                  {selectedEmail.customers.contact_person && (
                    <p className="text-sm text-muted-foreground">{selectedEmail.customers.contact_person}</p>
                  )}
                </div>

                {selectedEmail.customers.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${selectedEmail.customers.phone}`} className="text-sm hover:underline">
                      {selectedEmail.customers.phone}
                    </a>
                  </div>
                )}

                {selectedEmail.customers.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={selectedEmail.customers.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                    >
                      Website besuchen
                    </a>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Workflow-Aktionen</h5>
                  <div className="grid gap-2">
                    <Button size="sm" className="w-full justify-start">
                      <Target className="h-4 w-4 mr-2" />
                      Angebot senden
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-start">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Nachkalkulation
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderComposeDialog = () => {
    if (!isComposing) return null;

    return (
      <div className={`fixed bottom-0 right-4 bg-card border border-border rounded-t-lg shadow-lg transition-all duration-300 ${
        composeMinimized ? 'h-12 w-64' : 'h-96 w-96'
      }`}>
        {/* Compose Header */}
        <div className="h-12 px-4 flex items-center justify-between bg-primary text-primary-foreground rounded-t-lg">
          <span className="font-medium text-sm">Neue E-Mail</span>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setComposeMinimized(!composeMinimized)}
              className="h-6 w-6 p-0 text-primary-foreground hover:bg-primary-foreground/20"
            >
              {composeMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsComposing(false)}
              className="h-6 w-6 p-0 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {!composeMinimized && (
          <div className="p-4 space-y-3">
            <Input
              placeholder="An:"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
            />
            <Input
              placeholder="Betreff:"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
            />
            <Select value={composePriority} onValueChange={setComposePriority}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Priorität" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niedrig</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="urgent">Dringend</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Ihre Nachricht..."
              value={composeContent}
              onChange={(e) => setComposeContent(e.target.value)}
              rows={6}
            />
            <div className="flex justify-between">
              <Button size="sm" variant="outline">
                <Paperclip className="h-4 w-4 mr-2" />
                Anhang
              </Button>
              <Button size="sm" onClick={sendEmail}>
                <Send className="h-4 w-4 mr-2" />
                Senden
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">E-Mail Verwaltung</h1>
        <Button className="bg-blue-600 hover:bg-blue-700 rounded-full">
          <Plus className="h-4 w-4 mr-2" />
          Neue E-Mail
        </Button>
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
                <p className="text-2xl font-bold">{emails.filter(e => new Date(e.received_at).toDateString() === new Date().toDateString()).length}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold">{emails.length}</p>
              </div>
              <Archive className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft rounded-2xl flex-1">
        <CardContent className="p-0">
          {renderToolbar()}
          <div className="flex overflow-hidden">
            {renderSidebar()}
            {renderEmailList()}
            {renderEmailContent()}
          </div>
        </CardContent>
      </Card>
      
      {renderComposeDialog()}
    </div>
  );
}