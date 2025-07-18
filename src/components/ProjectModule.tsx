import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

const DashboardChef = () => {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ Planung: 0, "In Bearbeitung": 0, Abgeschlossen: 0 });
  const [topCustomers, setTopCustomers] = useState([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [delayedProjects, setDelayedProjects] = useState([]);
  const [projectProgress, setProjectProgress] = useState([]);

  useEffect(() => {
    fetchProjects();
    fetchTasks();
    fetchTopCustomers();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*');
    if (error || !data) return;
    setProjects(data);

    const budgetSum = data.reduce((sum, p) => {
      const cleanBudget = typeof p.budget === 'string' ? parseFloat(p.budget.replace(/[^0-9,.-]+/g, '').replace(',', '.')) : p.budget;
      return sum + (isNaN(cleanBudget) ? 0 : cleanBudget);
    }, 0);
    setTotalBudget(budgetSum);

    const counts = { Planung: 0, "In Bearbeitung": 0, Abgeschlossen: 0 };
    const delayed = [];
    const progressList = [];
    const today = new Date();

    data.forEach(p => {
      if (p.status in counts) counts[p.status]++;
      const endDate = new Date(p.end_date);
      if (endDate < today && p.status !== 'Abgeschlossen') delayed.push(p);
      if (typeof p.progress === 'number') {
        progressList.push({ name: p.name, progress: p.progress });
      }
    });

    setStatusCounts(counts);
    setDelayedProjects(delayed);
    setProjectProgress(progressList);
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase.from('tasks').select('*');
    if (error || !data) return;
    setTasks(data);
  };

  const fetchTopCustomers = async () => {
    const { data, error } = await supabase.rpc('get_top_customers');
    if (error || !data) return;
    setTopCustomers(data);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard – Überblick</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p>Aktive Projekte</p><p className="text-2xl">{statusCounts['In Bearbeitung']}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Abgeschlossene</p><p className="text-2xl">{statusCounts['Abgeschlossen']}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Gesamtbudget</p><p className="text-2xl">€{totalBudget.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Offene Aufgaben</p><p className="text-2xl">{tasks.length}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Anstehende Aufgaben</CardTitle></CardHeader>
            <CardContent>
              {tasks.map((task, i) => (
                <div key={i} className="p-2 border-b">
                  <div className="flex justify-between">
                    <span>{task.title}</span>
                    <Badge>{task.priority}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> {task.date}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Verzögerte Projekte</CardTitle></CardHeader>
            <CardContent>
              {delayedProjects.length === 0 ? (
                <p className="text-sm text-gray-500">Keine Projekte im Verzug</p>
              ) : delayedProjects.map((p, i) => (
                <div key={i} className="flex justify-between border-b py-1">
                  <span>{p.name}</span>
                  <Badge variant="destructive">überfällig</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Projektstatus</CardTitle></CardHeader>
            <CardContent>
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span>{status}</span>
                  <span>{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Kunden</CardTitle></CardHeader>
            <CardContent>
              {topCustomers.map((c, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span>€{!isNaN(parseFloat(c.revenue)) ? parseFloat(c.revenue).toLocaleString() : '0'}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Projektfortschritt</CardTitle></CardHeader>
            <CardContent>
              {projectProgress.map((p, i) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{p.name}</span>
                    <span>{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardChef;
