import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Loader2, 
  Settings as SettingsIcon,
  RefreshCw,
  Search
} from 'lucide-react';
import { AppSetting, Employee } from '../types';
import { firebaseService } from '../services/firebaseService';
import ConfirmModal from './ConfirmModal';

interface SettingsProps {
  companies: AppSetting[];
  teams: AppSetting[];
  employees: Employee[];
  refreshData: () => void;
}

const DEFAULT_COMPANIES = ['Arca Plast', 'Arca Mania', 'Rearca', 'Taex Transportadora'];
const DEFAULT_TEAMS = [
  'Embalagem', 'Engenharia', 'Estoque', 'Excelência Operacional', 'Financeiro', 
  'Gente e Gestão', 'Gestão', 'Gestão da Produção', 'Gestão Estratégica', 
  'Injeção', 'Logística', 'Manutenção', 'Marketing', 'Mercado', 
  'Serviços Gerais', 'Sopro', 'Suprimentos', 'TI'
];

const ManageList = ({ 
  title, 
  subtitle,
  icon: Icon, 
  items, 
  collectionName, 
  refreshData,
  deleteWarning 
}: { 
  title: string; 
  subtitle: string;
  icon: any; 
  items: AppSetting[]; 
  collectionName: 'settings_companies' | 'settings_areas';
  refreshData: () => void;
  deleteWarning?: string;
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [filter, setFilter] = useState('');

  // State para o Modal de Exclusão
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setLoading(true);
    try {
      await firebaseService.addSettingItem(collectionName, newItemName.trim());
      setNewItemName('');
      refreshData();
    } catch (error) {
      alert("Erro ao adicionar item.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: AppSetting) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    setLoading(true);
    try {
      await firebaseService.updateSettingItem(collectionName, editingId, editName.trim());
      setEditingId(null);
      refreshData();
    } catch (error) {
      alert("Erro ao atualizar item.");
    } finally {
      setLoading(false);
    }
  };

  // Abre o modal
  const requestDelete = (id: string) => {
    setItemToDelete(id);
  };

  // Executa a exclusão no Firebase
  const executeDelete = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    try {
      const success = await firebaseService.deleteSettingItem(collectionName, itemToDelete);
      if (success) {
        refreshData();
      } else {
        alert("Erro ao excluir item do banco de dados.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir item.");
    } finally {
      setIsDeleting(false);
      setItemToDelete(null); // Fecha o modal
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px] transition-all hover:shadow-md">
        {/* SaaS Card Header - Clean Slate/Indigo */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Icon size={20} />
            </div>
            <div>
              <h3 className="text-slate-800 font-bold text-base leading-tight">{title}</h3>
              <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full">
            {items.length}
          </span>
        </div>

        {/* Search Filter - Discrete */}
        <div className="border-b border-slate-100 p-3 bg-white">
          <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
              <input 
                  type="text" 
                  placeholder={`Filtrar ${title.toLowerCase()}...`}
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-600 placeholder-slate-400"
              />
          </div>
        </div>
        
        {/* Compact List Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white">
          {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                  <p>{filter ? 'Nenhum resultado encontrado.' : 'Nenhum item cadastrado.'}</p>
              </div>
          ) : (
              <ul className="divide-y divide-slate-50">
                  {filteredItems.map(item => (
                  <li key={item.id} className="group flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors">
                      {editingId === item.id ? (
                      <div className="flex flex-1 items-center gap-2 animate-fade-in">
                          <input 
                          autoFocus
                          type="text" 
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                          className="flex-1 text-sm border border-indigo-500 rounded px-2 py-1.5 focus:outline-none bg-white text-slate-900 shadow-sm"
                          />
                          <button onClick={handleUpdate} className="p-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded shadow-sm transition-colors"><Save size={14}/></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"><X size={14}/></button>
                      </div>
                      ) : (
                      <>
                          <span className="text-sm font-medium text-slate-700 truncate select-none">{item.name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button 
                              onClick={() => handleEdit(item)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" 
                              title="Editar"
                          >
                              <Edit2 size={14} />
                          </button>
                          <button 
                              onClick={() => requestDelete(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" 
                              title="Excluir"
                          >
                              <Trash2 size={14} />
                          </button>
                          </div>
                      </>
                      )}
                  </li>
                  ))}
              </ul>
          )}
        </div>

        {/* Footer Add Form - Compact & Elegant */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <form onSubmit={handleAdd} className="flex gap-2 items-center">
            <input 
              type="text" 
              placeholder="Adicionar novo..." 
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              disabled={loading}
              className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-slate-900 shadow-sm transition-shadow"
            />
            <button 
              type="submit" 
              disabled={loading || !newItemName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={3} />}
            </button>
          </form>
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={executeDelete}
        isLoading={isDeleting}
        title={`Excluir ${title.includes('Empresa') ? 'Empresa' : 'Área'}?`}
        message={deleteWarning || "Tem certeza? Isso pode afetar os filtros dos colaboradores já cadastrados."}
        confirmLabel="Sim, excluir"
        isDestructive={true}
      />
    </>
  );
};

const Settings: React.FC<SettingsProps> = ({ companies, teams, employees, refreshData }) => {
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    const performMigration = async () => {
       // TRAVA DE SEGURANÇA IMEDIATA: Se já existir QUALQUER dado, aborta para evitar duplicidade.
       if (companies.length > 0 || teams.length > 0) {
           return;
       }

       setIsMigrating(true);
       console.log("🔄 Iniciando Auto-Hidratação de configurações...");

       try {
          const uniqueCompanies = new Set(DEFAULT_COMPANIES);
          const uniqueTeams = new Set(DEFAULT_TEAMS);

          if (employees.length > 0) {
             employees.forEach(emp => {
                if (emp.company && emp.company.trim()) uniqueCompanies.add(emp.company.trim());
                if (emp.team && emp.team.trim()) uniqueTeams.add(emp.team.trim());
             });
          }

          const promises = [];

          for (const comp of uniqueCompanies) {
             if (comp) promises.push(firebaseService.addSettingItem('settings_companies', comp));
          }

          for (const team of uniqueTeams) {
             if (team) promises.push(firebaseService.addSettingItem('settings_areas', team));
          }

          if (promises.length > 0) {
            await Promise.all(promises);
            refreshData(); 
          }

       } catch (error) {
          console.error("Erro na migração automática:", error);
       } finally {
          setIsMigrating(false);
       }
    };

    performMigration();
  }, [companies.length, teams.length, employees]); 

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl shadow-sm">
               <SettingsIcon size={32} />
            </div>
            <div>
               <h2 className="text-2xl font-bold text-slate-800">Configurações do Sistema</h2>
               <p className="text-slate-500 mt-1">Gerencie as listas de dados mestres utilizados nos formulários.</p>
            </div>
        </div>
        
        {isMigrating && (
            <div className="flex items-center gap-3 text-indigo-800 bg-indigo-50 px-5 py-3 rounded-xl border border-indigo-100 shadow-sm animate-pulse">
                <RefreshCw size={20} className="animate-spin text-indigo-600" />
                <div>
                    <p className="text-sm font-bold">Sincronizando...</p>
                    <p className="text-xs text-indigo-500">Recuperando dados legados</p>
                </div>
            </div>
        )}
      </div>

      {/* Grid Layout - 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ManageList 
          title="Gestão de Empresas" 
          subtitle="Unidades de negócio ativas"
          icon={Building2} 
          items={companies} 
          collectionName="settings_companies"
          refreshData={refreshData}
          deleteWarning="Tem certeza? Isso pode afetar os filtros dos colaboradores já cadastrados."
        />
        <ManageList 
          title="Gestão de Áreas/Setores" 
          subtitle="Departamentos e equipes"
          icon={Briefcase} 
          items={teams} 
          collectionName="settings_areas"
          refreshData={refreshData}
          deleteWarning="Tem certeza? Isso pode afetar os filtros dos colaboradores já cadastrados."
        />
      </div>
    </div>
  );
};

export default Settings;