import { Outlet, useNavigate } from 'react-router-dom';
import { EmployeeSidebar } from './EmployeeSidebar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function EmployeeLayout() {
  const { employee, isLoading } = useEmployeePermissions();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-gray-500">Wird geladen...</p></div>;
  }
  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-96"><CardContent className="pt-6 text-center">
          <p className="text-gray-500">Kein Mitarbeiter-Profil gefunden.</p>
          <Button className="mt-4" onClick={() => navigate('/auth')}>Zur Anmeldung</Button>
        </CardContent></Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen w-full bg-slate-50 flex">
      <EmployeeSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-slate-800">Mitarbeiter Arbeitsbereich</h2>
          <div className="flex items-center space-x-3"><ThemeToggle /></div>
        </header>
        <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
export default EmployeeLayout;
