import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Receipt, 
  Eye,
  Check,
  X,
  Clock,
  User,
  FileText,
  AlertCircle,
  Calendar,
  Euro,
  Building2
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ComprehensiveOCRValidator } from './ComprehensiveOCRValidator';

interface PendingInvoice {
  id: string;
  project_id: string;
  project_name: string;
  document_name: string;
  file_url: string;
  created_by: string;
  employee_name: string;
  created_at: string;
  amount: number;
  description: string;
  ocr_result: any;
  validation_status: 'submitted' | 'pending' | 'validated' | 'rejected';
}

export function InvoiceValidationModule() {
  const { user, userProfile } = useSupabaseAuth();
  const { toast } = useToast();
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoice | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);

  // Load pending invoices for validation
  useEffect(() => {
    loadPendingInvoices();
  }, [user, userProfile]);

  const loadPendingInvoices = async () => {
    if (!user || !userProfile?.company_id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .rpc('get_pending_invoice_validations', {
          manager_company_id: userProfile.company_id
        });

      if (error) throw error;

      setPendingInvoices(data || []);
    } catch (error) {
      console.error('Error loading pending invoices:', error);
      toast({
        title: "Fehler beim Laden",
        description: "Ausstehende Validierungen konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateInvoice = async (invoiceId: string, action: 'validate' | 'reject') => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc('validate_receipt', {
          receipt_id: invoiceId,
          manager_id: user.id,
          action: action,
          reason: action === 'reject' ? rejectionReason : null,
          validated_data: action === 'validate' ? { validated_by_manager: true } : null
        });

      if (error) throw error;

      // Refresh the list
      await loadPendingInvoices();
      
      // Reset states
      setSelectedInvoice(null);
      setShowValidationDialog(false);
      setShowRejectionDialog(false);
      setRejectionReason('');

      toast({
        title: action === 'validate' ? "Rechnung genehmigt" : "Rechnung abgelehnt",
        description: action === 'validate' 
          ? "Die Rechnung wurde erfolgreich validiert und genehmigt."
          : "Die Rechnung wurde abgelehnt und der Mitarbeiter wurde benachrichtigt.",
        variant: action === 'validate' ? "default" : "destructive"
      });
    } catch (error) {
      console.error(`Error ${action}ing invoice:`, error);
      toast({
        title: "Fehler",
        description: `Rechnung konnte nicht ${action === 'validate' ? 'genehmigt' : 'abgelehnt'} werden.`,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Eingereicht</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">In Bearbeitung</Badge>;
      case 'validated':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Genehmigt</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Abgelehnt</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatAmount = (amount: number): string => {
    return amount ? amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '-';
  };

  const getImageUrl = (filePath: string) => {
    if (filePath.startsWith('data:')) return filePath;
    return `${supabase.storage.from('project-media').getPublicUrl(filePath).data.publicUrl}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Rechnungsvalidierung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Lade ausstehende Validierungen...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Rechnungsvalidierung
          </CardTitle>
          <CardDescription>
            Überprüfen und genehmigen Sie von Mitarbeitern eingereichte Rechnungen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              {pendingInvoices.length} ausstehende Validierungen
            </div>
            <Button onClick={loadPendingInvoices} variant="outline" size="sm">
              Aktualisieren
            </Button>
          </div>

          {pendingInvoices.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Keine ausstehenden Validierungen
              </h3>
              <p className="text-gray-500">
                Alle eingereichten Rechnungen wurden bereits bearbeitet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingInvoices.map((invoice) => (
                <Card key={invoice.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{invoice.project_name}</h4>
                          {getStatusBadge(invoice.validation_status)}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {invoice.employee_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(invoice.created_at).toLocaleDateString('de-DE')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Euro className="h-4 w-4" />
                            {formatAmount(invoice.amount)}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {invoice.document_name}
                          </div>
                        </div>

                        {invoice.description && (
                          <p className="text-sm bg-gray-50 p-2 rounded mb-3">
                            {invoice.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedInvoice(invoice)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Prüfen
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Rechnungsvalidierung - {invoice.project_name}</DialogTitle>
                            </DialogHeader>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Original Image */}
                              <div>
                                <h3 className="font-semibold mb-2">Original-Dokument</h3>
                                <img 
                                  src={getImageUrl(invoice.file_url)} 
                                  alt="Receipt" 
                                  className="w-full rounded border"
                                  style={{ maxHeight: '400px', objectFit: 'contain' }}
                                />
                              </div>

                              {/* Invoice Details */}
                              <div className="space-y-4">
                                <div>
                                  <h3 className="font-semibold mb-2">Details</h3>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span>Mitarbeiter:</span>
                                      <span className="font-medium">{invoice.employee_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Projekt:</span>
                                      <span className="font-medium">{invoice.project_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Betrag:</span>
                                      <span className="font-medium">{formatAmount(invoice.amount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Eingereicht:</span>
                                      <span className="font-medium">
                                        {new Date(invoice.created_at).toLocaleString('de-DE')}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {invoice.description && (
                                  <div>
                                    <h3 className="font-semibold mb-2">Beschreibung</h3>
                                    <p className="text-sm bg-gray-50 p-3 rounded">
                                      {invoice.description}
                                    </p>
                                  </div>
                                )}

                                {/* OCR Result */}
                                {invoice.ocr_result && (
                                  <div>
                                    <h3 className="font-semibold mb-2">OCR-Ergebnis</h3>
                                    <div className="text-sm bg-blue-50 p-3 rounded">
                                      <div className="flex justify-between mb-2">
                                        <span>Status:</span>
                                        <span className="font-medium">{invoice.ocr_result.status}</span>
                                      </div>
                                      {invoice.ocr_result.confidence && (
                                        <div className="flex justify-between">
                                          <span>Vertrauen:</span>
                                          <span className="font-medium">
                                            {Math.round(invoice.ocr_result.confidence * 100)}%
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Actions */}
                                <Separator />
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={() => validateInvoice(invoice.id, 'validate')}
                                    className="flex-1"
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Genehmigen
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedInvoice(invoice);
                                      setShowRejectionDialog(true);
                                    }}
                                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Ablehnen
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="h-5 w-5" />
              Rechnung ablehnen
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Bitte geben Sie einen Grund für die Ablehnung an. Der Mitarbeiter wird über die Ablehnung und den Grund informiert.
            </p>
            
            <Textarea
              placeholder="Grund für die Ablehnung..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
            
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowRejectionDialog(false);
                  setRejectionReason('');
                }}
              >
                Abbrechen
              </Button>
              <Button 
                variant="destructive"
                onClick={() => selectedInvoice && validateInvoice(selectedInvoice.id, 'reject')}
                disabled={!rejectionReason.trim()}
              >
                <X className="h-4 w-4 mr-2" />
                Ablehnen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}