import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Star,
  Mail,
  Phone,
  User,
  Briefcase,
  Save,
  X,
  Pencil,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

interface CustomerContact {
  id: string;
  customer_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  is_primary: boolean;
}

const emptyForm: ContactFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  role: '',
  is_primary: false,
};

const ROLE_OPTIONS = [
  'Geschäftsführer',
  'Bauleiter',
  'Sekretariat',
  'Einkauf',
  'Buchhaltung',
  'Projektleiter',
  'Hausmeister',
  'Eigentümer',
  'Sonstige',
];

interface CustomerContactsSectionProps {
  customerId: string;
}

export function CustomerContactsSection({ customerId }: CustomerContactsSectionProps) {
  const { companyId } = useSupabaseAuth();
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);

  const fetchContacts = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false })
      .order('last_name');

    if (error) {
      console.error('Error fetching contacts:', error);
    } else {
      setContacts((data as CustomerContact[]) || []);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name) {
      toast.error('Vor- und Nachname sind Pflichtfelder');
      return;
    }

    // If marking as primary, unmark all others first
    if (formData.is_primary && contacts.some(c => c.is_primary && c.id !== editingId)) {
      await supabase
        .from('customer_contacts')
        .update({ is_primary: false })
        .eq('customer_id', customerId);
    }

    if (editingId) {
      // Update
      const { error } = await supabase
        .from('customer_contacts')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          role: formData.role || null,
          is_primary: formData.is_primary,
        })
        .eq('id', editingId);

      if (error) {
        toast.error('Kontakt konnte nicht aktualisiert werden');
        console.error(error);
        return;
      }
      toast.success('Kontakt aktualisiert');
    } else {
      // Create
      const { error } = await supabase
        .from('customer_contacts')
        .insert({
          customer_id: customerId,
          company_id: companyId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          role: formData.role || null,
          is_primary: formData.is_primary,
        });

      if (error) {
        toast.error('Kontakt konnte nicht erstellt werden');
        console.error(error);
        return;
      }
      toast.success('Kontakt hinzugefügt');
    }

    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
    fetchContacts();
  };

  const handleEdit = (contact: CustomerContact) => {
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      role: contact.role || '',
      is_primary: contact.is_primary || false,
    });
    setEditingId(contact.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('customer_contacts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kontakt konnte nicht gelöscht werden');
      console.error(error);
      return;
    }
    toast.success('Kontakt gelöscht');
    fetchContacts();
  };

  const handleSetPrimary = async (id: string) => {
    // Unmark all
    await supabase
      .from('customer_contacts')
      .update({ is_primary: false })
      .eq('customer_id', customerId);
    // Mark this one
    await supabase
      .from('customer_contacts')
      .update({ is_primary: true })
      .eq('id', id);
    fetchContacts();
    toast.success('Hauptansprechpartner gesetzt');
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <User className="h-4 w-4" />
          Ansprechpartner ({contacts.length})
        </Label>
        {!showForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setFormData(emptyForm); setEditingId(null); setShowForm(true); }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Kontakt
          </Button>
        )}
      </div>

      {/* Contact list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Laden...</p>
      ) : contacts.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-2">
          Noch keine Ansprechpartner hinterlegt.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <Card key={contact.id} className="bg-white">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.is_primary && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          <Star className="h-3 w-3 mr-0.5 fill-amber-400" />
                          Haupt
                        </Badge>
                      )}
                      {contact.role && (
                        <Badge variant="outline" className="text-xs">
                          <Briefcase className="h-3 w-3 mr-0.5" />
                          {contact.role}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {!contact.is_primary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Als Hauptansprechpartner setzen"
                        onClick={() => handleSetPrimary(contact.id)}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(contact)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(contact.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                {editingId ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
              </Label>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={cancelForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Vorname *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData(p => ({ ...p, first_name: e.target.value }))}
                  placeholder="Max"
                  className="h-8 text-sm bg-white"
                />
              </div>
              <div>
                <Label className="text-xs">Nachname *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData(p => ({ ...p, last_name: e.target.value }))}
                  placeholder="Mustermann"
                  className="h-8 text-sm bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">E-Mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="max@firma.de"
                  className="h-8 text-sm bg-white"
                />
              </div>
              <div>
                <Label className="text-xs">Telefon</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+49 123 456789"
                  className="h-8 text-sm bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Funktion</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData(p => ({ ...p, role: v }))}
                >
                  <SelectTrigger className="h-8 text-sm bg-white">
                    <SelectValue placeholder="Funktion wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 h-8 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData(p => ({ ...p, is_primary: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  Hauptansprechpartner
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={cancelForm}>
                Abbrechen
              </Button>
              <Button type="button" size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {editingId ? 'Aktualisieren' : 'Hinzufügen'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
