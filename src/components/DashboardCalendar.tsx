import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, Users, Building2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import GoogleCalendarSettings from "./GoogleCalendarSettings";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'vacation' | 'project';
  person?: string;
  endDate?: Date;
}

const DashboardCalendar = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showVacations, setShowVacations] = useState(true);
  const [showProjects, setShowProjects] = useState(true);

  // Handler functions to properly convert CheckedState to boolean
  const handleVacationFilterChange = (checked: boolean | "indeterminate") => {
    setShowVacations(checked === true);
  };

  const handleProjectFilterChange = (checked: boolean | "indeterminate") => {
    setShowProjects(checked === true);
  };

  // Beispieldaten für Events
  const events: CalendarEvent[] = [
    {
      id: '1',
      title: 'Max Mustermann Urlaub',
      date: new Date(2024, 6, 15), // 15. Juli 2024
      endDate: new Date(2024, 6, 25), // 25. Juli 2024
      type: 'vacation',
      person: 'Max Mustermann'
    },
    {
      id: '2',
      title: 'Lisa Weber Urlaub',
      date: new Date(2024, 6, 8), // 8. Juli 2024
      endDate: new Date(2024, 6, 12), // 12. Juli 2024
      type: 'vacation',
      person: 'Lisa Weber'
    },
    {
      id: '3',
      title: 'Büroerweiterung Müller GmbH',
      date: new Date(2024, 5, 1), // 1. Juni 2024
      endDate: new Date(2024, 6, 15), // 15. Juli 2024
      type: 'project'
    },
    {
      id: '4',
      title: 'Wohnanlage Phase 2',
      date: new Date(2024, 6, 1), // 1. Juli 2024
      endDate: new Date(2024, 9, 30), // 30. Oktober 2024
      type: 'project'
    },
    {
      id: '5',
      title: 'Tom Fischer Urlaub',
      date: new Date(2024, 6, 20), // 20. Juli 2024
      endDate: new Date(2024, 6, 27), // 27. Juli 2024
      type: 'vacation',
      person: 'Tom Fischer'
    }
  ];

  const getFilteredEvents = () => {
    return events.filter(event => {
      if (event.type === 'vacation' && !showVacations) return false;
      if (event.type === 'project' && !showProjects) return false;
      return true;
    });
  };

  const getEventsForDate = (date: Date) => {
    return getFilteredEvents().filter(event => {
      const eventStart = new Date(event.date);
      const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
      
      // Normalize dates to compare only year, month, and day
      const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const startDate = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
      const endDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
      
      return checkDate >= startDate && checkDate <= endDate;
    });
  };

  const hasEvents = (date: Date) => {
    return getEventsForDate(date).length > 0;
  };

  const getSelectedDateEvents = () => {
    if (!selectedDate) return [];
    return getEventsForDate(selectedDate);
  };

  // New function to check if date has both types of events
  const hasBothEventTypes = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    const hasVacation = dayEvents.some(e => e.type === 'vacation');
    const hasProject = dayEvents.some(e => e.type === 'project');
    return hasVacation && hasProject;
  };

  const modifiers = {
    hasEvents: (date: Date) => hasEvents(date),
    vacation: (date: Date) => {
      const dayEvents = getEventsForDate(date);
      return dayEvents.some(e => e.type === 'vacation') && !hasBothEventTypes(date);
    },
    project: (date: Date) => {
      const dayEvents = getEventsForDate(date);
      return dayEvents.some(e => e.type === 'project') && !hasBothEventTypes(date);
    },
    mixed: (date: Date) => hasBothEventTypes(date)
  };

  const modifiersStyles = {
    hasEvents: {
      fontWeight: 'bold'
    },
    vacation: {
      backgroundColor: '#fef3c7',
      color: '#92400e'
    },
    project: {
      backgroundColor: '#dbeafe',
      color: '#1e40af'
    },
    mixed: {
      background: 'linear-gradient(135deg, #fef3c7 50%, #dbeafe 50%)',
      color: '#374151',
      fontWeight: 'bold'
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Kalender */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Kalender
            </div>
            <GoogleCalendarSettings />
          </CardTitle>
          
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="vacations" 
                checked={showVacations}
                onCheckedChange={handleVacationFilterChange}
              />
              <label 
                htmlFor="vacations" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
              >
                <Users className="h-4 w-4 text-yellow-600" />
                Urlaube
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="projects" 
                checked={showProjects}
                onCheckedChange={handleProjectFilterChange}
              />
              <label 
                htmlFor="projects" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
              >
                <Building2 className="h-4 w-4 text-blue-600" />
                Projekte
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className={cn("w-full pointer-events-auto")}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
          />
          
          {/* Legende */}
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Legende:</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-200 rounded"></div>
                <span>Urlaub</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-200 rounded"></div>
                <span>Projekt</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{background: 'linear-gradient(135deg, #fef3c7 50%, #dbeafe 50%)'}}></div>
                <span>Beides</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events für ausgewähltes Datum */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Events für {selectedDate?.toLocaleDateString('de-DE', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {getSelectedDateEvents().length === 0 ? (
              <p className="text-gray-500 text-sm">Keine Events für dieses Datum</p>
            ) : (
              getSelectedDateEvents().map((event) => (
                <div key={event.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      variant="outline" 
                      className={event.type === 'vacation' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}
                    >
                      {event.type === 'vacation' ? (
                        <><Users className="h-3 w-3 mr-1" />Urlaub</>
                      ) : (
                        <><Building2 className="h-3 w-3 mr-1" />Projekt</>
                      )}
                    </Badge>
                  </div>
                  <p className="font-medium text-sm">{event.title}</p>
                  {event.person && (
                    <p className="text-xs text-gray-600 mt-1">{event.person}</p>
                  )}
                  {event.endDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      {event.date.toLocaleDateString('de-DE')} - {event.endDate.toLocaleDateString('de-DE')}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Upcoming Events */}
          <div className="mt-6">
            <h4 className="font-medium text-sm mb-3">Kommende Events</h4>
            <div className="space-y-2">
              {getFilteredEvents()
                .filter(event => event.date > new Date())
                .slice(0, 3)
                .map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                    <div>
                      <span className="font-medium">{event.title}</span>
                      {event.person && <span className="text-gray-600 ml-1">({event.person})</span>}
                    </div>
                    <span className="text-gray-500">
                      {event.date.toLocaleDateString('de-DE')}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardCalendar;
