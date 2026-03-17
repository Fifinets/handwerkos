import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  StickyNote,
  Phone,
  Mail,
  Users,
  CalendarClock,
  Check,
  X,
  Save,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

interface CustomerNote {
  id: string;
  company_id: string;
  customer_id: string;
  employee_id: string | null;
  note_type: 'note' | 'call' | 'email' | 'meeting' | 'follow_up';
  title: string | null;
  content: string;
  follow_up_date: string | null;
  follow_up_done: boolean;
  created_at: string;
  updated_at: string;
  employee?: { first_name: string; last_name: string } | null;
}

interface NoteFormData {
  note_type: 'note' | 'call' | 'email' | 'meeting' | 'follow_up';
  title: string;
  content: string;
  follow_up_date: string;
}

const emptyForm: NoteFormData = {
  note_type: 'note',
  title: '',
  content: '',
  follow_up_date: '',
};

const NOTE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  note: { label: 'Notiz', icon: StickyNote, color: 'bg-slate-100 text-slate-700' },
  call: { label: 'Anruf', icon: Phone, color: 'bg-green-50 text-green-700' },
  email: { label: 'E-Mail', icon: Mail, color: 'bg-blue-50 text-blue-700' },
  meeting: { label: 'Termin', icon: Users, color: 'bg-purple-50 text-purple-700' },
  follow_up: { label: 'Wiedervorlage', icon: CalendarClock, color: 'bg-amber-50 text-amber-700' },
};

interface CustomerNotesSectionProps {
  customerId: string;
}

export function CustomerNotesSection({ customerId }: CustomerNotesSectionProps) {
  const { companyId, user } = useSupabaseAuth();
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<NoteFormData>(emptyForm);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Get current employee ID
  useEffect(() => {
    if (!user || !companyId) return;
    supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEmployeeId(data.id);
      });
  }, [user, companyId]);

  const fetchNotes = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('customer_notes')
      .select('*, employee:employees!employee_id(first_name, last_name)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
    } else {
      setNotes((data as CustomerNote[]) || []);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSave = async () => {
    if (!formData.content.trim()) {
      toast.error('Bitte Inhalt eingeben');
      return;
    }

    const { error } = await supabase
      .from('customer_notes')
      .insert({
        company_id: companyId,
        customer_id: customerId,
        employee_id: employeeId,
        note_type: formData.note_type,
        title: formData.title || null,
        content: formData.content,
        follow_up_date: formData.follow_up_date || null,
        follow_up_done: false,
      });

    if (error) {
      toast.error('Notiz konnte nicht gespeichert werden');
      console.error(error);
      return;
    }

    toast.success('Notiz gespeichert');
    setFormData(emptyForm);
    setShowForm(false);
    fetchNotes();
  };

  const handleToggleFollowUp = async (noteId: string, currentDone: boolean) => {
    await supabase
      .from('customer_notes')
      .update({ follow_up_done: !currentDone })
      .eq('id', noteId);
    fetchNotes();
  };

  const handleDelete = async (noteId: string) => {
    await supabase
      .from('customer_notes')
      .delete()
      .eq('id', noteId);
    toast.success('Notiz gelöscht');
    fetchNotes();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Pending follow-ups
  const pendingFollowUps = notes.filter(
    n => n.follow_up_date && !n.follow_up_done
  );

  return (
    <div className="space-y-3">
      {/* Pending follow-ups banner */}
      {pendingFollowUps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-2">
            <CalendarClock className="h-3.5 w-3.5" />
            Offene Wiedervorlagen ({pendingFollowUps.length})
          </p>
          <div className="space-y-1">
            {pendingFollowUps.map(n => {
              const isOverdue = n.follow_up_date && new Date(n.follow_up_date) < new Date();
              return (
                <div
                  key={n.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className={isOverdue ? 'text-red-600 font-medium' : 'text-amber-800'}>
                    {formatShortDate(n.follow_up_date!)} — {n.title || n.content.substring(0, 50)}
                    {isOverdue && ' (überfällig)'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-green-700 hover:text-green-800"
                    onClick={() => handleToggleFollowUp(n.id, n.follow_up_done)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Erledigt
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          Kommunikation & Notizen ({notes.length})
        </Label>
        {!showForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setFormData(emptyForm); setShowForm(true); }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Eintrag
          </Button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Neuer Eintrag</Label>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Typ</Label>
                <Select
                  value={formData.note_type}
                  onValueChange={(v) => setFormData(p => ({ ...p, note_type: v as NoteFormData['note_type'] }))}
                >
                  <SelectTrigger className="h-8 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTE_TYPE_CONFIG).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Betreff</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="z.B. Rückruf wegen Angebot"
                  className="h-8 text-sm bg-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Inhalt *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
                placeholder="Was wurde besprochen?"
                rows={3}
                className="text-sm bg-white"
              />
            </div>
            {(formData.note_type === 'follow_up' || formData.note_type === 'call') && (
              <div>
                <Label className="text-xs">Wiedervorlage am</Label>
                <Input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData(p => ({ ...p, follow_up_date: e.target.value }))}
                  className="h-8 text-sm bg-white w-48"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
              <Button type="button" size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Speichern
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes timeline */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Laden...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Noch keine Einträge.</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {notes.map((note) => {
            const cfg = NOTE_TYPE_CONFIG[note.note_type] || NOTE_TYPE_CONFIG.note;
            const Icon = cfg.icon;
            const empName = note.employee
              ? `${note.employee.first_name} ${note.employee.last_name}`
              : null;

            return (
              <div key={note.id} className="flex gap-2 group">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${cfg.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(note.created_at)}</span>
                    {empName && <span>— {empName}</span>}
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                    {note.follow_up_date && !note.follow_up_done && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                        WV: {formatShortDate(note.follow_up_date)}
                      </Badge>
                    )}
                    {note.follow_up_done && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> erledigt
                      </Badge>
                    )}
                  </div>
                  {note.title && (
                    <p className="text-sm font-medium mt-0.5">{note.title}</p>
                  )}
                  <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{note.content}</p>
                </div>
                <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {note.follow_up_date && !note.follow_up_done && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-green-600"
                      title="Als erledigt markieren"
                      onClick={() => handleToggleFollowUp(note.id, note.follow_up_done)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => handleDelete(note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
