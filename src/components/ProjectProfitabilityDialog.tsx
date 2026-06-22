import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Calculator, CheckCircle, Clock, Euro, Package, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProjectKPIService, type ProjectPostCalculation, type PostCalculationStatus } from "@/services/projectKPIService";

interface ProjectProfitabilityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

const statusConfig: Record<PostCalculationStatus, { label: string; className: string; icon: React.ReactNode }> = {
  profit: {
    label: 'Gewinn',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  risk: {
    label: 'Risiko',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  loss: {
    label: 'Verlust',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <TrendingDown className="h-4 w-4" />,
  },
  incomplete: {
    label: 'Unvollständig',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);

const formatNumber = (amount: number, suffix = '') =>
  `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(amount || 0)}${suffix}`;

const getVarianceClass = (value: number, positiveIsGood = false) => {
  if (value === 0) return 'text-slate-600';
  if (positiveIsGood) return value > 0 ? 'text-green-600' : 'text-red-600';
  return value > 0 ? 'text-red-600' : 'text-green-600';
};

function MetricCard({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'default' | 'good' | 'bad' | 'warn';
}) {
  const toneClasses = {
    default: 'bg-slate-50 text-slate-900',
    good: 'bg-green-50 text-green-900',
    bad: 'bg-red-50 text-red-900',
    warn: 'bg-amber-50 text-amber-900',
  };

  return (
    <Card className={toneClasses[tone]}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
          </div>
          <div className="rounded-md bg-white/70 p-2 text-slate-700">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonRow({
  label,
  planned,
  actual,
  variance,
  format,
  positiveIsGood,
}: {
  label: string;
  planned: number;
  actual: number;
  variance: number;
  format: (value: number) => string;
  positiveIsGood?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-4 border-b py-3 text-sm last:border-0">
      <span className="font-medium text-slate-800">{label}</span>
      <span>{format(planned)}</span>
      <span>{format(actual)}</span>
      <span className={`font-semibold ${getVarianceClass(variance, positiveIsGood)}`}>
        {variance > 0 ? '+' : ''}{format(variance)}
      </span>
    </div>
  );
}

const ProjectProfitabilityDialog: React.FC<ProjectProfitabilityDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const { toast } = useToast();
  const [calculation, setCalculation] = useState<ProjectPostCalculation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    let cancelled = false;
    const loadProfitabilityData = async () => {
      setLoading(true);
      try {
        const data = await ProjectKPIService.getProjectPostCalculation(projectId);
        if (!cancelled) setCalculation(data);
      } catch (error) {
        console.error('Fehler beim Laden der Rentabilitätsdaten:', error);
        if (!cancelled) {
          setCalculation(null);
          toast({
            title: "Fehler",
            description: "Rentabilitätsdaten konnten nicht geladen werden",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfitabilityData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId]);

  const status = calculation ? statusConfig[calculation.result.status] : statusConfig.incomplete;
  const titleName = calculation?.project_name || projectName;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Nachkalkulation & Rentabilität: {titleName}
          </DialogTitle>
          <DialogDescription>
            Planwerte, Ist-Kosten und Ergebnis aus verknüpften Angeboten, Zeiten, Material, Ausgaben und Rechnungen.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Rentabilitätsdaten werden geladen...
            </CardContent>
          </Card>
        )}

        {!loading && !calculation && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Für dieses Projekt konnten keine Rentabilitätsdaten geladen werden.
            </CardContent>
          </Card>
        )}

        {!loading && calculation && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-md border bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`gap-1 ${status.className}`}>
                    {status.icon}
                    {status.label}
                  </Badge>
                  <span className="text-sm text-slate-500">
                    berechnet am {new Date(calculation.calculated_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {calculation.counts.offers} Angebot(e), {calculation.counts.completedTimeEntries} abgeschlossene Zeiteintrag(e), {calculation.counts.materials} Materialposition(en)
                </p>
              </div>
              <div className="w-full md:w-64">
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>Budgetverbrauch</span>
                  <span>{formatNumber(calculation.result.budgetUtilizationPercent, '%')}</span>
                </div>
                <Progress value={Math.min(calculation.result.budgetUtilizationPercent, 100)} className="h-2" />
              </div>
            </div>

            {(calculation.missingData.length > 0 || calculation.openTimeEntries > 0) && (
              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {calculation.openTimeEntries > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{calculation.openTimeEntries} offene Zeiterfassung wird nicht in Ist-Kosten eingerechnet.</span>
                  </div>
                )}
                {calculation.missingData.map((message) => (
                  <div key={message} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <MetricCard
                label="Ergebnis"
                value={formatCurrency(calculation.result.profit)}
                icon={<Euro className="h-5 w-5" />}
                tone={calculation.result.profit >= 0 ? 'good' : 'bad'}
              />
              <MetricCard
                label="Marge"
                value={formatNumber(calculation.result.marginPercent, '%')}
                icon={<TrendingUp className="h-5 w-5" />}
                tone={calculation.result.marginPercent >= 10 ? 'good' : 'warn'}
              />
              <MetricCard
                label="Ist-Kosten"
                value={formatCurrency(calculation.actual.totalCosts)}
                icon={<Package className="h-5 w-5" />}
              />
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Übersicht</TabsTrigger>
                <TabsTrigger value="plan-actual">Plan/Ist</TabsTrigger>
                <TabsTrigger value="variance">Abweichungen</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Geplant</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between"><span>Umsatz netto</span><strong>{formatCurrency(calculation.planned.revenueNet)}</strong></div>
                      <div className="flex justify-between"><span>Gesamtkosten</span><strong>{formatCurrency(calculation.planned.totalCosts)}</strong></div>
                      <div className="flex justify-between"><span>Geplanter Gewinn</span><strong>{formatCurrency(calculation.planned.profit)}</strong></div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Tatsächlich</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between"><span>Erzielter Umsatz netto</span><strong>{formatCurrency(calculation.actual.revenueNet)}</strong></div>
                      <div className="flex justify-between"><span>Ist-Kosten</span><strong>{formatCurrency(calculation.actual.totalCosts)}</strong></div>
                      <div className="flex justify-between"><span>Gewinn/Verlust</span><strong>{formatCurrency(calculation.actual.profit)}</strong></div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="plan-actual">
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-4 gap-4 border-b pb-2 text-sm font-semibold text-slate-600">
                      <span>Kennzahl</span>
                      <span>Plan</span>
                      <span>Ist</span>
                      <span>Abweichung</span>
                    </div>
                    <ComparisonRow label="Stunden" planned={calculation.planned.hours} actual={calculation.actual.hours} variance={calculation.variance.hours} format={(value) => formatNumber(value, 'h')} />
                    <ComparisonRow label="Lohnkosten" planned={calculation.planned.laborCosts} actual={calculation.actual.laborCosts} variance={calculation.variance.laborCosts} format={formatCurrency} />
                    <ComparisonRow label="Material" planned={calculation.planned.materialCosts} actual={calculation.actual.materialCosts} variance={calculation.variance.materialCosts} format={formatCurrency} />
                    <ComparisonRow label="Gesamtkosten" planned={calculation.planned.totalCosts} actual={calculation.actual.totalCosts} variance={calculation.variance.totalCosts} format={formatCurrency} />
                    <ComparisonRow label="Ergebnis" planned={calculation.planned.profit} actual={calculation.actual.profit} variance={calculation.variance.profit} format={formatCurrency} positiveIsGood />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variance">
                <Card>
                  <CardHeader>
                    <CardTitle>Abweichungen</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <MetricCard label="Stundenabweichung" value={`${calculation.variance.hours > 0 ? '+' : ''}${formatNumber(calculation.variance.hours, 'h')}`} icon={<Clock className="h-5 w-5" />} tone={calculation.variance.hours > 0 ? 'warn' : 'good'} />
                    <MetricCard label="Materialabweichung" value={`${calculation.variance.materialCosts > 0 ? '+' : ''}${formatCurrency(calculation.variance.materialCosts)}`} icon={<Package className="h-5 w-5" />} tone={calculation.variance.materialCosts > 0 ? 'warn' : 'good'} />
                    <MetricCard label="Kostenabweichung" value={`${calculation.variance.totalCosts > 0 ? '+' : ''}${formatCurrency(calculation.variance.totalCosts)}`} icon={<Euro className="h-5 w-5" />} tone={calculation.variance.totalCosts > 0 ? 'warn' : 'good'} />
                    <MetricCard label="Gewinnabweichung" value={`${calculation.variance.profit > 0 ? '+' : ''}${formatCurrency(calculation.variance.profit)}`} icon={<TrendingUp className="h-5 w-5" />} tone={calculation.variance.profit >= 0 ? 'good' : 'bad'} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details">
                <Card>
                  <CardContent className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-5">
                    <div><p className="text-slate-500">Angebote</p><p className="font-semibold">{calculation.counts.offers}</p></div>
                    <div><p className="text-slate-500">Rechnungen</p><p className="font-semibold">{calculation.counts.invoices}</p></div>
                    <div><p className="text-slate-500">Zeiten</p><p className="font-semibold">{calculation.counts.completedTimeEntries}</p></div>
                    <div><p className="text-slate-500">Material</p><p className="font-semibold">{calculation.counts.materials}</p></div>
                    <div><p className="text-slate-500">Nebenkosten</p><p className="font-semibold">{calculation.counts.expenses}</p></div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectProfitabilityDialog;
