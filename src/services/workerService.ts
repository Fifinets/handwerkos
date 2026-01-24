// Import services directly to avoid circular dependencies
// import { projectKPIService } from './projectKPIService';
// import { notificationService } from './notificationService';  
// import { financeService } from './financeService';
import { supabase } from '@/integrations/supabase/client';
import { apiCall, createQuery } from './common';
import { eventBus } from './eventBus';

export interface WorkerJob {
  name: string;
  lastRun: Date | null;
  nextRun: Date;
  interval: number; // minutes
  enabled: boolean;
  description: string;
}

export class WorkerService {
  private static jobs: WorkerJob[] = [
    {
      name: 'budget_monitor',
      lastRun: null,
      nextRun: new Date(),
      interval: 60, // Every hour
      enabled: true,
      description: 'Monitor project budgets for 90% utilization threshold',
    },
    {
      name: 'overdue_invoices',
      lastRun: null,
      nextRun: new Date(),
      interval: 1440, // Daily (24 hours)
      enabled: true,
      description: 'Check for overdue invoices and update status',
    },
    {
      name: 'notification_cleanup',
      lastRun: null,
      nextRun: new Date(),
      interval: 1440, // Daily
      enabled: true,
      description: 'Clean up expired notifications',
    },
  ];

  /**
   * Start the worker service
   */
  static startWorkers(): void {
    console.log('🔄 Starting HandwerkOS Worker Service...');
    
    this.jobs.forEach(job => {
      if (job.enabled) {
        this.scheduleJob(job);
      }
    });
  }

  /**
   * Schedule a job to run at intervals
   */
  private static scheduleJob(job: WorkerJob): void {
    const runJob = async () => {
      try {
        console.log(`🔄 Running worker job: ${job.name}`);
        job.lastRun = new Date();

        switch (job.name) {
          case 'budget_monitor':
            await this.runBudgetMonitor();
            break;
          case 'overdue_invoices':
            await this.runOverdueInvoicesCheck();
            break;
          case 'notification_cleanup':
            await this.runNotificationCleanup();
            break;
          default:
            console.warn(`Unknown worker job: ${job.name}`);
        }

        // Schedule next run
        job.nextRun = new Date(Date.now() + job.interval * 60 * 1000);
        console.log(`✅ Worker job ${job.name} completed. Next run: ${job.nextRun.toISOString()}`);

      } catch (error) {
        console.error(`❌ Worker job ${job.name} failed:`, error);
        // Still schedule next run even if this one failed
        job.nextRun = new Date(Date.now() + job.interval * 60 * 1000);
      }
    };

    // Run immediately if it's the first time
    runJob();

    // Schedule recurring execution
    setInterval(runJob, job.interval * 60 * 1000);
  }

  /**
   * Budget Monitor Worker
   * Checks for projects with ≥90% budget utilization
   * Emits BUDGET_90_REACHED event and creates notifications
   */
  private static async runBudgetMonitor(): Promise<void> {
    return apiCall(async () => {
      console.log('🔍 Checking project budgets...');

      // Get all critical budget projects (≥90% utilization)
      // TODO: Re-enable after fixing circular dependency
      const criticalProjects = []; // await projectKPIService.getCriticalBudgetProjects();

      for (const projectKPI of criticalProjects) {
        // Get all managers/admins who should be notified
        const managersQuery = supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name')
          .or('is_admin.eq.true,is_project_manager.eq.true');

        const managers = await createQuery(managersQuery).execute();

        // Create notifications for each manager
        for (const manager of managers) {
          try {
            // TODO: Re-enable after fixing circular dependency
            // await notificationService.createBudgetWarningNotification(
            //   manager.id,
            //   projectKPI.project_id,
            //   projectKPI.project_name,
            //   projectKPI.utilization_percentage
            // );
          } catch (error) {
            console.error(`Failed to create budget notification for manager ${manager.id}:`, error);
          }
        }

        // Emit event for real-time handling
        eventBus.emit('BUDGET_90_REACHED', {
          project_id: projectKPI.project_id,
          project_name: projectKPI.project_name,
          utilization_percentage: projectKPI.utilization_percentage,
          budget: projectKPI.budget,
          actual_costs: projectKPI.actual_costs.total,
          status: projectKPI.status,
        });
      }

      console.log(`🔍 Budget monitor completed. Found ${criticalProjects.length} critical projects.`);
      
    }, 'Budget monitor worker');
  }

