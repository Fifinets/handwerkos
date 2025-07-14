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

export function EmailModule() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [companyEmail, setCompanyEmail] = useState<string>("");
  const { toast } = useToast();

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
      .maybeSingle();

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

    for (const email of unprocessedEmails) {
      try {
        const { error } = await supabase.functions.invoke('classify-email', {
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
        }
      } catch (error) {
        console.error('Error processing email:', error);
      }
    }

    setProcessing(false);
    fetchEmails();
    toast({
      title: "KI-Klassifizierung",
      description: `${unprocessedEmails.length} E-Mails wurden analysiert.`,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">E-Mails</h2>
          {companyEmail && (
            <p className="text-sm text-muted-foreground">
              Für: {companyEmail}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowImport(!showImport)} 
            variant="outline"
          >
            <Mail className="h-4 w-4 mr-2" />
            E-Mail hinzufügen
          </Button>
          <Button 
            onClick={classifyAllEmails} 
            disabled={processing}
            variant="outline"
          >
            <Brain className="h-4 w-4 mr-2" />
            {processing ? "Analysiere..." : "KI-Analyse"}
          </Button>
          <Button onClick={fetchEmails} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {showImport && (
        <EmailImport onEmailImported={() => {
          fetchEmails();
          setShowImport(false);
        }} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="E-Mails durchsuchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="w-full">
                  <TabsTrigger value="all">Alle</TabsTrigger>
                  <TabsTrigger value="unread">Ungelesen</TabsTrigger>
                  <TabsTrigger value="starred">Markiert</TabsTrigger>
                </TabsList>

                <div className="p-3 space-y-2">
                  {categories.map((category) => {
                    const Icon = iconMap[category.icon as keyof typeof iconMap] || Mail;
                    const count = emails.filter(e => e.email_categories?.name === category.name).length;
                    
                    return (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.name ? "secondary" : "ghost"}
                        className="w-full justify-between"
                        onClick={() => setSelectedCategory(category.name)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: category.color }} />
                          {category.name}
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </Button>
                    );
                  })}
                </div>

                <Separator />
                
                <ScrollArea className="h-96">
                  <div className="space-y-1 p-3">
                    {filteredEmails.map((email) => {
                      const Icon = email.email_categories?.icon ? 
                        iconMap[email.email_categories.icon as keyof typeof iconMap] : Mail;
                      
                      return (
                        <div
                          key={email.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedEmail?.id === email.id 
                              ? 'bg-accent' 
                              : 'hover:bg-accent/50'
                          } ${!email.is_read ? 'border-l-4 border-primary' : ''}`}
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
                              {getSentimentIcon(email.ai_sentiment)}
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
                            <p className="text-xs text-muted-foreground truncate">
                              {email.ai_summary || email.content.substring(0, 100) + '...'}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {email.email_categories && Icon && (
                                  <Badge variant="outline" className="text-xs">
                                    <Icon className="h-3 w-3 mr-1" style={{ color: email.email_categories.color }} />
                                    {email.email_categories.name}
                                  </Badge>
                                )}
                                {email.ai_confidence && (
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round(email.ai_confidence * 100)}%
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(email.received_at), 'dd.MM.', { locale: de })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Email Detail */}
        <div className="lg:col-span-2">
          {selectedEmail ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-xl">{selectedEmail.subject}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {selectedEmail.sender_name || selectedEmail.sender_email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(selectedEmail.received_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </div>
                      {selectedEmail.customers && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline">{selectedEmail.customers.company_name}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(selectedEmail.priority)}>
                      {selectedEmail.priority}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowReplyDialog(true)}
                    >
                      <Reply className="h-4 w-4 mr-2" />
                      Antworten
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => markAsRead(selectedEmail.id, !selectedEmail.is_read)}
                    >
                      {selectedEmail.is_read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                {selectedEmail.ai_summary && (
                  <div className="bg-accent/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">KI-Zusammenfassung</span>
                      {selectedEmail.ai_confidence && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(selectedEmail.ai_confidence * 100)}% Sicherheit
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedEmail.ai_summary}</p>
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="whitespace-pre-wrap">{selectedEmail.content}</div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center space-y-2">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">Wählen Sie eine E-Mail aus der Liste</p>
                </div>
              </CardContent>
            </Card>
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
    </div>
  );
}