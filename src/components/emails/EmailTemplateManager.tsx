import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

/**
 * EmailTemplateManager allows users to create, edit and delete reusable email
 * templates. Templates are stored in the `email_templates` table with fields
 * `name`, `subject` and `body`. This component lists existing templates,
 * displays a simple form for adding new ones, and provides editing inline.
 */
const EmailTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', body: '' });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', subject: '', body: '' });

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Vorlagen konnten nicht geladen werden.' });
    } else {
      setTemplates(data as Template[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.name || !newTemplate.subject) {
      toast({ title: 'Bitte ausfüllen', description: 'Name und Betreff sind erforderlich.' });
      return;
    }
    const { error } = await supabase.from('email_templates').insert(newTemplate);
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Vorlage konnte nicht gespeichert werden.' });
    } else {
      toast({ title: 'Vorlage gespeichert', description: `${newTemplate.name} wurde angelegt.` });
      setNewTemplate({ name: '', subject: '', body: '' });
      fetchTemplates();
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Vorlage konnte nicht gelöscht werden.' });
    } else {
      toast({ title: 'Vorlage gelöscht', description: 'Die Vorlage wurde entfernt.' });
      fetchTemplates();
    }
  };

  const startEditing = (template: Template) => {
    setEditingTemplateId(template.id);
    setEditData({ name: template.name, subject: template.subject, body: template.body });
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplateId) return;
    const { error } = await supabase
      .from('email_templates')
      .update({ name: editData.name, subject: editData.subject, body: editData.body })
      .eq('id', editingTemplateId);
    if (error) {
      console.error(error);
      toast({ title: 'Fehler', description: 'Vorlage konnte nicht aktualisiert werden.' });
    } else {
      toast({ title: 'Vorlage aktualisiert', description: `${editData.name} wurde aktualisiert.` });
      setEditingTemplateId(null);
      setEditData({ name: '', subject: '', body: '' });
      fetchTemplates();
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">E-Mail-Vorlagen verwalten</h3>
      {/* New template form */}
      <form onSubmit={handleAddTemplate} className="space-y-2 border p-4 rounded-md">
        <h4 className="font-medium">Neue Vorlage</h4>
        <input
          type="text"
          placeholder="Name der Vorlage"
          value={newTemplate.name}
          onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
          className="border p-2 w-full"
        />
        <input
          type="text"
          placeholder="Betreff"
          value={newTemplate.subject}
          onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
          className="border p-2 w-full"
        />
        <textarea
          placeholder="Inhalt (HTML oder Text)"
          value={newTemplate.body}
          onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
          className="border p-2 w-full h-24"
        />
        <Button type="submit">Vorlage erstellen</Button>
      </form>
      {/* Template list */}
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
                {editingTemplateId === tpl.id ? (
                  <form onSubmit={handleUpdateTemplate} className="space-y-1">
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="border p-1 w-full"
                    />
                    <input
                      type="text"
                      value={editData.subject}
                      onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                      className="border p-1 w-full"
                    />
                    <textarea
                      value={editData.body}
                      onChange={(e) => setEditData({ ...editData, body: e.target.value })}
                      className="border p-1 w-full h-20"
                    />
                    <div className="flex space-x-2">
                      <Button size="sm" type="submit">Speichern</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingTemplateId(null)}>Abbrechen</Button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="font-semibold">{tpl.name}</div>
                    <div className="text-sm text-gray-700">Betreff: {tpl.subject}</div>
                    <div className="text-xs text-gray-500 truncate">{tpl.body.substring(0, 80)}...</div>
                    <div className="mt-2 flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => startEditing(tpl)}>Bearbeiten</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteTemplate(tpl.id)}>Löschen</Button>
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

export default EmailTemplateManager;

