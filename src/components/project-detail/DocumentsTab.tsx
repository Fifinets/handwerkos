import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import {
  ClipboardList,
  FileText,
  Receipt,
  Upload,
  Download,
  ExternalLink,
  File,
  FileImage,
  FilePlus
} from "lucide-react";
import { ProjectPermissions } from "@/types/project";
import { formatFileSize } from './utils';
import { useToast } from "@/hooks/use-toast";

export interface DocumentsTabProps {
  permissions: ProjectPermissions;
  projectOffers: any[];
  projectInvoices: any[];
  projectDocuments: any[];
  deliveryNotes: any[];
  onSetIsCreateInvoiceOpen: (open: boolean) => void;
  onSetSelectedInvoice: (invoice: any) => void;
  onSetIsInvoiceDetailOpen: (open: boolean) => void;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({
  permissions,
  projectOffers,
  projectInvoices,
  projectDocuments,
  deliveryNotes,
  onSetIsCreateInvoiceOpen,
  onSetSelectedInvoice,
  onSetIsInvoiceDetailOpen,
  onClose,
  onNavigate,
}) => {
  const { toast } = useToast();

  return (
    <TabsContent value="documents" className="px-6 pb-6 pt-5 space-y-5 min-h-[600px] mt-0">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Dokumente</h3>
          <p className="text-xs text-slate-400">
            {projectOffers.length} Angebot(e) · {projectInvoices.length} Rechnung(en) · {deliveryNotes.length} Lieferschein(e) · {projectDocuments.length} Datei(en)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permissions.can_link_invoices && (
            <Button
              variant="default"
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => onSetIsCreateInvoiceOpen(true)}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Rechnung erstellen
            </Button>
          )}
          {permissions.can_upload_files && (
            <Button variant="outline" size="sm" className="text-slate-600">
              <Upload className="h-4 w-4 mr-2" />
              Hochladen
            </Button>
          )}
        </div>
      </div>

