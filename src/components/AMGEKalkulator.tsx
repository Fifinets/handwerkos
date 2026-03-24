import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calculator,
  Plus,
  Save,
  Trash2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Star,
  ArrowRight,
} from "lucide-react";
import { useAMGECalculations, useCreateAMGE, useUpdateAMGE, useDeleteAMGE, useSetActiveAMGE } from '@/hooks/useAMGE';
import { calculateAMGE, calculateTotalMarkup, calculateMargin } from '@/utils/amgeCalculator';
import type { AMGEFormData, AMGECalculation, AMGECalculationSteps, CustomSurcharge } from '@/types/amge';
import { AMGE_DEFAULTS } from '@/types/amge';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

const formatPercent = (value: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) + ' %';

// Prozent-Eingabefeld
function PercentInput({ label, value, onChange, disabled }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <Label className="text-sm text-slate-600 flex-1">{label}</Label>
      <div className="relative w-24">
        <Input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="text-right pr-7 h-8 text-sm"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
      </div>
    </div>
  );
}

// Zusammenklappbare Sektion
function CollapsibleSection({ title, badge, children, defaultOpen = true }: {
  title: string;
  badge: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white text-slate-600 font-mono text-xs">
            {badge}
          </Badge>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
      {open && <div className="p-3 space-y-1">{children}</div>}
    </div>
  );
}

