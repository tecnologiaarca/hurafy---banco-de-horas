import React, { useState } from 'react';
import { Plus, Trash2, Search, User, Shield, Briefcase, Edit, Loader2, Lock, Building2 } from 'lucide-react';
import { Employee, Role } from '../types';
import { TEAMS, COMPANIES } from '../constants';
import { firebaseService } from '../services/firebaseService';
import { v4 as uuidv4 } from 'uuid';

interface EmployeeListProps {
  employees: Employee[];
  refreshData: () => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, refreshData }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  // Optimistic UI state
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  // Password logic removed from this specific UI as Firebase handles auth separately,
  // but we keep the concept of creating the employee profile.
  const [newRole, setNewRole] = useState<Role>(Role.EMPLOYEE);
  const [newTeam, setNewTeam] = useState(TEAMS[0]);
  const [newCompany, setNewCompany] = useState(COMPANIES[0]);

  const filteredEmployees = employees.filter(e => {
    if (deletedIds.has(e.id)) return false;
    return (
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.team.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const openAddModal = () => {
    setEditingId(null);
    setNewName('');
    setNewUsername('');
    setNewEmail('');
    setNewRole(Role.EMPLOYEE);
    setNewTeam(TEAMS[0]);
    setNewCompany(COMPANIES[0]);
    setIsModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingId(employee.id);
    setNewName(employee.name);
    setNewUsername(employee.username);
    setNewEmail(employee.email || '');
    setNewRole(employee.role);
    setNewTeam(employee.team);
    setNewCompany(employee.company || COMPANIES[0]);
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction('save');
    
    let finalUsername = newUsername;

    // Gerador de username simples se não fornecido
    if (!finalUsername) {
        if (newEmail && newEmail.includes('@')) {
             finalUsername = newEmail.split('@')[0];
        } else {
             const cleanName = newName.toLowerCase().trim().split(' ');
             const baseName = cleanName.length > 1 
                ? `${cleanName[0]}.${cleanName[cleanName.length - 1]}` 
                : cleanName[0];
             finalUsername = baseName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, "");
        }
    }

    const employeeData: Employee = {
      id: editingId || uuidv4(),
      username: finalUsername,
      name: newName,
      email: newEmail,
      role: newRole,
      team: newTeam,
      company: newCompany,
      active: true,
    };

    try {
      if (editingId) {
        await firebaseService.updateEmployee(employeeData);
      } else {
        await firebaseService.addEmployee(employeeData);
      }
      refreshData();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving employee:", error);
      alert("Erro ao salvar.");
    } finally {
      setLoadingAction(null);
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este colaborador?')) {
      setLoadingAction(id);
      setDeletedIds(prev => new Set(prev).add(id));
      const success = await firebaseService.deleteEmployee(id);
      
      if (success) {
        refreshData();
      } else {
        alert("Erro ao excluir do banco de dados.");
        setDeletedIds(prev => {
           const newSet = new Set(prev);
           newSet.delete(id);
           return newSet;
        });
      }
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Gestão de Colaboradores</h2>
        <div className="flex gap-2">
          <button 
            onClick={openAddModal}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Colaborador
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nome ou equipe..."
          className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 text-slate-900 focus:outline-none focus:placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <ul className="divide-y divide-slate-200">
          {filteredEmployees.map((employee) => (
            <li key={employee.id} className="p-4 hover:bg-slate-50 transition-colors animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center min-w-0 gap-4">
                  <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <User size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{employee.name}</p>
                    <p className="text-xs text-slate-400 flex items-center mt-0.5">
                       <Building2 size={10} className="mr-1" />
                       {employee.company || 'Empresa não informada'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{employee.email || 'Sem email'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex flex-col items-end">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      employee.role === Role.ADMIN ? 'bg-purple-100 text-purple-800' :
                      employee.role === Role.LEADER ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {employee.role === Role.ADMIN ? <Shield size={10} className="mr-1"/> : <Briefcase size={10} className="mr-1"/>}
                      {employee.role === Role.ADMIN ? 'Administrador' : employee.role === Role.LEADER ? 'Líder' : 'Colaborador'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">{employee.team}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openEditModal(employee)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-indigo-50"
                      title="Editar"
                      disabled={loadingAction === employee.id}
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(employee.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                      title="Excluir"
                      disabled={loadingAction === employee.id}
                    >
                      {loadingAction === employee.id ? (
                        <Loader2 size={18} className="animate-spin text-red-600" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
          {filteredEmployees.length === 0 && (
            <li className="p-8 text-center text-slate-500">
              {employees.length > 0 ? 'Nenhum colaborador encontrado com este filtro.' : 'Nenhum colaborador cadastrado.'}
            </li>
          )}
        </ul>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800">
                {editingId ? 'Editar Colaborador' : 'Adicionar Colaborador'}
              </h3>
              <p className="text-xs text-slate-500">Dados do perfil no sistema.</p>
            </div>
            
            <form onSubmit={handleSaveEmployee} className="space-y-4 overflow-y-auto pr-3 custom-scrollbar flex-1 min-h-0">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome Completo</label>
                <input required type="text" className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Empresa</label>
                    <select className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" value={newCompany} onChange={e => setNewCompany(e.target.value)}>
                      {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Equipe</label>
                    <select className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" value={newTeam} onChange={e => setNewTeam(e.target.value)}>
                      {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Permissão</label>
                    <select className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" value={newRole} onChange={e => setNewRole(e.target.value as Role)}>
                      <option value={Role.EMPLOYEE}>Colaborador</option>
                      <option value={Role.LEADER}>Líder</option>
                      <option value={Role.ADMIN}>Administrador</option>
                    </select>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email <span className="text-slate-400 font-normal text-xs">(Opcional)</span></label>
                <input 
                  type="email" 
                  className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" 
                  value={newEmail} 
                  onChange={e => setNewEmail(e.target.value)} 
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={loadingAction === 'save'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center">
                  {loadingAction === 'save' && <Loader2 size={16} className="animate-spin mr-2" />}
                  {editingId ? 'Salvar Alterações' : 'Criar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;