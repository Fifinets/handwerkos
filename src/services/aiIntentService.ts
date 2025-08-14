import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { apiCall, createQuery, validateInput, getCurrentUserProfile, ApiError, API_ERROR_CODES } from './common';
import { auditLogService } from './auditLogService';
import { aiRAGService } from './aiRAGService';
import { eventBus } from './eventBus';

// AI Intent types for understanding user requests
export type IntentCategory = 
  | 'SEARCH_REQUEST'       // "Zeige mir alle Rechnungen von Müller"
  | 'CREATE_ENTITY'        // "Erstelle ein Angebot für Projekt X"
  | 'UPDATE_ENTITY'        // "Ändere den Status der Rechnung auf bezahlt"
  | 'REPORT_REQUEST'       // "Wie ist die Auslastung dieses Monats?"
  | 'CALCULATION_REQUEST'  // "Berechne die Materialkosten für Projekt Y"
  | 'SCHEDULE_TASK'        // "Plane einen Termin mit Kunde Z"
  | 'COMPLIANCE_CHECK'     // "Ist die Rechnung GoBD-konform?"
  | 'EXPORT_REQUEST'       // "Exportiere DATEV-Daten für Q3"
  | 'NOTIFICATION_SETUP'   // "Benachrichtige mich bei Budget-Überschreitungen"
  | 'HELP_REQUEST'         // "Wie funktioniert die Zeiterfassung?"
  | 'UNKNOWN';

export type EntityType = 
  | 'customer' 
  | 'invoice' 
  | 'quote' 
  | 'order' 
  | 'project' 
  | 'material' 
  | 'employee' 
  | 'timesheet' 
  | 'expense'
  | 'report'
  | 'notification';

export type ActionType = 
  | 'CREATE' 
  | 'READ' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'SEARCH' 
  | 'EXPORT' 
  | 'CALCULATE' 
  | 'SCHEDULE' 
  | 'NOTIFY' 
  | 'VALIDATE';

export interface IntentAnalysis {
  id: string;
  user_input: string;
  detected_intent: IntentCategory;
  confidence_score: number;
  target_entity?: EntityType;
  suggested_action?: ActionType;
  extracted_parameters: Record<string, any>;
  natural_language_explanation: string;
  suggested_queries: string[];
  requires_confirmation: boolean;
  created_at: string;
  user_id: string;
}

export interface IntentAction {
  id: string;
  intent_id: string;
  action_type: ActionType;
  target_entity: EntityType;
  parameters: Record<string, any>;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  result?: any;
  error_message?: string;
  executed_at?: string;
  user_confirmation_required: boolean;
}

export interface ConversationalContext {
  id: string;
  session_id: string;
  conversation_history: Array<{
    timestamp: string;
    user_message: string;
    ai_response: string;
    intent_detected?: IntentCategory;
    actions_taken?: string[];
  }>;
  user_preferences: Record<string, any>;
  current_focus?: {
    entity_type: EntityType;
    entity_id: string;
    context_info: Record<string, any>;
  };
  created_at: string;
  updated_at: string;
  user_id: string;
}

