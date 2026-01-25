/**
 * Unit Tests für Project Health Engine
 *
 * Tests für die Regeln und Berechnungen des Project Cockpit.
 */

import { describe, it, expect } from "vitest";
import {
  THRESHOLDS,
  checkMissingTargets,
  checkNoTimeEntries,
  checkNoProjectManager,
  checkTimeOverPlanned,
  checkCostOverTarget,
  checkDeadlineRisk,
  checkMissingInvoice,
  determineNextAction,
  daysUntilDeadline,
} from "./rules";
import type {
  ProjectWithTargets,
  ProjectAggregates,
  HealthReason,
} from "@/types/projectHealth";

// Helper to create a project with defaults
function createProject(
  overrides: Partial<ProjectWithTargets> = {}
): ProjectWithTargets {
  return {
    id: "test-project-id",
    status: "geplant",
    planned_hours: 40,
    target_revenue: 10000,
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0], // 30 days from now
    project_manager_id: "manager-id",
    budget: 8000,
    ...overrides,
  };
}

// Helper to create aggregates with defaults
function createAggregates(
  overrides: Partial<ProjectAggregates> = {}
): ProjectAggregates {
  return {
    actualHours: 20,
    actualCosts: 3000,
    hasInvoice: false,
    ...overrides,
  };
}

