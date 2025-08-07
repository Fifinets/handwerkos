import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Reply
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { EmailImport } from "./emails/EmailImport";
import { EmailSync } from "./emails/EmailSync";
import { EmailReplyDialog } from "./emails/EmailReplyDialog";
import { EmailActionButtons } from "./emails/EmailActionButtons";
import { CustomerProjectDialog } from "./emails/CustomerProjectDialog";
import { useGmailConnection } from "@/hooks/useGmailConnection";

interface Email {
  id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  content: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  priority: string;
  ai_category_id?: string;
  ai_confidence?: number;
  ai_sentiment?: string;
  ai_summary?: string;
  ai_extracted_data?: any;
  processing_status: string;
  email_categories?: {
    name: string;
    color: string;
    icon: string;
  };
  customers?: {
    company_name: string;
  };
}

interface EmailCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

const iconMap = {
  ShoppingCart,
  MessageSquare,
  Receipt,
  HelpCircle,
  Newspaper,
  Trash2,
  Mail,
};

// Function to properly format email content
const formatEmailContent = (content: string): string => {
  if (!content) return '';
  
  // Check if content is already HTML
  const isHTML = /<[a-z][\s\S]*>/i.test(content);
  
  if (isHTML) {
    // Clean and sanitize HTML content
    return content
      // Fix encoding issues
      .replace(/&auml;/g, 'ä')
      .replace(/&ouml;/g, 'ö')
      .replace(/&uuml;/g, 'ü')
      .replace(/&Auml;/g, 'Ä')
      .replace(/&Ouml;/g, 'Ö')
      .replace(/&Uuml;/g, 'Ü')
      .replace(/&szlig;/g, 'ß')
      .replace(/&euro;/g, '€')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      // Ensure images are responsive
      .replace(/<img([^>]*?)>/g, '<img$1 style="max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;">')
      // Style links
      .replace(/<a([^>]*?)>/g, '<a$1 style="color: #2563eb; text-decoration: underline;">');
  } else {
    // Convert plain text to HTML with proper formatting
    return content
      // Fix encoding issues in plain text
      .replace(/Ã¤/g, 'ä')
      .replace(/Ã¶/g, 'ö')
      .replace(/Ã¼/g, 'ü')
      .replace(/Ã„/g, 'Ä')
      .replace(/Ã–/g, 'Ö')
      .replace(/Ãœ/g, 'Ü')
      .replace(/ÃŸ/g, 'ß')
      .replace(/â‚¬/g, '€')
      // Convert line breaks to HTML
      .replace(/\r\n|\r|\n/g, '<br>')
      // Convert URLs to links
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color: #2563eb; text-decoration: underline;" target="_blank" rel="noopener">$1</a>')
      // Convert email addresses to links
      .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" style="color: #2563eb; text-decoration: underline;">$1</a>');
  }
};