// German business intent patterns
const GERMAN_INTENT_PATTERNS = {
  SEARCH_REQUEST: {
    patterns: [
      /zeige?\s+(mir\s+)?(alle\s+)?(.+)/i,
      /suche?\s+(nach\s+)?(.+)/i,
      /finde?\s+(.+)/i,
      /liste\s+(alle\s+)?(.+)\s+(auf|an)/i,
      /wo\s+(ist|sind|finde)\s+(.+)/i,
    ],
    keywords: ['zeige', 'suche', 'finde', 'liste', 'wo ist', 'alle'],
    confidence_boost: 0.2,
  },

  CREATE_ENTITY: {
    patterns: [
      /erstelle?\s+(ein|eine|einen)\s+(.+)/i,
      /neue[snr]?\s+(.+)\s+(erstellen|anlegen)/i,
      /lege?\s+(ein|eine|einen)\s+(.+)\s+an/i,
      /mach[e]?\s+(ein|eine|einen)\s+(.+)/i,
    ],
    keywords: ['erstelle', 'neue', 'anlegen', 'erstellen', 'mache'],
    confidence_boost: 0.25,
  },

  UPDATE_ENTITY: {
    patterns: [
      /(ändere|aktualisiere|bearbeite)\s+(.+)/i,
      /setze\s+(.+)\s+(auf|zu)\s+(.+)/i,
      /markiere\s+(.+)\s+(als|auf)\s+(.+)/i,
      /status\s+(.+)\s+(auf|zu)\s+(.+)/i,
    ],
    keywords: ['ändere', 'aktualisiere', 'bearbeite', 'setze', 'markiere', 'status'],
    confidence_boost: 0.2,
  },

  REPORT_REQUEST: {
    patterns: [
      /(bericht|report|auswertung)\s+(über|von|für)\s+(.+)/i,
      /wie\s+(ist|war|steht)\s+(.+)/i,
      /(statistik|übersicht)\s+(von|über|für)\s+(.+)/i,
      /zeige\s+(auslastung|umsatz|gewinn|kosten)/i,
    ],
    keywords: ['bericht', 'report', 'auswertung', 'wie ist', 'statistik', 'übersicht', 'auslastung'],
    confidence_boost: 0.18,
  },

  CALCULATION_REQUEST: {
    patterns: [
      /(berechne|rechne)\s+(.+)/i,
      /was\s+kostet\s+(.+)/i,
      /(kosten|preis|betrag)\s+(für|von)\s+(.+)/i,
      /kalkulation\s+(für|von)\s+(.+)/i,
    ],
    keywords: ['berechne', 'rechne', 'kostet', 'kosten', 'preis', 'kalkulation'],
    confidence_boost: 0.22,
  },

  SCHEDULE_TASK: {
    patterns: [
      /(plane|terminiere|vereinbare)\s+(.+)/i,
      /termin\s+(mit|für|bei)\s+(.+)/i,
      /(erinnerung|reminder)\s+(für|an)\s+(.+)/i,
      /wann\s+(ist|soll)\s+(.+)/i,
    ],
    keywords: ['plane', 'termin', 'vereinbare', 'erinnerung', 'terminiere', 'wann'],
    confidence_boost: 0.2,
  },

  EXPORT_REQUEST: {
    patterns: [
      /(exportiere|export)\s+(.+)/i,
      /(datev|csv|pdf)\s+(export|ausgabe)/i,
      /erstelle\s+(datev|csv|pdf)/i,
      /ausgabe\s+(als|in)\s+(csv|pdf|datev)/i,
    ],
    keywords: ['exportiere', 'export', 'datev', 'csv', 'pdf', 'ausgabe'],
    confidence_boost: 0.25,
  },

  COMPLIANCE_CHECK: {
    patterns: [
      /(prüfe|check|validiere)\s+(.+)/i,
      /(gobd|compliance|konform)\s+(check|prüfung)/i,
      /ist\s+(.+)\s+(konform|korrekt|gültig)/i,
      /(fehler|probleme)\s+(in|bei)\s+(.+)/i,
    ],
    keywords: ['prüfe', 'check', 'gobd', 'compliance', 'konform', 'validiere'],
    confidence_boost: 0.2,
  },

  HELP_REQUEST: {
    patterns: [
      /(hilfe|help|wie)\s+(.+)/i,
      /erkläre\s+(.+)/i,
      /was\s+(ist|macht)\s+(.+)/i,
      /anleitung\s+(für|zu)\s+(.+)/i,
    ],
    keywords: ['hilfe', 'help', 'wie', 'erkläre', 'was ist', 'anleitung'],
    confidence_boost: 0.15,
  }
};

// German entity recognition patterns
const ENTITY_PATTERNS = {
  customer: ['kunde', 'kunden', 'auftraggeber', 'mandant'],
  invoice: ['rechnung', 'rechnungen', 'faktura', 'invoice'],
  quote: ['angebot', 'angebote', 'kostenvoranschlag', 'offerte'],
  order: ['auftrag', 'aufträge', 'bestellung', 'order'],
  project: ['projekt', 'projekte', 'baustelle', 'vorhaben'],
  material: ['material', 'materialien', 'waren', 'artikel'],
  employee: ['mitarbeiter', 'angestellte', 'kollege', 'personal'],
  timesheet: ['zeiterfassung', 'stunden', 'arbeitszeit', 'timesheet'],
  expense: ['ausgabe', 'ausgaben', 'kosten', 'spesen'],
};

