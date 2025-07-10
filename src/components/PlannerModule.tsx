import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';

interface PlannerItem {
  id: string;
  name: string;
  type: 'project' | 'employee';
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'in-progress' | 'completed';
  color: string;
}

const PlannerModule = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [resourceType, setResourceType] = useState<'projects' | 'employees'>('projects');

  // Mock data - in real app this would come from database
  const mockProjects: PlannerItem[] = [
    {
      id: '1',
      name: 'Bürogebäude München',
      type: 'project',
      tasks: [
        {
          id: '1',
          title: 'Elektroinstallation',
          startDate: new Date(2024, 0, 15),
          endDate: new Date(2024, 0, 25),
          status: 'in-progress',
          color: 'bg-blue-500'
        },
        {
          id: '2',
          title: 'Prüfung DGUV V3',
          startDate: new Date(2024, 0, 26),
          endDate: new Date(2024, 0, 28),
          status: 'planned',
          color: 'bg-orange-500'
        }
      ]
    },
    {
      id: '2',
      name: 'Fabrikhalle Stuttgart',
      type: 'project',
      tasks: [
        {
          id: '3',
          title: 'Schaltschrank Installation',
          startDate: new Date(2024, 0, 20),
          endDate: new Date(2024, 0, 30),
          status: 'planned',
          color: 'bg-green-500'
        }
      ]
    }
  ];

  const mockEmployees: PlannerItem[] = [
    {
      id: '1',
      name: 'Max Mustermann',
      type: 'employee',
      tasks: [
        {
          id: '4',
          title: 'Projekt München',
          startDate: new Date(2024, 0, 15),
          endDate: new Date(2024, 0, 25),
          status: 'in-progress',
          color: 'bg-blue-500'
        },
        {
          id: '5',
          title: 'Urlaub',
          startDate: new Date(2024, 0, 29),
          endDate: new Date(2024, 1, 2),
          status: 'planned',
          color: 'bg-gray-400'
        }
      ]
    },
    {
      id: '2',
      name: 'Anna Schmidt',
      type: 'employee',
      tasks: [
        {
          id: '6',
          title: 'Projekt Stuttgart',
          startDate: new Date(2024, 0, 20),
          endDate: new Date(2024, 0, 30),
          status: 'in-progress',
          color: 'bg-green-500'
        }
      ]
    }
  ];

  const currentItems = resourceType === 'projects' ? mockProjects : mockEmployees;

  const getDateRange = () => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  };

  const { start, end } = getDateRange();
  const dateRange = eachDayOfInterval({ start, end });

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const getTaskPosition = (task: Task, dayIndex: number, totalDays: number) => {
    const taskStart = Math.max(0, Math.floor((task.startDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const taskEnd = Math.min(totalDays - 1, Math.floor((task.endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    
    if (dayIndex < taskStart || dayIndex > taskEnd) return null;
    
    const isStart = dayIndex === taskStart;
    const isEnd = dayIndex === taskEnd;
    const width = taskEnd - taskStart + 1;
    
    return {
      isStart,
      isEnd,
      width,
      task
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold">Planer</h1>
          <Badge variant="outline" className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>Zeitplanung</span>
          </Badge>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select value={resourceType} onValueChange={(value: 'projects' | 'employees') => setResourceType(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="projects">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4" />
                  <span>Projekte</span>
                </div>
              </SelectItem>
              <SelectItem value="employees">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Mitarbeiter</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Woche</SelectItem>
              <SelectItem value="month">Monat</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>
                {viewMode === 'week' 
                  ? `${format(start, 'dd.MM', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`
                  : format(currentDate, 'MMMM yyyy', { locale: de })
                }
              </span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Heute
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 gap-0 border border-border rounded-lg overflow-hidden">
            {/* Header row with dates */}
            <div className="grid grid-cols-12 bg-muted">
              <div className="col-span-3 p-3 border-r border-border font-medium">
                {resourceType === 'projects' ? 'Projekt' : 'Mitarbeiter'}
              </div>
              <div className="col-span-9 grid grid-cols-subgrid">
                {dateRange.map((date, index) => (
                  <div
                    key={index}
                    className="p-2 text-center text-sm border-r border-border last:border-r-0"
                  >
                    <div className="font-medium">
                      {format(date, 'EEE', { locale: de })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(date, 'dd.MM', { locale: de })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resource rows */}
            {currentItems.map((item, itemIndex) => (
              <div
                key={item.id}
                className={`grid grid-cols-12 border-b border-border last:border-b-0 ${
                  itemIndex % 2 === 0 ? 'bg-background' : 'bg-muted/50'
                }`}
              >
                <div className="col-span-3 p-3 border-r border-border">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.tasks.length} Aufgabe(n)
                  </div>
                </div>
                
                <div className="col-span-9 relative h-16">
                  <div className="grid grid-cols-subgrid h-full">
                    {dateRange.map((date, dayIndex) => (
                      <div
                        key={dayIndex}
                        className="border-r border-border last:border-r-0 relative"
                      />
                    ))}
                  </div>
                  
                  {/* Task bars */}
                  {item.tasks.map((task) => {
                    const taskStart = Math.max(0, Math.floor((task.startDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                    const taskEnd = Math.min(dateRange.length - 1, Math.floor((task.endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                    
                    if (taskStart > dateRange.length - 1 || taskEnd < 0) return null;
                    
                    const width = ((taskEnd - taskStart + 1) / dateRange.length) * 100;
                    const left = (taskStart / dateRange.length) * 100;
                    
                    return (
                      <div
                        key={task.id}
                        className={`absolute top-2 h-10 ${task.color} rounded-md flex items-center px-2 text-white text-xs font-medium shadow-sm`}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          minWidth: '60px'
                        }}
                        title={`${task.title} (${format(task.startDate, 'dd.MM')} - ${format(task.endDate, 'dd.MM')})`}
                      >
                        <span className="truncate">{task.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>In Bearbeitung</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span>Geplant</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Abgeschlossen</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-400 rounded"></div>
              <span>Urlaub/Auszeit</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlannerModule;