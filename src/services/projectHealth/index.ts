/**
 * Project Health Service
 *
 * Berechnet den Gesundheitsstatus eines Projekts basierend auf:
 * - Soll-Werten (planned_hours, target_revenue, end_date, project_manager_id)
 * - Ist-Werten (time_entries, material_entries)
 *
 * WICHTIG: Das Master-Signal wird NIEMALS persistiert, sondern immer
 * live berechnet, um Drift zwischen Daten und Anzeige zu vermeiden.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  ProjectHealth,
  TrafficLight,
  HealthReason,
  EconomySummary,
  ProjectWithTargets,
  ProjectAggregates,
} from "@/types/projectHealth";
import {
  checkMissingTargets,
  checkNoTimeEntries,
  checkNoProjectManager,
  checkTimeOverPlanned,
  checkCostOverTarget,
  checkDeadlineRisk,
  checkMissingInvoice,
  determineNextAction,
} from "./rules";

/**
 * Lädt die Projektdaten mit Soll-Werten
 */
async function loadProjectWithTargets(
  projectId: string
): Promise<ProjectWithTargets | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, status, planned_hours, target_revenue, end_date, project_manager_id, budget"
    )
    .eq("id", projectId)
    .single();

  if (error || !data) {
    console.error("Error loading project:", error);
    return null;
  }

  return data as ProjectWithTargets;
}

/**
 * Berechnet die aggregierten Ist-Werte aus time_entries und material_entries
 */
async function loadProjectAggregates(
  projectId: string
): Promise<ProjectAggregates> {
  // Zeiteinträge summieren
  const { data: timeEntries, error: timeError } = await supabase
    .from("time_entries")
    .select("start_time, end_time, break_duration")
    .eq("project_id", projectId);

  if (timeError) {
    console.error("Error loading time entries:", timeError);
  }

  let actualHours = 0;
  if (timeEntries) {
    for (const entry of timeEntries) {
      if (entry.start_time && entry.end_time) {
        const start = new Date(entry.start_time);
        const end = new Date(entry.end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const breakHours = (entry.break_duration || 0) / 60; // break_duration ist in Minuten
        actualHours += Math.max(0, hours - breakHours);
      }
    }
  }

  // Materialkosten summieren
  const { data: materialEntries, error: materialError } = await supabase
    .from("material_entries")
    .select("total_cost")
    .eq("project_id", projectId);

  if (materialError) {
    console.error("Error loading material entries:", materialError);
  }

  let actualCosts = 0;
  if (materialEntries) {
    for (const entry of materialEntries) {
      actualCosts += entry.total_cost || 0;
    }
  }

  // Prüfen ob Rechnungen verknüpft sind
  // Hinweis: Dies setzt voraus, dass es eine Verknüpfung zwischen Projekten und Rechnungen gibt
  // Falls nicht vorhanden, wird hasInvoice immer false sein
  const { data: invoices, error: invoiceError } = await supabase
    .from("invoices")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);

  const hasInvoice = !invoiceError && invoices && invoices.length > 0;

  return {
    actualHours: Math.round(actualHours * 10) / 10, // Auf 1 Dezimalstelle runden
    actualCosts: Math.round(actualCosts * 100) / 100, // Auf 2 Dezimalstellen runden
    hasInvoice,
  };
}

/**
 * Ermittelt den schlechtesten Status aus allen Reasons
 */
function determineStatus(reasons: HealthReason[]): TrafficLight {
  if (reasons.some((r) => r.severity === "red")) {
    return "red";
  }
  if (reasons.some((r) => r.severity === "yellow")) {
    return "yellow";
  }
  return "green";
}

/**
 * Berechnet die Economy-Zusammenfassung
 */
function calculateEconomy(
  project: ProjectWithTargets,
  aggregates: ProjectAggregates
): EconomySummary {
  const targetRevenue = project.target_revenue;
  const actualCosts = aggregates.actualCosts;

  let grossProfit: number | null = null;
  let grossMarginPct: number | null = null;

  if (targetRevenue !== null && targetRevenue > 0) {
    grossProfit = targetRevenue - actualCosts;
    grossMarginPct = Math.round((grossProfit / targetRevenue) * 100);
  }

  return {
    targetRevenue,
    actualCosts,
    grossProfit,
    grossMarginPct,
  };
}

/**
 * Hauptfunktion: Berechnet den vollständigen ProjectHealth für ein Projekt
 */
export async function calculateProjectHealth(
  projectId: string
): Promise<ProjectHealth | null> {
  // 1. Projekt laden (Soll-Werte + Status)
  const project = await loadProjectWithTargets(projectId);
  if (!project) {
    return null;
  }

  // 2. Aggregationen laden: actualHours, actualCosts
  const aggregates = await loadProjectAggregates(projectId);

  // 3. Alle Regeln anwenden und Reasons sammeln
  const reasons: HealthReason[] = [];

  // Regel A: Soll-Werte fehlen
  const missingTargets = checkMissingTargets(project);
  if (missingTargets) reasons.push(missingTargets);

  // Regel B: Keine Zeiteinträge (nur wenn nicht gerade erst erstellt)
  const noTimeEntries = checkNoTimeEntries(aggregates);
  if (noTimeEntries) reasons.push(noTimeEntries);

  // Regel C: Kein Projektleiter
  const noManager = checkNoProjectManager(project);
  if (noManager) reasons.push(noManager);

  // Regel D: Stundenüberschreitung
  const timeOver = checkTimeOverPlanned(project, aggregates);
  if (timeOver) reasons.push(timeOver);

  // Regel E: Kostenüberschreitung
  const costOver = checkCostOverTarget(project, aggregates);
  if (costOver) reasons.push(costOver);

  // Regel F: Deadline-Risiko
  const deadlineRisk = checkDeadlineRisk(project);
  if (deadlineRisk) reasons.push(deadlineRisk);

  // Regel G: Fehlende Rechnung bei abgeschlossenem Projekt
  const missingInvoice = checkMissingInvoice(project, aggregates);
  if (missingInvoice) reasons.push(missingInvoice);

  // 4. Status aus Reasons ermitteln (worst case)
  const status = determineStatus(reasons);

  // 5. NextAction bestimmen
  const nextAction = determineNextAction(
    projectId,
    project,
    aggregates,
    reasons
  );

  // 6. Economy berechnen
  const economy = calculateEconomy(project, aggregates);

  // 7. ProjectHealth zurückgeben
  return {
    status,
    reasons,
    nextAction,
    economy,
    computedAtISO: new Date().toISOString(),
  };
}

/**
 * Hook-kompatible Version für React Query
 */
export async function getProjectHealth(
  projectId: string
): Promise<ProjectHealth> {
  const health = await calculateProjectHealth(projectId);

  if (!health) {
    // Fallback für den Fall, dass das Projekt nicht gefunden wurde
    return {
      status: "yellow",
      reasons: [
        {
          code: "MISSING_TARGETS",
          severity: "yellow",
          title: "Projekt nicht gefunden",
          detail: "Die Projektdaten konnten nicht geladen werden.",
        },
      ],
      nextAction: null,
      economy: {
        targetRevenue: null,
        actualCosts: 0,
        grossProfit: null,
        grossMarginPct: null,
      },
      computedAtISO: new Date().toISOString(),
    };
  }

  return health;
}

// Re-export types for convenience
export type { ProjectHealth, TrafficLight, HealthReason, EconomySummary };
