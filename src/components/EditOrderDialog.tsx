
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { ORDER_STATUS_LABELS, OrderStatus } from "@/types/order";

interface Customer {
  id: string;
  company_name: string;
  contact_person: string;
}

interface Offer {
  id: string;
  offer_number: string;
  project: { name: string } | null;
  snapshots?: {
    snapshot_net_total?: number;
    snapshot_gross_total?: number;
  };
  total_amount?: number; // Depending on what we fetch
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  offer_id?: string | null;
  title: string;
  description: string | null;
  order_date: string;
  due_date: string | null;
  status: string;
  priority: string;
  total_amount: number | null;
  currency: string | null;
  notes: string | null;
}

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onOrderUpdated: () => void;
}

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }: EditOrderDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [offerId, setOfferId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<OrderStatus>('created');
  const [priority, setPriority] = useState('Normal');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (customerId) {
      fetchOffers(customerId);
    } else {
      setOffers([]);
    }
  }, [customerId]);

  const fetchOffers = async (custId: string) => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          id,
          offer_number,
          projects ( name ),
          snapshot_net_total,
          snapshot_gross_total
        `)
        .eq('status', 'accepted')
        .eq('customer_id', custId)
        .order('created_at', { ascending: false });

      if (error) {
        return;
      }

      const mappedOffers = (data || []).map(o => ({
        id: o.id,
        offer_number: o.offer_number,
        project: Array.isArray(o.projects) ? o.projects[0] : o.projects,
        snapshots: {
          snapshot_net_total: o.snapshot_net_total,
          snapshot_gross_total: o.snapshot_gross_total,
        }
      })) as Offer[];

      setOffers(mappedOffers);
    } catch (error) {
      console.error('Error fetching offers:', error);
    }
  };

  useEffect(() => {
    if (open && order) {
      setTitle(order.title);
      setDescription(order.description || '');
      setCustomerId(order.customer_id);
      setOfferId(order.offer_id || '');
      setDueDate(order.due_date || '');
      setStatus((order.status as OrderStatus) || 'created');
      setPriority(order.priority);
      setTotalAmount(order.total_amount?.toString() || '');
      setCurrency(order.currency || 'EUR');
      setNotes(order.notes || '');
      fetchCustomers();
    }
  }, [open, order]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_person')
        .eq('status', 'Aktiv')
        .order('company_name');

      if (error) {
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !customerId) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {

      const orderData = {
        title: title.trim(),
        description: description.trim() || null,
        customer_id: customerId,
        offer_id: offerId || null,
        due_date: dueDate || null,
        status,
        priority,
        total_amount: totalAmount ? parseFloat(totalAmount) : null,
        currency,
        notes: notes.trim() || null
      };

      const { error } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', order.id);

      if (error) {
        toast({
          title: "Fehler",
          description: "Auftrag konnte nicht aktualisiert werden.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Erfolg",
        description: "Auftrag wurde erfolgreich aktualisiert."
      });

      onOrderUpdated();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auftrag bearbeiten - {order?.order_number}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auftragstitel eingeben"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Kunde *</Label>
              <Select value={customerId} onValueChange={setCustomerId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Kunde auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer">Angebot (Optional)</Label>
            <Select value={offerId} onValueChange={setOfferId} disabled={!customerId || offers.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={!customerId ? "Zuerst Kunde wählen" : offers.length === 0 ? "Keine aktiven Angebote" : "Angebot auswählen"} />
              </SelectTrigger>
              <SelectContent>
                {offers.map((offer) => (
                  <SelectItem key={offer.id} value={offer.id}>
                    {offer.offer_number} {offer.project?.name ? `- ${offer.project.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Auftragsbeschreibung eingeben"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as OrderStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Niedrig">Niedrig</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Hoch">Hoch</SelectItem>
                  <SelectItem value="Dringend">Dringend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Fälligkeitsdatum</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Gesamtbetrag</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Währung</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Notizen"
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird gespeichert..." : "Änderungen speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;
