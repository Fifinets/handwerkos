import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ProjectDashboardData,
  ProjectPermissions,
  getProjectPermissions,
  PROJECT_STATUS_CONFIG,
  WORKFLOW_STAGES,
  UserRole,
  ProjectStatus
} from "@/types/project";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import TimeEntryForm from "./TimeEntryForm";
import MaterialEntryForm from "./MaterialEntryForm";
import InvoiceDetailDialog from "./InvoiceDetailDialog";
import CreateInvoiceFromProjectDialog from "./CreateInvoiceFromProjectDialog";
import { WorkflowStatusDialog } from './WorkflowStatusDialog';
import { SiteDocModule } from '@/components/site-docs/SiteDocModule';
import { OverviewTab, DetailsTab, TimeTab, MaterialsTab, DocumentsTab, CommentsTab } from './project-detail';
import { formatCurrency, getStatusConfig, generateShortId } from './project-detail/utils';

interface ProjectDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ isOpen, onClose, projectId }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<ProjectPermissions>({
    can_view: false,
    can_edit_basic_data: false,
    can_add_time: false,
    can_add_materials: false,
    can_upload_files: false,
    can_change_status: false,
    can_link_invoices: false,
    can_delete: false,
    can_manage_team: false,
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [isTimeFormOpen, setIsTimeFormOpen] = useState(false);
  const [isMaterialFormOpen, setIsMaterialFormOpen] = useState(false);
  const [isAddTeamMemberOpen, setIsAddTeamMemberOpen] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isLinkOfferOpen, setIsLinkOfferOpen] = useState(false);
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);

  // NEW STATE
  const [projectOffers, setProjectOffers] = useState<any[]>([]);
  const [projectInvoices, setProjectInvoices] = useState<any[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<{id:string; title:string; is_completed:boolean; due_date?:string; priority?:string}[]>([]);
  const [photos, setPhotos] = useState<{id:string; file_url?:string; file_path?:string}[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [plannedHours, setPlannedHours] = useState(0);
  const [teamAssignments, setTeamAssignments] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([]);
  const [deliveryNoteMaterials, setDeliveryNoteMaterials] = useState<any[]>([]);

  // Customer projects modal
  const [isCustomerProjectsOpen, setIsCustomerProjectsOpen] = useState(false);
  const [customerProjects, setCustomerProjects] = useState<any[]>([]);
  const [loadingCustomerProjects, setLoadingCustomerProjects] = useState(false);

  // Invoice detail dialog
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);

  // Create invoice from project dialog
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);

  // Workflow status dialog
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [workflowTargetStatus, setWorkflowTargetStatus] = useState<ProjectStatus | undefined>();
  const [workflowEditMode, setWorkflowEditMode] = useState<'besichtigung' | 'in_bearbeitung' | undefined>();
  const [allEmployees, setAllEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);

  // Internal project ID tracking (allows switching projects within the dialog)
  const [currentProjectId, setCurrentProjectId] = useState(projectId);

  // Sync with prop when it changes
  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (isOpen && currentProjectId) {
      fetchProjectData(currentProjectId);
    }
  }, [isOpen, currentProjectId]);

  const fetchProjectData = async (fetchId?: string) => {
    const targetId = fetchId || currentProjectId;
    setLoading(true);
    try {
      // Get current user and their role
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        toast({
          title: "Fehler",
          description: "Benutzer nicht authentifiziert",
          variant: "destructive"
        });
        return;
      }

      // Get user profile and role
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) {
        toast({
          title: "Fehler",
          description: "Benutzer-Unternehmen nicht gefunden",
          variant: "destructive"
        });
        return;
      }

      // Fetch basic project data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', targetId)
        .eq('company_id', profile.company_id)
        .single();

      if (projectError || !projectData) {
        toast({
          title: "Fehler",
          description: "Projekt nicht gefunden",
          variant: "destructive"
        });
        return;
      }

      // Fetch all employees for workflow dialog
      const { data: empData } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', profile.company_id)
        .not('status', 'in', '("Inaktiv","Gekündigt")');
      if (empData) setAllEmployees(empData);

      // Get customer data
      let customerData = null;
      if (projectData.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', projectData.customer_id)
          .single();
        customerData = customer;
      }

      // ====== NEW: CALCULATE DATA FROM TABLES ======

      // 1. TIME ENTRIES: Calculate total hours from time_entries
      const { data: timeEntriesData, error: timeError } = await supabase
        .from('time_entries')
        .select('id, employee_id, start_time, end_time, break_duration, description, status')
        .eq('project_id', targetId)
        .order('start_time', { ascending: false });

      let calculatedTotalHours = 0;
      if (!timeError && timeEntriesData && timeEntriesData.length > 0) {
        calculatedTotalHours = timeEntriesData.reduce((sum, entry) => {
          if (entry.start_time && entry.end_time) {
            const start = new Date(entry.start_time).getTime();
            const end = new Date(entry.end_time).getTime();
            const breakMs = (entry.break_duration || 0) * 60 * 1000;
            const workedMs = end - start - breakMs;
            const hours = workedMs / (1000 * 60 * 60);
            return sum + Math.max(0, hours);
          }
          return sum;
        }, 0);
      }
      setTotalHours(calculatedTotalHours);

      // Enrich time entries with employee names
      let totalLaborCost = 0;
      if (timeEntriesData && timeEntriesData.length > 0) {
        const empIds = [...new Set(timeEntriesData.map(e => e.employee_id).filter(Boolean))];
        let empMap: Record<string, string> = {};
        let hourlyRateMap: Record<string, number> = {};
        if (empIds.length > 0) {
          const { data: empData } = await supabase
            .from('employees')
            .select('id, first_name, last_name, hourly_wage')
            .in('id', empIds);
          (empData || []).forEach(e => {
            empMap[e.id] = `${e.first_name || ''} ${e.last_name || ''}`.trim();
            if (e.hourly_wage) hourlyRateMap[e.id] = e.hourly_wage;
          });
        }
        setTimeEntries(timeEntriesData.map(entry => {
          const hours = entry.start_time && entry.end_time
            ? Math.max(0, (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime() - (entry.break_duration || 0) * 60 * 1000) / (1000 * 60 * 60))
            : 0;
          totalLaborCost += hours * (hourlyRateMap[entry.employee_id] || 0);
          return {
            ...entry,
            employee_name: empMap[entry.employee_id] || 'Unbekannt',
            hours,
          };
        }));
      } else {
        setTimeEntries([]);
      }

      // 2. TEAM ASSIGNMENTS: Get from project_team_assignments (not project_team_members)
      let teamMembersProcessed = [];
      try {
        const { data: teamAssignmentsData, error: teamError } = await supabase
          .from('project_team_assignments')
          .select('id, employee_id')
          .eq('project_id', targetId);

        if (!teamError && teamAssignmentsData && teamAssignmentsData.length > 0) {
          const employeeIds = teamAssignmentsData.map((ta: any) => ta.employee_id);
          const { data: employeeDetails } = await supabase
            .from('employees')
            .select('id, first_name, last_name, email')
            .in('id', employeeIds);

          if (employeeDetails) {
            // Get time entries for this project to calculate per-employee hours
            const { data: projectTimeEntries } = await supabase
              .from('time_entries')
              .select('employee_id, start_time, end_time, break_duration')
              .eq('project_id', targetId);

            teamMembersProcessed = teamAssignmentsData.map((ta: any) => {
              const emp = employeeDetails.find(e => e.id === ta.employee_id);
              // Calculate hours for this employee on this project
              const empHours = (projectTimeEntries || [])
                .filter(te => te.employee_id === ta.employee_id)
                .reduce((sum, te) => {
                  if (te.start_time && te.end_time) {
                    const start = new Date(te.start_time).getTime();
                    const end = new Date(te.end_time).getTime();
                    const breakMs = (te.break_duration || 0) * 60 * 1000;
                    return sum + Math.max(0, (end - start - breakMs) / (1000 * 60 * 60));
                  }
                  return sum;
                }, 0);

              return {
                id: ta.employee_id,
                name: `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim(),
                role: 'team_member',
                email: emp?.email || '',
                hours_this_week: Math.round(empHours * 10) / 10
              };
            }).filter((tm: any) => tm.name);
          }
        }
      } catch (_error) {
        // intentional
      }
      setTeamAssignments(teamMembersProcessed);

      // 3. MATERIALS: Get from project_materials and sum total_price
      let totalMaterialCost = 0;
      try {
        const { data: materialsData, error: materialError } = await supabase
          .from('project_materials')
          .select('total_price')
          .eq('project_id', targetId);

        if (!materialError && materialsData && materialsData.length > 0) {
          totalMaterialCost = materialsData.reduce((sum, entry) => sum + (entry.total_price || 0), 0);
        }
      } catch (_error) {
        // intentional
      }

      // 4. OFFERS: Get offers where project_id = projectId and sum gross_total
      let processedOffers = [];
      try {
        const { data: offersData, error: offersError } = await supabase
          .from('offers')
          .select('id, snapshot_gross_total, snapshot_net_total, status, offer_number')
          .eq('project_id', targetId);

        if (!offersError && offersData && offersData.length > 0) {
          // Calculate totals from offer_items if snapshot is null
          processedOffers = await Promise.all(offersData.map(async (offer) => {
            if (offer.snapshot_gross_total) return offer;

            const { data: items } = await supabase
              .from('offer_items')
              .select('quantity, unit_price_net, vat_rate')
              .eq('offer_id', offer.id);

            const netTotal = (items || []).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price_net || 0)), 0);
            const grossTotal = (items || []).reduce((sum, item) => {
              const net = (item.quantity || 0) * (item.unit_price_net || 0);
              return sum + net * (1 + (item.vat_rate || 19) / 100);
            }, 0);

            return { ...offer, snapshot_net_total: netTotal, snapshot_gross_total: grossTotal };
          }));
        }
      } catch (_error) {
        // intentional
      }
      setProjectOffers(processedOffers);

      // Calculate planned hours from all linked offer items
      let totalPlannedHours = 0;
      if (processedOffers.length > 0) {
        const offerIds = processedOffers.map((o: any) => o.id);
        const { data: allItems } = await supabase
          .from('offer_items')
          .select('planned_hours_item')
          .in('offer_id', offerIds);

        totalPlannedHours = (allItems || []).reduce((sum, item) => sum + (item.planned_hours_item || 0), 0);
      }
      setPlannedHours(totalPlannedHours);

      // 5. MILESTONES: Get from project_milestones
      let processedMilestones: any[] = [];
      try {
        const { data: milestonesData, error: milestonesError } = await supabase
          .from('project_milestones')
          .select('id, title, is_completed')
          .eq('project_id', targetId);

        if (!milestonesError && milestonesData && milestonesData.length > 0) {
          processedMilestones = milestonesData;
        }
      } catch (_error) {
        // intentional
      }
      setMilestones(processedMilestones);

      // 6. PHOTOS & DOCUMENTS: Get from project_documents
      let processedPhotos: any[] = [];
      let processedDocuments: any[] = [];
      try {
        const { data: docsData, error: docsError } = await supabase
          .from('project_documents')
          .select('id, name, document_type, file_url, file_path, file_size, mime_type, created_at')
          .eq('project_id', targetId)
          .order('created_at', { ascending: false });

        if (!docsError && docsData && docsData.length > 0) {
          // Separate photos from other documents
          processedPhotos = docsData.filter(d => d.mime_type?.startsWith('image/'));
          processedDocuments = docsData;
        }
      } catch (_error) {
        // intentional
      }
      setPhotos(processedPhotos);
      setProjectDocuments(processedDocuments);

      // 6b. INVOICES: Get invoices for this project
      let processedInvoices: any[] = [];
      try {
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select('id, invoice_number, title, status, invoice_date, due_date, net_amount, gross_amount, invoice_type')
          .eq('project_id', targetId)
          .order('invoice_date', { ascending: false });

        if (!invoicesError && invoicesData) {
          processedInvoices = invoicesData;
        }
      } catch (_error) {
        // intentional
      }
      setProjectInvoices(processedInvoices);

      // 7. DELIVERY NOTES: Get delivery notes for this project
      let dnHours = 0;
      let dnMaterials: any[] = [];
      let dnPhotos: any[] = [];
      let dnList: any[] = [];
      try {
        const { data: dnData, error: dnError } = await supabase
          .from('delivery_notes')
          .select(`
            *,
            delivery_note_items(*)
          `)
          .eq('project_id', targetId)
          .order('work_date', { ascending: false });

        if (dnError) {
          console.error('Delivery notes fetch error:', dnError);
        }

        if (dnData && dnData.length > 0) {
          // Fetch employee names + hourly_wage separately to avoid FK disambiguation issues
          const empIds = [...new Set(dnData.map((dn: any) => dn.employee_id).filter(Boolean))];
          let empMap: Record<string, { first_name: string; last_name: string; hourly_wage: number }> = {};
          if (empIds.length > 0) {
            const { data: empData } = await supabase
              .from('employees')
              .select('id, first_name, last_name, hourly_wage')
              .in('id', empIds);
            (empData || []).forEach((e: any) => {
              empMap[e.id] = { first_name: e.first_name, last_name: e.last_name, hourly_wage: e.hourly_wage ?? 0 };
            });
          }

          dnList = dnData.map((dn: any) => ({
            ...dn,
            employee: empMap[dn.employee_id] || null,
          }));

          // Sum hours from delivery notes
          dnHours = dnData.reduce((sum: number, dn: any) => {
            if (dn.start_time && dn.end_time) {
              const [sh, sm] = dn.start_time.split(':').map(Number);
              const [eh, em] = dn.end_time.split(':').map(Number);
              const gross = (eh * 60 + em) - (sh * 60 + sm);
              const net = gross - (dn.break_minutes ?? 0);
              return sum + Math.max(0, net / 60);
            }
            return sum;
          }, 0);

          // Collect materials and photos from items
          dnList.forEach((dn: any) => {
            const empName = dn.employee
              ? `${dn.employee.first_name} ${dn.employee.last_name}`
              : '';
            (dn.delivery_note_items || []).forEach((item: any) => {
              if (item.item_type === 'material' && item.material_name) {
                dnMaterials.push({
                  ...item,
                  work_date: dn.work_date,
                  employee_name: empName,
                  delivery_note_number: dn.delivery_note_number,
                });
              }
              if (item.item_type === 'photo' && item.photo_url) {
                dnPhotos.push({
                  id: item.id,
                  file_url: item.photo_url,
                  caption: item.photo_caption,
                  work_date: dn.work_date,
                });
              }
            });
          });
        }
      } catch (error) {
        console.error('[DN-DEBUG] EXCEPTION:', error);
      }
      setDeliveryNotes(dnList);
      setDeliveryNoteMaterials(dnMaterials);

      // Add delivery note hours to team member totals
      if (dnList.length > 0 && teamMembersProcessed.length > 0) {
        const dnHoursByEmployee: Record<string, number> = {};
        dnList.forEach((dn: any) => {
          if (dn.start_time && dn.end_time) {
            const [sh, sm] = dn.start_time.split(':').map(Number);
            const [eh, em] = dn.end_time.split(':').map(Number);
            const gross = (eh * 60 + em) - (sh * 60 + sm);
            const net = Math.max(0, gross - (dn.break_minutes ?? 0)) / 60;
            // Primary employee
            if (dn.employee_id) {
              dnHoursByEmployee[dn.employee_id] = (dnHoursByEmployee[dn.employee_id] || 0) + net;
            }
            // Additional employees
            if (dn.additional_employee_ids && Array.isArray(dn.additional_employee_ids)) {
              dn.additional_employee_ids.forEach((empId: string) => {
                dnHoursByEmployee[empId] = (dnHoursByEmployee[empId] || 0) + net;
              });
            }
          }
        });
        teamMembersProcessed = teamMembersProcessed.map((tm: any) => ({
          ...tm,
          hours_this_week: Math.round(((tm.hours_this_week || 0) + (dnHoursByEmployee[tm.id] || 0)) * 10) / 10,
        }));
        setTeamAssignments(teamMembersProcessed);
      }

      // Add delivery note labor costs using real hourly rates
      dnList.forEach((dn: any) => {
        if (dn.start_time && dn.end_time && dn.employee) {
          const [sh, sm] = dn.start_time.split(':').map(Number);
          const [eh, em] = dn.end_time.split(':').map(Number);
          const gross = (eh * 60 + em) - (sh * 60 + sm);
          const net = Math.max(0, gross - (dn.break_minutes ?? 0)) / 60;
          totalLaborCost += net * (dn.employee.hourly_wage || 0);
        }
        // Material costs from delivery note items
        (dn.delivery_note_items || []).forEach((item: any) => {
          if (item.item_type === 'material' && item.unit_price && item.material_quantity) {
            totalMaterialCost += item.unit_price * item.material_quantity;
          }
        });
      });

      // Add delivery note hours to total
      calculatedTotalHours += dnHours;
      setTotalHours(calculatedTotalHours);

      // Add delivery note photos to photos list
      const allPhotos = [...processedPhotos, ...dnPhotos];
      setPhotos(allPhotos);

      // Calculate real statistics from database
      const totalProjectCost = totalMaterialCost + totalLaborCost;
      const projectBudget = projectData.budget || 0;
      const budgetUtilization = projectBudget > 0 ? Math.round((totalProjectCost / projectBudget) * 100) : 0;

      // Calculate days active and remaining
      const startDate = new Date(projectData.start_date || new Date());
      const endDate = new Date(projectData.end_date || new Date());
      const today = new Date();
      const daysActive = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const daysRemaining = Math.max(0, Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

      const realProjectData: ProjectDashboardData = {
        id: projectData.id,
        company_id: projectData.company_id,
        project_name: projectData.name,
        customer_id: projectData.customer_id || '',
        start_date: projectData.start_date || new Date().toISOString().split('T')[0],
        planned_end_date: projectData.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: ((projectData.status as ProjectStatus) ?? 'anfrage') as ProjectStatus,
        project_type: projectData.project_type,
        project_address: projectData.site || projectData.location || 'Nicht angegeben',
        project_description: projectData.description || 'Keine Beschreibung',
        budget_planned: projectBudget,
        linked_invoices: [],
        linked_offers: [],
        created_at: projectData.created_at || new Date().toISOString(),
        updated_at: projectData.updated_at || new Date().toISOString(),
        created_by: currentUser.user.id,
        assigned_team: teamMembersProcessed.map(tm => tm.id) || [],

        customer: customerData ? {
          company_name: customerData.company_name || 'Unbekanntes Unternehmen',
          contact_person: customerData.contact_person || 'Nicht angegeben',
          email: customerData.email || 'Nicht angegeben',
          phone: customerData.phone || 'Nicht angegeben'
        } : {
          company_name: 'Kein Kunde zugewiesen',
          contact_person: 'Nicht angegeben',
          email: 'Nicht angegeben',
          phone: 'Nicht angegeben'
        },

        stats: {
          total_hours_logged: calculatedTotalHours,
          total_material_cost: totalMaterialCost,
          total_project_cost: totalProjectCost,
          budget_utilization: budgetUtilization,
          days_active: daysActive,
          days_remaining: daysRemaining,
          team_size: teamMembersProcessed.length || 0,
          documents_count: processedPhotos.length || 0,
          comments_count: 0,
          last_activity: new Date().toISOString()
        },

        recent_activities: [],

        team_members: teamMembersProcessed || [],

        permissions: getProjectPermissions('admin', true)
      };

      // Set permissions based on user role (mock for now)
      const currentUserRole: UserRole = 'admin'; // This should come from user profile
      setPermissions(getProjectPermissions(currentUserRole, true));

      // Get real project activities
      const activities = [];

      // Get recent time entries
      if (timeEntriesData && timeEntriesData.length > 0) {
        const { data: recentTimeEntries } = await supabase
          .from('time_entries')
          .select('id, start_time, created_at')
          .eq('project_id', targetId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentTimeEntries) {
          recentTimeEntries.forEach((entry: any) => {
            activities.push({
              id: `time_${entry.id}`,
              project_id: targetId,
              event_type: 'time',
              title: 'Arbeitszeit erfasst',
              description: `${new Date(entry.start_time).toLocaleDateString('de-DE')}`,
              user_name: 'Team-Mitglied',
              user_role: 'team_member',
              timestamp: entry.created_at
            });
          });
        }
      }

      // Add delivery note activities
      dnList.forEach((dn: any) => {
        const empName = dn.employee
          ? `${dn.employee.first_name} ${dn.employee.last_name}`
          : 'Mitarbeiter';
        const materialCount = (dn.delivery_note_items || []).filter((i: any) => i.item_type === 'material').length;
        let desc = new Date(dn.work_date).toLocaleDateString('de-DE');
        if (dn.start_time && dn.end_time) {
          const [sh, sm] = dn.start_time.split(':').map(Number);
          const [eh, em] = dn.end_time.split(':').map(Number);
          const net = ((eh * 60 + em) - (sh * 60 + sm) - (dn.break_minutes ?? 0)) / 60;
          desc += ` · ${net.toFixed(1)}h`;
        }
        if (materialCount > 0) desc += ` · ${materialCount} Material`;
        activities.push({
          id: `dn_${dn.id}`,
          project_id: targetId,
          event_type: 'delivery_note',
          title: `Lieferschein ${dn.delivery_note_number || ''}`,
          description: desc,
          user_name: empName,
          user_role: 'team_member',
          timestamp: dn.created_at,
        });
      });

      // Sort activities by timestamp (newest first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Update project data with real activities only
      realProjectData.recent_activities = activities.slice(0, 10);

      setProject(realProjectData);
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast({
        title: "Fehler",
        description: "Projektdaten konnten nicht geladen werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableEmployees = async () => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) return;

      // Get all employees from the company who are not already in the project
      const { data: employees } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email, position')
        .eq('company_id', profile.company_id)
        .in('status', ['active', 'aktiv']);

      // Filter out employees who are already in the project
      const currentTeamIds = project?.assigned_team || [];
      const available = employees?.filter(emp => !currentTeamIds.includes(emp.id)) || [];

      setAvailableEmployees(available);
    } catch (error) {
      console.error('Error loading available employees:', error);
    }
  };

  const loadCustomerProjects = async (customerId: string) => {
    setLoadingCustomerProjects(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) return;

      // Get all projects for this customer
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date')
        .eq('customer_id', customerId)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (!error && projects) {
        setCustomerProjects(projects);
        setIsCustomerProjectsOpen(true);
      } else {
        toast({
          title: "Fehler",
          description: "Kundenprojekte konnten nicht geladen werden",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading customer projects:', error);
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
        variant: "destructive"
      });
    } finally {
      setLoadingCustomerProjects(false);
    }
  };

  const loadAvailableOffers = async () => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) return;

      // Fetch offers that are NOT yet linked to a project
      const { data: offers } = await supabase
        .from('offers')
        .select('id, offer_number, customer_name, snapshot_gross_total, snapshot_net_total, status')
        .eq('company_id', profile.company_id)
        .eq('customer_id', project.customer_id)
        .is('project_id', null)
        .order('created_at', { ascending: false });

      // For each offer, calculate total from items if snapshot is null
      const offersWithTotals = await Promise.all((offers || []).map(async (offer) => {
        if (offer.snapshot_gross_total) return offer;

        const { data: items } = await supabase
          .from('offer_items')
          .select('quantity, unit_price_net, vat_rate')
          .eq('offer_id', offer.id);

        const netTotal = (items || []).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price_net || 0)), 0);
        const grossTotal = (items || []).reduce((sum, item) => {
          const net = (item.quantity || 0) * (item.unit_price_net || 0);
          return sum + net * (1 + (item.vat_rate || 19) / 100);
        }, 0);

        return { ...offer, snapshot_net_total: netTotal, snapshot_gross_total: grossTotal };
      }));

      setAvailableOffers(offersWithTotals);
    } catch (error) {
      console.error('Error loading offers:', error);
    }
  };

  const linkOfferToProject = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ project_id: currentProjectId })
        .eq('id', offerId);

      if (error) {
        toast({ title: "Fehler", description: "Angebot konnte nicht verknüpft werden: " + error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Erfolg", description: "Angebot mit Projekt verknüpft" });
      setIsLinkOfferOpen(false);
      fetchProjectData(currentProjectId);
    } catch (error) {
      console.error('Error linking offer:', error);
    }
  };

  const unlinkOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ project_id: null })
        .eq('id', offerId);

      if (error) {
        toast({ title: "Fehler", description: "Verknüpfung konnte nicht entfernt werden: " + error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Entfernt", description: "Angebot wurde vom Projekt getrennt" });
      fetchProjectData(currentProjectId);
    } catch (error) {
      console.error('Error unlinking offer:', error);
    }
  };

  const handleAddTeamMember = async (employeeId: string) => {
    try {
      // Add team member to project_team_assignments table
      const { error } = await supabase
        .from('project_team_assignments')
        .insert({
          project_id: currentProjectId,
          employee_id: employeeId,
          assigned_at: new Date().toISOString()
        });

      if (error) {
        toast({
          title: "Fehler",
          description: "Team-Mitglied konnte nicht hinzugefügt werden",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Erfolg",
        description: "Team-Mitglied wurde erfolgreich hinzugefügt"
      });

      // Refresh project data to show new team member
      await fetchProjectData();
      setIsAddTeamMemberOpen(false);
    } catch (error) {
      console.error('Error adding team member:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const toggleMilestoneCompletion = async (milestoneId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .update({ is_completed: completed })
        .eq('id', milestoneId);

      if (error) throw error;

      setMilestones(prev =>
        prev.map(m => m.id === milestoneId ? { ...m, is_completed: completed } : m)
      );

      toast({
        title: "Erfolg",
        description: completed ? "Meilenstein abgeschlossen" : "Meilenstein als offen markiert"
      });
    } catch (error) {
      console.error('Error updating milestone:', error);
      toast({
        title: "Fehler",
        description: "Meilenstein konnte nicht aktualisiert werden",
        variant: "destructive"
      });
    }
  };

  const addMilestone = async (title: string) => {
    if (!title.trim()) {
      toast({
        title: "Fehler",
        description: "Meilenstein-Titel kann nicht leer sein",
        variant: "destructive"
      });
      return;
    }

    try {
      const newMilestone = {
        project_id: currentProjectId,
        title: title.trim(),
        is_completed: false
      };

      const { data, error } = await supabase
        .from('project_milestones')
        .insert(newMilestone)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setMilestones(prev => [...prev, data[0]]);
        setNewChecklistItem('');
        toast({
          title: "Erfolg",
          description: "Meilenstein hinzugefügt"
        });
      }
    } catch (error) {
      console.error('Error adding milestone:', error);
      toast({
        title: "Fehler",
        description: "Meilenstein konnte nicht hinzugefügt werden",
        variant: "destructive"
      });
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!file) return;

    try {
      const fileName = `${currentProjectId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('project_documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('project_documents')
        .getPublicUrl(fileName);

      const newDocument = {
        project_id: currentProjectId,
        document_type: 'image',
        file_path: fileName,
        file_url: publicData.publicUrl,
        name: file.name
      };

      const { data, error } = await supabase
        .from('project_documents')
        .insert(newDocument)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setPhotos(prev => [...prev, data[0]]);
        toast({
          title: "Erfolg",
          description: "Foto hochgeladen"
        });
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Fehler",
        description: "Foto konnte nicht hochgeladen werden",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (!project || !permissions.can_change_status) return;
    setWorkflowTargetStatus(newStatus as ProjectStatus);
    setWorkflowEditMode(undefined);
    setWorkflowDialogOpen(true);
  };

  const handleEditAppointment = (mode: 'besichtigung' | 'in_bearbeitung') => {
    setWorkflowTargetStatus(undefined);
    setWorkflowEditMode(mode);
    setWorkflowDialogOpen(true);
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] rounded-2xl bg-white shadow-xl border border-slate-200 p-0">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
              <p className="mt-3 text-sm text-slate-500">Projektdaten werden geladen...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!project) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] w-full h-full">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Projekt nicht gefunden</h3>
            <p className="text-gray-600">Das angeforderte Projekt konnte nicht geladen werden.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusConfig = getStatusConfig(project.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] rounded-2xl bg-white shadow-xl overflow-y-auto border border-slate-200 p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* Dialog Header */}
          <DialogHeader className="px-6 pt-6 pb-0">
            {/* Title row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <DialogTitle className="text-2xl font-semibold text-slate-900 leading-tight truncate">
                    {project.project_name}
                  </DialogTitle>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusConfig.color} bg-slate-50`}>
                    {statusConfig.label}
                  </span>
                </div>
                <DialogDescription className="text-sm text-slate-500 flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{generateShortId(project.id)}</span>
                  {project.project_address && project.project_address !== 'Nicht angegeben' && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{project.project_address}</span>
                    </>
                  )}
                </DialogDescription>
              </div>

              {/* Budget chip - only for Projektauftraege */}
              {project.project_type !== 'kleinauftrag' && (
                <div className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Projektkosten</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(project.stats.total_project_cost)}</p>
                  {project.budget_planned > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">von {formatCurrency(project.budget_planned)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Status Pipeline - only for Projektauftraege */}
            {project.project_type !== 'kleinauftrag' && (() => {
              const stages = WORKFLOW_STAGES.map(key => ({
                key,
                label: PROJECT_STATUS_CONFIG[key].label,
                icon: PROJECT_STATUS_CONFIG[key].icon,
              }));
              const statusKey = project.status === 'angebot_versendet' ? 'angebot' : project.status;
              const currentIdx = stages.findIndex(s => s.key === statusKey);

              const getDateAnnotation = (stageKey: string) => {
                switch (stageKey) {
                  case 'anfrage': return project.created_at ? format(new Date(project.created_at), 'dd.MM.', { locale: de }) : null;
                  case 'besichtigung': {
                    if (!project.besichtigung_date) return null;
                    const d = format(new Date(project.besichtigung_date), 'dd.MM.', { locale: de });
                    const t = project.besichtigung_time_start ? ` ${project.besichtigung_time_start.slice(0, 5)}` : '';
                    return d + t;
                  }
                  case 'in_bearbeitung': return project.work_start_date ? format(new Date(project.work_start_date), 'dd.MM.', { locale: de }) : null;
                  case 'abgeschlossen': return project.completed_at ? format(new Date(project.completed_at), 'dd.MM.', { locale: de }) : null;
                  default: return null;
                }
              };

              const getEmployeeName = () => {
                if (!project.besichtigung_employee_id) return null;
                const emp = allEmployees.find(e => e.id === project.besichtigung_employee_id);
                return emp ? `${emp.first_name.charAt(0)}. ${emp.last_name}` : null;
              };

              return (
                <div className="mb-4">
                  {/* Status Bar */}
                  <div className="flex rounded-lg overflow-hidden border border-slate-200">
                    {stages.map((stage, idx) => {
                      const isPast = idx < currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <button
                          key={stage.key}
                          onClick={() => permissions.can_change_status && handleStatusChange(stage.key)}
                          disabled={!permissions.can_change_status}
                          className={`flex-1 py-2 text-xs sm:text-sm font-medium text-center transition-all ${
                            isPast ? 'bg-emerald-500 text-white' :
                            isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-1' :
                            'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          } ${permissions.can_change_status ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <span className="hidden sm:inline">{stage.label}</span>
                          <span className="sm:hidden">{stage.icon}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Date Annotations */}
                  <div className="hidden sm:flex mt-1">
                    {stages.map(stage => {
                      const date = getDateAnnotation(stage.key);
                      const empName = stage.key === 'besichtigung' ? getEmployeeName() : null;
                      return (
                        <div key={stage.key} className="flex-1 text-center">
                          <div className="text-[10px] text-slate-400 leading-tight">{date || '—'}</div>
                          {empName && <div className="text-[10px] text-slate-400 leading-tight">{empName}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Tabs */}
            <TabsList className="bg-slate-100/80 border border-slate-200/60 p-1 rounded-full grid w-full grid-cols-7 h-11">
              {[
                { value: 'overview', label: 'Übersicht' },
                { value: 'details', label: 'Details' },
                { value: 'time', label: 'Zeiten' },
                { value: 'materials', label: 'Material' },
                { value: 'documents', label: 'Dokumente' },
                { value: 'baudoku', label: 'Baudoku' },
                { value: 'comments', label: 'Kommentare' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-full text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-600 data-[state=active]:font-semibold transition-all text-slate-500 hover:text-slate-700"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </DialogHeader>

          {/* Tab Content */}
          <OverviewTab
            project={project}
            permissions={permissions}
            totalHours={totalHours}
            plannedHours={plannedHours}
            deliveryNotes={deliveryNotes}
            projectOffers={projectOffers}
            teamAssignments={teamAssignments}
            milestones={milestones}
            photos={photos}
            newChecklistItem={newChecklistItem}
            isLinkOfferOpen={isLinkOfferOpen}
            availableOffers={availableOffers}
            onSetIsTimeFormOpen={setIsTimeFormOpen}
            onSetIsLinkOfferOpen={setIsLinkOfferOpen}
            onLoadAvailableOffers={loadAvailableOffers}
            onLinkOfferToProject={linkOfferToProject}
            onUnlinkOffer={unlinkOffer}
            onSetIsAddTeamMemberOpen={setIsAddTeamMemberOpen}
            onLoadAvailableEmployees={loadAvailableEmployees}
            onToggleMilestoneCompletion={toggleMilestoneCompletion}
            onSetNewChecklistItem={setNewChecklistItem}
            onAddMilestone={addMilestone}
            onUploadPhoto={uploadPhoto}
          />

          <TimeTab
            permissions={permissions}
            totalHours={totalHours}
            timeEntries={timeEntries}
            deliveryNotes={deliveryNotes}
            onSetIsTimeFormOpen={setIsTimeFormOpen}
          />

          <DetailsTab
            project={project}
            permissions={permissions}
            allEmployees={allEmployees}
            onLoadCustomerProjects={loadCustomerProjects}
            onHandleEditAppointment={handleEditAppointment}
          />

          <MaterialsTab
            deliveryNoteMaterials={deliveryNoteMaterials}
          />

          <DocumentsTab
            permissions={permissions}
            projectOffers={projectOffers}
            projectInvoices={projectInvoices}
            projectDocuments={projectDocuments}
            deliveryNotes={deliveryNotes}
            onSetIsCreateInvoiceOpen={setIsCreateInvoiceOpen}
            onSetSelectedInvoice={setSelectedInvoice}
            onSetIsInvoiceDetailOpen={setIsInvoiceDetailOpen}
            onClose={onClose}
            onNavigate={navigate}
          />

          <TabsContent value="baudoku" className="px-6 pb-6 pt-5 min-h-[600px] mt-0">
            <SiteDocModule
              projectId={project.id}
              projectName={project.project_name}
            />
          </TabsContent>

          <CommentsTab />

        </Tabs>

        {/* Time Entry Form */}
        <TimeEntryForm
          isOpen={isTimeFormOpen}
          onClose={() => setIsTimeFormOpen(false)}
          projectId={project.id}
          teamMembers={teamAssignments}
          onTimeEntryAdded={async (entry) => {
            try {
              const { data: currentUser } = await supabase.auth.getUser();
              if (!currentUser?.user) return;

              const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', currentUser.user.id)
                .single();

              const startTime = new Date(`${entry.work_date}T${entry.start_time}`);
              const endTime = new Date(`${entry.work_date}T${entry.end_time}`);

              const { error } = await supabase
                .from('time_entries')
                .insert({
                  employee_id: entry.employee_id,
                  project_id: currentProjectId,
                  company_id: profile?.company_id,
                  start_time: startTime.toISOString(),
                  end_time: endTime.toISOString(),
                  break_duration: entry.break_duration_min || 0,
                  description: entry.task_description,
                  status: 'completed'
                });

              if (error) {
                toast({ title: "Fehler", description: "Arbeitszeit konnte nicht gespeichert werden: " + error.message, variant: "destructive" });
                return;
              }

              fetchProjectData(currentProjectId);
            } catch (error) {
              console.error('Error saving time entry:', error);
              toast({ title: "Fehler", description: "Arbeitszeit konnte nicht gespeichert werden.", variant: "destructive" });
            }
          }}
        />

        {/* Material Entry Form */}
        <MaterialEntryForm
          isOpen={isMaterialFormOpen}
          onClose={() => setIsMaterialFormOpen(false)}
          projectId={project.id}
          onMaterialEntryAdded={(entry) => {
            fetchProjectData();
            toast({
              title: "Erfolg",
              description: "Material wurde erfasst"
            });
          }}
        />

        {/* Add Team Member Dialog */}
        {
          isAddTeamMemberOpen && (
            <Dialog open={isAddTeamMemberOpen} onOpenChange={setIsAddTeamMemberOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Team-Mitglied hinzufügen</DialogTitle>
                  <DialogDescription>
                    Wählen Sie einen Mitarbeiter aus, der dem Projekt hinzugefügt werden soll.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {availableEmployees.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Keine verfügbaren Mitarbeiter gefunden oder alle sind bereits dem Projekt zugewiesen.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableEmployees.map(employee => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div>
                            <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                            <p className="text-sm text-gray-500">{employee.position}</p>
                            <p className="text-xs text-gray-400">{employee.email}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddTeamMember(employee.id)}
                          >
                            Hinzufügen
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )
        }

        {/* Customer Projects Dialog */}
        <Dialog open={isCustomerProjectsOpen} onOpenChange={setIsCustomerProjectsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Projekte für {project?.customer.company_name}</DialogTitle>
              <DialogDescription>
                Alle Projekte dieses Kunden. Klicken Sie auf ein Projekt, um es zu öffnen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {loadingCustomerProjects ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                </div>
              ) : customerProjects.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">Keine weiteren Projekte für diesen Kunden</p>
                </div>
              ) : (
                customerProjects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      setIsCustomerProjectsOpen(false);
                      setCurrentProjectId(proj.id);
                      setActiveTab('overview');
                    }}
                    className={`w-full text-left p-4 border rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-all ${
                      proj.id === currentProjectId ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-300' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{proj.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {proj.start_date && `von ${new Date(proj.start_date).toLocaleDateString('de-DE')}`}
                          {proj.end_date && ` bis ${new Date(proj.end_date).toLocaleDateString('de-DE')}`}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        proj.status === 'abgeschlossen' ? 'bg-green-100 text-green-700' :
                        proj.status === 'in_bearbeitung' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {proj.status === 'abgeschlossen' ? 'Fertig' :
                         proj.status === 'in_bearbeitung' ? 'In Arbeit' :
                         proj.status === 'beauftragt' ? 'Beauftragt' :
                         proj.status === 'angebot' ? 'Angebot' : proj.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Invoice Detail Dialog */}
        {selectedInvoice && (
          <InvoiceDetailDialog
            isOpen={isInvoiceDetailOpen}
            onClose={() => {
              setIsInvoiceDetailOpen(false);
              setSelectedInvoice(null);
            }}
            invoice={selectedInvoice}
          />
        )}

        {/* Create Invoice from Project Dialog */}
        {project && (
          <CreateInvoiceFromProjectDialog
            isOpen={isCreateInvoiceOpen}
            onClose={() => setIsCreateInvoiceOpen(false)}
            projectId={currentProjectId}
            projectName={project.project_name}
            customerId={project.customer.id}
            onInvoiceCreated={() => {
              fetchProjectData(currentProjectId);
              toast({
                title: "Rechnung erstellt",
                description: "Die Rechnung wurde erfolgreich erstellt.",
              });
            }}
          />
        )}

        {project && (
          <WorkflowStatusDialog
            open={workflowDialogOpen}
            onOpenChange={setWorkflowDialogOpen}
            projectId={project.id}
            projectName={project.project_name}
            companyId={project.company_id}
            targetStatus={workflowTargetStatus}
            editMode={workflowEditMode}
            currentValues={{
              besichtigung_date: project.besichtigung_date,
              besichtigung_time_start: project.besichtigung_time_start,
              besichtigung_time_end: project.besichtigung_time_end,
              besichtigung_employee_id: project.besichtigung_employee_id,
              besichtigung_calendar_event_id: project.besichtigung_calendar_event_id,
              work_start_date: project.work_start_date,
              work_end_date: project.work_end_date,
              work_calendar_event_id: project.work_calendar_event_id,
            }}
            employees={allEmployees}
            onSuccess={() => fetchProjectData(currentProjectId)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetailView;