// Zod schemas
const IntentAnalysisSchema = z.object({
  user_input: z.string().min(1),
  detected_intent: z.enum(['SEARCH_REQUEST', 'CREATE_ENTITY', 'UPDATE_ENTITY', 'REPORT_REQUEST', 'CALCULATION_REQUEST', 'SCHEDULE_TASK', 'COMPLIANCE_CHECK', 'EXPORT_REQUEST', 'NOTIFICATION_SETUP', 'HELP_REQUEST', 'UNKNOWN']),
  target_entity: z.enum(['customer', 'invoice', 'quote', 'order', 'project', 'material', 'employee', 'timesheet', 'expense', 'report', 'notification']).optional(),
  suggested_action: z.enum(['CREATE', 'READ', 'UPDATE', 'DELETE', 'SEARCH', 'EXPORT', 'CALCULATE', 'SCHEDULE', 'NOTIFY', 'VALIDATE']).optional(),
  extracted_parameters: z.record(z.any()).default({}),
  confidence_score: z.number().min(0).max(1),
});

export class AIIntentService {

  /**
   * Analyze user input to detect intent and extract parameters
   */
  static async analyzeIntent(userInput: string): Promise<IntentAnalysis> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();

      // Detect intent using pattern matching
      const intentDetection = this.detectIntent(userInput);
      
      // Extract entity mentions
      const entityMentions = this.extractEntities(userInput);
      
      // Extract parameters (dates, amounts, names, etc.)
      const parameters = this.extractParameters(userInput);

      // Generate natural language explanation
      const explanation = this.generateIntentExplanation(
        intentDetection.intent,
        entityMentions.entities,
        parameters,
        userInput
      );

      // Generate suggested follow-up queries
      const suggestedQueries = this.generateSuggestedQueries(
        intentDetection.intent,
        entityMentions.primaryEntity,
        parameters
      );

      const analysisData = {
        user_input: userInput,
        detected_intent: intentDetection.intent,
        confidence_score: intentDetection.confidence,
        target_entity: entityMentions.primaryEntity,
        suggested_action: this.mapIntentToAction(intentDetection.intent),
        extracted_parameters: parameters,
        natural_language_explanation: explanation,
        suggested_queries: suggestedQueries,
        requires_confirmation: this.requiresConfirmation(intentDetection.intent, parameters),
        user_id: currentUser.id,
      };

      // Save intent analysis
      const query = supabase
        .from('ai_intent_analyses')
        .insert(analysisData)
        .select()
        .single();

      const analysis = await createQuery<IntentAnalysis>(query).executeSingle();

      // Create audit log
      await auditLogService.createAuditLog({
        entity_type: 'document',
        entity_id: analysis.id,
        action: 'CREATE',
        new_values: {
          user_input: userInput,
          detected_intent: intentDetection.intent,
          confidence_score: intentDetection.confidence,
        },
        reason: 'AI Intent-Analyse durchgeführt',
        is_automated: true,
      });

      // Emit event
      eventBus.emit('INTENT_ANALYZED', {
        intent_id: analysis.id,
        intent: intentDetection.intent,
        confidence: intentDetection.confidence,
        user_id: currentUser.id,
      });

