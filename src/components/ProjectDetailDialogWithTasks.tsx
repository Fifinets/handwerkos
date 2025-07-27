import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader as ShadCardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Project {
  id: string;
  name: string;
  customer: string;
  status: string;
  progress: number;
  startDate: string;
  endDate: string;
  budget?: string;
  location?: string;
}

interface ProjectDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

interface Task {
  id: string;
  project_id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

const ProjectDetailDialogWithTasks = ({ isOpen, onClose, project }: ProjectDetailDialogProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskEndDate, setTaskEndDate] = useState('');
  const [taskStatus, setTaskStatus] = useState('geplant');

  useEffect(() => {
    if (isOpen && project) {
      loadTasks(project.id);
    }
  }, [isOpen, project]);

  const loadTasks = async (projectId: string) => {
    setLoadingTasks(true);
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date', { ascending: true });
    if (!error && data) {
      setTasks(data as Task[]);
    }
    setLoadingTasks(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!taskName.trim()) return;
    const { error } = await supabase.from('project_tasks').insert({
      project_id: project.id,
      name: taskName,
      description: taskDescription,
      start_date: taskStartDate || null,
      end_date: taskEndDate || null,
      status: taskStatus,
    });
    if (!error) {
      setTaskName('');
      setTaskDescription('');
      setTaskStartDate('');
      setTaskEndDate('');
      setTaskStatus('geplant');
      loadTasks(project.id);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{project.name} – Details</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="overview" className="w-full mt-4">
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="tasks">Teilaufgaben</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <ShadCardHeader>
                  <CardTitle>Kunde</CardTitle>
                </ShadCardHeader>
                <CardContent>{project.customer}</CardContent>
              </Card>
              <Card>
                <ShadCardHeader>
                  <CardTitle>Status</CardTitle>
                </ShadCardHeader>
                <CardContent>{project.status}</CardContent>
              </Card>
              <Card>
                <ShadCardHeader>
                  <CardTitle>Budget</CardTitle>
                </ShadCardHeader>
                <CardContent>{project.budget || 'n/a'}</CardContent>
              </Card>
              <Card>
                <ShadCardHeader>
                  <CardTitle>Standort</CardTitle>
                </ShadCardHeader>
                <CardContent>{project.location || 'n/a'}</CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Aufgabenplan</h3>
              {loadingTasks ? (
                <p>Aufgaben werden geladen…</p>
              ) : tasks.length === 0 ? (
                <p>Keine Teilaufgaben vorhanden.</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((task) => (
                    <li key={task.id} className="border rounded-md p-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{task.name}</span>
                        <span className="text-xs text-gray-500">{task.status}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {task.description || '–'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {task.start_date && `Start: ${task.start_date}`} {task.end_date && `· Ende: ${task.end_date}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={handleCreateTask} className="mt-6 space-y-2">
                <h4 className="font-semibold">Neue Aufgabe</h4>
                <input
                  type="text"
                  className="border rounded-md p-2 w-full"
                  placeholder="Name der Aufgabe"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  required
                />
                <textarea
                  className="border rounded-md p-2 w-full"
                  placeholder="Beschreibung"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="border rounded-md p-2 flex-1"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                  />
                  <input
                    type="date"
                    className="border rounded-md p-2 flex-1"
                    value={taskEndDate}
                    onChange={(e) => setTaskEndDate(e.target.value)}
                  />
                </div>
                <select
                  className="border rounded-md p-2 w-full"
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value)}
                >
                  <option value="geplant">Geplant</option>
                  <option value="in_bearbeitung">In Bearbeitung</option>
                  <option value="abgeschlossen">Abgeschlossen</option>
                </select>
                <Button type="submit" className="w-full">
                  Aufgabe hinzufügen
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetailDialogWithTasks;
