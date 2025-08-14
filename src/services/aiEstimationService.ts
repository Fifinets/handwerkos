import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { auditLogService } from './auditLogService';
import { aiRAGService } from './aiRAGService';
import { eventBus } from './eventBus';

// AI Estimation types for intelligent cost and time planning
export type EstimationType = 
  | 'PROJECT_COST'      // Gesamtprojektkosten
  | 'MATERIAL_COST'     // Materialkosten
  | 'LABOR_COST'        // Arbeitskosten
  | 'TIME_ESTIMATION'   // Zeitschätzung
  | 'COMPLETION_DATE'   // Fertigstellungstermin
  | 'RESOURCE_NEED'     // Ressourcenbedarf
  | 'PROFIT_MARGIN'     // Gewinnmarge
  | 'RISK_ASSESSMENT';  // Risikoanalyse

export type ProjectCategory = 
  | 'BATHROOM_RENOVATION' // Badsanierung
  | 'KITCHEN_RENOVATION'  // Küchenrenovierung
  | 'ELECTRICAL_WORK'     // Elektroarbeiten
  | 'PLUMBING_WORK'      // Sanitärarbeiten
  | 'FLOORING_WORK'      // Bodenarbeiten
  | 'PAINTING_WORK'      // Malerarbeiten
  | 'ROOFING_WORK'       // Dacharbeiten
  | 'GENERAL_CONSTRUCTION' // Allgemeine Bauarbeiten
  | 'MAINTENANCE'        // Wartungsarbeiten
  | 'CUSTOM_WORK';       // Individuelle Arbeiten

export interface EstimationRequest {
  id: string;
  estimation_type: EstimationType;
  project_category: ProjectCategory;
  project_description: string;
  project_size: {
    area_sqm?: number;
    rooms?: number;
    complexity_level: 1 | 2 | 3 | 4 | 5; // 1=einfach, 5=sehr komplex
  };
  customer_requirements: string[];
  timeline_constraints?: {
    start_date?: string;
    end_date?: string;
    fixed_deadline?: boolean;
  };
  budget_constraints?: {
    min_budget?: number;
    max_budget?: number;
    flexible?: boolean;
  };
  additional_context: Record<string, any>;
  created_at: string;
  created_by: string;
}

export interface AIEstimation {
  id: string;
  request_id: string;
  estimation_type: EstimationType;
  
  // Cost estimations
  estimated_costs: {
    materials: number;
    labor: number;
    overhead: number;
    profit_margin: number;
    total: number;
    contingency: number; // Sicherheitspuffer
  };
  
  // Time estimations
  estimated_timeline: {
    preparation_hours: number;
    execution_hours: number;
    cleanup_hours: number;
    total_hours: number;
    estimated_days: number;
    suggested_start_date: string;
    suggested_end_date: string;
  };
  
  // Resource requirements
  resource_requirements: {
    skilled_workers: number;
    helpers: number;
    specialized_equipment: string[];
    material_list: Array<{
      item: string;
      quantity: number;
      unit: string;
      estimated_cost: number;
    }>;
  };
  
  // Risk and confidence
  confidence_score: number; // 0-1
  risk_factors: Array<{
    factor: string;
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
    mitigation: string;
  }>;
  
  // Historical context
  similar_projects: Array<{
    project_id: string;
    similarity_score: number;
    actual_cost: number;
    actual_duration: number;
    lessons_learned: string;
  }>;
  
  // Recommendations
  recommendations: string[];
  alternative_approaches: Array<{
    approach: string;
    cost_impact: number;
    time_impact: number;
    description: string;
  }>;
  
  created_at: string;
  updated_at: string;
}

export interface EstimationAccuracy {
  estimation_id: string;
  actual_costs?: {
    materials: number;
    labor: number;
    total: number;
  };
  actual_timeline?: {
    start_date: string;
    end_date: string;
    total_hours: number;
  };
  variance_percentage: number;
  accuracy_score: number;
  lessons_learned: string[];
  feedback_notes: string;
  created_at: string;
}