      return analysis;
    }, 'Analyze user intent');
  }

  /**
   * Execute an action based on detected intent
   */
  static async executeIntent(
    intentId: string,
    userConfirmation: boolean = false
  ): Promise<IntentAction> {
    return apiCall(async () => {
      // Get intent analysis
      const intentQuery = supabase
        .from('ai_intent_analyses')
        .select('*')
        .eq('id', intentId)
        .single();

      const intent = await createQuery<IntentAnalysis>(intentQuery).executeSingle();

      // Check if confirmation is required
      if (intent.requires_confirmation && !userConfirmation) {
        throw new ApiError(
          'Benutzerbestätigung erforderlich',
          API_ERROR_CODES.FORBIDDEN,
          'Diese Aktion erfordert eine explizite Bestätigung des Benutzers.'
        );
      }

      // Create intent action
      const actionData = {
        intent_id: intentId,
        action_type: intent.suggested_action || 'READ',
        target_entity: intent.target_entity || 'customer',
        parameters: intent.extracted_parameters,
        status: 'PENDING' as const,
        user_confirmation_required: intent.requires_confirmation,
      };

      const actionQuery = supabase
        .from('ai_intent_actions')
        .insert(actionData)
        .select()
        .single();

      let action = await createQuery<IntentAction>(actionQuery).executeSingle();

      // Execute the action
      try {
        action = await this.performAction(action);
      } catch (error) {
        // Update action with error
        await supabase
          .from('ai_intent_actions')
          .update({
            status: 'FAILED',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', action.id);
      }

      return action;
    }, 'Execute intent action');
  }

  /**
   * Get conversational context for user session
   */
  static async getConversationalContext(
    sessionId: string
  ): Promise<ConversationalContext | null> {
    return apiCall(async () => {
      const query = supabase
        .from('ai_conversational_contexts')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      try {
        return await createQuery<ConversationalContext>(query).executeSingle();
      } catch (error) {
        return null; // Context doesn't exist yet
      }
    }, 'Get conversational context');
  }

  /**
   * Update conversational context with new interaction
   */
  static async updateConversationalContext(
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    intentDetected?: IntentCategory,
    actionsTaken: string[] = []
  ): Promise<ConversationalContext> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      const existingContext = await this.getConversationalContext(sessionId);

      const newInteraction = {
        timestamp: new Date().toISOString(),
        user_message: userMessage,
        ai_response: aiResponse,
        intent_detected: intentDetected,
        actions_taken: actionsTaken,
      };

      if (existingContext) {
        // Update existing context
        const updatedHistory = [...existingContext.conversation_history, newInteraction];

        const updateQuery = supabase
          .from('ai_conversational_contexts')
          .update({
            conversation_history: updatedHistory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingContext.id)
          .select()
          .single();

        return await createQuery<ConversationalContext>(updateQuery).executeSingle();
      } else {
        // Create new context
        const contextData = {
          session_id: sessionId,
          conversation_history: [newInteraction],
          user_preferences: {},
          user_id: currentUser.id,
        };

        const createQuery = supabase
          .from('ai_conversational_contexts')
          .insert(contextData)
          .select()
          .single();

        return await createQuery<ConversationalContext>(createQuery).executeSingle();
      }
    }, 'Update conversational context');
  }

  /**
   * Generate intelligent suggestions based on current context
   */
  static async generateContextualSuggestions(
    sessionId: string,
    currentEntityType?: EntityType,
    currentEntityId?: string
  ): Promise<{
    suggested_actions: Array<{ text: string; intent: IntentCategory; confidence: number }>;
    relevant_information: string[];
    next_steps: string[];
  }> {
    return apiCall(async () => {
      const context = await this.getConversationalContext(sessionId);
      
      const suggestions = this.generateActionSuggestions(
        context,
        currentEntityType,
        currentEntityId
      );

      const relevantInfo = this.gatherRelevantInformation(
        currentEntityType,
        currentEntityId
      );

      const nextSteps = this.generateNextSteps(
        context,
        currentEntityType
      );

      return {
        suggested_actions: suggestions,
        relevant_information: await relevantInfo,
        next_steps: nextSteps,
      };
    }, 'Generate contextual suggestions');
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private static detectIntent(userInput: string): { intent: IntentCategory; confidence: number } {
    const input = userInput.toLowerCase();
    let bestMatch: { intent: IntentCategory; confidence: number } = {
      intent: 'UNKNOWN',
      confidence: 0,
    };

    Object.entries(GERMAN_INTENT_PATTERNS).forEach(([intentName, config]) => {
      let confidence = 0;

      // Check pattern matches
      const patternMatches = config.patterns.filter(pattern => pattern.test(input)).length;
      confidence += (patternMatches / config.patterns.length) * 0.6;

      // Check keyword matches
      const keywordMatches = config.keywords.filter(keyword => input.includes(keyword)).length;
      confidence += (keywordMatches / config.keywords.length) * 0.4;

      // Apply confidence boost
      if (confidence > 0) {
        confidence += config.confidence_boost;
      }

      confidence = Math.min(1, confidence); // Cap at 1.0

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent: intentName as IntentCategory,
          confidence,
        };
      }
    });

    return bestMatch;
  }

  private static extractEntities(userInput: string): {
    entities: EntityType[];
    primaryEntity?: EntityType;
  } {
    const input = userInput.toLowerCase();
    const foundEntities: EntityType[] = [];

    Object.entries(ENTITY_PATTERNS).forEach(([entityType, patterns]) => {
      if (patterns.some(pattern => input.includes(pattern))) {
        foundEntities.push(entityType as EntityType);
      }
    });

    return {
      entities: foundEntities,
      primaryEntity: foundEntities[0], // First found entity as primary
    };
  }

  private static extractParameters(userInput: string): Record<string, any> {
    const parameters: Record<string, any> = {};

    // Extract currency amounts
    const amounts = userInput.match(/€\s*(\d+(?:[.,]\d{2})?)/g);
    if (amounts) {
      parameters.amounts = amounts.map(amount => 
        parseFloat(amount.replace('€', '').replace(',', '.').trim())
      );
    }

    // Extract dates
    const dates = userInput.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/g);
    if (dates) {
      parameters.dates = dates;
    }

    // Extract customer/company names (simple heuristic)
    const nameMatches = userInput.match(/\b([A-Z][a-z]+ [A-Z][a-z]+|[A-Z][a-z]+ GmbH|[A-Z][a-z]+ AG)\b/g);
    if (nameMatches) {
      parameters.names = nameMatches;
    }

    // Extract numbers (IDs, quantities)
    const numbers = userInput.match(/\b\d+\b/g);
    if (numbers) {
      parameters.numbers = numbers.map(n => parseInt(n));
    }

    // Extract status keywords
    const statusKeywords = ['offen', 'bezahlt', 'überfällig', 'storniert', 'abgeschlossen', 'in bearbeitung'];
    const foundStatus = statusKeywords.filter(status => 
      userInput.toLowerCase().includes(status)
    );
    if (foundStatus.length > 0) {
      parameters.status = foundStatus;
    }

    return parameters;
  }

  private static mapIntentToAction(intent: IntentCategory): ActionType {
    const mapping = {
      SEARCH_REQUEST: 'SEARCH',
      CREATE_ENTITY: 'CREATE',
      UPDATE_ENTITY: 'UPDATE',
      REPORT_REQUEST: 'READ',
      CALCULATION_REQUEST: 'CALCULATE',
      SCHEDULE_TASK: 'SCHEDULE',
      COMPLIANCE_CHECK: 'VALIDATE',
      EXPORT_REQUEST: 'EXPORT',
      NOTIFICATION_SETUP: 'NOTIFY',
      HELP_REQUEST: 'READ',
      UNKNOWN: 'READ',
    } as const;

    return mapping[intent];
  }

  private static generateIntentExplanation(
    intent: IntentCategory,
    entities: EntityType[],
    parameters: Record<string, any>,
    originalInput: string
  ): string {
    const intentDescriptions = {
      SEARCH_REQUEST: 'Der Benutzer möchte nach Informationen suchen',
      CREATE_ENTITY: 'Der Benutzer möchte ein neues Element erstellen',
      UPDATE_ENTITY: 'Der Benutzer möchte bestehende Daten aktualisieren',
      REPORT_REQUEST: 'Der Benutzer möchte einen Bericht oder eine Auswertung',
      CALCULATION_REQUEST: 'Der Benutzer möchte eine Berechnung durchführen',
      SCHEDULE_TASK: 'Der Benutzer möchte einen Termin oder Task planen',
      COMPLIANCE_CHECK: 'Der Benutzer möchte eine Compliance-Prüfung durchführen',
      EXPORT_REQUEST: 'Der Benutzer möchte Daten exportieren',
      NOTIFICATION_SETUP: 'Der Benutzer möchte Benachrichtigungen einrichten',
      HELP_REQUEST: 'Der Benutzer benötigt Hilfe oder Informationen',
      UNKNOWN: 'Die Absicht konnte nicht eindeutig erkannt werden',
    };

    let explanation = intentDescriptions[intent];

    if (entities.length > 0) {
      explanation += ` bezogen auf: ${entities.join(', ')}`;
    }

    if (Object.keys(parameters).length > 0) {
      explanation += `. Erkannte Parameter: ${Object.keys(parameters).join(', ')}`;
    }

    return explanation;
  }

  private static generateSuggestedQueries(
    intent: IntentCategory,
    entity?: EntityType,
    parameters: Record<string, any> = {}
  ): string[] {
    const suggestions: string[] = [];

    switch (intent) {
      case 'SEARCH_REQUEST':
        suggestions.push(
          `Zeige alle ${entity || 'Dokumente'} der letzten 30 Tage`,
          `Suche nach ${entity || 'Einträgen'} mit Status "offen"`,
          `Finde alle ${entity || 'Datensätze'} über €1000`
        );
        break;

      case 'CREATE_ENTITY':
        suggestions.push(
          `Erstelle eine neue ${entity || 'Rechnung'}`,
          `Lege einen neuen ${entity || 'Kunden'} an`,
          `Mache ein neues ${entity || 'Projekt'}`
        );
        break;

      case 'REPORT_REQUEST':
        suggestions.push(
          'Zeige Umsatzstatistik dieses Monats',
          'Wie ist die Projektauslastung?',
          'Bericht über offene Rechnungen'
        );
        break;

      case 'CALCULATION_REQUEST':
        suggestions.push(
          'Berechne Materialkosten für aktuelles Projekt',
          'Was kostet die Arbeitszeit diese Woche?',
          'Kalkulation für neues Angebot'
        );
        break;

      default:
        suggestions.push(
          'Zeige mir die neuesten Aktivitäten',
          'Was steht heute an?',
          'Übersicht über offene Aufgaben'
        );
    }

    return suggestions;
  }

  private static requiresConfirmation(intent: IntentCategory, parameters: Record<string, any>): boolean {
    // Actions that modify data require confirmation
    const confirmationRequired = [
      'CREATE_ENTITY',
      'UPDATE_ENTITY',
      'EXPORT_REQUEST',
    ];

    if (confirmationRequired.includes(intent)) {
      return true;
    }

    // Large amounts require confirmation
    if (parameters.amounts && Math.max(...parameters.amounts) > 10000) {
      return true;
    }

    return false;
  }

  private static async performAction(action: IntentAction): Promise<IntentAction> {
    // Update status to executing
    await supabase
      .from('ai_intent_actions')
      .update({ status: 'EXECUTING' })
      .eq('id', action.id);

    let result: any = null;
    let status: 'COMPLETED' | 'FAILED' = 'COMPLETED';
    let errorMessage: string | undefined;

    try {
      switch (action.action_type) {
        case 'SEARCH':
          result = await this.performSearch(action);
          break;
        case 'CREATE':
          result = await this.performCreate(action);
          break;
        case 'UPDATE':
          result = await this.performUpdate(action);
          break;
        case 'EXPORT':
          result = await this.performExport(action);
          break;
        case 'CALCULATE':
          result = await this.performCalculation(action);
          break;
        default:
          result = { message: 'Action not yet implemented', action_type: action.action_type };
      }
    } catch (error) {
      status = 'FAILED';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    // Update action with result
    const updateData = {
      status,
      result,
      error_message: errorMessage,
      executed_at: new Date().toISOString(),
    };

    await supabase
      .from('ai_intent_actions')
      .update(updateData)
      .eq('id', action.id);

    return { ...action, ...updateData };
  }

  private static async performSearch(action: IntentAction): Promise<any> {
    // Use RAG service for search
    const searchQuery = {
      query: action.parameters.search_term || 'general search',
      document_types: action.target_entity ? [action.target_entity as any] : undefined,
      limit: 10,
    };

    const searchResult = await aiRAGService.searchDocuments(searchQuery);
    
    return {
      results_count: searchResult.results.length,
      documents: searchResult.results.map(r => ({
        title: r.document.title,
        relevance: r.similarity_score,
        content_preview: r.highlighted_content.substring(0, 100),
      })),
    };
  }

  private static async performCreate(action: IntentAction): Promise<any> {
    // This would integrate with the appropriate service to create entities
    return {
      message: `Would create ${action.target_entity}`,
      parameters: action.parameters,
      note: 'Create action simulation - would integrate with actual services',
    };
  }

  private static async performUpdate(action: IntentAction): Promise<any> {
    // This would integrate with the appropriate service to update entities
    return {
      message: `Would update ${action.target_entity}`,
      parameters: action.parameters,
      note: 'Update action simulation - would integrate with actual services',
    };
  }

  private static async performExport(action: IntentAction): Promise<any> {
    // This would integrate with export services (DATEV, CSV, etc.)
    return {
      message: `Would export ${action.target_entity} data`,
      export_type: action.parameters.format || 'CSV',
      note: 'Export action simulation - would integrate with DATEV service',
    };
  }

  private static async performCalculation(action: IntentAction): Promise<any> {
    // This would perform various business calculations
    return {
      message: `Would calculate for ${action.target_entity}`,
      calculation_type: action.parameters.calculation_type || 'general',
      note: 'Calculation action simulation - would integrate with KPI service',
    };
  }

  private static generateActionSuggestions(
    context?: ConversationalContext | null,
    currentEntityType?: EntityType,
    currentEntityId?: string
  ): Array<{ text: string; intent: IntentCategory; confidence: number }> {
    const suggestions = [];

    if (currentEntityType && currentEntityId) {
      suggestions.push(
        { text: `Zeige Details zu dieser ${currentEntityType}`, intent: 'SEARCH_REQUEST', confidence: 0.9 },
        { text: `Aktualisiere diese ${currentEntityType}`, intent: 'UPDATE_ENTITY', confidence: 0.8 },
        { text: `Erstelle Bericht für diese ${currentEntityType}`, intent: 'REPORT_REQUEST', confidence: 0.7 }
      );
    }

    // Add general suggestions
    suggestions.push(
      { text: 'Zeige offene Rechnungen', intent: 'SEARCH_REQUEST', confidence: 0.6 },
      { text: 'Erstelle neues Angebot', intent: 'CREATE_ENTITY', confidence: 0.6 },
      { text: 'Umsatzstatistik dieses Monats', intent: 'REPORT_REQUEST', confidence: 0.5 }
    );

    return suggestions;
  }

  private static async gatherRelevantInformation(
    currentEntityType?: EntityType,
    currentEntityId?: string
  ): Promise<string[]> {
    const info = [];

    if (currentEntityType && currentEntityId) {
      info.push(`Aktuelle Entität: ${currentEntityType} (${currentEntityId})`);
    }

    // Add contextual information
    info.push(
      'Heute: ' + new Date().toLocaleDateString('de-DE'),
      'System: HandwerkOS AI Assistant',
      'Verfügbare Aktionen: Suchen, Erstellen, Aktualisieren, Berichte, Berechnungen'
    );

    return info;
  }

  private static generateNextSteps(
    context?: ConversationalContext | null,
    currentEntityType?: EntityType
  ): string[] {
    const steps = [];

    if (currentEntityType) {
      steps.push(
        `Weitere ${currentEntityType}-Operationen durchführen`,
        `Verwandte Dokumente suchen`,
        'Bericht oder Auswertung erstellen'
      );
    }

    steps.push(
      'Neue Suchanfrage stellen',
      'Dashboard aufrufen',
      'Hilfe für spezielle Funktionen anfordern'
    );

    return steps;
  }
}

export const aiIntentService = new AIIntentService();