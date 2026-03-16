// Manager module for delivery notes (Lieferscheine)
// Shows all company delivery notes with KPIs

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, Clock, Package } from 'lucide-react';
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes';
import { DeliveryNoteList } from '@/components/delivery-notes/DeliveryNoteList';

const DeliveryNotesModule = () => {
  const { deliveryNotes, fetchDeliveryNotes } = useDeliveryNotes();

  useEffect(() => {
    fetchDeliveryNotes();
  }, []);

  // KPI counts
  const total = deliveryNotes.length;

  // Total hours this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const hoursThisWeek = deliveryNotes
    .filter((n) => new Date(n.work_date) >= weekAgo)
    .reduce((sum, n) => {
      if (!n.start_time || !n.end_time) return sum;
      const [sh, sm] = n.start_time.split(':').map(Number);
      const [eh, em] = n.end_time.split(':').map(Number);
      const gross = (eh * 60 + em) - (sh * 60 + sm);
      const net = gross - (n.break_minutes ?? 0);
      return sum + Math.max(0, net / 60);
    }, 0);

  // Total material positions
  const materialCount = deliveryNotes.reduce(
    (sum, n) => sum + (n.delivery_note_items || []).filter((i) => i.item_type === 'material').length,
    0
  );

  const kpis = [
    {
      label: 'Lieferscheine',
      value: total,
      icon: ClipboardList,
      color: 'text-slate-600',
      bg: 'bg-slate-50',
    },
    {
      label: 'Stunden (7 Tage)',
      value: `${hoursThisWeek.toFixed(1)}h`,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Materialpositionen',
      value: materialCount,
      icon: Package,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lieferscheine</h1>
        <p className="text-sm text-slate-500 mt-1">
          Arbeitszeit und Material pro Projekt dokumentieren
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{kpi.value}</p>
                <p className="text-xs text-slate-500">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List */}
      <DeliveryNoteList showProjectColumn={true} />
    </div>
  );
};

export default DeliveryNotesModule;
