import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy,
  Download,
  Eye,
  Code,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentTemplate {
  id: string;
  name: string;
  type: 'quote' | 'invoice' | 'delivery_note' | 'custom';
  category: string;
  content: string;
  variables: string[];
  created_at: string;
  updated_at: string;
  is_default: boolean;
}

const TEMPLATE_VARIABLES = [
  { key: '{{company_name}}', description: 'Firmenname' },
  { key: '{{customer_name}}', description: 'Kundenname' },
  { key: '{{customer_address}}', description: 'Kundenadresse' },
  { key: '{{document_number}}', description: 'Dokumentennummer' },
  { key: '{{document_date}}', description: 'Dokumentendatum' },
  { key: '{{valid_until}}', description: 'Gültig bis' },
  { key: '{{total_amount}}', description: 'Gesamtbetrag' },
  { key: '{{tax_amount}}', description: 'Steuerbetrag' },
  { key: '{{net_amount}}', description: 'Nettobetrag' },
  { key: '{{items_table}}', description: 'Positionstabelle' },
  { key: '{{payment_terms}}', description: 'Zahlungsbedingungen' },
  { key: '{{bank_details}}', description: 'Bankverbindung' },
];

export default function DocumentTemplateManager() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([
    {
      id: '1',
      name: 'Standard Angebot',
      type: 'quote',
      category: 'Standard',
      content: `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:

{{items_table}}

Gesamtbetrag: {{total_amount}}

Dieses Angebot ist gültig bis: {{valid_until}}

Mit freundlichen Grüßen
{{company_name}}`,
      variables: ['company_name', 'items_table', 'total_amount', 'valid_until'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_default: true
    },
    {
      id: '2',
      name: 'Standard Rechnung',
      type: 'invoice',
      category: 'Standard',
      content: `Rechnung Nr. {{document_number}}
Datum: {{document_date}}

An:
{{customer_name}}
{{customer_address}}

{{items_table}}

Nettobetrag: {{net_amount}}
USt. 19%: {{tax_amount}}
Gesamtbetrag: {{total_amount}}

Zahlungsbedingungen: {{payment_terms}}

Bankverbindung:
{{bank_details}}`,
      variables: ['document_number', 'document_date', 'customer_name', 'customer_address', 'items_table', 'net_amount', 'tax_amount', 'total_amount', 'payment_terms', 'bank_details'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_default: true
    }
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    type: 'quote' as const,
    category: 'Standard',
    content: '',
    is_default: false
  });

  const handleCreateTemplate = () => {
    setFormData({
      name: '',
      type: 'quote',
      category: 'Standard',
      content: '',
      is_default: false
    });
    setSelectedTemplate(null);
    setShowEditDialog(true);
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    setFormData({
      name: template.name,
      type: template.type,
      category: template.category,
      content: template.content,
      is_default: template.is_default
    });
    setSelectedTemplate(template);
    setShowEditDialog(true);
  };

  const handleSaveTemplate = () => {
    const extractedVariables = formData.content.match(/{{(\w+)}}/g)?.map(v => v.replace(/[{}]/g, '')) || [];
    
    if (selectedTemplate) {
      setTemplates(templates.map(t => 
        t.id === selectedTemplate.id 
          ? {
              ...t,
              ...formData,
              variables: extractedVariables,
              updated_at: new Date().toISOString()
            }
          : t
      ));
      toast({
        title: 'Vorlage aktualisiert',
        description: `Die Vorlage "${formData.name}" wurde erfolgreich aktualisiert.`
      });
    } else {
      const newTemplate: DocumentTemplate = {
        id: Date.now().toString(),
        ...formData,
        variables: extractedVariables,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setTemplates([...templates, newTemplate]);
      toast({
        title: 'Vorlage erstellt',
        description: `Die Vorlage "${formData.name}" wurde erfolgreich erstellt.`
      });
    }
    setShowEditDialog(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template?.is_default) {
      toast({
        title: 'Fehler',
        description: 'Standard-Vorlagen können nicht gelöscht werden.',
        variant: 'destructive'
      });
      return;
    }
    
    setTemplates(templates.filter(t => t.id !== templateId));
    toast({
      title: 'Vorlage gelöscht',
      description: 'Die Vorlage wurde erfolgreich gelöscht.'
    });
  };

  const handleDuplicateTemplate = (template: DocumentTemplate) => {
    const newTemplate: DocumentTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Kopie)`,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setTemplates([...templates, newTemplate]);
    toast({
      title: 'Vorlage dupliziert',
      description: `Die Vorlage "${template.name}" wurde erfolgreich dupliziert.`
    });
  };

  const handlePreviewTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setShowPreviewDialog(true);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = 
        formData.content.substring(0, start) + 
        variable + 
        formData.content.substring(end);
      
      setFormData({ ...formData, content: newContent });
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  const filteredTemplates = activeTab === 'all' 
    ? templates 
    : templates.filter(t => t.type === activeTab);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quote': return 'bg-blue-100 text-blue-800';
      case 'invoice': return 'bg-green-100 text-green-800';
      case 'delivery_note': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'quote': return 'Angebot';
      case 'invoice': return 'Rechnung';
      case 'delivery_note': return 'Lieferschein';
      default: return 'Benutzerdefiniert';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Dokumentvorlagen</CardTitle>
            <Button onClick={handleCreateTemplate}>
              <Plus className="mr-2 h-4 w-4" />
              Neue Vorlage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Alle</TabsTrigger>
              <TabsTrigger value="quote">Angebote</TabsTrigger>
              <TabsTrigger value="invoice">Rechnungen</TabsTrigger>
              <TabsTrigger value="delivery_note">Lieferscheine</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <div className="grid gap-4">
                {filteredTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <h3 className="font-semibold">{template.name}</h3>
                            <Badge className={getTypeColor(template.type)}>
                              {getTypeLabel(template.type)}
                            </Badge>
                            {template.is_default && (
                              <Badge variant="secondary">Standard</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Kategorie: {template.category}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {template.variables.map((variable) => (
                              <Badge key={variable} variant="outline" className="text-xs">
                                <Code className="h-3 w-3 mr-1" />
                                {variable}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreviewTemplate(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDuplicateTemplate(template)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {!template.is_default && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
            </DialogTitle>
            <DialogDescription>
              Erstellen oder bearbeiten Sie Ihre Dokumentvorlagen mit Variablen.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Standard Angebot"
                />
              </div>
              <div>
                <Label htmlFor="template-type">Typ</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="template-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quote">Angebot</SelectItem>
                    <SelectItem value="invoice">Rechnung</SelectItem>
                    <SelectItem value="delivery_note">Lieferschein</SelectItem>
                    <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="template-category">Kategorie</Label>
              <Input
                id="template-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="z.B. Standard, Premium, etc."
              />
            </div>

            <div>
              <Label htmlFor="template-content">Inhalt</Label>
              <div className="mb-2">
                <p className="text-sm text-gray-600 mb-2">Verfügbare Variablen:</p>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <Button
                      key={variable.key}
                      size="sm"
                      variant="outline"
                      onClick={() => insertVariable(variable.key)}
                      title={variable.description}
                    >
                      <Code className="h-3 w-3 mr-1" />
                      {variable.description}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea
                id="template-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={12}
                className="font-mono text-sm"
                placeholder="Verwenden Sie {{variable}} für dynamische Inhalte..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-default"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is-default">Als Standard-Vorlage festlegen</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="mr-2 h-4 w-4" />
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vorschau: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm">
              {selectedTemplate?.content}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}