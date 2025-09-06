import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Download, 
  Eye, 
  Mail, 
  MoreVertical, 
  FileText, 
  Loader2,
  Send
} from 'lucide-react'
import { useDeliveryNotePDF } from '@/hooks/useDeliveryNotePDF'
import { toast } from 'sonner'

interface PDFEmailActionsProps {
  deliveryNote: {
    id: string
    number: string
    status: string
    project?: {
      customer?: {
        name: string
        email?: string
      }
    }
  }
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  showDropdown?: boolean
}

interface EmailDialogState {
  open: boolean
  recipientEmail: string
  ccEmails: string
  subject: string
  message: string
  attachPDF: boolean
}

export const PDFEmailActions: React.FC<PDFEmailActionsProps> = ({
  deliveryNote,
  size = 'sm',
  variant = 'outline',
  showDropdown = true
}) => {
  const {
    isGenerating,
    isSending,
    downloadPDF,
    openPDFInNewTab,
    sendEmail
  } = useDeliveryNotePDF()

  const [emailDialog, setEmailDialog] = useState<EmailDialogState>({
    open: false,
    recipientEmail: deliveryNote.project?.customer?.email || '',
    ccEmails: '',
    subject: `Lieferschein ${deliveryNote.number}`,
    message: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie den Lieferschein ${deliveryNote.number}.\n\nMit freundlichen Grüßen`,
    attachPDF: true
  })

  const handleDownloadPDF = async () => {
    try {
      await downloadPDF(deliveryNote.id, deliveryNote.number)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const handleViewPDF = async () => {
    try {
      await openPDFInNewTab(deliveryNote.id)
    } catch (error) {
      console.error('View failed:', error)
    }
  }

  const handleSendEmail = async () => {
    if (!emailDialog.recipientEmail) {
      toast.error('Bitte E-Mail-Adresse eingeben')
      return
    }

    try {
      const ccEmailsArray = emailDialog.ccEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0)

      await sendEmail({
        deliveryNoteId: deliveryNote.id,
        recipientEmail: emailDialog.recipientEmail,
        ccEmails: ccEmailsArray.length > 0 ? ccEmailsArray : undefined,
        subject: emailDialog.subject,
        message: emailDialog.message,
        attachPDF: emailDialog.attachPDF
      })

      setEmailDialog(prev => ({ ...prev, open: false }))
    } catch (error) {
      console.error('Email sending failed:', error)
    }
  }

  if (!showDropdown) {
    // Einzelne Buttons für kompakte Ansicht
    return (
      <div className="flex items-center gap-1">
        <Button
          size={size}
          variant={variant}
          onClick={handleViewPDF}
          disabled={isGenerating}
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          size={size}
          variant={variant}
          onClick={handleDownloadPDF}
          disabled={isGenerating}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          size={size}
          variant={variant}
          onClick={() => setEmailDialog(prev => ({ ...prev, open: true }))}
          disabled={isSending}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        </Button>
      </div>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant={variant}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleViewPDF} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            PDF anzeigen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadPDF} disabled={isGenerating}>
            <Download className="mr-2 h-4 w-4" />
            PDF herunterladen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setEmailDialog(prev => ({ ...prev, open: true }))}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Per E-Mail versenden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Email Dialog */}
      <Dialog open={emailDialog.open} onOpenChange={(open) => setEmailDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Lieferschein per E-Mail versenden
            </DialogTitle>
            <DialogDescription>
              Lieferschein {deliveryNote.number} an Kunden senden
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="recipient">Empfänger *</Label>
              <Input
                id="recipient"
                type="email"
                value={emailDialog.recipientEmail}
                onChange={(e) => setEmailDialog(prev => ({ ...prev, recipientEmail: e.target.value }))}
                placeholder="kunde@beispiel.de"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cc">CC (optional)</Label>
              <Input
                id="cc"
                type="email"
                value={emailDialog.ccEmails}
                onChange={(e) => setEmailDialog(prev => ({ ...prev, ccEmails: e.target.value }))}
                placeholder="person1@beispiel.de, person2@beispiel.de"
              />
              <p className="text-xs text-muted-foreground">
                Mehrere E-Mail-Adressen durch Komma trennen
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subject">Betreff</Label>
              <Input
                id="subject"
                value={emailDialog.subject}
                onChange={(e) => setEmailDialog(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="message">Nachricht</Label>
              <Textarea
                id="message"
                rows={6}
                value={emailDialog.message}
                onChange={(e) => setEmailDialog(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Ihre Nachricht..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="attachPDF"
                checked={emailDialog.attachPDF}
                onCheckedChange={(checked) => 
                  setEmailDialog(prev => ({ ...prev, attachPDF: !!checked }))
                }
              />
              <Label htmlFor="attachPDF" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                PDF als Anhang beifügen
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEmailDialog(prev => ({ ...prev, open: false }))}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={isSending || !emailDialog.recipientEmail}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  E-Mail senden
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}