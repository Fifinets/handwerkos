import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

const DashboardChef = () => {
  const [projects, setProjects] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ geplant: 0, in_bearbeitung: 0, abgeschlossen: 0 });
  const [topCustomers, setTopCustomers] = useState([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [delayedProjects, setDelayedProjects] = useState([]);

  useEffect(() => {
    fetchProjects();
    fetchTopCustomers();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*');
    if (error || !data) return;
    setProjects(data);

    // Da es kein Budget-Feld gibt, setzen wir es auf 0
    setTotalBudget(0);

    const counts = { geplant: 0, in_bearbeitung: 0, abgeschlossen: 0 };
    const delayed = [];
    const today = new Date();

    data.forEach(p => {
      // Verwende die tatsächlichen Status-Werte aus der DB
      if (p.status === 'geplant') counts.geplant++;
      else if (p.status === 'in_bearbeitung') counts["in_bearbeitung"]++;
      else if (p.status === 'abgeschlossen') counts.abgeschlossen++;
      
      if (p.end_date) {
        const endDate = new Date(p.end_date);
        if (endDate < today && p.status !== 'abgeschlossen') delayed.push(p);
      }
    });

    setStatusCounts(counts);
    setDelayedProjects(delayed);
  };

  const fetchTopCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*');
    if (error || !data) return;
    setTopCustomers(data.slice(0, 5)); // Zeige die ersten 5 Kunden
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard – Überblick</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p>Aktive Projekte</p><p className="text-2xl">{statusCounts.in_bearbeitung}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Abgeschlossene</p><p className="text-2xl">{statusCounts.abgeschlossen}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Gesamtbudget</p><p className="text-2xl">€{totalBudget.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Projekte gesamt</p><p className="text-2xl">{projects.length}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Aktuelle Projekte</CardTitle></CardHeader>
            <CardContent>
              {projects.slice(0, 5).map((project, i) => (
                <div key={i} className="p-2 border-b">
                  <div className="flex justify-between">
                    <span>{project.name}</span>
                    <Badge>{project.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> {project.start_date}
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
                  <span>{c.company_name}</span>
                  <span>{c.email}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Projekt Übersicht</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500">
                Gesamt: {projects.length} Projekte
              </div>
              <div className="text-sm">
                Geplant: {statusCounts.geplant}
              </div>
              <div className="text-sm">
                In Bearbeitung: {statusCounts.in_bearbeitung}
              </div>
              <div className="text-sm">
                Abgeschlossen: {statusCounts.abgeschlossen}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardChef;
