import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import {
  Clock,
  Users,
  Plus,
  Image as LucideImage,
  X,
  ClipboardList,
  Link2
} from "lucide-react";
import { ProjectDashboardData, ProjectPermissions } from "@/types/project";
import { formatCurrency, formatDateTime } from './utils';

export interface OverviewTabProps {
  project: ProjectDashboardData;
  permissions: ProjectPermissions;
  totalHours: number;
  plannedHours: number;
  deliveryNotes: any[];
  projectOffers: any[];
  teamAssignments: any[];
  milestones: { id: string; title: string; is_completed: boolean; due_date?: string; priority?: string }[];
  photos: { id: string; file_url?: string; file_path?: string }[];
  newChecklistItem: string;
  isLinkOfferOpen: boolean;
  availableOffers: any[];
  onSetIsTimeFormOpen: (open: boolean) => void;
  onSetIsLinkOfferOpen: (open: boolean) => void;
  onLoadAvailableOffers: () => void;
  onLinkOfferToProject: (offerId: string) => void;
  onUnlinkOffer: (offerId: string) => void;
  onSetIsAddTeamMemberOpen: (open: boolean) => void;
  onLoadAvailableEmployees: () => void;
  onToggleMilestoneCompletion: (milestoneId: string, completed: boolean) => void;
  onSetNewChecklistItem: (value: string) => void;
  onAddMilestone: (title: string) => void;
  onUploadPhoto: (file: File) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  project,
  permissions,
  totalHours,
  plannedHours,
  deliveryNotes,
  projectOffers,
  teamAssignments,
  milestones,
  photos,
  newChecklistItem,
  isLinkOfferOpen,
  availableOffers,
  onSetIsTimeFormOpen,
  onSetIsLinkOfferOpen,
  onLoadAvailableOffers,
  onLinkOfferToProject,
  onUnlinkOffer,
  onSetIsAddTeamMemberOpen,
  onLoadAvailableEmployees,
  onToggleMilestoneCompletion,
  onSetNewChecklistItem,
  onAddMilestone,
  onUploadPhoto,
}) => {
  return (
    <TabsContent value="overview" className="px-6 pb-6 pt-5 space-y-5 min-h-[500px] mt-0">

      {/* Zeile 1 -- KPIs */}
      <div className={`grid grid-cols-1 ${project.project_type !== 'kleinauftrag' ? 'lg:grid-cols-2' : ''} gap-5`}>

        {/* Erfasste Zeit */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 m-0">Erfasste Zeit</CardTitle>
            {permissions.can_add_time && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => onSetIsTimeFormOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Erfassen
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-5">
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">
                {totalHours.toFixed(1)}{plannedHours > 0 && <span className="text-lg font-normal text-slate-400"> / {plannedHours.toFixed(1)}</span>}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {deliveryNotes.length > 0
                  ? `${deliveryNotes.length} Lieferschein(e) + Zeiteinträge`
                  : plannedHours > 0 ? 'Stunden erfasst / Stunden aus Angebot' : 'Stunden insgesamt'}
              </p>
              {plannedHours > 0 && (
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${totalHours / plannedHours > 1 ? 'bg-red-500' : totalHours / plannedHours > 0.8 ? 'bg-yellow-500' : 'bg-teal-500'}`}
                    style={{ width: `${Math.min(100, (totalHours / plannedHours) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Angebotssumme -- only for Projektauftraege */}
        {project.project_type !== 'kleinauftrag' && (
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 m-0">Angebotssumme</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => { onLoadAvailableOffers(); onSetIsLinkOfferOpen(!isLinkOfferOpen); }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Verknüpfen
              </Button>
            </CardHeader>
            <CardContent className="p-5">
              {isLinkOfferOpen && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <p className="text-xs font-medium text-slate-600 mb-2">Angebot auswählen:</p>
                  {availableOffers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Keine unverknüpften Angebote vorhanden</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {availableOffers.map(offer => (
                        <button
                          key={offer.id}
                          onClick={() => onLinkOfferToProject(offer.id)}
                          className="w-full flex items-center justify-between p-2.5 rounded-md border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-300 transition-colors text-left"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">{offer.offer_number}</p>
                            <p className="text-xs text-slate-400">{offer.customer_name}</p>
                          </div>
                          <span className="text-sm font-semibold text-slate-700">{formatCurrency(offer.snapshot_gross_total || 0)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="text-center mb-3">
                <p className="text-3xl font-bold text-slate-900">{formatCurrency(projectOffers.reduce((sum, o) => sum + (o.snapshot_gross_total || 0), 0))}</p>
                <p className="text-xs text-slate-400 mt-1">von {projectOffers.length} Angeboten</p>
              </div>
              {projectOffers.length > 0 && (
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  {projectOffers.map(offer => (
                    <div key={offer.id} className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        <a
                          href={`/manager2/offers/${offer.id}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-teal-600 hover:text-teal-800 hover:underline"
                        >
                          {offer.offer_number}
                        </a>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          offer.status === 'accepted' ? 'bg-green-50 text-green-700 border border-green-200' :
                          offer.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        }`}>
                          {offer.status === 'accepted' ? 'Akzeptiert' : offer.status === 'rejected' ? 'Abgelehnt' : 'Ausstehend'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{formatCurrency(offer.snapshot_gross_total || 0)}</span>
                        <button
                          onClick={() => onUnlinkOffer(offer.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                          title="Verknüpfung entfernen"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Zeile 2 -- Team + Checkliste */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Team-Mitglieder */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 m-0">Team-Mitglieder</CardTitle>
            {permissions.can_manage_team && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => { onLoadAvailableEmployees(); onSetIsAddTeamMemberOpen(true); }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Hinzufügen
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {teamAssignments.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Noch keine Teammitglieder zugewiesen</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {teamAssignments.map(member => (
                  <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-slate-600 font-semibold text-xs">{member.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{member.name}</p>
                      <p className="text-xs text-slate-400 truncate">{member.email}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{member.hours_this_week || 0}h</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checkliste (Milestones) */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Checkliste</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-2 mb-4">
              {milestones.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-3">Noch keine Meilensteine. Füge einen hinzu.</p>
              )}
              {milestones.map(item => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={item.is_completed}
                    onChange={() => onToggleMilestoneCompletion(item.id, !item.is_completed)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 flex-shrink-0"
                  />
                  <span className={`text-sm ${item.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {item.title}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={e => onSetNewChecklistItem(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newChecklistItem.trim()) {
                    onAddMilestone(newChecklistItem);
                  }
                }}
                placeholder="+ Meilenstein hinzufügen"
                className="flex-1 text-sm text-teal-600 placeholder:text-teal-500 bg-transparent border-none outline-none px-0 py-1"
              />
              {newChecklistItem.trim() && (
                <button
                  onClick={() => onAddMilestone(newChecklistItem)}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  Hinzufügen
                </button>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Zeile 3 -- Fotos */}
      <div className="grid grid-cols-1 gap-5">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 m-0">Fotos</CardTitle>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onUploadPhoto(e.target.files[0]);
                }
              }}
              style={{ display: 'none' }}
              id="photo-upload"
            />
            <label htmlFor="photo-upload" className="cursor-pointer">
              <Button size="sm" variant="outline" className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50" asChild>
                <span>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Hochladen
                </span>
              </Button>
            </label>
          </CardHeader>
          <CardContent className="p-5">
            {photos.length === 0 ? (
              <div className="text-center py-8">
                <LucideImage className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Noch keine Fotos hochgeladen</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    {photo.file_url && (
                      <img
                        src={photo.file_url}
                        alt="Project photo"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aktivitaets-Timeline -- volle Breite */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Aktivitäts-Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {project.recent_activities.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Noch keine Aktivitäten vorhanden</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-slate-50">
              {project.recent_activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 py-3">
                  <div className={`h-8 w-8 rounded-full border flex items-center justify-center flex-shrink-0 ${
                    activity.event_type === 'delivery_note'
                      ? 'bg-teal-50 border-teal-200'
                      : 'bg-slate-100 border-slate-200'
                  }`}>
                    {activity.event_type === 'delivery_note'
                      ? <ClipboardList className="h-3.5 w-3.5 text-teal-500" />
                      : <Clock className="h-3.5 w-3.5 text-slate-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{activity.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{activity.user_name} · {activity.description}</p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{formatDateTime(activity.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </TabsContent>
  );
};

export default OverviewTab;
