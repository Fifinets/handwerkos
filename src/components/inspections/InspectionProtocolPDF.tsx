import jsPDF from 'jspdf';
import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { ProtocolWithRelations } from '@/types/inspection';
import { PROTOCOL_TYPE_LABELS, RESULT_LABELS, SEVERITY_LABELS, MEASUREMENT_TYPE_LABELS } from '@/types/inspection';
import type { MeasurementType, InspectionMeasurement } from '@/types/inspection';

interface PDFOptions {
  protocol: ProtocolWithRelations;
  companyName: string;
  companyLogo?: string;
}

export async function generateInspectionPDF({ protocol, companyName, companyLogo }: PDFOptions): Promise<jsPDF> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const M = 15; // margin
  let y = M;

  const ln = (yy: number) => { doc.setDrawColor(200); doc.line(M, yy, 195, yy); };
  const sec = (t: string) => { y += 4; doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(t, M, y); y += 2; ln(y); y += 5; };
  const rw = (l: string, v: string) => { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(l, M, y); doc.text(v, M + 55, y); y += 5; };
  const pg = () => { if (y > 270) { doc.addPage(); y = M; } };

  // Header
  if (companyLogo) { try { doc.addImage(companyLogo, 'PNG', M, y, 28, 10); } catch { /* ignore logo errors */ } }
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(companyName, companyLogo ? M + 32 : M, y + 5); y += 14;
  doc.setFontSize(16); doc.text('Pruefprotokoll', M, y); y += 7;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(PROTOCOL_TYPE_LABELS[protocol.protocol_type] ?? protocol.protocol_type, M, y); y += 8;
  rw('Protokoll-Nr.:', protocol.protocol_number ?? '-');
  rw('Pruefdatum:', protocol.inspection_date);

  // Device info (0701/0702)
  if (protocol.protocol_type === 'vde_0701_0702' && protocol.device) {
    sec('Geraetedaten');
    rw('Geraet:', protocol.device.device_name);
    rw('Hersteller:', protocol.device.manufacturer ?? '-');
    rw('Seriennr.:', protocol.device.serial_number ?? '-');
    rw('Schutzklasse:', protocol.device.protection_class ?? '-');
  }

  // Visual checks (parsed from notes JSON for anlage types)
  if (protocol.protocol_type !== 'vde_0701_0702' && protocol.notes) {
    try {
      const parsed = JSON.parse(protocol.notes) as {
        visualChecks?: { checked: boolean; label: string; note?: string }[];
      };
      if (parsed.visualChecks?.length) {
        sec('Sichtpruefung');
        doc.setFontSize(8);
        for (const item of parsed.visualChecks) {
          doc.text(item.checked ? '[x]' : '[ ]', M, y);
          doc.text(item.label, M + 8, y);
          if (item.note) doc.text(item.note, M + 115, y);
          y += 4; pg();
        }
      }
    } catch {
      /* notes is plain text, not JSON */
    }
  }

  // Measurements grouped by type
  if (protocol.measurements?.length) {
    const byType = new Map<string, InspectionMeasurement[]>();
    for (const m of protocol.measurements) {
      const arr = byType.get(m.measurement_type) ?? [];
      arr.push(m);
      byType.set(m.measurement_type, arr);
    }
    for (const [type, rows] of byType) {
      sec(MEASUREMENT_TYPE_LABELS[type as MeasurementType] ?? type);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('Stromkreis', M, y); doc.text('Messwert', M + 45, y);
      doc.text('Grenzwert', M + 80, y); doc.text('Ergebnis', M + 115, y);
      y += 1; ln(y); y += 4; doc.setFont('helvetica', 'normal');
      for (const m of rows) {
        doc.text(m.circuit_label ?? '-', M, y);
        doc.text(`${m.measured_value} ${m.unit}`, M + 45, y);
        doc.text(m.limit_value != null ? `${m.limit_value} ${m.unit}` : '-', M + 80, y);
        doc.text(m.result === 'pass' ? 'OK' : 'FAIL', M + 115, y);
        y += 4; pg();
      }
    }
  }

  // Defects
  if (protocol.defects?.length) {
    sec('Festgestellte Maengel');
    doc.setFontSize(8);
    for (const d of protocol.defects) {
      doc.setFont('helvetica', 'bold');
      doc.text(`[${SEVERITY_LABELS[d.severity] ?? d.severity}]`, M, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${d.description}${d.location ? ` (${d.location})` : ''}`, M + 22, y);
      y += 5; pg();
    }
  }

  // Overall result
  y += 6; ln(y); y += 6;
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  const resultText = protocol.overall_result ? RESULT_LABELS[protocol.overall_result] : 'OFFEN';
  doc.text(`Gesamtergebnis: ${resultText}`, M, y); y += 12;

  // Signature line
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  ln(y); y += 4;
  doc.text('Ort, Datum', M, y);
  doc.text('Unterschrift Pruefer', M + 80, y);

  // Footer on all pages
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`Erstellt mit HandwerkOS | ${new Date().toLocaleString('de-DE')}`, M, 290);
    doc.text(`Seite ${p} / ${pages}`, 170, 290); doc.setTextColor(0);
  }
  return doc;
}

// Download button component
export function InspectionPDFDownloadButton({ protocol, companyName, companyLogo }: PDFOptions) {
  const handle = async () => {
    const doc = await generateInspectionPDF({ protocol, companyName, companyLogo });
    doc.save(`Pruefprotokoll_${protocol.protocol_number ?? protocol.id.slice(0, 8)}.pdf`);
  };
  return (
    <Button variant="outline" size="sm" onClick={handle}>
      <Download className="h-4 w-4 mr-1" />PDF
    </Button>
  );
}
