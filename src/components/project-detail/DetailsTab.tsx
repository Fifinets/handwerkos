import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  Phone,
  Mail
} from "lucide-react";
import { ProjectDashboardData, ProjectPermissions } from "@/types/project";
import { formatDate } from './utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface DetailsTabProps {
  project: ProjectDashboardData;
  permissions: ProjectPermissions;
  allEmployees: { id: string; first_name: string; last_name: string }[];
  onLoadCustomerProjects: (customerId: string) => void;
  onHandleEditAppointment: (mode: 'besichtigung' | 'in_bearbeitung') => void;
}

const DetailsTab: React.FC<DetailsTabProps> = ({
  project,
  permissions,
  allEmployees,
  onLoadCustomerProjects,
  onHandleEditAppointment,
}) => {
  return (
    <TabsContent value="details" className="px-6 pb-6 pt-5 space-y-5 min-h-[500px] mt-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Projektdetails */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Projektdetails</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-slate-400 mr-1.5">Start:</span>
                <span className="font-medium text-slate-800">{formatDate(project.start_date)}</span>
              </div>
              <div>
                <span className="text-slate-400 mr-1.5">Ende:</span>
                <span className="font-medium text-slate-800">{formatDate(project.planned_end_date)}</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-sm">{project.stats.days_remaining} Tage verbleibend</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span>{project.project_address}</span>
            </div>
            {project.project_description && project.project_description !== 'Keine Beschreibung' && (
              <p className="text-sm text-slate-500 leading-relaxed">{project.project_description}</p>
            )}
          </CardContent>
        </Card>

        {/* Kundeninformationen */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden cursor-pointer hover:border-teal-300 hover:shadow-md transition-all" onClick={() => project.customer_id && onLoadCustomerProjects(project.customer_id)}>
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Kundeninformationen</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Unternehmen</p>
                <p className="font-semibold text-slate-900 hover:text-teal-600 transition-colors">{project.customer.company_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Ansprechpartner</p>
                <p className="font-medium text-slate-800">{project.customer.contact_person}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href={`mailto:${project.customer.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors flex-1">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="truncate">{project.customer.email}</span>
              </a>
              {project.customer.phone && (
                <a href={`tel:${project.customer.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors flex-1">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{project.customer.phone}</span>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Termine Section */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Termine</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Besichtigung Card */}
          {project.besichtigung_date ? (
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <span className="text-sm font-semibold text-slate-900">Besichtigung</span>
                  </div>
                  <button
                    onClick={() => onHandleEditAppointment('besichtigung')}
                    className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    Bearbeiten
                  </button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                    {format(new Date(project.besichtigung_date), 'dd. MMMM yyyy', { locale: de })}
                    {project.besichtigung_time_start && (
                      <span>, {project.besichtigung_time_start.slice(0, 5)}{project.besichtigung_time_end ? ` – ${project.besichtigung_time_end.slice(0, 5)}` : ''}</span>
                    )}
                  </div>
                  {project.besichtigung_employee_id && (() => {
                    const emp = allEmployees.find(e => e.id === project.besichtigung_employee_id);
                    return emp ? (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {emp.first_name} {emp.last_name}
                      </div>
                    ) : null;
                  })()}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card
              className="border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all rounded-xl"
              onClick={() => onHandleEditAppointment('besichtigung')}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center text-center py-6">
                <CalendarIcon className="h-5 w-5 text-slate-300 mb-1.5" />
                <span className="text-sm font-medium text-slate-500">Besichtigung</span>
                <span className="text-xs text-slate-400">Termin festlegen</span>
              </CardContent>
            </Card>
          )}

          {/* In Arbeit Card */}
          {project.work_start_date ? (
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-sm font-semibold text-slate-900">In Arbeit</span>
                  </div>
                  <button
                    onClick={() => onHandleEditAppointment('in_bearbeitung')}
                    className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    Bearbeiten
                  </button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                    Baustart: {format(new Date(project.work_start_date), 'dd. MMMM yyyy', { locale: de })}
                  </div>
                  {project.work_end_date && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                      Geplantes Ende: {format(new Date(project.work_end_date), 'dd. MMMM yyyy', { locale: de })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card
              className="border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all rounded-xl"
              onClick={() => onHandleEditAppointment('in_bearbeitung')}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center text-center py-6">
                <CalendarIcon className="h-5 w-5 text-slate-300 mb-1.5" />
                <span className="text-sm font-medium text-slate-500">In Arbeit</span>
                <span className="text-xs text-slate-400">Baustart festlegen</span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TabsContent>
  );
};

export default DetailsTab;