// German construction and trade-specific knowledge base
const GERMAN_TRADE_KNOWLEDGE = {
  BATHROOM_RENOVATION: {
    base_cost_per_sqm: 800, // €/qm
    complexity_multipliers: {
      1: 0.8, // Einfach: nur Fliesen
      2: 1.0, // Standard: Fliesen + Sanitär
      3: 1.3, // Mittel: + Elektrik
      4: 1.6, // Komplex: + Heizung
      5: 2.0  // Sehr komplex: Komplettsanierung
    },
    typical_materials: [
      { item: 'Fliesen', unit: 'qm', cost_per_unit: 25 },
      { item: 'Sanitärkeramik', unit: 'Set', cost_per_unit: 800 },
      { item: 'Armaturen', unit: 'Set', cost_per_unit: 300 },
      { item: 'Rohrmaterial', unit: 'lfdm', cost_per_unit: 15 },
      { item: 'Elektromaterial', unit: 'Pauschal', cost_per_unit: 200 }
    ],
    labor_hours_per_sqm: 8,
    typical_duration_days: 10
  },

  KITCHEN_RENOVATION: {
    base_cost_per_sqm: 1200,
    complexity_multipliers: { 1: 0.7, 2: 1.0, 3: 1.4, 4: 1.8, 5: 2.2 },
    typical_materials: [
      { item: 'Küchenzeile', unit: 'lfdm', cost_per_unit: 600 },
      { item: 'Arbeitsplatte', unit: 'lfdm', cost_per_unit: 150 },
      { item: 'Elektrogeräte', unit: 'Set', cost_per_unit: 2000 },
      { item: 'Fliesen Spritzschutz', unit: 'qm', cost_per_unit: 30 }
    ],
    labor_hours_per_sqm: 12,
    typical_duration_days: 8
  },

  ELECTRICAL_WORK: {
    base_cost_per_sqm: 50,
    complexity_multipliers: { 1: 0.6, 2: 1.0, 3: 1.5, 4: 2.0, 5: 3.0 },
    typical_materials: [
      { item: 'Kabel NYM-J', unit: 'lfdm', cost_per_unit: 2.5 },
      { item: 'Steckdosen/Schalter', unit: 'Stück', cost_per_unit: 8 },
      { item: 'Sicherungskasten', unit: 'Stück', cost_per_unit: 150 },
      { item: 'Installationsrohre', unit: 'lfdm', cost_per_unit: 1.5 }
    ],
    labor_hours_per_sqm: 2,
    typical_duration_days: 3
  },

  PAINTING_WORK: {
    base_cost_per_sqm: 15,
    complexity_multipliers: { 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.5, 5: 2.0 },
    typical_materials: [
      { item: 'Wandfarbe', unit: 'Liter', cost_per_unit: 8 },
      { item: 'Grundierung', unit: 'Liter', cost_per_unit: 6 },
      { item: 'Abdeckmaterial', unit: 'qm', cost_per_unit: 0.5 },
      { item: 'Pinsel/Rollen', unit: 'Set', cost_per_unit: 25 }
    ],
    labor_hours_per_sqm: 0.5,
    typical_duration_days: 2
  }
};

// German wage rates and overhead costs
const GERMAN_WAGE_RATES = {
  skilled_worker: 45, // €/Stunde für Fachkraft
  helper: 25,         // €/Stunde für Hilfskraft
  apprentice: 15,     // €/Stunde für Azubi
  overhead_factor: 1.6, // Gemeinkosten-Faktor (Sozialabgaben, etc.)
  profit_margin: 0.15,  // 15% Gewinnmarge
  contingency: 0.10     // 10% Sicherheitspuffer
};

// Zod schemas
const EstimationRequestSchema = z.object({
  estimation_type: z.enum(['PROJECT_COST', 'MATERIAL_COST', 'LABOR_COST', 'TIME_ESTIMATION', 'COMPLETION_DATE', 'RESOURCE_NEED', 'PROFIT_MARGIN', 'RISK_ASSESSMENT']),
  project_category: z.enum(['BATHROOM_RENOVATION', 'KITCHEN_RENOVATION', 'ELECTRICAL_WORK', 'PLUMBING_WORK', 'FLOORING_WORK', 'PAINTING_WORK', 'ROOFING_WORK', 'GENERAL_CONSTRUCTION', 'MAINTENANCE', 'CUSTOM_WORK']),
  project_description: z.string().min(10),
  project_size: z.object({
    area_sqm: z.number().positive().optional(),
    rooms: z.number().int().positive().optional(),
    complexity_level: z.number().int().min(1).max(5),
  }),
  customer_requirements: z.array(z.string()).default([]),
  timeline_constraints: z.object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    fixed_deadline: z.boolean().default(false),
  }).optional(),
  budget_constraints: z.object({
    min_budget: z.number().positive().optional(),
    max_budget: z.number().positive().optional(),
    flexible: z.boolean().default(true),
  }).optional(),
  additional_context: z.record(z.any()).default({}),
});

export class AIEstimationService {

