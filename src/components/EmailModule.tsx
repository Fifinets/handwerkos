import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Star, 
  Calendar, 
  Archive,
  Plus,
  Eye,
  Users,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Email {
  id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  content: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
}

const EmailModule = () => {
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Mock data for now
  useEffect(() => {
    const mockEmails: Email[] = [
      {
        id: '1',
        subject: 'Angebot für Badezimmer-Sanierung',
        sender_email: 'kunde@example.com',
        sender_name: 'Max Mustermann',
        content: 'Hallo, ich hätte gerne ein Angebot für die Sanierung meines Badezimmers...',
        received_at: new Date().toISOString(),
        is_read: false,
        is_starred: true,
        is_archived: false
      },
      {
        id: '2',
        subject: 'Nachfrage Küchenumbau',
        sender_email: 'mueller@firma.de',
        sender_name: 'Anna Müller',
        content: 'Guten Tag, wir planen einen Küchenumbau...',
        received_at: new Date(Date.now() - 86400000).toISOString(),
        is_read: true,
        is_starred: false,
        is_archived: false
      }
    ];
    
    setEmails(mockEmails);
    setLoading(false);
  }, []);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unbekannt';
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

  const unreadCount = emails.filter(e => !e.is_read).length;
  const starredCount = emails.filter(e => e.is_starred).length;
  const todayCount = emails.filter(e => {
    try {
      return new Date(e.received_at).toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  }).length;

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
                <p className="text-2xl font-bold">{unreadCount}</p>
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
                <p className="text-2xl font-bold">{starredCount}</p>
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
                <p className="text-2xl font-bold">{todayCount}</p>
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

      {/* Email List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle>Posteingang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div>Loading...</div>
            ) : emails.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine E-Mails vorhanden</p>
            ) : (
              emails.map((email) => (
                <div 
                  key={email.id}
                  className={`p-3 rounded-xl border cursor-pointer hover:shadow-md transition-shadow ${
                    !email.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                  } ${selectedEmail?.id === email.id ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedEmail(email)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm ${!email.is_read ? 'font-semibold' : ''}`}>
                          {email.sender_name || email.sender_email}
                        </span>
                        {email.is_starred && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        )}
                        {!email.is_read && (
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-blue-100 text-blue-800">
                            Neu
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mb-1 ${!email.is_read ? 'font-semibold' : ''}`}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {email.content.substring(0, 100)}...
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {getTimeAgo(email.received_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Email Detail */}
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle>E-Mail Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEmail ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedEmail.subject}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <span>Von: {selectedEmail.sender_name || selectedEmail.sender_email}</span>
                    <span>•</span>
                    <span>{formatDate(selectedEmail.received_at)}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedEmail.content}
                  </p>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button size="sm" className="rounded-xl">
                    Antworten
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl">
                    Weiterleiten
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl">
                    Archivieren
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Wählen Sie eine E-Mail aus, um sie anzuzeigen</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailModule;