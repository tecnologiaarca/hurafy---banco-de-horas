import React from 'react';
import { LayoutDashboard, FilePlus, Users, FileText, LogOut, Layers, Settings } from 'lucide-react';
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
    { id: 'reports', label: 'Relatórios', icon: FileText, roles: [Role.ADMIN, Role.LEADER] },
    { id: 'form', label: 'Nova Ocorrência', icon: FilePlus, roles: [Role.ADMIN, Role.LEADER] },
    { id: 'bulk', label: 'Lançamento em Massa', icon: Layers, roles: [Role.ADMIN] },
    { id: 'employees', label: 'Colaboradores', icon: Users, roles: [Role.ADMIN] },
    { id: 'settings', label: 'Configurações', icon: Settings, roles: [Role.ADMIN] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(currentRole));

  const getDisplayName = () => {
    if (!currentUser || !currentUser.name) return 'Usuário';
    const parts = currentUser.name.split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1]}`;
    }
    return parts[0];
  };

  const getInitials = () => {
     if (!currentUser || !currentUser.name) return 'US';
     const parts = currentUser.name.split(' ');
     if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
     return parts[0].slice(0,2).toUpperCase();
  };

  const roleLabel = currentRole === Role.ADMIN ? 'Administrador' : 'Líder';

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-0 shadow-xl flex flex-col`}>
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-wider uppercase text-white">Hurafy</h1>
          <p className="text-xs text-slate-400 mt-1">Formulário de Ocorrência</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 group ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center w-6 h-6 shrink-0">
                    <Icon size={20} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                </div>
                <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center space-x-3 px-4 py-3 mb-2 bg-slate-800/50 rounded-xl">
             <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-inner">
               {getInitials()}
             </div>
             <div className="overflow-hidden">
               <p className="text-sm font-semibold truncate text-slate-200" title={currentUser.name}>{getDisplayName()}</p>
               <p className="text-[10px] uppercase tracking-wider text-slate-400">{roleLabel}</p>
             </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors mt-1"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="text-sm font-medium">Sair do Sistema</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;