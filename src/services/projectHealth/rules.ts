/**
 * Project Health Engine - Schwellenwerte und Regeln
 *
 * Diese Datei enthält alle Konfigurationswerte für die Projekt-Gesundheitsberechnung.
 */

import type {
  HealthReason,
  HealthReasonCode,
  NextAction,
  NextActionKey,
  ProjectWithTargets,
  ProjectAggregates,
} from "@/types/projectHealth";

// Schwellenwerte für die Regeln
export const THRESHOLDS = {
  // Zeit-Überschreitung
  timeYellowPctOver: 0.10, // +10% → yellow
  timeRedPctOver: 0.25, // +25% → red

  // Kosten-Überschreitung
  costYellowPctOver: 0.05, // +5% → yellow
  costRedPctOver: 0.15, // +15% → red

  // Deadline-Warnung (Tage verbleibend)
  deadlineYellowDays: 7, // <= 7 Tage → yellow
  deadlineRedDays: 3, // <= 3 Tage → red
};

// Texte für HealthReasons (Deutsch)
export const REASON_TEXTS: Record<
  HealthReasonCode,
  { title: string; detailTemplate: string }
> = {
  MISSING_TARGETS: {
    title: "Soll-Werte fehlen",
    detailTemplate:
      "Bitte geplante Stunden, Ziel-Umsatz und Enddatum vervollständigen.",
  },
  NO_TIME_ENTRIES: {
    title: "Keine Zeiteinträge",
    detailTemplate: "Es wurden noch keine Arbeitsstunden erfasst.",
  },
  NO_PROJECT_MANAGER: {
    title: "Kein Projektleiter",
    detailTemplate: "Bitte einen Projektleiter zuweisen.",
  },
  TIME_OVER_PLANNED: {
    title: "Stundenüberschreitung",
    detailTemplate: "{actual}h von {planned}h geplant ({percent}% über Plan)",
  },
  COST_OVER_TARGET: {
    title: "Kostenüberschreitung",
    detailTemplate:
      "{actual}€ Kosten bei {target}€ Ziel-Umsatz ({percent}% über Plan)",
  },
  DEADLINE_RISK: {
    title: "Deadline-Risiko",
    detailTemplate: "Nur noch {days} Tage bis zum geplanten Ende.",
  },
  MISSING_INVOICE: {
    title: "Rechnung fehlt",
    detailTemplate:
      "Projekt ist abgeschlossen, aber keine Rechnung verknüpft.",
  },
};

// NextAction Definitionen mit Priorität
export const NEXT_ACTIONS: Record<
  NextActionKey,
  Omit<NextAction, "key"> & { priority: number }
> = {
  SET_TARGETS: {
    priority: 1,
    title: "Soll-Werte festlegen",
    description: "Geplante Stunden, Ziel-Umsatz und Enddatum definieren",
    ctaLabel: "Projekt bearbeiten",
    ctaRoute: "/projects/{id}/edit",
  },
  BOOK_FIRST_TIME: {
    priority: 2,
    title: "Erste Zeit buchen",
    description: "Arbeitszeit für dieses Projekt erfassen",
    ctaLabel: "Zeit erfassen",
    ctaRoute: "/projects/{id}?tab=time",
  },
  ASSIGN_MANAGER: {
    priority: 3,
    title: "Projektleiter zuweisen",
    description: "Einen verantwortlichen Projektleiter festlegen",
    ctaLabel: "Team bearbeiten",
    ctaRoute: "/projects/{id}/edit",
  },
  REVIEW_DEADLINE: {
    priority: 4,
    title: "Deadline prüfen",
    description: "Das Enddatum liegt in Kürze - Fortschritt prüfen",
    ctaLabel: "Projekt ansehen",
    ctaRoute: "/projects/{id}",
  },
  CREATE_INVOICE: {
    priority: 5,
    title: "Rechnung erstellen",
    description: "Projekt ist abgeschlossen - Rechnung erstellen",
    ctaLabel: "Rechnung erstellen",
    ctaRoute: "/invoices/new?project={id}",
  },
  ADD_MATERIAL: {
    priority: 6,
    title: "Material erfassen",
    description: "Verwendete Materialien zum Projekt hinzufügen",
    ctaLabel: "Material hinzufügen",
    ctaRoute: "/projects/{id}?tab=materials",
  },
};