  /**
   * Overdue Invoices Worker  
   * Finds invoices with status 'sent' that are past due date
   * Updates status to 'overdue' and creates notifications
   */
  private static async runOverdueInvoicesCheck(): Promise<void> {
    return apiCall(async () => {
      console.log('📄 Checking for overdue invoices...');

      const today = new Date().toISOString().split('T')[0];

      // Find invoices that are sent and past their due date
      const overdueQuery = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          status,
          customer_id,
          customers (
            company_name,
            contact_person,
            email
          )
        `)
        .eq('status', 'sent')
        .lt('due_date', today);

      const overdueInvoices = await createQuery(overdueQuery).execute();

      let updatedCount = 0;

      for (const invoice of overdueInvoices) {
        try {
          // Update invoice status to 'overdue'
          await supabase
            .from('invoices')
            .update({ 
              status: 'overdue',
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.id);

          // Calculate days past due
          const dueDate = new Date(invoice.due_date);
          const today = new Date();
          const daysPastDue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Get all managers/admins to notify
          const managersQuery = supabase
            .from('user_profiles')
            .select('id, email, first_name, last_name')
            .or('is_admin.eq.true,is_project_manager.eq.true');

          const managers = await createQuery(managersQuery).execute();

          // Create notifications for each manager
          for (const manager of managers) {
            try {
              // TODO: Re-enable after fixing circular dependency
              // await notificationService.createOverdueInvoiceNotification(
              //   manager.id,
              //   invoice.id,
              //   invoice.invoice_number,
              //   invoice.customers?.company_name || 'Unbekannter Kunde',
              //   invoice.amount,
              //   daysPastDue
              // );
            } catch (error) {
              console.error(`Failed to create overdue notification for manager ${manager.id}:`, error);
            }
          }

          // Emit event for real-time handling
          eventBus.emit('INVOICE_OVERDUE', {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            customer_name: invoice.customers?.company_name || 'Unbekannter Kunde',
            amount: invoice.amount,
            due_date: invoice.due_date,
            days_past_due: daysPastDue,
          });

          updatedCount++;

        } catch (error) {
          console.error(`Failed to update overdue invoice ${invoice.id}:`, error);
        }
      }

      console.log(`📄 Overdue invoices check completed. Updated ${updatedCount} invoices.`);

    }, 'Overdue invoices worker');
  }

  /**
   * Notification Cleanup Worker
   * Removes expired notifications to keep the database clean
   */
  private static async runNotificationCleanup(): Promise<void> {
    return apiCall(async () => {
      console.log('🧹 Cleaning up expired notifications...');

      // TODO: Re-enable after fixing circular dependency
      // await notificationService.cleanupExpiredNotifications();

      // Also clean up very old read notifications (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await supabase
        .from('notifications')
        .delete()
        .eq('read', true)
        .eq('archived', true)
        .lt('created_at', thirtyDaysAgo.toISOString());

      console.log('🧹 Notification cleanup completed.');

    }, 'Notification cleanup worker');
  }

  /**
   * Get worker status and statistics
   */
  static getWorkerStatus(): WorkerJob[] {
    return this.jobs.map(job => ({
      ...job,
      // Create copies to avoid mutation
      lastRun: job.lastRun ? new Date(job.lastRun) : null,
      nextRun: new Date(job.nextRun),
    }));
  }

  /**
   * Enable or disable a specific worker job
   */
  static setJobStatus(jobName: string, enabled: boolean): void {
    const job = this.jobs.find(j => j.name === jobName);
    if (job) {
      job.enabled = enabled;
      console.log(`${enabled ? '✅ Enabled' : '❌ Disabled'} worker job: ${jobName}`);
      
      if (enabled) {
        this.scheduleJob(job);
      }
    } else {
      console.warn(`Unknown worker job: ${jobName}`);
    }
  }

  /**
   * Run a specific job immediately (for testing/debugging)
   */
  static async runJobNow(jobName: string): Promise<void> {
    console.log(`🚀 Manually triggering worker job: ${jobName}`);
    
    switch (jobName) {
      case 'budget_monitor':
        await this.runBudgetMonitor();
        break;
      case 'overdue_invoices':
        await this.runOverdueInvoicesCheck();
        break;
      case 'notification_cleanup':
        await this.runNotificationCleanup();
        break;
      default:
        throw new Error(`Unknown worker job: ${jobName}`);
    }
  }
}

export const workerService = new WorkerService();