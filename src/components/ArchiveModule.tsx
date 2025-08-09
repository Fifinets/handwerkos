import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, FileText, Layers3, Receipt } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const supabase: any = supabaseClient;

const matchesArchivedStatus = (status?: string | null) => {
  if (!status) return false;
  return /abgeschlossen|fertig|fertiggestellt|bezahlt|storniert|abgelehnt|archiv/i.test(status);
};

export default function ArchiveModule() {
  const { companyId } = useSupabaseAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [prj, ord, inv, qts] = await Promise.all([
          supabase.from('projects').select('id,name,status,start_date,end_date,updated_at').eq('company_id', companyId),
          supabase.from('orders').select('id,title,status,order_number,order_date,due_date,updated_at').eq('company_id', companyId),
          supabase.from('invoices').select('id,title,status,invoice_number,invoice_date,due_date,total_amount,updated_at').eq('company_id', companyId),
          supabase.from('quotes').select('id,title,status,quote_number,quote_date,valid_until,total_amount,updated_at').eq('company_id', companyId),
        ]);
        if (prj.error) throw prj.error;
        if (ord.error) throw ord.error;
        if (inv.error) throw inv.error;
        if (qts.error) throw qts.error;
        setProjects(prj.data || []);
        setOrders(ord.data || []);
        setInvoices(inv.data || []);
        setQuotes(qts.data || []);
      } catch (e: any) {
        console.error(e);
        toast({ title: 'Fehler beim Laden des Archivs', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const filterList = (list: any[], titleKey: string) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return list.filter((item) => {
      const statusHit = matchesArchivedStatus(item.status);
      const date = new Date(item.updated_at || item.due_date || item.end_date || item.order_date || item.quote_date || item.invoice_date || 0);
      const oldEnough = date < ninetyDaysAgo;
      const text = (item[titleKey] || '').toString().toLowerCase();
      const searchHit = !search || text.includes(search.toLowerCase());
      return searchHit && (statusHit || oldEnough);
    });
  };

  const archivedProjects = useMemo(() => filterList(projects, 'name'), [projects, search]);
  const archivedOrders = useMemo(() => filterList(orders, 'title'), [orders, search]);
  const archivedInvoices = useMemo(() => filterList(invoices, 'title'), [invoices, search]);
  const archivedQuotes = useMemo(() => filterList(quotes, 'title'), [quotes, search]);

  const Empty = ({ icon: Icon, label }: any) => (
    <div className="text-center py-10 text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-2 opacity-50" />
      <p>Keine archivierten {label} gefunden</p>
    </div>
  );

  const List = ({ items, titleKey, meta }: any) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((it: any) => (
        <Card key={it.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{it[titleKey]}</div>
                <div className="text-xs text-muted-foreground mt-1">{meta(it)}</div>
              </div>
              <Badge variant="secondary">{it.status}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Archiv</h2>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen..." className="w-56" />
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="projects" className="flex items-center gap-2"><Layers3 className="w-4 h-4" />Projekte</TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2"><FileText className="w-4 h-4" />Aufträge</TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2"><Receipt className="w-4 h-4" />Rechnungen</TabsTrigger>
          <TabsTrigger value="quotes" className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Angebote</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          {loading ? <Card><CardContent className="p-6">Laden...</CardContent></Card> :
            archivedProjects.length === 0 ? <Empty icon={Layers3} label="Projekte" /> :
            <List items={archivedProjects} titleKey="name" meta={(it: any) => `Ende: ${it.end_date || '-'} • Aktualisiert: ${new Date(it.updated_at).toLocaleDateString('de-DE')}`}/>
          }
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          {loading ? <Card><CardContent className="p-6">Laden...</CardContent></Card> :
            archivedOrders.length === 0 ? <Empty icon={FileText} label="Aufträge" /> :
            <List items={archivedOrders} titleKey="title" meta={(it: any) => `${it.order_number || ''} • Fällig: ${it.due_date || '-'}`}/>
          }
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          {loading ? <Card><CardContent className="p-6">Laden...</CardContent></Card> :
            archivedInvoices.length === 0 ? <Empty icon={Receipt} label="Rechnungen" /> :
            <List items={archivedInvoices} titleKey="title" meta={(it: any) => `${it.invoice_number || ''} • Fällig: ${it.due_date || '-'} • Betrag: €${it.total_amount ?? 0}`}/>
          }
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          {loading ? <Card><CardContent className="p-6">Laden...</CardContent></Card> :
            archivedQuotes.length === 0 ? <Empty icon={CheckCircle2} label="Angebote" /> :
            <List items={archivedQuotes} titleKey="title" meta={(it: any) => `${it.quote_number || ''} • Gültig bis: ${it.valid_until || '-'}`}/>
          }
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" />Automatisches Archivieren</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Hinweis: Später fügen wir eine Option hinzu, um Elemente automatisch beim Status „Fertig/Abgeschlossen/Bezahlt“ zu archivieren und optional wiederherzustellen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