export function EmailModule() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showCustomerProjectDialog, setShowCustomerProjectDialog] = useState(false);
  const [companyEmail, setCompanyEmail] = useState<string>("");
  const { toast } = useToast();
  const { isGmailConnected, connectGmail, isConnecting } = useGmailConnection();

  useEffect(() => {
    fetchCompanySettings();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (companyEmail) {
      fetchEmails();
      
      // Set up real-time subscription for new emails
      const channel = supabase
        .channel('emails-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'emails',
            filter: `recipient_email=eq.${companyEmail}`
          },
          (payload) => {
            console.log('New email received:', payload);
            // Add the new email to the list
            setEmails(prevEmails => [payload.new as Email, ...prevEmails]);
            toast({
              title: "Neue E-Mail",
              description: `Von: ${(payload.new as Email).sender_email}`,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'emails',
            filter: `recipient_email=eq.${companyEmail}`
          },
          (payload) => {
            console.log('Email updated:', payload);
            // Update the email in the list
            setEmails(prevEmails => 
              prevEmails.map(email => 
                email.id === (payload.new as Email).id 
                  ? { ...email, ...(payload.new as Email) }
                  : email
              )
            );
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [companyEmail, toast]);

  const fetchCompanySettings = async () => {
    const { data, error } = await supabase
      .from('company_settings')
      .select('company_email')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching company settings:', error);
      return;
    }

    if (data?.company_email) {
      setCompanyEmail(data.company_email);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('email_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data || []);
  };

  const fetchEmails = async () => {
    if (!companyEmail) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('emails')
      .select(`
        *,
        email_categories (name, color, icon),
        customers (company_name)
      `)
      .eq('recipient_email', companyEmail)
      .order('received_at', { ascending: false });

    if (error) {
      console.error('Error fetching emails:', error);
      toast({
        title: "Fehler",
        description: "E-Mails konnten nicht geladen werden.",
        variant: "destructive",
      });
      return;
    }

    setEmails(data || []);
    setLoading(false);
  };

  const classifyAllEmails = async () => {
    setProcessing(true);
    const unprocessedEmails = emails.filter(email => 
      email.processing_status === 'pending' || !email.ai_category_id
    );

    console.log(`Starting classification of ${unprocessedEmails.length} emails`);
    
    let successCount = 0;
    let errorCount = 0;

    // Process emails one by one with delay to avoid rate limiting
    for (let i = 0; i < unprocessedEmails.length; i++) {
      const email = unprocessedEmails[i];
      try {
        console.log(`Processing email ${i + 1}/${unprocessedEmails.length}: ${email.subject}`);
        
        const { data, error } = await supabase.functions.invoke('classify-email', {
          body: {
            emailId: email.id,
            subject: email.subject,
            content: email.content,
            senderEmail: email.sender_email,
            senderName: email.sender_name,
          },
        });

        if (error) {
          console.error('Error classifying email:', error);
          errorCount++;
        } else {
          console.log(`Successfully classified email: ${email.subject}`, data);
          successCount++;
        }
        
        // Add delay between requests to avoid rate limiting
        if (i < unprocessedEmails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error('Error processing email:', error);
        errorCount++;
      }
    }

    setProcessing(false);
    await fetchEmails(); // Refresh emails to show updated classifications
    
    toast({
      title: "KI-Klassifizierung abgeschlossen",
      description: `${successCount} E-Mails erfolgreich analysiert, ${errorCount} Fehler.`,
    });
  };

  const markAsRead = async (emailId: string, isRead: boolean) => {
    const { error } = await supabase
      .from('emails')
      .update({ is_read: isRead })
      .eq('id', emailId);

    if (!error) {
      setEmails(emails.map(email => 
        email.id === emailId ? { ...email, is_read: isRead } : email
      ));
    }
  };

  const toggleStar = async (emailId: string, isStarred: boolean) => {
    const { error } = await supabase
      .from('emails')
      .update({ is_starred: !isStarred })
      .eq('id', emailId);

    if (!error) {
      setEmails(emails.map(email => 
        email.id === emailId ? { ...email, is_starred: !isStarred } : email
      ));
    }
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.sender_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || 
                           (email.email_categories?.name === selectedCategory) ||
                           (selectedCategory === "unread" && !email.is_read) ||
                           (selectedCategory === "starred" && email.is_starred);

    return matchesSearch && matchesCategory;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'normal': return 'outline';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'negative': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const handleAcceptEmail = () => {
    setShowCustomerProjectDialog(true);
  };

  const handleDeclineEmail = () => {
    toast({
      title: "Anfrage abgelehnt",
      description: "Die E-Mail wurde als abgelehnt markiert.",
    });
  };

  const handleFollowUp = () => {
    toast({
      title: "Nachfrage",
      description: "Nachfrage-Dialog würde hier geöffnet.",
    });
  };

  const handlePriceAdjustment = () => {
    toast({
      title: "Preisanpassung",
      description: "Preisanpassungs-Dialog würde hier geöffnet.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Header */}
      <div className="h-12 px-4 border-b bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <h1 className="font-semibold">Mail</h1>
          {companyEmail && (
            <span className="text-sm text-muted-foreground">- {companyEmail}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Suchen (⌘+K für Filter)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Button variant="ghost" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          {!isGmailConnected ? (
            <Button
              onClick={connectGmail}
              disabled={isConnecting}
              size="sm"
            >
              <Mail className="h-4 w-4 mr-2" />
              {isConnecting ? "Verbinde..." : "Gmail verbinden"}
            </Button>
          ) : (
            <Button
              onClick={() => setShowSync(!showSync)} 
              variant="ghost"
              size="icon"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {showImport && (
        <div className="p-4 border-b bg-accent/50">
          <EmailImport onEmailImported={() => {
            fetchEmails();
            setShowImport(false);
          }} />
        </div>
      )}

      {showSync && (
        <div className="p-4 border-b bg-accent/50">
          <EmailSync onClose={() => setShowSync(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Folders */}
        <div className="w-64 bg-muted/30 border-r flex flex-col">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Button
                onClick={() => setShowImport(!showImport)} 
                className="flex-1"
                size="sm"
              >
                <Mail className="h-4 w-4 mr-2" />
                Neue E-Mail
              </Button>
            </div>
            
            <nav className="space-y-1">
              <Button
                variant={selectedCategory === "all" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedCategory("all")}
              >
                <Mail className="h-4 w-4 mr-2" />
                Alle Nachrichten
                <Badge variant="secondary" className="ml-auto">
                  {emails.length}
                </Badge>
              </Button>
              
              <Button
                variant={selectedCategory === "unread" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedCategory("unread")}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ungelesen
                <Badge variant="secondary" className="ml-auto">
                  {emails.filter(e => !e.is_read).length}
                </Badge>
              </Button>
              
              <Button
                variant={selectedCategory === "starred" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedCategory("starred")}
              >
                <Star className="h-4 w-4 mr-2" />
                Markiert
                <Badge variant="secondary" className="ml-auto">
                  {emails.filter(e => e.is_starred).length}
                </Badge>
              </Button>
              
              <Separator className="my-2" />
              
              {categories.map((category) => {
                const Icon = iconMap[category.icon as keyof typeof iconMap] || Mail;
                const count = emails.filter(e => e.email_categories?.name === category.name).length;
                
                return (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.name ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    <Icon className="h-4 w-4 mr-2" style={{ color: category.color }} />
                    {category.name}
                    <Badge variant="secondary" className="ml-auto">{count}</Badge>
                  </Button>
                );
              })}
            </nav>
          </div>
          
          <div className="mt-auto p-4 border-t">
            <Button
              onClick={classifyAllEmails} 
              disabled={processing}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Brain className="h-4 w-4 mr-2" />
              {processing ? "Analysiere..." : "KI-Analyse"}
            </Button>
          </div>
        </div>

        {/* Middle Panel - Email List */}
        <div className="w-96 bg-background border-r flex flex-col">
          <div className="h-12 px-4 border-b bg-card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {selectedCategory === "all" ? "Alle Nachrichten" : 
                 selectedCategory === "unread" ? "Ungelesen" :
                 selectedCategory === "starred" ? "Markiert" :
                 categories.find(c => c.name === selectedCategory)?.name || selectedCategory}
              </span>
              <Badge variant="secondary">
                {filteredEmails.length}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchEmails}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {filteredEmails.map((email) => {
                const Icon = email.email_categories?.icon ? 
                  iconMap[email.email_categories.icon as keyof typeof iconMap] : Mail;
                
                return (
                  <div
                    key={email.id}
                    className={`p-4 cursor-pointer transition-colors hover:bg-accent/50 ${
                      selectedEmail?.id === email.id ? 'bg-accent border-r-2 border-primary' : ''
                    } ${!email.is_read ? 'bg-blue-50/50 border-l-2 border-blue-500' : ''}`}
                    onClick={() => {
                      setSelectedEmail(email);
                      if (!email.is_read) {
                        markAsRead(email.id, true);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {email.sender_name?.[0] || email.sender_email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {email.sender_name || email.sender_email}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(email.received_at), 'HH:mm', { locale: de })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(email.id, email.is_starred);
                          }}
                        >
                          <Star 
                            className={`h-4 w-4 ${
                              email.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                            }`} 
                          />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm font-medium truncate">{email.subject}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {email.ai_summary || email.content.substring(0, 80) + '...'}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        {email.email_categories && Icon && (
                          <Badge variant="outline" className="text-xs">
                            <Icon className="h-3 w-3 mr-1" style={{ color: email.email_categories.color }} />
                            {email.email_categories.name}
                          </Badge>
                        )}
                        {getSentimentIcon(email.ai_sentiment)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Email Content and Agenda */}
        <div className="flex-1 flex">
          {selectedEmail ? (
            <>
              {/* Email Content */}
              <div className="flex-1 flex flex-col">
                <div className="h-12 px-4 border-b bg-card flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{selectedEmail.subject}</span>
                    <Badge variant={getPriorityColor(selectedEmail.priority)} className="text-xs">
                      {selectedEmail.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowReplyDialog(true)}
                    >
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => markAsRead(selectedEmail.id, !selectedEmail.is_read)}
                    >
                      {selectedEmail.is_read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {selectedEmail.sender_name?.[0] || selectedEmail.sender_email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{selectedEmail.sender_name || selectedEmail.sender_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(selectedEmail.received_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                      </div>
                    </div>
                    {selectedEmail.customers && (
                      <Badge variant="outline">{selectedEmail.customers.company_name}</Badge>
                    )}
                  </div>
                  
                  {selectedEmail.ai_summary && (
                    <div className="bg-accent/50 p-3 rounded-lg mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">KI-Zusammenfassung</span>
                        {selectedEmail.ai_confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(selectedEmail.ai_confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedEmail.ai_summary}</p>
                    </div>
                  )}

                  {/* Email Action Buttons */}
                  <div className="flex justify-center">
                    <EmailActionButtons
                      emailCategory={selectedEmail.email_categories?.name || ""}
                      onAccept={handleAcceptEmail}
                      onDecline={handleDeclineEmail}
                      onReply={() => setShowReplyDialog(true)}
                      onFollowUp={handleFollowUp}
                      onPriceAdjustment={handlePriceAdjustment}
                    />
                  </div>
                </div>
                
                <ScrollArea className="flex-1 p-4">
                  <div 
                    className="text-sm leading-relaxed max-w-none email-content"
                    dangerouslySetInnerHTML={{ 
                      __html: formatEmailContent(selectedEmail.content) 
                    }}
                    style={{
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word'
                    }}
                  />
                </ScrollArea>
              </div>
              
              {/* Agenda Sidebar */}
              <div className="w-80 border-l bg-muted/30">
                <div className="h-12 px-4 border-b bg-card flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="font-medium text-sm">Agenda</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="text-center text-muted-foreground text-sm">
                    Keine Termine heute
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Wählen Sie eine E-Mail aus der Liste</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reply Dialog */}
      {selectedEmail && (
        <EmailReplyDialog
          isOpen={showReplyDialog}
          onClose={() => setShowReplyDialog(false)}
          email={{
            id: selectedEmail.id,
            subject: selectedEmail.subject,
            sender_email: selectedEmail.sender_email,
            sender_name: selectedEmail.sender_name
          }}
        />
      )}

      {/* Customer Project Dialog */}
      {selectedEmail && (
        <CustomerProjectDialog
          isOpen={showCustomerProjectDialog}
          onClose={() => {
            setShowCustomerProjectDialog(false);
            fetchEmails(); // Refresh emails to show updated data
          }}
          email={selectedEmail}
        />
      )}
    </div>
  );
}
