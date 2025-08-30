import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, User, Plus } from "lucide-react";
import { VacationRequestDialog } from "./VacationRequestDialog";

interface VacationRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  request_type: "vacation" | "sick" | "personal";
  reason?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface VacationBalance {
  total_days: number;
  used_days: number;
  pending_days: number;
  available_days: number;
}

export function VacationManagement() {
  const { user, userRole } = useSupabaseAuth();
  const { toast } = useToast();
  
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [vacationBalance, setVacationBalance] = useState<VacationBalance>({
    total_days: 0,
    used_days: 0,
    pending_days: 0,
    available_days: 0
  });
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [currentView, setCurrentView] = useState<'my-requests' | 'all-requests'>('my-requests');

  const isManager = userRole === 'manager' || userRole === 'admin';

  useEffect(() => {
    if (user) {
      loadVacationData();
    }
  }, [user, currentView]);

  const loadVacationData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadVacationBalance(),
        loadVacationRequests()
      ]);
    } catch (error) {
      console.error('Error loading vacation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVacationBalance = async () => {
    if (!user) return;

    try {
      // Get employee data
      const { data: employee } = await supabase
        .from('employees')
        .select('vacation_days_total, vacation_days_used')
        .eq('user_id', user.id)
        .single();

      if (employee) {
        // Calculate pending days from pending requests
        const { data: pendingRequests } = await supabase
          .from('vacation_requests')
          .select('days_requested')
          .eq('employee_id', employee.id)
          .eq('status', 'pending')
          .eq('request_type', 'vacation');

        const pendingDays = pendingRequests?.reduce((sum, req) => sum + req.days_requested, 0) || 0;
        const totalDays = employee.vacation_days_total || 0;
        const usedDays = employee.vacation_days_used || 0;
        const availableDays = Math.max(0, totalDays - usedDays - pendingDays);

        setVacationBalance({
          total_days: totalDays,
          used_days: usedDays,
          pending_days: pendingDays,
          available_days: availableDays
        });
      } else {
        // Get default from company settings if no employee record
        const { data: settings } = await supabase
          .from('company_settings')
          .select('default_vacation_days')
          .single();

        const defaultDays = settings?.default_vacation_days || 25;
        setVacationBalance({
          total_days: defaultDays,
          used_days: 0,
          pending_days: 0,
          available_days: defaultDays
        });
      }
    } catch (error) {
      console.error('Error loading vacation balance:', error);
    }
  };

  const loadVacationRequests = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('vacation_requests')
        .select(`
          id,
          employee_id,
          start_date,
          end_date,
          days_requested,
          request_type,
          reason,
          status,
          created_at,
          approved_by,
          approved_at,
          employees!inner(
            id,
            first_name,
            last_name,
            user_id
          )
        `)
        .order('created_at', { ascending: false });

      // Filter based on view and permissions
      if (currentView === 'my-requests' || !isManager) {
        // Get employee ID first
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (employee) {
          query = query.eq('employee_id', employee.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedRequests: VacationRequest[] = data?.map((request: any) => ({
        id: request.id,
        employee_id: request.employee_id,
        employee_name: `${request.employees.first_name} ${request.employees.last_name}`,
        start_date: request.start_date,
        end_date: request.end_date,
        days_requested: request.days_requested,
        request_type: request.request_type,
        reason: request.reason,
        status: request.status,
        created_at: request.created_at,
        approved_by: request.approved_by,
        approved_at: request.approved_at
      })) || [];

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error loading vacation requests:', error);
      toast({
        title: "Fehler",
        description: "Urlaubsanträge konnten nicht geladen werden",
        variant: "destructive"
      });
    }
  };

  const handleApproveRequest = async (requestId: string, approve: boolean) => {
    // Sofort UI aktualisieren - BEVOR der API Call
    const originalRequests = [...requests];
    
    // Entferne den Request sofort aus der UI
    setRequests(prevRequests => 
      prevRequests.filter(req => req.id !== requestId)
    );

    try {
      // Direkte Ablehnung ohne Begründung
      const updateData: any = {
        status: approve ? 'approved' : 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('vacation_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) {
        // Bei Fehler: Stelle die ursprüngliche Liste wieder her
        setRequests(originalRequests);
        throw error;
      }

      // If approved, update employee vacation days used
      if (approve) {
        const request = requests.find(r => r.id === requestId);
        if (request && request.request_type === 'vacation') {
          const { error: updateError } = await supabase.rpc('increment_vacation_days_used', {
            employee_id_param: request.employee_id,
            days_to_add: request.days_requested
          });

          if (updateError) {
            console.error('Error updating vacation days:', updateError);
          }
        }
      }

      // Erfolg! Der Request wurde bereits aus der UI entfernt
      toast({
        title: approve ? "Antrag genehmigt" : "Antrag abgelehnt",
        description: `Der Urlaubsantrag wurde erfolgreich ${approve ? 'genehmigt' : 'abgelehnt'}`,
      });

      // Optional: Lade Daten nach einer Sekunde neu für Synchronisation
      setTimeout(() => {
        loadVacationData();
      }, 1000);
    } catch (error: any) {
      console.error('Error updating vacation request:', error);
      toast({
        title: "Fehler",
        description: "Antrag konnte nicht aktualisiert werden",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" />Ausstehend</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Genehmigt</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Abgelehnt</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'Urlaub';
      case 'sick':
        return 'Krankmeldung';
      case 'personal':
        return 'Persönlich';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Lade Urlaubsdaten...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-gray-600 bg-clip-text text-transparent flex items-center gap-3">
            <Calendar className="h-8 w-8 text-gray-600" />
            Urlaubsverwaltung
          </h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Urlaubsanträge und Abwesenheiten
          </p>
        </div>
        <Button onClick={() => setShowRequestDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Antrag
        </Button>
      </div>

      {/* Vacation Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Mein Urlaubskonto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{vacationBalance.total_days}</div>
              <div className="text-sm text-blue-700">Gesamte Tage</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{vacationBalance.available_days}</div>
              <div className="text-sm text-green-700">Verfügbar</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{vacationBalance.pending_days}</div>
              <div className="text-sm text-orange-700">Ausstehend</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{vacationBalance.used_days}</div>
              <div className="text-sm text-gray-700">Verbraucht</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle for Managers */}
      {isManager && (
        <div className="flex gap-2">
          <Button
            variant={currentView === 'my-requests' ? 'default' : 'outline'}
            onClick={() => setCurrentView('my-requests')}
          >
            Meine Anträge
          </Button>
          <Button
            variant={currentView === 'all-requests' ? 'default' : 'outline'}
            onClick={() => setCurrentView('all-requests')}
          >
            Alle Anträge
          </Button>
        </div>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {currentView === 'all-requests' ? 'Alle Urlaubsanträge' : 'Meine Urlaubsanträge'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Anträge</h3>
              <p className="text-gray-500">
                {currentView === 'all-requests' 
                  ? 'Es sind keine Urlaubsanträge vorhanden'
                  : 'Sie haben noch keine Urlaubsanträge gestellt'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">
                          {currentView === 'all-requests' ? request.employee_name : getTypeLabel(request.request_type)}
                        </h4>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(request.start_date).toLocaleDateString('de-DE')} - {' '}
                        {new Date(request.end_date).toLocaleDateString('de-DE')} ({request.days_requested} {request.days_requested === 1 ? 'Tag' : 'Tage'})
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(request.created_at).toLocaleDateString('de-DE')}
                    </div>
                  </div>

                  {request.reason && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-700">{request.reason}</p>
                    </div>
                  )}

                  {/* Manager Action Buttons */}
                  {isManager && currentView === 'all-requests' && request.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => handleApproveRequest(request.id, true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Genehmigen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Direkte Ablehnung ohne Dialog oder Begründung
                          handleApproveRequest(request.id, false);
                        }}
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Ablehnen
                      </Button>
                    </div>
                  )}

                  {request.approved_at && (
                    <div className="text-xs text-gray-500 mt-2">
                      {request.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'} am{' '}
                      {new Date(request.approved_at).toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <VacationRequestDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
        onSuccess={loadVacationData}
      />
    </div>
  );
}