/**
 * Berechnet die Tage bis zum Enddatum
 */
export function daysUntilDeadline(endDate: string | null): number | null {
  if (!endDate) return null;

  const end = new Date(endDate);
  const now = new Date();

  // Auf Mitternacht normalisieren
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Regel A: Prüft ob Soll-Werte fehlen
 */
export function checkMissingTargets(
  project: ProjectWithTargets
): HealthReason | null {
  const missingFields: string[] = [];

  if (!project.planned_hours) missingFields.push("geplante Stunden");
  if (!project.target_revenue) missingFields.push("Ziel-Umsatz");
  if (!project.end_date) missingFields.push("Enddatum");

  if (missingFields.length > 0) {
    return {
      code: "MISSING_TARGETS",
      severity: "yellow",
      title: REASON_TEXTS.MISSING_TARGETS.title,
      detail: `Fehlend: ${missingFields.join(", ")}`,
    };
  }
  return null;
}

/**
 * Regel B: Prüft ob Zeiteinträge vorhanden sind
 */
export function checkNoTimeEntries(
  aggregates: ProjectAggregates
): HealthReason | null {
  if (aggregates.actualHours === 0) {
    return {
      code: "NO_TIME_ENTRIES",
      severity: "yellow",
      title: REASON_TEXTS.NO_TIME_ENTRIES.title,
      detail: REASON_TEXTS.NO_TIME_ENTRIES.detailTemplate,
    };
  }
  return null;
}

/**
 * Regel C: Prüft ob Projektleiter zugewiesen ist
 */
export function checkNoProjectManager(
  project: ProjectWithTargets
): HealthReason | null {
  if (!project.project_manager_id) {
    return {
      code: "NO_PROJECT_MANAGER",
      severity: "yellow",
      title: REASON_TEXTS.NO_PROJECT_MANAGER.title,
      detail: REASON_TEXTS.NO_PROJECT_MANAGER.detailTemplate,
    };
  }
  return null;
}

/**
 * Regel D: Prüft Stundenüberschreitung
 */
export function checkTimeOverPlanned(
  project: ProjectWithTargets,
  aggregates: ProjectAggregates
): HealthReason | null {
  if (!project.planned_hours || project.planned_hours <= 0) return null;

  const overPct =
    (aggregates.actualHours - project.planned_hours) / project.planned_hours;

  if (overPct > THRESHOLDS.timeRedPctOver) {
    const percentOver = Math.round(overPct * 100);
    return {
      code: "TIME_OVER_PLANNED",
      severity: "red",
      title: REASON_TEXTS.TIME_OVER_PLANNED.title,
      detail: `${aggregates.actualHours.toFixed(1)}h von ${project.planned_hours}h geplant (${percentOver}% über Plan)`,
    };
  }

  if (overPct > THRESHOLDS.timeYellowPctOver) {
    const percentOver = Math.round(overPct * 100);
    return {
      code: "TIME_OVER_PLANNED",
      severity: "yellow",
      title: REASON_TEXTS.TIME_OVER_PLANNED.title,
      detail: `${aggregates.actualHours.toFixed(1)}h von ${project.planned_hours}h geplant (${percentOver}% über Plan)`,
    };
  }

  return null;
}

/**
 * Regel E: Prüft Kostenüberschreitung
 */
export function checkCostOverTarget(
  project: ProjectWithTargets,
  aggregates: ProjectAggregates
): HealthReason | null {
  if (!project.target_revenue || project.target_revenue <= 0) return null;

  const overPct =
    (aggregates.actualCosts - project.target_revenue) / project.target_revenue;

  if (overPct > THRESHOLDS.costRedPctOver) {
    const percentOver = Math.round(overPct * 100);
    return {
      code: "COST_OVER_TARGET",
      severity: "red",
      title: REASON_TEXTS.COST_OVER_TARGET.title,
      detail: `${aggregates.actualCosts.toFixed(0)}€ Kosten bei ${project.target_revenue}€ Ziel-Umsatz (${percentOver}% über Plan)`,
    };
  }

  if (overPct > THRESHOLDS.costYellowPctOver) {
    const percentOver = Math.round(overPct * 100);
    return {
      code: "COST_OVER_TARGET",
      severity: "yellow",
      title: REASON_TEXTS.COST_OVER_TARGET.title,
      detail: `${aggregates.actualCosts.toFixed(0)}€ Kosten bei ${project.target_revenue}€ Ziel-Umsatz (${percentOver}% über Plan)`,
    };
  }

  return null;
}

/**
 * Regel F: Prüft Deadline-Risiko
 */
export function checkDeadlineRisk(
  project: ProjectWithTargets
): HealthReason | null {
  const daysLeft = daysUntilDeadline(project.end_date);

  if (daysLeft === null) return null;

  // Nicht warnen wenn Deadline bereits überschritten ist (wird durch andere Regeln abgedeckt)
  if (daysLeft < 0) return null;

  if (daysLeft <= THRESHOLDS.deadlineRedDays) {
    return {
      code: "DEADLINE_RISK",
      severity: "red",
      title: REASON_TEXTS.DEADLINE_RISK.title,
      detail: `Nur noch ${daysLeft} Tag${daysLeft !== 1 ? "e" : ""} bis zum geplanten Ende.`,
    };
  }

  if (daysLeft <= THRESHOLDS.deadlineYellowDays) {
    return {
      code: "DEADLINE_RISK",
      severity: "yellow",
      title: REASON_TEXTS.DEADLINE_RISK.title,
      detail: `Nur noch ${daysLeft} Tage bis zum geplanten Ende.`,
    };
  }

  return null;
}

/**
 * Regel G: Prüft fehlende Rechnung bei abgeschlossenem Projekt
 */
export function checkMissingInvoice(
  project: ProjectWithTargets,
  aggregates: ProjectAggregates
): HealthReason | null {
  if (project.status === "abgeschlossen" && !aggregates.hasInvoice) {
    return {
      code: "MISSING_INVOICE",
      severity: "yellow",
      title: REASON_TEXTS.MISSING_INVOICE.title,
      detail: REASON_TEXTS.MISSING_INVOICE.detailTemplate,
    };
  }
  return null;
}

/**
 * Ermittelt die passende NextAction basierend auf den Reasons
 */
export function determineNextAction(
  projectId: string,
  project: ProjectWithTargets,
  aggregates: ProjectAggregates,
  reasons: HealthReason[]
): NextAction | null {
  // Mapping von ReasonCode zu NextActionKey
  const reasonToAction: Partial<Record<HealthReasonCode, NextActionKey>> = {
    MISSING_TARGETS: "SET_TARGETS",
    NO_TIME_ENTRIES: "BOOK_FIRST_TIME",
    NO_PROJECT_MANAGER: "ASSIGN_MANAGER",
    DEADLINE_RISK: "REVIEW_DEADLINE",
    MISSING_INVOICE: "CREATE_INVOICE",
  };

  // Finde alle möglichen Actions basierend auf Reasons
  const possibleActions: NextActionKey[] = [];

  for (const reason of reasons) {
    const actionKey = reasonToAction[reason.code];
    if (actionKey && !possibleActions.includes(actionKey)) {
      possibleActions.push(actionKey);
    }
  }

  // Wenn keine Reasons, aber auch keine Zeit gebucht → BOOK_FIRST_TIME
  if (possibleActions.length === 0 && aggregates.actualHours === 0) {
    possibleActions.push("BOOK_FIRST_TIME");
  }

  // Wenn immer noch keine Action, aber keine Materialien → ADD_MATERIAL
  if (possibleActions.length === 0 && aggregates.actualCosts === 0) {
    possibleActions.push("ADD_MATERIAL");
  }

  if (possibleActions.length === 0) {
    return null;
  }

  // Sortiere nach Priorität und nimm die höchste
  possibleActions.sort((a, b) => {
    return NEXT_ACTIONS[a].priority - NEXT_ACTIONS[b].priority;
  });

  const selectedKey = possibleActions[0];
  const actionDef = NEXT_ACTIONS[selectedKey];

  return {
    key: selectedKey,
    title: actionDef.title,
    description: actionDef.description,
    ctaLabel: actionDef.ctaLabel,
    ctaRoute: actionDef.ctaRoute.replace("{id}", projectId),
  };
}
