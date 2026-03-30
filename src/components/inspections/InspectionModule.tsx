import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Zap, Calendar, Plus } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useInspectionProtocols, useInspectionProtocol } from '@/hooks/useInspections';
import InspectionForm from './InspectionForm';
import DeviceInventory from './DeviceInventory';
import DGUVScheduleDashboard from './DGUVScheduleDashboard';
import { InspectionPDFDownloadButton } from './InspectionProtocolPDF';
import type { InspectionDevice, ProtocolType } from '@/types/inspection';
import { PROTOCOL_TYPE_LABELS, RESULT_LABELS } from '@/types/inspection';
import { format } from 'date-fns';
import { useFeatureAccess } from '@/hooks/useSubscription';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';

function useCustomerList() {
  return useQuery({
    queryKey: ['customers-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, company_name').order('company_name');
      return (data ?? []).map(c => ({ id: c.id, name: c.company_name }));
    },
  });
}

export default function InspectionModule() {
  const { hasAccess, isLoading: accessLoading, requiredPlan } = useFeatureAccess('vde_protocols');

  const { data: protocols = [] } = useInspectionProtocols();
  const { data: customers = [] } = useCustomerList();

  const [tab, setTab] = useState('protocols');
  const [formOpen, setFormOpen] = useState(false);
  const [selProtocolId, setSelProtocolId] = useState<string | undefined>();
  const [selDevice, setSelDevice] = useState<InspectionDevice | undefined>();
  const [defType, setDefType] = useState<ProtocolType | undefined>();

  const { data: selProtocol } = useInspectionProtocol(selProtocolId ?? '');

  if (!accessLoading && !hasAccess) {
    return <UpgradePrompt feature="VDE-Pruefprotokolle" requiredPlan={requiredPlan || 'enterprise'} />;
  }

  const openNew = (dev?: InspectionDevice) => {
    setSelProtocolId(undefined);
    setSelDevice(dev);
    setDefType(dev?.device_type === 'geraet' ? 'vde_0701_0702' : 'vde_0100_600');
    setFormOpen(true);
  };

  const ResultBadge = ({ r }: { r?: string | null }) => {
    if (r === 'pass') return <Badge className="bg-green-100 text-green-800">BESTANDEN</Badge>;
    if (r === 'fail') return <Badge variant="destructive">NICHT BEST.</Badge>;
    if (r === 'conditional') return <Badge className="bg-yellow-100 text-yellow-800">BEDINGT</Badge>;
    return <Badge variant="secondary">Entwurf</Badge>;
  };

  // Short labels for protocol type column
  const PT_SHORT: Record<string, string> = {
    vde_0100_600: '0100-600',
    vde_0105_100: '0105-100',
    vde_0701_0702: '0701/0702',
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">Pruefprotokolle</h1>
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">DEMO</Badge>
          </div>
          <p className="text-sm text-slate-500">VDE-Pruefungen, Geraete & DGUV V3 — Grenzwerte noch nicht normkonform validiert</p>
        </div>
        <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" />Neue Pruefung</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="protocols" className="gap-1">
            <ClipboardList className="h-4 w-4" />Pruefprotokolle
            <Badge variant="secondary" className="ml-1 text-xs">{protocols.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-1"><Zap className="h-4 w-4" />Geraete & Anlagen</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1"><Calendar className="h-4 w-4" />DGUV V3 Fristen</TabsTrigger>
        </TabsList>

        <TabsContent value="protocols">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                <th className="p-3">Nr.</th>
                <th className="p-3">Typ</th>
                <th className="p-3">Datum</th>
                <th className="p-3">Ergebnis</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>{protocols.map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50 cursor-pointer"
                  onClick={() => { setSelProtocolId(p.id); setFormOpen(true); }}>
                  <td className="p-3 font-mono text-xs">{p.protocol_number ?? p.id.slice(0, 8)}</td>
                  <td className="p-3"><Badge variant="outline">{PT_SHORT[p.protocol_type] ?? p.protocol_type}</Badge></td>
                  <td className="p-3">{format(new Date(p.inspection_date), 'dd.MM.yyyy')}</td>
                  <td className="p-3"><ResultBadge r={p.overall_result} /></td>
                  <td className="p-3"><Badge variant={p.is_finalized ? 'default' : 'secondary'}>{p.is_finalized ? 'Final' : 'Entwurf'}</Badge></td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    {p.is_finalized && <InspectionPDFDownloadButton protocol={p as any} companyName="Elektrobetrieb MG" />}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {protocols.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p>Noch keine Protokolle vorhanden.</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="devices">
          <DeviceInventory onStartInspection={openNew} />
        </TabsContent>

        <TabsContent value="schedule">
          <DGUVScheduleDashboard customers={customers} onDeviceClick={openNew} />
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selProtocolId ? `Protokoll ${selProtocol?.protocol_number ?? ''}` : 'Neue Pruefung'}</DialogTitle>
          </DialogHeader>
          <InspectionForm
            protocol={selProtocol ?? undefined}
            deviceId={selDevice?.id}
            customerId={selDevice?.customer_id ?? undefined}
            defaultType={defType}
            onClose={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
