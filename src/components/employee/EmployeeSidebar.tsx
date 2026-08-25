import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Clock, Plane, UserCircle, Receipt, LogOut, User } from 'lucide-react';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

const NAV = [
  { to: '/employee', end: true, icon: LayoutDashboard, label: 'Übersicht' },
  { to: '/employee/projekte', icon: Building2, label: 'Meine Projekte' },
  { to: '/employee/zeiterfassung', icon: Clock, label: 'Zeiterfassung' },
  { to: '/employee/urlaub', icon: Plane, label: 'Urlaub' },
  { to: '/employee/profil', icon: UserCircle, label: 'Mein Profil' },
];

export function EmployeeSidebar() {
  const { employee, isManager, canViewInvoices } = useEmployeePermissions();
  const { signOut } = useSupabaseAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
      isActive ? 'bg-slate-800 text-teal-400 font-medium'
               : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`;
  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            <User className="h-5 w-5 text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{employee?.first_name} {employee?.last_name}</p>
            <p className="text-xs text-slate-500">{isManager ? 'Manager' : 'Mitarbeiter'}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            <item.icon className="h-5 w-5" />
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}
        {canViewInvoices() && (
          <NavLink to="/employee/rechnungen" className={linkClass}>
            <Receipt className="h-5 w-5" />
            <span className="text-sm">Rechnungen</span>
          </NavLink>
        )}
      </nav>
      <div className="p-2 border-t border-slate-800/60">
        <button onClick={async () => { await signOut(); navigate('/auth'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-red-400 hover:bg-red-950/30 transition-colors">
          <LogOut className="h-5 w-5" />
          <span className="text-sm">Abmelden</span>
        </button>
      </div>
    </aside>
  );
}
export default EmployeeSidebar;
