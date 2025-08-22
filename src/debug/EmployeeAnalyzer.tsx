import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisResult {
  employees: any[];
  profiles: any[];
  teamMembers: any[];
  currentUser: any;
  errors: string[];
}

const EmployeeAnalyzer: React.FC = () => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    const result: AnalysisResult = {
      employees: [],
      profiles: [],
      teamMembers: [],
      currentUser: null,
      errors: []
    };

    try {
      // 1. Current User
      const { data: currentUser, error: userError } = await supabase.auth.getUser();
      if (userError) {
        result.errors.push(`User Error: ${userError.message}`);
      } else {
        result.currentUser = currentUser.user;
      }

      // 2. Profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .limit(10);
        
      if (profileError) {
        result.errors.push(`Profile Error: ${profileError.message}`);
      } else {
        result.profiles = profiles || [];
      }

      // 3. Employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .limit(10);
        
      if (empError) {
        result.errors.push(`Employee Error: ${empError.message}`);
      } else {
        result.employees = employees || [];
      }

      // 4. Team Members
      const { data: teamMembers, error: teamError } = await supabase
        .from('project_team_members')
        .select('*')
        .limit(10);
        
      if (teamError) {
        result.errors.push(`Team Members Error: ${teamError.message}`);
      } else {
        result.teamMembers = teamMembers || [];
      }

    } catch (error) {
      result.errors.push(`General Error: ${error}`);
    }

    setAnalysis(result);
    setLoading(false);
  };

  useEffect(() => {
    runAnalysis();
  }, []);

  if (loading) {
    return <div className="p-4">🔍 Analysiere Datenbank...</div>;
  }

  if (!analysis) {
    return <div className="p-4">❌ Keine Analyse verfügbar</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔍 Supabase Mitarbeiter-Analyse</h1>
      
      {analysis.errors.length > 0 && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <h3 className="font-bold">❌ Fehler:</h3>
          <ul className="list-disc list-inside">
            {analysis.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current User */}
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="font-bold text-blue-800 mb-2">👤 Aktueller Benutzer</h3>
          <pre className="text-sm bg-white p-2 rounded overflow-auto">
            {JSON.stringify(analysis.currentUser, null, 2)}
          </pre>
        </div>

        {/* Profiles */}
        <div className="bg-green-50 p-4 rounded">
          <h3 className="font-bold text-green-800 mb-2">👥 Profile ({analysis.profiles.length})</h3>
          <div className="text-sm bg-white p-2 rounded max-h-40 overflow-auto">
            {analysis.profiles.map((profile, i) => (
              <div key={i} className="mb-2 p-2 border-b">
                <div><strong>ID:</strong> {profile.id}</div>
                <div><strong>Email:</strong> {profile.email}</div>
                <div><strong>Company ID:</strong> {profile.company_id || 'NULL'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Employees */}
        <div className="bg-yellow-50 p-4 rounded">
          <h3 className="font-bold text-yellow-800 mb-2">🧑‍💼 Mitarbeiter ({analysis.employees.length})</h3>
          <div className="text-sm bg-white p-2 rounded max-h-40 overflow-auto">
            {analysis.employees.map((emp, i) => (
              <div key={i} className="mb-2 p-2 border-b">
                <div><strong>Name:</strong> {emp.first_name} {emp.last_name}</div>
                <div><strong>Email:</strong> {emp.email}</div>
                <div><strong>Status:</strong> {emp.status || 'NULL'}</div>
                <div><strong>Company ID:</strong> {emp.company_id || 'NULL'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-purple-50 p-4 rounded">
          <h3 className="font-bold text-purple-800 mb-2">🤝 Team-Zuweisungen ({analysis.teamMembers.length})</h3>
          <div className="text-sm bg-white p-2 rounded max-h-40 overflow-auto">
            {analysis.teamMembers.map((tm, i) => (
              <div key={i} className="mb-2 p-2 border-b">
                <div><strong>Project:</strong> {tm.project_id}</div>
                <div><strong>Employee:</strong> {tm.employee_id}</div>
                <div><strong>Assigned:</strong> {tm.assigned_at}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="font-bold mb-2">📊 Analyse-Zusammenfassung:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Benutzer angemeldet: {analysis.currentUser ? '✅ Ja' : '❌ Nein'}</li>
          <li>Profile mit company_id: {analysis.profiles.filter(p => p.company_id).length}/{analysis.profiles.length}</li>
          <li>Mitarbeiter mit company_id: {analysis.employees.filter(e => e.company_id).length}/{analysis.employees.length}</li>
          <li>Aktive Mitarbeiter: {analysis.employees.filter(e => e.status === 'active' || e.status === 'Active').length}</li>
          <li>Team-Zuweisungen: {analysis.teamMembers.length}</li>
        </ul>
      </div>

      <button 
        onClick={runAnalysis}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        🔄 Analyse erneut ausführen
      </button>
    </div>
  );
};

export default EmployeeAnalyzer;