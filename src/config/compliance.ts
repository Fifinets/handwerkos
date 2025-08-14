export const complianceConfig = {
  // Globaler Schalter
  requireHumanApproval: true,

  // Feingranulare Gates – welche Aktionen brauchen Freigabe?
  gates: {
    aiEstimateApply: true,
    aiScheduleApply: true,
    customerScoringAction: true, // z. B. Mahnstufe erhöhen
    employeeScoringAction: true, // z. B. Schicht/Bonus
  },
} as const;

export type ComplianceGate = keyof typeof complianceConfig.gates;