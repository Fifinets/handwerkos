import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, Inbox, Send } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface Email {
  id: string
  subject: string
  sender_email: string
  is_read: boolean
  received_at: string
}

const EmailModuleSimple: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadEmails = async () => {
      try {
        const { data, error } = await supabase
          .from('emails')
          .select('id, subject, sender_email, is_read, received_at')
          .order('received_at', { ascending: false })
          .limit(50)
        
        if (error) {
          console.error('Email error:', error)
          setEmails([])
        } else {
          setEmails(data || [])
        }
      } catch (error) {
        console.error('Error loading emails:', error)
        setEmails([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadEmails()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">E-Mails</h2>
        <div className="text-center py-8">Laden...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">E-Mails</h2>
          <p className="text-muted-foreground">
            E-Mail-Verwaltung und Kommunikation
          </p>
        </div>
        
        <Button onClick={() => toast.info('E-Mail-Funktion noch nicht verfügbar')}>
          <Send className="h-4 w-4 mr-2" />
          Neue E-Mail
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Posteingang ({emails.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <div className="text-center py-16">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine E-Mails</h3>
              <p className="text-muted-foreground">
                Ihr Posteingang ist leer.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.slice(0, 20).map((email) => (
                <div 
                  key={email.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer ${
                    !email.is_read ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => toast.info('E-Mail-Details noch nicht verfügbar')}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${!email.is_read ? 'font-semibold' : ''}`}>
                        {email.subject}
                      </p>
                      {!email.is_read && (
                        <Badge variant="secondary" className="text-xs">Neu</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Von: {email.sender_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(email.received_at).toLocaleDateString()} {' '}
                      {new Date(email.received_at).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="ml-4">
                    <Mail className={`h-4 w-4 ${!email.is_read ? 'text-blue-600' : 'text-muted-foreground'}`} />
                  </div>
                </div>
              ))}
              
              {emails.length > 20 && (
                <div className="text-center pt-4">
                  <Button variant="outline">
                    Weitere E-Mails laden ({emails.length - 20} verbleibend)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default EmailModuleSimple