      {/* Angebote Section */}
      {projectOffers.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-orange-50/50 px-5 py-3">
            <CardTitle className="text-sm font-semibold text-orange-700 m-0 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Angebote ({projectOffers.length})
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {projectOffers.map((offer: any) => {
              const statusColors: Record<string, string> = {
                draft: 'bg-slate-100 text-slate-600',
                sent: 'bg-blue-100 text-blue-700',
                accepted: 'bg-green-100 text-green-700',
                rejected: 'bg-red-100 text-red-700',
                expired: 'bg-amber-100 text-amber-700',
              };
              const statusLabels: Record<string, string> = {
                draft: 'Entwurf',
                sent: 'Versendet',
                accepted: 'Angenommen',
                rejected: 'Abgelehnt',
                expired: 'Abgelaufen',
              };
              return (
                <div
                  key={offer.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-orange-50/50 transition-colors cursor-pointer group"
                  onClick={() => {
                    onClose();
                    onNavigate(`/offers/${offer.id}/edit`);
                  }}
                >
                  <div className="flex-shrink-0 p-2 rounded-lg bg-orange-50 group-hover:bg-orange-100 transition-colors">
                    <FileText className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-800 group-hover:text-orange-700 transition-colors">{offer.offer_number || 'Angebot'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[offer.status] || 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[offer.status] || offer.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-slate-800">
                      {(offer.snapshot_gross_total || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Rechnungen Section */}
      {projectInvoices.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-emerald-50/50 px-5 py-3">
            <CardTitle className="text-sm font-semibold text-emerald-700 m-0 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Rechnungen ({projectInvoices.length})
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {projectInvoices.map((invoice: any) => {
              const statusColors: Record<string, string> = {
                draft: 'bg-slate-100 text-slate-600',
                sent: 'bg-blue-100 text-blue-700',
                paid: 'bg-green-100 text-green-700',
                overdue: 'bg-red-100 text-red-700',
                cancelled: 'bg-slate-100 text-slate-500',
              };
              const statusLabels: Record<string, string> = {
                draft: 'Entwurf',
                sent: 'Versendet',
                paid: 'Bezahlt',
                overdue: 'Überfällig',
                cancelled: 'Storniert',
              };
              const typeLabels: Record<string, string> = {
                final: 'Schlussrechnung',
                partial: 'Abschlagsrechnung',
                advance: 'Vorauszahlung',
                credit: 'Gutschrift',
              };
              return (
                <div
                  key={invoice.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                  onClick={() => {
                    onSetSelectedInvoice(invoice);
                    onSetIsInvoiceDetailOpen(true);
                  }}
                >
                  <div className="flex-shrink-0 p-2 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                    <Receipt className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-800 group-hover:text-emerald-700 transition-colors">{invoice.invoice_number || 'Rechnung'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[invoice.status] || 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[invoice.status] || invoice.status}
                      </span>
                      {invoice.invoice_type && invoice.invoice_type !== 'final' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {typeLabels[invoice.invoice_type] || invoice.invoice_type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('de-DE') : '–'}
                      {invoice.title && ` · ${invoice.title}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-slate-800">
                      {(invoice.gross_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Lieferscheine Section */}
      {deliveryNotes.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-teal-50/50 px-5 py-3">
            <CardTitle className="text-sm font-semibold text-teal-700 m-0 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Lieferscheine ({deliveryNotes.length})
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {deliveryNotes.map((dn: any) => {
              const empName = dn.employee
                ? `${dn.employee.first_name} ${dn.employee.last_name}`
                : 'Mitarbeiter';
              const dateStr = dn.work_date ? new Date(dn.work_date).toLocaleDateString('de-DE') : '–';
              let hours = 0;
              if (dn.start_time && dn.end_time) {
                const [sh, sm] = dn.start_time.split(':').map(Number);
                const [eh, em] = dn.end_time.split(':').map(Number);
                hours = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm) - (dn.break_minutes ?? 0)) / 60);
              }
              return (
                <div
                  key={dn.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-teal-50/50 transition-colors cursor-pointer group"
                  onClick={() => {
                    toast({
                      title: `Lieferschein ${dn.delivery_note_number || ''}`,
                      description: `${empName} · ${dateStr} · ${hours.toFixed(1)}h`,
                    });
                  }}
                >
                  <div className="flex-shrink-0 p-2 rounded-lg bg-teal-50 group-hover:bg-teal-100 transition-colors">
                    <ClipboardList className="h-5 w-5 text-teal-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-800 group-hover:text-teal-700 transition-colors">{dn.delivery_note_number || 'Lieferschein'}</span>
                      {dn.signed_at && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          Unterschrieben
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{dateStr} · {empName} · {hours.toFixed(1)}h</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Hochgeladene Dateien Section */}
      {projectDocuments.length > 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
            <CardTitle className="text-sm font-semibold text-slate-700 m-0 flex items-center gap-2">
              <File className="h-4 w-4" />
              Hochgeladene Dateien ({projectDocuments.length})
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {projectDocuments.map((doc: any) => {
              const isImage = doc.mime_type?.startsWith('image/');
              const isPdf = doc.mime_type === 'application/pdf';
              const handleDownload = () => {
                const url = doc.file_url || doc.file_path;
                if (url) {
                  window.open(url, '_blank');
                } else {
                  toast({
                    title: "Download nicht verfügbar",
                    description: "Die Datei konnte nicht gefunden werden.",
                    variant: "destructive"
                  });
                }
              };
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-100/50 transition-colors cursor-pointer group"
                  onClick={handleDownload}
                >
                  <div className={`flex-shrink-0 p-2 rounded-lg transition-colors ${isImage ? 'bg-purple-50 group-hover:bg-purple-100' : isPdf ? 'bg-red-50 group-hover:bg-red-100' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                    {isImage ? (
                      <FileImage className="h-5 w-5 text-purple-500" />
                    ) : isPdf ? (
                      <FileText className="h-5 w-5 text-red-500" />
                    ) : (
                      <File className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-slate-900">{doc.name || 'Dokument'}</p>
                    <p className="text-xs text-slate-500">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString('de-DE') : '–'}
                      {doc.file_size && ` · ${formatFileSize(doc.file_size)}`}
                    </p>
                  </div>
                  <Download className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {projectOffers.length === 0 && projectInvoices.length === 0 && deliveryNotes.length === 0 && projectDocuments.length === 0 && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-12 text-center">
            <File className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h4 className="text-base font-medium text-slate-700 mb-1">Keine Dokumente vorhanden</h4>
            <p className="text-sm text-slate-400 mb-4">
              Erstellen Sie Angebote, Rechnungen oder laden Sie Dateien hoch.
            </p>
            {permissions.can_upload_files && (
              <Button variant="outline" size="sm">
                <FilePlus className="h-4 w-4 mr-2" />
                Erste Datei hochladen
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
};

export default DocumentsTab;
