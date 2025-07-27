import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface DocumentTemplate {
  id: string;
  name: string;
  type: 'quote' | 'invoice';
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  header_text?: string | null;
  footer_text?: string | null;
}

/**
 * DocumentTemplateManager allows companies to create and manage custom document
 * templates for quotes and invoices. Each template can specify a name,
 * document type (quote or invoice), optional logo, primary/secondary color
 * scheme and header/footer text. Templates are stored in the
 * `document_templates` table and can be edited or deleted. The logo is
 * uploaded to the `document-templates` storage bucket.
 */
const DocumentTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'quote' as 'quote' | 'invoice',
    logo: null as File | null,
    primaryColor: '#3B82F6',
    secondaryColor: '#F97316',
    headerText: '',
    footerText: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: '',
    type: 'quote' as 'quote' | 'invoice',
    primaryColor: '#3B82F6',
    secondaryColor: '#F97316',
    headerText: '',
    footerText: '',
    logo: null as File | null,
    logo_url: '' as string | null,
  });

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .order('created_at');
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Vorlagen konnten nicht geladen werden.' });
    } else {
      setTemplates(data as DocumentTemplate[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleUploadLogo = async (file: File | null, templateId: string | null) => {
    if (!file) return null;
    const filePath = `${templateId || 'tmp'}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('document-templates')
      .upload(filePath, file, { upsert: true });
    if (uploadError) {
      console.error(uploadError);
      toast({ title: 'Fehler', description: 'Logo konnte nicht hochgeladen werden.' });
      return null;
    }
    const { data: urlData } = supabase.storage
      .from('document-templates')
      .getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    let logoUrl: string | null = null;
    if (newTemplate.logo) {
      logoUrl = await handleUploadLogo(newTemplate.logo, null);
    }
    const { error } = await supabase.from('document_templates').insert({
      name: newTemplate.name,
      type: newTemplate.type,
      logo_url: logoUrl,
      primary_color: newTemplate.primaryColor,
      secondary_color: newTemplate.secondaryColor,
      header_text: newTemplate.headerText,
      footer_text: newTemplate.footerText,
    });
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Vorlage konnte nicht gespeichert werden.' });
    } else {
      toast({ title: 'Vorlage gespeichert' });
      setNewTemplate({
        name: '',
        type: 'quote',
        logo: null,
        primaryColor: '#3B82F6',
        secondaryColor: '#F97316',
        headerText: '',
        footerText: '',
      });
      fetchTemplates();
    }
  };

  const startEdit = (template: DocumentTemplate) => {
    setEditingId(template.id);
    setEditData({
      name: template.name,
      type: template.type,
      primaryColor: template.primary_color || '#3B82F6',
      secondaryColor: template.secondary_color || '#F97316',
      headerText: template.header_text || '',
      footerText: template.footer_text || '',
      logo: null,
      logo_url: template.logo_url || null,
    });
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    let logoUrl = editData.logo_url;
    if (editData.logo) {
      logoUrl = await handleUploadLogo(editData.logo, editingId);
    }
    const { error } = await supabase
      .from('document_templates')
      .update({
        name: editData.name,
        type: editData.type,
        logo_url: logoUrl,
        primary_color: editData.primaryColor,
        secondary_color: editData.secondaryColor,
        header_text: editData.headerText,
        footer_text: editData.footerText,
      })
      .eq('id', editingId);
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Vorlage konnte nicht aktualisiert werden.' });
    } else {
      toast({ title: 'Vorlage aktualisiert' });
      setEditingId(null);
      setEditData({
        name: '',
        type: 'quote',
        primaryColor: '#3B82F6',
        secondaryColor: '#F97316',
        headerText: '',
        footerText: '',
        logo: null,
        logo_url: null,
      });
      fetchTemplates();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('document_templates').delete().eq('id', id);
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Vorlage konnte nicht gelöscht werden.' });
    } else {
      toast({ title: 'Vorlage gelöscht' });
      fetchTemplates();
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Dokumentvorlagen verwalten</h3>
      <form onSubmit={handleAddTemplate} className="border p-4 rounded-md space-y-3">
        <h4 className="font-medium">Neue Vorlage</h4>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Name"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
            className="border p-2 flex-1"
          />
          <select
            value={newTemplate.type}
            onChange={(e) =>
              setNewTemplate({ ...newTemplate, type: e.target.value as 'quote' | 'invoice' })
            }
            className="border p-2 flex-1"
          >
            <option value="quote">Angebot</option>
            <option value="invoice">Rechnung</option>
          </select>
        </div>
        <div className="flex space-x-2">
          <div className="flex-1">
            <label className="block text-sm">Primärfarbe</label>
            <input
              type="color"
              value={newTemplate.primaryColor}
              onChange={(e) => setNewTemplate({ ...newTemplate, primaryColor: e.target.value })}
              className="w-full h-8"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm">Sekundärfarbe</label>
            <input
              type="color"
              value={newTemplate.secondaryColor}
              onChange={(e) => setNewTemplate({ ...newTemplate, secondaryColor: e.target.value })}
              className="w-full h-8"
            />
          </div>
        </div>
        <input
          type="file"
          onChange={(e) => setNewTemplate({ ...newTemplate, logo: e.target.files?.[0] || null })}
          className="border p-2 w-full"
        />
        <textarea
          placeholder="Kopfzeile"
          value={newTemplate.headerText}
          onChange={(e) => setNewTemplate({ ...newTemplate, headerText: e.target.value })}
          className="border p-2 w-full h-20"
        />
        <textarea
          placeholder="Fußzeile"
          value={newTemplate.footerText}
          onChange={(e) => setNewTemplate({ ...newTemplate, footerText: e.target.value })}
          className="border p-2 w-full h-20"
        />
        <Button type="submit">Vorlage erstellen</Button>
      </form>
      <div>
        <h4 className="font-medium mb-2">Vorhandene Vorlagen</h4>
        {loading ? (
          <p>Lade...</p>
        ) : templates.length === 0 ? (
          <p>Keine Vorlagen vorhanden.</p>
        ) : (
          <ul className="space-y-2">
            {templates.map((tpl) => (
              <li key={tpl.id} className="border p-3 rounded-md">
                {editingId === tpl.id ? (
                  <form onSubmit={handleUpdateTemplate} className="space-y-2">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="border p-1 flex-1"
                      />
                      <select
                        value={editData.type}
                        onChange={(e) =>
                          setEditData({ ...editData, type: e.target.value as 'quote' | 'invoice' })
                        }
                        className="border p-1 flex-1"
                      >
                        <option value="quote">Angebot</option>
                        <option value="invoice">Rechnung</option>
                      </select>
                    </div>
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <label className="block text-xs">Primärfarbe</label>
                        <input
                          type="color"
                          value={editData.primaryColor}
                          onChange={(e) => setEditData({ ...editData, primaryColor: e.target.value })}
                          className="w-full h-6"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs">Sekundärfarbe</label>
                        <input
                          type="color"
                          value={editData.secondaryColor}
                          onChange={(e) => setEditData({ ...editData, secondaryColor: e.target.value })}
                          className="w-full h-6"
                        />
                      </div>
                    </div>
                    <input
                      type="file"
                      onChange={(e) => setEditData({ ...editData, logo: e.target.files?.[0] || null })}
                      className="border p-1 w-full"
                    />
                    <textarea
                      value={editData.headerText}
                      onChange={(e) => setEditData({ ...editData, headerText: e.target.value })}
                      className="border p-1 w-full h-16"
                    />
                    <textarea
                      value={editData.footerText}
                      onChange={(e) => setEditData({ ...editData, footerText: e.target.value })}
                      className="border p-1 w-full h-16"
                    />
                    <div className="flex space-x-2">
                      <Button size="sm" type="submit">Speichern</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">
                        {tpl.name} ({tpl.type === 'quote' ? 'Angebot' : 'Rechnung'})
                      </div>
                      <div className="text-sm text-gray-600">
                        Primär: {tpl.primary_color || '-'} | Sekundär: {tpl.secondary_color || '-'}
                      </div>
                      {tpl.logo_url && <img src={tpl.logo_url} alt="Logo" className="mt-1 h-6" />}
                      {tpl.header_text && (
                        <div className="text-xs text-gray-500 mt-1">Header: {tpl.header_text}</div>
                      )}
                      {tpl.footer_text && (
                        <div className="text-xs text-gray-500 mt-1">Footer: {tpl.footer_text}</div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(tpl)}>
                        Bearbeiten
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(tpl.id)}>
                        Löschen
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DocumentTemplateManager;
