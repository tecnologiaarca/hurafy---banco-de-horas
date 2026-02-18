import React from 'react';
import { LayoutDashboard, FilePlus, Users, FileText, LogOut } from 'lucide-react';
import { Role, Employee } from '../types';

interface SidebarProps {
  currentUser: Employee;
  currentRole: Role;
  currentPage: string;
  setPage: (page: string) => void;
  onLogout: () => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, currentRole, currentPage, setPage, onLogout, isOpen }) => {
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [Role.ADMIN, Role.LEADER] },
    { id: 'form', label: 'Nova Ocorrência', icon: FilePlus, roles: [Role.ADMIN, Role.LEADER] },
    { id: 'employees', label: 'Colaboradores', icon: Users, roles: [Role.ADMIN] },
    { id: 'reports', label: 'Relatórios', icon: FileText, roles: [Role.ADMIN, Role.LEADER] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(currentRole));

  // Helper to get First and Last Name
  const getDisplayName = () => {
    if (!currentUser || !currentUser.name) return 'Usuário';
    const parts = currentUser.name.split(' ');
    if (parts.length > 1) {
      // Returns First Name + Last Name (or second word)
      return `${parts[0]} ${parts[parts.length - 1]}`; // Or just parts[1] for strictly second name
    }
    return parts[0];
  };

  // Helper for Initials based on Name
  const getInitials = () => {
     if (!currentUser || !currentUser.name) return 'US';
     const parts = currentUser.name.split(' ');
     if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
     return parts[0].slice(0,2).toUpperCase();
  };

  const roleLabel = currentRole === Role.ADMIN ? 'Administrador' : 'Líder';

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-0 shadow-xl`}>
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-wider uppercase">Hurafy</h1>
          <p className="text-xs text-slate-400 mt-1">Formulário de Ocorrência</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center space-x-3 px-4 py-3 mb-2">
             <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold shrink-0">
               {getInitials()}
             </div>
             <div className="overflow-hidden">
               <p className="text-sm font-medium truncate" title={currentUser.name}>{getDisplayName()}</p>
               <p className="text-xs text-slate-400">{roleLabel}</p>
             </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Sair / Trocar Perfil</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;