  /**
   * Create comprehensive project estimation using AI and historical data
   */
  static async createProjectEstimation(
    estimationRequest: Omit<EstimationRequest, 'id' | 'created_at' | 'created_by'>
  ): Promise<AIEstimation> {
    return apiCall(async () => {
      const validatedRequest = validateInput(EstimationRequestSchema, estimationRequest);
      const currentUser = await getCurrentUserProfile();

      // Save estimation request
      const requestData = {
        ...validatedRequest,
        created_by: currentUser.id,
      };

      const requestQuery = supabase
        .from('ai_estimation_requests')
        .insert(requestData)
        .select()
        .single();

      const savedRequest = await createQuery<EstimationRequest>(requestQuery).executeSingle();

      // Get historical data for similar projects
      const similarProjects = await this.findSimilarProjects(
        validatedRequest.project_category,
        validatedRequest.project_size
      );

      // Perform cost estimation
      const costEstimation = this.calculateCostEstimation(
        validatedRequest.project_category,
        validatedRequest.project_size,
        validatedRequest.customer_requirements,
        similarProjects
      );

      // Perform time estimation
      const timeEstimation = this.calculateTimeEstimation(
        validatedRequest.project_category,
        validatedRequest.project_size,
        validatedRequest.timeline_constraints,
        similarProjects
      );

      // Calculate resource requirements
      const resourceRequirements = this.calculateResourceRequirements(
        validatedRequest.project_category,
        validatedRequest.project_size,
        costEstimation.materials
      );

      // Assess risks
      const riskAssessment = this.assessRisks(
        validatedRequest.project_category,
        validatedRequest.project_size,
        validatedRequest.customer_requirements,
        validatedRequest.timeline_constraints
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        validatedRequest,
        costEstimation,
        timeEstimation,
        riskAssessment
      );

      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(
        similarProjects,
        riskAssessment,
        validatedRequest.project_size.complexity_level
      );

      // Create final estimation
      const estimationData = {
        request_id: savedRequest.id,
        estimation_type: validatedRequest.estimation_type,
        estimated_costs: costEstimation,
        estimated_timeline: timeEstimation,
        resource_requirements: resourceRequirements,
        confidence_score: confidenceScore,
        risk_factors: riskAssessment,
        similar_projects: similarProjects.map(p => ({
          project_id: p.id,
          similarity_score: p.similarity_score,
          actual_cost: p.total_cost,
          actual_duration: p.duration_days,
          lessons_learned: p.lessons_learned || 'Keine besonderen Erkenntnisse'
        })),
        recommendations: recommendations.general,
        alternative_approaches: recommendations.alternatives,
      };

      const estimationQuery = supabase
        .from('ai_estimations')
        .insert(estimationData)
        .select()
        .single();

      const estimation = await createQuery<AIEstimation>(estimationQuery).executeSingle();

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: 'project',
        entity_id: estimation.id,
        action: 'CREATE',
        new_values: {
          estimation_type: validatedRequest.estimation_type,
          project_category: validatedRequest.project_category,
          total_cost: costEstimation.total,
          estimated_days: timeEstimation.estimated_days,
          confidence_score: confidenceScore,
        },
        reason: 'AI-Kostenschätzung erstellt',
        is_automated: true,
      });

      // Emit event
      eventBus.emit('ESTIMATION_CREATED', {
        estimation_id: estimation.id,
        project_category: validatedRequest.project_category,
        total_cost: costEstimation.total,
        user_id: currentUser.id,
      });

      return estimation;
    }, 'Create AI project estimation');
  }

  /**
   * Update estimation accuracy with actual project data
   */
  static async updateEstimationAccuracy(
    estimationId: string,
    actualCosts: { materials: number; labor: number; total: number },
    actualTimeline: { start_date: string; end_date: string; total_hours: number },
    lessonsLearned: string[] = [],
    feedbackNotes: string = ''
  ): Promise<EstimationAccuracy> {
    return apiCall(async () => {
      // Get original estimation
      const estimationQuery = supabase
        .from('ai_estimations')
        .select('*')
        .eq('id', estimationId)
        .single();

      const estimation = await createQuery<AIEstimation>(estimationQuery).executeSingle();

      // Calculate variance
      const costVariance = ((actualCosts.total - estimation.estimated_costs.total) / estimation.estimated_costs.total) * 100;
      
      const actualDays = Math.ceil(
        (new Date(actualTimeline.end_date).getTime() - new Date(actualTimeline.start_date).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      const timeVariance = ((actualDays - estimation.estimated_timeline.estimated_days) / estimation.estimated_timeline.estimated_days) * 100;
      
      const averageVariance = Math.abs((costVariance + timeVariance) / 2);

      // Calculate accuracy score (higher is better)
      const accuracyScore = Math.max(0, 100 - averageVariance) / 100;

      const accuracyData = {
        estimation_id: estimationId,
        actual_costs: actualCosts,
        actual_timeline: actualTimeline,
        variance_percentage: averageVariance,
        accuracy_score: accuracyScore,
        lessons_learned: lessonsLearned,
        feedback_notes: feedbackNotes,
      };

      const accuracyQuery = supabase
        .from('ai_estimation_accuracy')
        .insert(accuracyData)
        .select()
        .single();

      const accuracy = await createQuery<EstimationAccuracy>(accuracyQuery).executeSingle();

      // Learn from this data to improve future estimations
      await this.updateEstimationModel(estimation, accuracy);

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: 'project',
        entity_id: estimationId,
        action: 'UPDATE',
        new_values: {
          actual_cost: actualCosts.total,
          actual_duration: actualDays,
          variance_percentage: averageVariance,
          accuracy_score: accuracyScore,
        },
        reason: 'Schätzungsgenauigkeit aktualisiert mit tatsächlichen Daten',
      });

      return accuracy;
    }, 'Update estimation accuracy');
  }

  /**
   * Get estimation statistics and model performance
   */
  static async getEstimationStatistics(
    dateRange?: { from: string; to: string }
  ): Promise<{
    total_estimations: number;
    average_accuracy: number;
    cost_accuracy: number;
    time_accuracy: number;
    best_performing_categories: Array<{ category: ProjectCategory; accuracy: number }>;
    improvement_areas: string[];
  }> {
    return apiCall(async () => {
      let accuracyQuery = supabase
        .from('ai_estimation_accuracy')
        .select(`
          *,
          ai_estimations (
            estimation_type,
            ai_estimation_requests (project_category)
          )
        `);

      if (dateRange) {
        accuracyQuery = accuracyQuery
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to);
      }

      const accuracyRecords = await createQuery(accuracyQuery).execute();

      if (accuracyRecords.length === 0) {
        return {
          total_estimations: 0,
          average_accuracy: 0,
          cost_accuracy: 0,
          time_accuracy: 0,
          best_performing_categories: [],
          improvement_areas: ['Nicht genügend Daten für Analyse verfügbar'],
        };
      }

      // Calculate statistics
      const totalEstimations = accuracyRecords.length;
      const averageAccuracy = accuracyRecords.reduce((sum, record) => sum + record.accuracy_score, 0) / totalEstimations;

      // Group by category
      const categoryStats = new Map<ProjectCategory, { total: number; accuracy_sum: number }>();
      
      accuracyRecords.forEach(record => {
        const category = record.ai_estimations?.ai_estimation_requests?.project_category;
        if (category) {
          const current = categoryStats.get(category) || { total: 0, accuracy_sum: 0 };
          current.total += 1;
          current.accuracy_sum += record.accuracy_score;
          categoryStats.set(category, current);
        }
      });

      const bestPerformingCategories = Array.from(categoryStats.entries())
        .map(([category, stats]) => ({
          category,
          accuracy: stats.accuracy_sum / stats.total
        }))
        .sort((a, b) => b.accuracy - a.accuracy);

      // Identify improvement areas
      const improvementAreas = this.identifyImprovementAreas(accuracyRecords, averageAccuracy);

      return {
        total_estimations: totalEstimations,
        average_accuracy: Math.round(averageAccuracy * 100),
        cost_accuracy: Math.round(averageAccuracy * 100), // Simplified
        time_accuracy: Math.round(averageAccuracy * 100), // Simplified
        best_performing_categories: bestPerformingCategories.slice(0, 5),
        improvement_areas: improvementAreas,
      };
    }, 'Get estimation statistics');
  }

  /**
   * Generate quick cost estimation for simple requests
   */
  static async getQuickEstimate(
    projectCategory: ProjectCategory,
    areaSqm: number,
    complexityLevel: 1 | 2 | 3 | 4 | 5
  ): Promise<{
    estimated_cost: number;
    cost_range: { min: number; max: number };
    estimated_days: number;
    confidence: number;
    note: string;
  }> {
    return apiCall(async () => {
      const categoryData = GERMAN_TRADE_KNOWLEDGE[projectCategory] || GERMAN_TRADE_KNOWLEDGE.GENERAL_CONSTRUCTION;
      
      if (!categoryData) {
        throw new ApiError(
          'Kategorie nicht unterstützt',
          API_ERROR_CODES.BAD_REQUEST,
          `Schnellschätzung für ${projectCategory} nicht verfügbar`
        );
      }

      const baseCost = categoryData.base_cost_per_sqm;
      const complexityMultiplier = categoryData.complexity_multipliers[complexityLevel];
      const estimatedCost = Math.round(areaSqm * baseCost * complexityMultiplier);

      // Add range (±20%)
      const range = {
        min: Math.round(estimatedCost * 0.8),
        max: Math.round(estimatedCost * 1.2),
      };

      // Estimate days
      const estimatedDays = Math.ceil((areaSqm * categoryData.labor_hours_per_sqm) / 8);

      // Confidence decreases with complexity and lack of details
      const confidence = Math.max(0.3, 0.8 - (complexityLevel * 0.1));

      return {
        estimated_cost: estimatedCost,
        cost_range: range,
        estimated_days: estimatedDays,
        confidence: confidence,
        note: `Schnellschätzung basierend auf ${areaSqm}qm ${projectCategory} (Komplexität: ${complexityLevel}/5)`,
      };
    }, 'Generate quick estimate');
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private static async findSimilarProjects(
    category: ProjectCategory,
    projectSize: { area_sqm?: number; complexity_level: number }
  ): Promise<Array<{
    id: string;
    similarity_score: number;
    total_cost: number;
    duration_days: number;
    lessons_learned?: string;
  }>> {
    // Search for similar completed projects
    const projectQuery = supabase
      .from('projects')
      .select(`
        id,
        budget,
        start_date,
        end_date,
        metadata,
        description
      `)
      .eq('status', 'abgeschlossen')
      .not('budget', 'is', null)
      .limit(10);

    const projects = await createQuery(projectQuery).execute();

    // Calculate similarity scores
    const similarProjects = projects
      .map(project => {
        let similarityScore = 0.5; // Base score

        // Check category match (would need metadata or description analysis)
        const description = (project.description || '').toLowerCase();
        const categoryKeywords = this.getCategoryKeywords(category);
        if (categoryKeywords.some(keyword => description.includes(keyword))) {
          similarityScore += 0.3;
        }

        // Check size similarity (if available in metadata)
        if (project.metadata?.area_sqm && projectSize.area_sqm) {
          const sizeDiff = Math.abs(project.metadata.area_sqm - projectSize.area_sqm) / projectSize.area_sqm;
          if (sizeDiff < 0.5) similarityScore += 0.2;
        }

        // Calculate duration
        const startDate = new Date(project.start_date);
        const endDate = new Date(project.end_date);
        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: project.id,
          similarity_score: Math.min(1, similarityScore),
          total_cost: project.budget,
          duration_days: durationDays,
          lessons_learned: project.metadata?.lessons_learned,
        };
      })
      .filter(p => p.similarity_score > 0.3)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 5);

    return similarProjects;
  }

  private static getCategoryKeywords(category: ProjectCategory): string[] {
    const keywordMap = {
      BATHROOM_RENOVATION: ['bad', 'sanitär', 'dusche', 'wc', 'fliesen'],
      KITCHEN_RENOVATION: ['küche', 'küchenzeile', 'arbeitsplatte', 'spüle'],
      ELECTRICAL_WORK: ['elektro', 'strom', 'kabel', 'steckdose', 'schalter'],
      PLUMBING_WORK: ['sanitär', 'wasser', 'heizung', 'rohr'],
      FLOORING_WORK: ['boden', 'parkett', 'laminat', 'fliesen'],
      PAINTING_WORK: ['maler', 'farbe', 'streichen', 'tapete'],
      ROOFING_WORK: ['dach', 'ziegel', 'dachrinne'],
      GENERAL_CONSTRUCTION: ['bau', 'renovierung', 'sanierung'],
      MAINTENANCE: ['wartung', 'reparatur', 'instandhaltung'],
      CUSTOM_WORK: ['sonder', 'individuell', 'maßanfertigung'],
    };

    return keywordMap[category] || [];
  }

  private static calculateCostEstimation(
    category: ProjectCategory,
    projectSize: { area_sqm?: number; rooms?: number; complexity_level: number },
    requirements: string[],
    similarProjects: Array<{ total_cost: number; similarity_score: number }>
  ) {
    const categoryData = GERMAN_TRADE_KNOWLEDGE[category] || GERMAN_TRADE_KNOWLEDGE.GENERAL_CONSTRUCTION;
    const area = projectSize.area_sqm || (projectSize.rooms || 1) * 20; // Assume 20qm per room if no area given

    // Base calculation
    const baseCostPerSqm = categoryData.base_cost_per_sqm;
    const complexityMultiplier = categoryData.complexity_multipliers[projectSize.complexity_level] || 1.0;
    const baseCost = area * baseCostPerSqm * complexityMultiplier;

    // Material costs
    let materialCosts = 0;
    categoryData.typical_materials.forEach(material => {
      let quantity = area;
      if (material.unit === 'Set') quantity = 1;
      if (material.unit === 'lfdm') quantity = area * 0.5; // Rough approximation
      if (material.unit === 'Stück') quantity = area * 0.1;
      
      materialCosts += quantity * material.cost_per_unit;
    });

    // Labor costs
    const laborHours = area * categoryData.labor_hours_per_sqm;
    const laborCost = laborHours * GERMAN_WAGE_RATES.skilled_worker * GERMAN_WAGE_RATES.overhead_factor;

    // Overhead and profit
    const subtotal = materialCosts + laborCost;
    const overhead = subtotal * 0.15; // 15% overhead
    const profitMargin = subtotal * GERMAN_WAGE_RATES.profit_margin;
    const contingency = subtotal * GERMAN_WAGE_RATES.contingency;

    // Adjust based on similar projects
    let adjustmentFactor = 1.0;
    if (similarProjects.length > 0) {
      const weightedAvgCost = similarProjects.reduce((sum, p) => sum + (p.total_cost * p.similarity_score), 0) / 
                             similarProjects.reduce((sum, p) => sum + p.similarity_score, 0);
      adjustmentFactor = weightedAvgCost / baseCost;
      adjustmentFactor = Math.max(0.7, Math.min(1.5, adjustmentFactor)); // Limit adjustment
    }

    const total = (subtotal + overhead + profitMargin + contingency) * adjustmentFactor;

    return {
      materials: Math.round(materialCosts * adjustmentFactor),
      labor: Math.round(laborCost * adjustmentFactor),
      overhead: Math.round(overhead * adjustmentFactor),
      profit_margin: Math.round(profitMargin * adjustmentFactor),
      total: Math.round(total),
      contingency: Math.round(contingency * adjustmentFactor),
    };
  }

  private static calculateTimeEstimation(
    category: ProjectCategory,
    projectSize: { area_sqm?: number; rooms?: number; complexity_level: number },
    timelineConstraints?: { start_date?: string; end_date?: string; fixed_deadline?: boolean },
    similarProjects: Array<{ duration_days: number; similarity_score: number }> = []
  ) {
    const categoryData = GERMAN_TRADE_KNOWLEDGE[category] || GERMAN_TRADE_KNOWLEDGE.GENERAL_CONSTRUCTION;
    const area = projectSize.area_sqm || (projectSize.rooms || 1) * 20;

    // Base time calculation
    const executionHours = area * categoryData.labor_hours_per_sqm * projectSize.complexity_level * 0.8;
    const preparationHours = executionHours * 0.2;
    const cleanupHours = executionHours * 0.1;
    const totalHours = preparationHours + executionHours + cleanupHours;

    let estimatedDays = Math.ceil(totalHours / 8); // 8 hours per working day

    // Adjust based on similar projects
    if (similarProjects.length > 0) {
      const weightedAvgDays = similarProjects.reduce((sum, p) => sum + (p.duration_days * p.similarity_score), 0) / 
                             similarProjects.reduce((sum, p) => sum + p.similarity_score, 0);
      const adjustmentFactor = weightedAvgDays / estimatedDays;
      estimatedDays = Math.round(estimatedDays * Math.max(0.5, Math.min(2.0, adjustmentFactor)));
    }

    // Calculate dates
    const startDate = timelineConstraints?.start_date 
      ? new Date(timelineConstraints.start_date)
      : new Date();
    
    // Add buffer days and account for weekends
    const bufferDays = Math.ceil(estimatedDays * 0.1);
    const totalDaysWithBuffer = estimatedDays + bufferDays;
    
    const endDate = new Date(startDate);
    // Add only working days (Mon-Fri)
    let daysAdded = 0;
    while (daysAdded < totalDaysWithBuffer) {
      endDate.setDate(endDate.getDate() + 1);
      const dayOfWeek = endDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        daysAdded++;
      }
    }

    return {
      preparation_hours: Math.round(preparationHours),
      execution_hours: Math.round(executionHours),
      cleanup_hours: Math.round(cleanupHours),
      total_hours: Math.round(totalHours),
      estimated_days: estimatedDays,
      suggested_start_date: startDate.toISOString().split('T')[0],
      suggested_end_date: endDate.toISOString().split('T')[0],
    };
  }

  private static calculateResourceRequirements(
    category: ProjectCategory,
    projectSize: { area_sqm?: number; complexity_level: number },
    materialCosts: number
  ) {
    const categoryData = GERMAN_TRADE_KNOWLEDGE[category] || GERMAN_TRADE_KNOWLEDGE.GENERAL_CONSTRUCTION;
    const area = projectSize.area_sqm || 20;

    // Calculate worker requirements
    const skilledWorkers = Math.max(1, Math.ceil(area / 30)); // 1 skilled worker per 30qm
    const helpers = projectSize.complexity_level > 3 ? 1 : 0;

    // Specialized equipment based on category
    const equipment = this.getSpecializedEquipment(category, projectSize.complexity_level);

    // Material list based on category
    const materialList = categoryData.typical_materials.map(material => {
      let quantity = area;
      if (material.unit === 'Set') quantity = 1;
      if (material.unit === 'lfdm') quantity = area * 0.5;
      if (material.unit === 'Stück') quantity = Math.ceil(area * 0.1);

      return {
        item: material.item,
        quantity: Math.round(quantity * 10) / 10, // Round to 1 decimal
        unit: material.unit,
        estimated_cost: Math.round(quantity * material.cost_per_unit),
      };
    });

    return {
      skilled_workers: skilledWorkers,
      helpers: helpers,
      specialized_equipment: equipment,
      material_list: materialList,
    };
  }

  private static getSpecializedEquipment(category: ProjectCategory, complexityLevel: number): string[] {
    const equipmentMap = {
      BATHROOM_RENOVATION: ['Fliesenschneidemaschine', 'Bohrmaschine', 'Schweißgerät'],
      KITCHEN_RENOVATION: ['Kreissäge', 'Oberfräse', 'Bohrmaschine'],
      ELECTRICAL_WORK: ['Multimeter', 'Kabelzuggerät', 'Isolationsprüfer'],
      PLUMBING_WORK: ['Rohrschneidegerät', 'Lötkolben', 'Rohrbiegemaschine'],
      FLOORING_WORK: ['Parkettschleifer', 'Säge', 'Verlegewerkzeug'],
      PAINTING_WORK: ['Spritzpistole', 'Gerüst', 'Schleifmaschine'],
      ROOFING_WORK: ['Dachleiter', 'Sicherheitsausrüstung', 'Hebegerät'],
      GENERAL_CONSTRUCTION: ['Bohrmaschine', 'Winkelschleifer', 'Baugerüst'],
      MAINTENANCE: ['Universalwerkzeug', 'Messgeräte'],
      CUSTOM_WORK: ['Spezialwerkzeug nach Bedarf'],
    };

    let equipment = equipmentMap[category] || [];
    
    if (complexityLevel >= 4) {
      equipment = [...equipment, 'Zusätzliche Spezialgeräte'];
    }

    return equipment;
  }

  private static assessRisks(
    category: ProjectCategory,
    projectSize: { area_sqm?: number; complexity_level: number },
    requirements: string[],
    timelineConstraints?: { start_date?: string; end_date?: string; fixed_deadline?: boolean }
  ): Array<{ factor: string; impact: 'LOW' | 'MEDIUM' | 'HIGH'; mitigation: string }> {
    const risks = [];

    // Complexity-based risks
    if (projectSize.complexity_level >= 4) {
      risks.push({
        factor: 'Hohe Projektkomplexität',
        impact: 'HIGH' as const,
        mitigation: 'Detaillierte Planung und erfahrene Fachkräfte einsetzen'
      });
    }

    // Timeline risks
    if (timelineConstraints?.fixed_deadline) {
      risks.push({
        factor: 'Fester Fertigstellungstermin',
        impact: 'MEDIUM' as const,
        mitigation: 'Pufferzeiten einplanen und Ressourcen flexibel halten'
      });
    }

    // Category-specific risks
    const categoryRisks = this.getCategorySpecificRisks(category);
    risks.push(...categoryRisks);

    // Weather/seasonal risks
    const seasonalRisks = this.getSeasonalRisks(category, timelineConstraints?.start_date);
    risks.push(...seasonalRisks);

    return risks;
  }

  private static getCategorySpecificRisks(category: ProjectCategory): Array<{ factor: string; impact: 'LOW' | 'MEDIUM' | 'HIGH'; mitigation: string }> {
    const riskMap = {
      BATHROOM_RENOVATION: [
        { factor: 'Wasserschäden bei Altbau', impact: 'HIGH' as const, mitigation: 'Vorab-Inspektion der Rohrleitungen' },
        { factor: 'Asbest in alten Fliesen', impact: 'HIGH' as const, mitigation: 'Schadstoffprüfung vor Beginn' }
      ],
      ELECTRICAL_WORK: [
        { factor: 'Alte Elektroinstallation', impact: 'HIGH' as const, mitigation: 'Vollständige Bestandsaufnahme und Prüfung' },
        { factor: 'Unvorhersehbare Kabelverläufe', impact: 'MEDIUM' as const, mitigation: 'Ortungsgeräte verwenden' }
      ],
      ROOFING_WORK: [
        { factor: 'Witterungsabhängigkeit', impact: 'HIGH' as const, mitigation: 'Wetterpuffer einplanen' },
        { factor: 'Unfallgefahr in der Höhe', impact: 'HIGH' as const, mitigation: 'Umfangreiche Sicherheitsmaßnahmen' }
      ]
    };

    return riskMap[category] || [
      { factor: 'Unvorhersehbare Bausubstanz', impact: 'MEDIUM' as const, mitigation: 'Vorab-Begutachtung durchführen' }
    ];
  }

  private static getSeasonalRisks(category: ProjectCategory, startDate?: string): Array<{ factor: string; impact: 'LOW' | 'MEDIUM' | 'HIGH'; mitigation: string }> {
    if (!startDate) return [];

    const start = new Date(startDate);
    const month = start.getMonth() + 1; // 1-12

    const risks = [];

    // Winter risks (Dec-Feb)
    if (month === 12 || month <= 2) {
      if (['ROOFING_WORK', 'GENERAL_CONSTRUCTION'].includes(category)) {
        risks.push({
          factor: 'Winterwetter und Frost',
          impact: 'HIGH' as const,
          mitigation: 'Wetterschutz und Frostschutzmaßnahmen'
        });
      }
    }

    // Holiday risks
    if (month === 7 || month === 8) {
      risks.push({
        factor: 'Ferienzeit - Personalengpässe',
        impact: 'MEDIUM' as const,
        mitigation: 'Frühzeitige Personalplanung'
      });
    }

    return risks;
  }

  private static generateRecommendations(
    request: any,
    costEstimation: any,
    timeEstimation: any,
    riskAssessment: any
  ): { general: string[]; alternatives: Array<{ approach: string; cost_impact: number; time_impact: number; description: string }> } {
    const recommendations = [];
    const alternatives = [];

    // Cost-based recommendations
    if (costEstimation.total > 50000) {
      recommendations.push('Erwägen Sie eine Finanzierung oder Teilzahlungen');
      recommendations.push('Holen Sie mehrere Angebote für teure Materialien ein');
    }

    // Time-based recommendations
    if (timeEstimation.estimated_days > 20) {
      recommendations.push('Planen Sie Zwischentermine für Qualitätskontrollen');
      recommendations.push('Informieren Sie Nachbarn über längere Bauzeit');
    }

    // Risk-based recommendations
    const highRisks = riskAssessment.filter((r: any) => r.impact === 'HIGH');
    if (highRisks.length > 0) {
      recommendations.push('Zusätzliche Versicherung für Hochrisiko-Arbeiten abschließen');
      recommendations.push('Detaillierte Vorab-Untersuchung der Bausubstanz');
    }

    // Generate alternatives
    alternatives.push({
      approach: 'Budgetvariante',
      cost_impact: -0.15,
      time_impact: 0.1,
      description: 'Einfachere Materialien und weniger Extras für 15% Kostenersparnis'
    });

    alternatives.push({
      approach: 'Premium-Variante',
      cost_impact: 0.25,
      time_impact: 0.05,
      description: 'Hochwertige Materialien und zusätzliche Features für bessere Qualität'
    });

    alternatives.push({
      approach: 'Express-Durchführung',
      cost_impact: 0.20,
      time_impact: -0.30,
      description: 'Mehr Personal und Überstunden für 30% schnellere Fertigstellung'
    });

    return { general: recommendations, alternatives };
  }

  private static calculateConfidenceScore(
    similarProjects: Array<{ similarity_score: number }>,
    riskAssessment: Array<{ impact: string }>,
    complexityLevel: number
  ): number {
    let confidence = 0.7; // Base confidence

    // Boost confidence with similar projects
    if (similarProjects.length > 0) {
      const avgSimilarity = similarProjects.reduce((sum, p) => sum + p.similarity_score, 0) / similarProjects.length;
      confidence += avgSimilarity * 0.2;
    }

    // Reduce confidence with high risks
    const highRiskCount = riskAssessment.filter(r => r.impact === 'HIGH').length;
    confidence -= highRiskCount * 0.1;

    // Reduce confidence with high complexity
    confidence -= (complexityLevel - 3) * 0.05;

    return Math.max(0.2, Math.min(1.0, confidence));
  }

  private static async updateEstimationModel(estimation: AIEstimation, accuracy: EstimationAccuracy): Promise<void> {
    // This would update ML models in production
    // For now, just log the learning data
    console.log('Learning from estimation accuracy:', {
      category: estimation.estimation_type,
      variance: accuracy.variance_percentage,
      accuracy_score: accuracy.accuracy_score,
      lessons: accuracy.lessons_learned,
    });
  }

  private static identifyImprovementAreas(accuracyRecords: any[], averageAccuracy: number): string[] {
    const areas = [];

    if (averageAccuracy < 0.7) {
      areas.push('Gesamtgenauigkeit der Schätzungen verbessern');
    }

    // Check for consistently overestimated categories
    const highVarianceRecords = accuracyRecords.filter(r => r.variance_percentage > 30);
    if (highVarianceRecords.length > accuracyRecords.length * 0.3) {
      areas.push('Kostenschätzungen sind oft zu ungenau - mehr historische Daten sammeln');
    }

    if (accuracyRecords.length < 10) {
      areas.push('Mehr abgeschlossene Projekte für bessere Lernbasis dokumentieren');
    }

    return areas;
  }
}

export const aiEstimationService = new AIEstimationService();