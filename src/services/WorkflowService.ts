/**
 * WorkflowService - Zentrale Geschäftslogik für Workflow-Automatisierungen
 * 
 * Verwaltet den durchgängigen Geschäftsprozess:
 * Angebot → Auftrag → Projekt → Abrechnung
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface WorkflowStep {
  id: string;
  type: 'quote' | 'order' | 'project' | 'invoice';
  status: string;
  relatedId: string;
  data: any;
}

export interface WorkflowChain {
  quoteId?: string;
  orderId?: string;
  projectId?: string;
  invoiceId?: string;
  currentStep: 'quote' | 'order' | 'project' | 'invoice';
  customerId: string;
  metadata: {
    title: string;
    totalAmount?: number;
    createdAt: string;
    updatedAt: string;
  };
}

class WorkflowService {
  /**
   * Erstellt einen Auftrag aus einem Angebot
   */
  async createOrderFromQuote(quoteId: string): Promise<string | null> {
    try {
      console.log('🔄 Creating order from quote:', quoteId);

      // 1. Quote-Daten laden
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError || !quote) {
        throw new Error('Angebot nicht gefunden');
      }

      // 2. Auftrag erstellen
      const orderData = {
        order_number: `AUF-${Date.now().toString().slice(-6)}`,
        customer_id: quote.customer_id,
        title: quote.title || 'Auftrag aus Angebot',
        description: quote.description,
        order_date: new Date().toISOString().split('T')[0],
        due_date: quote.valid_until || null,
        status: 'confirmed',
        priority: 'medium',
        total_amount: quote.total_amount,
        currency: quote.currency || 'EUR',
        notes: `Automatisch erstellt aus Angebot ${quote.quote_number}`,
        workflow_origin_type: 'quote',
        workflow_origin_id: quoteId,
      };

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Quote-Status aktualisieren
      await supabase
        .from('quotes')
        .update({ 
          status: 'accepted',
          workflow_target_type: 'order',
          workflow_target_id: newOrder.id 
        })
        .eq('id', quoteId);

      // 4. Workflow-Chain erstellen/aktualisieren
      await this.createOrUpdateWorkflowChain({
        quoteId,
        orderId: newOrder.id,
        currentStep: 'order',
        customerId: quote.customer_id,
        metadata: {
          title: quote.title || 'Neuer Workflow',
          totalAmount: quote.total_amount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      });

      toast({
        title: "Auftrag erstellt",
        description: `Auftrag ${orderData.order_number} wurde erfolgreich aus dem Angebot erstellt.`
      });

      return newOrder.id;
    } catch (error) {
      console.error('❌ Error creating order from quote:', error);
      toast({
        title: "Fehler",
        description: "Auftrag konnte nicht erstellt werden: " + error.message,
        variant: "destructive"
      });
      return null;
    }
  }

  /**
   * Erstellt ein Projekt aus einem Auftrag
   */
  async createProjectFromOrder(orderId: string): Promise<string | null> {
    try {
      console.log('🔄 Creating project from order:', orderId);

      // 1. Order-Daten laden
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, customers(company_name)')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        throw new Error('Auftrag nicht gefunden');
      }

      // 2. Company ID für RLS holen
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) throw new Error('Benutzer nicht authentifiziert');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) throw new Error('Firma nicht gefunden');

      // 3. Projekt erstellen
      const projectData = {
        name: order.title,
        customer_id: order.customer_id,
        company_id: profile.company_id,
        status: 'geplant',
        start_date: new Date().toISOString().split('T')[0],
        end_date: order.due_date || null,
        location: null,
        budget: order.total_amount || 0,
        description: `Automatisch erstellt aus Auftrag ${order.order_number}. ${order.description || ''}`,
        workflow_origin_type: 'order',
        workflow_origin_id: orderId,
      };

      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();

      if (projectError) throw projectError;

      // 4. Order-Status aktualisieren
      await supabase
        .from('orders')
        .update({ 
          status: 'in_progress',
          workflow_target_type: 'project',
          workflow_target_id: newProject.id 
        })
        .eq('id', orderId);

      // 5. Workflow-Chain aktualisieren
      const existingChain = await this.getWorkflowChain(orderId, 'order');
      if (existingChain) {
        await this.createOrUpdateWorkflowChain({
          ...existingChain,
          projectId: newProject.id,
          currentStep: 'project',
        });
      }

      toast({
        title: "Projekt erstellt",
        description: `Projekt "${order.title}" wurde erfolgreich aus dem Auftrag erstellt.`
      });

      return newProject.id;
    } catch (error) {
      console.error('❌ Error creating project from order:', error);
      toast({
        title: "Fehler",
        description: "Projekt konnte nicht erstellt werden: " + error.message,
        variant: "destructive"
      });
      return null;
    }
  }

  /**
   * Erstellt eine Rechnung aus einem abgeschlossenen Projekt
   */
  async createInvoiceFromProject(projectId: string): Promise<string | null> {
    try {
      console.log('🔄 Creating invoice from project:', projectId);

      // 1. Projekt-Daten laden
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*, customers(company_name, address)')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new Error('Projekt nicht gefunden');
      }

      if (project.status !== 'abgeschlossen') {
        throw new Error('Rechnung kann nur für abgeschlossene Projekte erstellt werden');
      }

      // 2. Rechnung erstellen
      const invoiceData = {
        invoice_number: `RG-${Date.now().toString().slice(-6)}`,
        customer_id: project.customer_id,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 Tage
        status: 'draft',
        total_amount: project.budget || 0,
        currency: 'EUR',
        description: `Rechnung für Projekt: ${project.name}`,
        notes: `Automatisch erstellt aus Projekt ${project.name}`,
        workflow_origin_type: 'project',
        workflow_origin_id: projectId,
      };

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // 3. Projekt aktualisieren
      await supabase
        .from('projects')
        .update({ 
          workflow_target_type: 'invoice',
          workflow_target_id: newInvoice.id 
        })
        .eq('id', projectId);

      // 4. Workflow-Chain aktualisieren
      const existingChain = await this.getWorkflowChain(projectId, 'project');
      if (existingChain) {
        await this.createOrUpdateWorkflowChain({
          ...existingChain,
          invoiceId: newInvoice.id,
          currentStep: 'invoice',
        });
      }

      toast({
        title: "Rechnung erstellt",
        description: `Rechnungsentwurf ${invoiceData.invoice_number} wurde erfolgreich erstellt.`
      });

      return newInvoice.id;
    } catch (error) {
      console.error('❌ Error creating invoice from project:', error);
      toast({
        title: "Fehler",
        description: "Rechnung konnte nicht erstellt werden: " + error.message,
        variant: "destructive"
      });
      return null;
    }
  }

  /**
   * Überwacht Budgetwarnungen bei Projekten
   */
  async checkBudgetWarnings(): Promise<any[]> {
    try {
      // Projekte mit hoher Budget-Auslastung finden (90%+)
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .in('status', ['geplant', 'in_bearbeitung']);

      const warnings = [];
      
      for (const project of projects || []) {
        if (project.budget && project.budget > 0) {
          // Hier würde normalerweise die tatsächlichen Ausgaben berechnet
          // Für Demo verwenden wir eine simulierte Budget-Auslastung
          const mockUsedBudget = project.budget * 0.95; // 95% simuliert
          const usagePercentage = (mockUsedBudget / project.budget) * 100;

          if (usagePercentage >= 90) {
            warnings.push({
              projectId: project.id,
              projectName: project.name,
              budget: project.budget,
              usedBudget: mockUsedBudget,
              usagePercentage,
              type: 'budget_warning'
            });
          }
        }
      }

      return warnings;
    } catch (error) {
      console.error('❌ Error checking budget warnings:', error);
      return [];
    }
  }

  /**
   * Erstellt oder aktualisiert eine Workflow-Kette
   */
  private async createOrUpdateWorkflowChain(chain: WorkflowChain): Promise<void> {
    try {
      const chainData = {
        quote_id: chain.quoteId || null,
        order_id: chain.orderId || null,
        project_id: chain.projectId || null,
        invoice_id: chain.invoiceId || null,
        current_step: chain.currentStep,
        customer_id: chain.customerId,
        metadata: chain.metadata,
        updated_at: new Date().toISOString(),
      };

      // Prüfen ob Chain bereits existiert
      const existingChainQuery = supabase
        .from('workflow_chains')
        .select('id');
      
      if (chain.quoteId) existingChainQuery.eq('quote_id', chain.quoteId);
      else if (chain.orderId) existingChainQuery.eq('order_id', chain.orderId);
      else if (chain.projectId) existingChainQuery.eq('project_id', chain.projectId);

      const { data: existing } = await existingChainQuery.single();

      if (existing) {
        // Aktualisieren
        await supabase
          .from('workflow_chains')
          .update(chainData)
          .eq('id', existing.id);
      } else {
        // Neu erstellen
        await supabase
          .from('workflow_chains')
          .insert({
            ...chainData,
            created_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error('❌ Error managing workflow chain:', error);
    }
  }

  /**
   * Lädt eine Workflow-Kette
   */
  private async getWorkflowChain(id: string, type: 'quote' | 'order' | 'project'): Promise<WorkflowChain | null> {
    try {
      const column = `${type}_id`;
      const { data } = await supabase
        .from('workflow_chains')
        .select('*')
        .eq(column, id)
        .single();

      if (!data) return null;

      return {
        quoteId: data.quote_id,
        orderId: data.order_id,
        projectId: data.project_id,
        invoiceId: data.invoice_id,
        currentStep: data.current_step,
        customerId: data.customer_id,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error('❌ Error getting workflow chain:', error);
      return null;
    }
  }

  /**
   * Holt alle kritischen Dashboard-Daten
   */
  async getDashboardCriticalData(): Promise<{
    overdueTasks: any[];
    budgetWarnings: any[];
    pendingQuotes: any[];
    delayedProjects: any[];
    overdueInvoices: any[];
  }> {
    try {
      const [budgetWarnings, pendingQuotes, delayedProjects, overdueInvoices] = await Promise.all([
        this.checkBudgetWarnings(),
        this.getPendingQuotes(),
        this.getDelayedProjects(),
        this.getOverdueInvoices(),
      ]);

      return {
        overdueTasks: [...budgetWarnings, ...delayedProjects],
        budgetWarnings,
        pendingQuotes,
        delayedProjects,
        overdueInvoices,
      };
    } catch (error) {
      console.error('❌ Error getting dashboard critical data:', error);
      return {
        overdueTasks: [],
        budgetWarnings: [],
        pendingQuotes: [],
        delayedProjects: [],
        overdueInvoices: [],
      };
    }
  }

  private async getPendingQuotes(): Promise<any[]> {
    const { data } = await supabase
      .from('quotes')
      .select('*, customers(company_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    return data || [];
  }

  private async getDelayedProjects(): Promise<any[]> {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .in('status', ['geplant', 'in_bearbeitung'])
      .lt('end_date', new Date().toISOString().split('T')[0]);
    
    return data || [];
  }

  private async getOverdueInvoices(): Promise<any[]> {
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(company_name)')
      .eq('status', 'sent')
      .lt('due_date', new Date().toISOString().split('T')[0]);
    
    return data || [];
  }
}

export const workflowService = new WorkflowService();