describe("Project Health Rules", () => {
  describe("checkMissingTargets", () => {
    it("returns null when all targets are set", () => {
      const project = createProject();
      const result = checkMissingTargets(project);
      expect(result).toBeNull();
    });

    it("returns yellow reason when planned_hours is missing", () => {
      const project = createProject({ planned_hours: null });
      const result = checkMissingTargets(project);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("MISSING_TARGETS");
      expect(result?.severity).toBe("yellow");
      expect(result?.detail).toContain("geplante Stunden");
    });

    it("returns yellow reason when target_revenue is missing", () => {
      const project = createProject({ target_revenue: null });
      const result = checkMissingTargets(project);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("MISSING_TARGETS");
    });

    it("returns yellow reason when end_date is missing", () => {
      const project = createProject({ end_date: null });
      const result = checkMissingTargets(project);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("MISSING_TARGETS");
      expect(result?.detail).toContain("Enddatum");
    });
  });

  describe("checkNoTimeEntries", () => {
    it("returns null when there are time entries", () => {
      const aggregates = createAggregates({ actualHours: 10 });
      const result = checkNoTimeEntries(aggregates);
      expect(result).toBeNull();
    });

    it("returns yellow reason when actualHours is 0", () => {
      const aggregates = createAggregates({ actualHours: 0 });
      const result = checkNoTimeEntries(aggregates);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("NO_TIME_ENTRIES");
      expect(result?.severity).toBe("yellow");
    });
  });

  describe("checkNoProjectManager", () => {
    it("returns null when project manager is assigned", () => {
      const project = createProject({ project_manager_id: "manager-123" });
      const result = checkNoProjectManager(project);
      expect(result).toBeNull();
    });

    it("returns yellow reason when project manager is missing", () => {
      const project = createProject({ project_manager_id: null });
      const result = checkNoProjectManager(project);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("NO_PROJECT_MANAGER");
      expect(result?.severity).toBe("yellow");
    });
  });

  describe("checkTimeOverPlanned", () => {
    it("returns null when within budget", () => {
      const project = createProject({ planned_hours: 40 });
      const aggregates = createAggregates({ actualHours: 35 });
      const result = checkTimeOverPlanned(project, aggregates);
      expect(result).toBeNull();
    });

    it("returns null when planned_hours is not set", () => {
      const project = createProject({ planned_hours: null });
      const aggregates = createAggregates({ actualHours: 100 });
      const result = checkTimeOverPlanned(project, aggregates);
      expect(result).toBeNull();
    });

    it("returns yellow when over 10% (but under 25%)", () => {
      const project = createProject({ planned_hours: 20 });
      // 24h is 20% over 20h (between 10% and 25%)
      const aggregates = createAggregates({ actualHours: 24 });
      const result = checkTimeOverPlanned(project, aggregates);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("TIME_OVER_PLANNED");
      expect(result?.severity).toBe("yellow");
    });

    it("returns red when over 25%", () => {
      const project = createProject({ planned_hours: 20 });
      // 30h is 50% over 20h (over 25%)
      const aggregates = createAggregates({ actualHours: 30 });
      const result = checkTimeOverPlanned(project, aggregates);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("TIME_OVER_PLANNED");
      expect(result?.severity).toBe("red");
    });
  });

  describe("checkCostOverTarget", () => {
    it("returns null when costs are within target", () => {
      const project = createProject({ target_revenue: 10000 });
      const aggregates = createAggregates({ actualCosts: 9000 });
      const result = checkCostOverTarget(project, aggregates);
      expect(result).toBeNull();
    });

    it("returns yellow when costs exceed target by 5-15%", () => {
      const project = createProject({ target_revenue: 10000 });
      // 11000 is 10% over (between 5% and 15%)
      const aggregates = createAggregates({ actualCosts: 11000 });
      const result = checkCostOverTarget(project, aggregates);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("COST_OVER_TARGET");
      expect(result?.severity).toBe("yellow");
    });

    it("returns red when costs exceed target by more than 15%", () => {
      const project = createProject({ target_revenue: 10000 });
      // 12000 is 20% over (more than 15%)
      const aggregates = createAggregates({ actualCosts: 12000 });
      const result = checkCostOverTarget(project, aggregates);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("COST_OVER_TARGET");
      expect(result?.severity).toBe("red");
    });
  });

  describe("checkDeadlineRisk", () => {
    it("returns null when deadline is far away", () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const project = createProject({ end_date: futureDate });
      const result = checkDeadlineRisk(project);
      expect(result).toBeNull();
    });

    it("returns yellow when deadline is within 7 days", () => {
      const nearDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const project = createProject({ end_date: nearDate });
      const result = checkDeadlineRisk(project);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("DEADLINE_RISK");
      expect(result?.severity).toBe("yellow");
    });

    it("returns red when deadline is within 3 days", () => {
      const veryNearDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const project = createProject({ end_date: veryNearDate });
      const result = checkDeadlineRisk(project);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("DEADLINE_RISK");
      expect(result?.severity).toBe("red");
    });

    it("returns null when end_date is not set", () => {
      const project = createProject({ end_date: null });
      const result = checkDeadlineRisk(project);
      expect(result).toBeNull();
    });
  });

  describe("checkMissingInvoice", () => {
    it("returns null when project is not completed", () => {
      const project = createProject({ status: "in_bearbeitung" });
      const aggregates = createAggregates({ hasInvoice: false });
      const result = checkMissingInvoice(project, aggregates);
      expect(result).toBeNull();
    });

    it("returns null when completed project has invoice", () => {
      const project = createProject({ status: "abgeschlossen" });
      const aggregates = createAggregates({ hasInvoice: true });
      const result = checkMissingInvoice(project, aggregates);
      expect(result).toBeNull();
    });

    it("returns yellow when completed project has no invoice", () => {
      const project = createProject({ status: "abgeschlossen" });
      const aggregates = createAggregates({ hasInvoice: false });
      const result = checkMissingInvoice(project, aggregates);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("MISSING_INVOICE");
      expect(result?.severity).toBe("yellow");
    });
  });

  describe("daysUntilDeadline", () => {
    it("returns null for null end_date", () => {
      const result = daysUntilDeadline(null);
      expect(result).toBeNull();
    });

    it("returns positive number for future date", () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const result = daysUntilDeadline(futureDate);
      expect(result).toBeGreaterThanOrEqual(9);
      expect(result).toBeLessThanOrEqual(11);
    });

    it("returns negative number for past date", () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const result = daysUntilDeadline(pastDate);
      expect(result).toBeLessThan(0);
    });
  });

  describe("determineNextAction", () => {
    it("returns SET_TARGETS when targets are missing", () => {
      const project = createProject({ planned_hours: null });
      const aggregates = createAggregates();
      const reasons: HealthReason[] = [
        {
          code: "MISSING_TARGETS",
          severity: "yellow",
          title: "test",
          detail: "test",
        },
      ];
      const result = determineNextAction(
        project.id,
        project,
        aggregates,
        reasons
      );
      expect(result).not.toBeNull();
      expect(result?.key).toBe("SET_TARGETS");
    });

    it("returns BOOK_FIRST_TIME when no time entries and no critical reasons", () => {
      const project = createProject();
      const aggregates = createAggregates({ actualHours: 0 });
      const reasons: HealthReason[] = [];
      const result = determineNextAction(
        project.id,
        project,
        aggregates,
        reasons
      );
      expect(result).not.toBeNull();
      expect(result?.key).toBe("BOOK_FIRST_TIME");
    });

    it("returns CREATE_INVOICE for completed project without invoice", () => {
      const project = createProject({ status: "abgeschlossen" });
      const aggregates = createAggregates({ hasInvoice: false, actualHours: 40 });
      const reasons: HealthReason[] = [
        {
          code: "MISSING_INVOICE",
          severity: "yellow",
          title: "test",
          detail: "test",
        },
      ];
      const result = determineNextAction(
        project.id,
        project,
        aggregates,
        reasons
      );
      expect(result).not.toBeNull();
      expect(result?.key).toBe("CREATE_INVOICE");
    });

    it("returns null when everything is fine", () => {
      const project = createProject();
      const aggregates = createAggregates({ actualHours: 20, actualCosts: 5000 });
      const reasons: HealthReason[] = [];
      const result = determineNextAction(
        project.id,
        project,
        aggregates,
        reasons
      );
      // Should return ADD_MATERIAL as fallback since actualCosts is set
      // If actualCosts > 0, it won't suggest ADD_MATERIAL, so should be null
      expect(result).toBeNull();
    });

    it("prioritizes SET_TARGETS over BOOK_FIRST_TIME", () => {
      const project = createProject({ planned_hours: null });
      const aggregates = createAggregates({ actualHours: 0 });
      const reasons: HealthReason[] = [
        {
          code: "MISSING_TARGETS",
          severity: "yellow",
          title: "test",
          detail: "test",
        },
        {
          code: "NO_TIME_ENTRIES",
          severity: "yellow",
          title: "test",
          detail: "test",
        },
      ];
      const result = determineNextAction(
        project.id,
        project,
        aggregates,
        reasons
      );
      expect(result?.key).toBe("SET_TARGETS");
    });
  });

  describe("THRESHOLDS", () => {
    it("has correct threshold values", () => {
      expect(THRESHOLDS.timeYellowPctOver).toBe(0.1);
      expect(THRESHOLDS.timeRedPctOver).toBe(0.25);
      expect(THRESHOLDS.costYellowPctOver).toBe(0.05);
      expect(THRESHOLDS.costRedPctOver).toBe(0.15);
      expect(THRESHOLDS.deadlineYellowDays).toBe(7);
      expect(THRESHOLDS.deadlineRedDays).toBe(3);
    });
  });
});