// Ergebnis-Schritt-Anzeige
function StepResult({ label, betrag, prozent, isTotal }: {
  label: string;
  betrag: number;
  prozent?: number;
  isTotal?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${isTotal ? 'border-t-2 border-slate-300 pt-3 mt-2' : ''}`}>
      <div className="flex items-center gap-2">
        {!isTotal && <ArrowRight className="h-3 w-3 text-slate-400" />}
        <span className={`text-sm ${isTotal ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {prozent !== undefined && (
          <span className="text-xs text-slate-400 font-mono">+{formatPercent(prozent)}</span>
        )}
        <span className={`font-mono text-sm ${isTotal ? 'font-bold text-emerald-700 text-base' : 'font-medium text-slate-800'}`}>
          {formatCurrency(betrag)}
        </span>
      </div>
    </div>
  );
}

const AMGEKalkulator: React.FC = () => {
  const { data: calculations, isLoading } = useAMGECalculations();
  const createMutation = useCreateAMGE();
  const updateMutation = useUpdateAMGE();
  const deleteMutation = useDeleteAMGE();
  const setActiveMutation = useSetActiveAMGE();

  const [formData, setFormData] = useState<AMGEFormData>(AMGE_DEFAULTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Live-Berechnung
  const steps = useMemo(() => calculateAMGE(formData), [formData]);
  const totalMarkup = useMemo(() => calculateTotalMarkup(steps), [steps]);

  const updateField = (field: keyof AMGEFormData, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openNewCalculation = () => {
    setFormData(AMGE_DEFAULTS);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditCalculation = (calc: AMGECalculation) => {
    setFormData({
      name: calc.name,
      description: calc.description,
      is_active: calc.is_active,
      valid_from: calc.valid_from,
      valid_until: calc.valid_until,
      direktlohn: calc.direktlohn,
      lzk_sozialversicherung: calc.lzk_sozialversicherung,
      lzk_urlaubsgeld: calc.lzk_urlaubsgeld,
      lzk_lohnfortzahlung: calc.lzk_lohnfortzahlung,
      lzk_berufsgenossenschaft: calc.lzk_berufsgenossenschaft,
      lzk_winterbau: calc.lzk_winterbau,
      lzk_sonstige: calc.lzk_sonstige,
      bgk_bauleitung: calc.bgk_bauleitung,
      bgk_hilfsstoffe: calc.bgk_hilfsstoffe,
      bgk_geraete: calc.bgk_geraete,
      bgk_transport: calc.bgk_transport,
      bgk_sonstige: calc.bgk_sonstige,
      agk_prozent: calc.agk_prozent,
      custom_surcharges: calc.custom_surcharges || [],
      wagnis_prozent: calc.wagnis_prozent,
      gewinn_prozent: calc.gewinn_prozent,
    });
    setEditingId(calc.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-slate-500" />
            AMGE-Kalkulator
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Verrechnungslohn berechnen: Direktlohn → LZK → BGK → AGK → W+G
          </p>
        </div>
        <Button onClick={openNewCalculation} className="bg-slate-900 hover:bg-slate-800 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Neue Kalkulation
        </Button>
      </div>

      {/* Gespeicherte Kalkulationen */}
      {isLoading ? (
        <div className="text-sm text-slate-400 text-center py-8">Kalkulationen werden geladen...</div>
      ) : !calculations || calculations.length === 0 ? (
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Calculator className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">Noch keine AMGE-Kalkulationen vorhanden.</p>
            <Button onClick={openNewCalculation} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Erste Kalkulation erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {calculations.map((calc) => (
            <Card
              key={calc.id}
              className={`bg-white border shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                calc.is_active ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
              }`}
              onClick={() => openEditCalculation(calc)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 truncate">{calc.name}</h3>
                      {calc.is_active && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          Aktiv
                        </Badge>
                      )}
                    </div>
                    {calc.description && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{calc.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!calc.is_active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={e => { e.stopPropagation(); setActiveMutation.mutate(calc.id); }}
                        title="Als aktiv setzen"
                      >
                        <Star className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-rose-400 hover:text-rose-600"
                      onClick={e => { e.stopPropagation(); setDeleteConfirmId(calc.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Kurzübersicht */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Direktlohn</span>
                    <span className="font-mono text-slate-700">{formatCurrency(calc.direktlohn)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">LZK ({formatPercent(calc.lzk_gesamt_prozent)})</span>
                    <span className="font-mono text-slate-700">+ {formatCurrency(calc.lzk_betrag)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">BGK ({formatPercent(calc.bgk_gesamt_prozent)})</span>
                    <span className="font-mono text-slate-700">+ {formatCurrency(calc.bgk_betrag)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">AGK ({formatPercent(calc.agk_prozent)})</span>
                    <span className="font-mono text-slate-700">+ {formatCurrency(calc.agk_betrag)}</span>
                  </div>
                  {calc.custom_surcharges && calc.custom_surcharges.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 truncate">
                        Eigene ({formatPercent(calc.custom_surcharges.reduce((s: number, c: any) => s + c.prozent, 0))})
                      </span>
                      <span className="font-mono text-slate-700">+ {formatCurrency(calc.custom_surcharges_betrag)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">W+G ({formatPercent(calc.wagnis_prozent + calc.gewinn_prozent)})</span>
                    <span className="font-mono text-slate-700">+ {formatCurrency(calc.wagnis_betrag + calc.gewinn_betrag)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-800">Verrechnungslohn</span>
                    <span className="font-bold font-mono text-emerald-700 text-lg">
                      {formatCurrency(calc.verrechnungslohn)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  Gültig ab: {new Date(calc.valid_from).toLocaleDateString('de-DE')}
                  {calc.valid_until && ` bis ${new Date(calc.valid_until).toLocaleDateString('de-DE')}`}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Kalkulations-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {editingId ? 'Kalkulation bearbeiten' : 'Neue AMGE-Kalkulation'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Linke Seite: Eingaben */}
            <div className="space-y-4">
              {/* Name & Beschreibung */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Bezeichnung</Label>
                  <Input
                    value={formData.name}
                    onChange={e => updateField('name', e.target.value)}
                    placeholder="z.B. Standard 2026"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Beschreibung (optional)</Label>
                  <Input
                    value={formData.description || ''}
                    onChange={e => updateField('description', e.target.value)}
                    placeholder="z.B. Kalkulation für Wohnungsbau"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Direktlohn */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <Label className="text-sm font-medium text-slate-700">Mittellohn (Direktlohn) pro Stunde</Label>
                <div className="relative mt-2">
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    value={formData.direktlohn}
                    onChange={e => updateField('direktlohn', parseFloat(e.target.value) || 0)}
                    className="text-right pr-8 text-lg font-semibold bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                </div>
              </div>

              {/* LZK */}
              <CollapsibleSection
                title="Lohnzusatzkosten (LZK)"
                badge={formatPercent(steps.lzk_gesamt_prozent)}
              >
                <PercentInput label="Sozialversicherung (AG)" value={formData.lzk_sozialversicherung}
                  onChange={v => updateField('lzk_sozialversicherung', v)} />
                <PercentInput label="Urlaubsgeld" value={formData.lzk_urlaubsgeld}
                  onChange={v => updateField('lzk_urlaubsgeld', v)} />
                <PercentInput label="Lohnfortzahlung" value={formData.lzk_lohnfortzahlung}
                  onChange={v => updateField('lzk_lohnfortzahlung', v)} />
                <PercentInput label="Berufsgenossenschaft" value={formData.lzk_berufsgenossenschaft}
                  onChange={v => updateField('lzk_berufsgenossenschaft', v)} />
                <PercentInput label="Winterbauumlage" value={formData.lzk_winterbau}
                  onChange={v => updateField('lzk_winterbau', v)} />
                <PercentInput label="Sonstige LZK" value={formData.lzk_sonstige}
                  onChange={v => updateField('lzk_sonstige', v)} />
              </CollapsibleSection>

              {/* BGK */}
              <CollapsibleSection
                title="Baustellengemeinkosten (BGK)"
                badge={formatPercent(steps.bgk_gesamt_prozent)}
                defaultOpen={false}
              >
                <PercentInput label="Bauleitung" value={formData.bgk_bauleitung}
                  onChange={v => updateField('bgk_bauleitung', v)} />
                <PercentInput label="Hilfsstoffe" value={formData.bgk_hilfsstoffe}
                  onChange={v => updateField('bgk_hilfsstoffe', v)} />
                <PercentInput label="Gerätekosten" value={formData.bgk_geraete}
                  onChange={v => updateField('bgk_geraete', v)} />
                <PercentInput label="Transport" value={formData.bgk_transport}
                  onChange={v => updateField('bgk_transport', v)} />
                <PercentInput label="Sonstige BGK" value={formData.bgk_sonstige}
                  onChange={v => updateField('bgk_sonstige', v)} />
              </CollapsibleSection>

              {/* AGK */}
              <CollapsibleSection
                title="Allgemeine Geschäftskosten (AGK)"
                badge={formatPercent(formData.agk_prozent)}
                defaultOpen={false}
              >
                <PercentInput label="AGK-Zuschlag" value={formData.agk_prozent}
                  onChange={v => updateField('agk_prozent', v)} />
              </CollapsibleSection>

              {/* Eigene Zuschläge */}
              <CollapsibleSection
                title="Eigene Zuschläge"
                badge={formData.custom_surcharges.length > 0
                  ? formatPercent(formData.custom_surcharges.reduce((s, c) => s + c.prozent, 0))
                  : '0,0 %'}
                defaultOpen={formData.custom_surcharges.length > 0}
              >
                {formData.custom_surcharges.map((surcharge, index) => (
                  <div key={index} className="flex items-center gap-2 py-1.5">
                    <Input
                      value={surcharge.name}
                      onChange={e => {
                        const updated = [...formData.custom_surcharges];
                        updated[index] = { ...updated[index], name: e.target.value };
                        setFormData(prev => ({ ...prev, custom_surcharges: updated }));
                      }}
                      placeholder="Bezeichnung"
                      className="flex-1 h-8 text-sm"
                    />
                    <div className="relative w-20">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={surcharge.prozent}
                        onChange={e => {
                          const updated = [...formData.custom_surcharges];
                          updated[index] = { ...updated[index], prozent: parseFloat(e.target.value) || 0 };
                          setFormData(prev => ({ ...prev, custom_surcharges: updated }));
                        }}
                        className="text-right pr-7 h-8 text-sm"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-rose-400 hover:text-rose-600 shrink-0"
                      onClick={() => {
                        const updated = formData.custom_surcharges.filter((_, i) => i !== index);
                        setFormData(prev => ({ ...prev, custom_surcharges: updated }));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 h-8 text-xs"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      custom_surcharges: [...prev.custom_surcharges, { name: '', prozent: 0 }],
                    }));
                  }}
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Zuschlag hinzufügen
                </Button>
              </CollapsibleSection>

              {/* W+G */}
              <CollapsibleSection
                title="Wagnis und Gewinn (W+G)"
                badge={formatPercent(formData.wagnis_prozent + formData.gewinn_prozent)}
                defaultOpen={false}
              >
                <PercentInput label="Wagnis" value={formData.wagnis_prozent}
                  onChange={v => updateField('wagnis_prozent', v)} />
                <PercentInput label="Gewinn" value={formData.gewinn_prozent}
                  onChange={v => updateField('gewinn_prozent', v)} />
              </CollapsibleSection>
            </div>

            {/* Rechte Seite: Live-Ergebnis */}
            <div className="space-y-4">
              <Card className="bg-gradient-to-b from-slate-50 to-white border-slate-200 shadow-sm sticky top-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Berechnungsergebnis
                  </CardTitle>
                  <CardDescription>Live-Berechnung des Verrechnungslohns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  <StepResult label="Direktlohn" betrag={steps.direktlohn} />
                  <StepResult label="+ Lohnzusatzkosten" betrag={steps.lzk_betrag} prozent={steps.lzk_gesamt_prozent} />
                  <div className="text-right text-xs text-slate-400 font-mono pr-1 pb-1">
                    = {formatCurrency(steps.lohn_mit_lzk)}
                  </div>
                  <StepResult label="+ Baustellengemeinkosten" betrag={steps.bgk_betrag} prozent={steps.bgk_gesamt_prozent} />
                  <div className="text-right text-xs text-slate-400 font-mono pr-1 pb-1">
                    = {formatCurrency(steps.lohn_mit_bgk)}
                  </div>
                  <StepResult label="+ Allg. Geschäftskosten" betrag={steps.agk_betrag} prozent={steps.agk_prozent} />
                  <div className="text-right text-xs text-slate-400 font-mono pr-1 pb-1">
                    = {formatCurrency(steps.lohn_mit_agk)}
                  </div>
                  {steps.custom_surcharges.length > 0 && (
                    <>
                      {steps.custom_surcharges.map((s, i) => (
                        <StepResult key={i} label={`+ ${s.name || 'Eigener Zuschlag'}`} betrag={s.betrag} prozent={s.prozent} />
                      ))}
                      <div className="text-right text-xs text-slate-400 font-mono pr-1 pb-1">
                        = {formatCurrency(steps.lohn_mit_custom)}
                      </div>
                    </>
                  )}
                  <StepResult label="+ Wagnis" betrag={steps.wagnis_betrag} prozent={steps.wagnis_prozent} />
                  <StepResult label="+ Gewinn" betrag={steps.gewinn_betrag} prozent={steps.gewinn_prozent} />
                  <StepResult label="Verrechnungslohn / Std." betrag={steps.verrechnungslohn} isTotal />
                </CardContent>
              </Card>

              {/* Gesamtzuschlag */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Gesamtzuschlag auf Direktlohn</span>
                    <span className="font-bold font-mono text-slate-800">{formatPercent(totalMarkup)}</span>
                  </div>
                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 rounded-full transition-all"
                      style={{ width: `${Math.min(totalMarkup / 2, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>0%</span>
                    <span>200%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Tageswerte */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Hochrechnung</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tagelohn (8 Std.)</span>
                    <span className="font-mono text-slate-800">{formatCurrency(steps.verrechnungslohn * 8)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Wochenlohn (40 Std.)</span>
                    <span className="font-mono text-slate-800">{formatCurrency(steps.verrechnungslohn * 40)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Monatslohn (170 Std.)</span>
                    <span className="font-mono text-slate-800">{formatCurrency(steps.verrechnungslohn * 170)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.name || formData.direktlohn <= 0}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {isSaving ? (
                'Speichert...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? 'Aktualisieren' : 'Speichern'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kalkulation löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Diese AMGE-Kalkulation wird unwiderruflich gelöscht. Möchtest du fortfahren?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AMGEKalkulator;
