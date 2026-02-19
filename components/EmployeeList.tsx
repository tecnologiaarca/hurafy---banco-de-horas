import React, { useState } from 'react';
import { Plus, Trash2, Search, User, Shield, Briefcase, Edit, Loader2, Building2 } from 'lucide-react';
import { Employee, Role, AppSetting } from '../types';
import { firebaseService } from '../services/firebaseService';
import { v4 as uuidv4 } from 'uuid';
import ConfirmModal from './ConfirmModal';

interface EmployeeListProps {
  employees: Employee[];
  refreshData: () => void;
  currentUser: Employee; 
  companyList: AppSetting[];
  teamList: AppSetting[];
}

const EmployeeList: React.FC<EmployeeListProps> = ({ 
  employees, 
  refreshData, 
  currentUser,
  companyList,
  teamList
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  // Estado para controlar o modal de confirmação de exclusão
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>(Role.EMPLOYEE);
  const [newTeam, setNewTeam] = useState('');
  const [newCompany, setNewCompany] = useState('');

  const filteredEmployees = employees.filter(e => {
    return (
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleRoleChange = async (userId: string, newRole: Role) => {
    if (userId === currentUser.id) {
        alert("Você não pode alterar seu próprio cargo nesta tela.");
        return;
    }
    setLoadingAction(`role-${userId}`);
    try {
        const success = await firebaseService.updateUserRole(userId, newRole);
        if (success) {
            refreshData();
        } else {
            alert("Erro ao atualizar cargo.");
        }
    } catch (error) {
        console.error("Erro ao mudar role:", error);
    } finally {
        setLoadingAction(null);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setNewName('');
    setNewEmail('');
    setNewRole(Role.EMPLOYEE);
    setNewTeam('');
    setNewCompany('');
    setIsModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingId(employee.id);
    setNewName(employee.name);
    setNewEmail(employee.email || '');
    setNewRole(employee.role);
    setNewTeam(employee.team);
    setNewCompany(employee.company || '');
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany || !newTeam) {
        alert("Por favor, selecione uma Empresa e uma Equipe (Área). Se as listas estiverem vazias, vá em Configurações.");
        return;
    }
    setLoadingAction('save');
    
    let finalUsername = '';
    if (newEmail && newEmail.includes('@')) {
         finalUsername = newEmail.split('@')[0];
    } else {
         const cleanName = newName.toLowerCase().trim().split(' ');
         finalUsername = cleanName[0];
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

  // Solicita a exclusão abrindo o modal
  const requestDelete = (id: string) => {
    if (id === currentUser.id) {
        alert("Você não pode excluir sua própria conta.");
        return;
    }
    setEmployeeToDelete(id);
  };

  // Executa a exclusão no Firebase
  const executeDelete = async () => {
    if (!employeeToDelete) return;
    
    // Define loading action com o ID para mostrar spinner no botão (se visível) e no modal
    setLoadingAction(employeeToDelete);

    try {
      const success = await firebaseService.deleteEmployee(employeeToDelete);
      
      if (success) {
        // Apenas atualiza a lista após confirmação do Firebase
        refreshData();
        setEmployeeToDelete(null); // Fecha o modal
      } else {
        throw new Error("Falha ao excluir registro no banco de dados. Verifique suas permissões.");
      }
    } catch (error: any) {
      console.error("Erro na exclusão:", error);
      alert(`Erro: ${error.message || "Não foi possível excluir o colaborador."}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const isAdmin = currentUser.role === Role.ADMIN;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Gestão de Colaboradores</h2>
           <p className="text-sm text-slate-500">
             {employees.length} usuários cadastrados
           </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={openAddModal}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center transition-colors shadow-sm font-bold"
          >
            <Plus size={20} className="mr-2" />
            Novo Colaborador
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nome, email ou equipe..."
          className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 text-slate-900 focus:outline-none focus:placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        {employees.length === 0 ? (
           <div className="p-10 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Carregando colaboradores...</p>
           </div>
        ) : (
        <ul className="divide-y divide-slate-200">
          {filteredEmployees.map((employee) => (
            <li key={employee.id} className="p-4 hover:bg-slate-50 transition-colors animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                <div className="flex items-center min-w-0 gap-4 flex-1">
                  <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                    <User size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate flex items-center gap-2">
                      {employee.name}
                      {employee.id === currentUser.id && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Você</span>}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center mt-0.5">
                       <Building2 size={10} className="mr-1" />
                       {employee.company || 'Empresa não informada'} • {employee.team}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{employee.email || 'Sem email vinculado'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 justify-between md:justify-end w-full md:w-auto">
                  
                  <div className="flex flex-col items-end min-w-[140px]">
                    {isAdmin ? (
                        <div className="relative">
                            <select 
                                value={employee.role}
                                disabled={loadingAction === `role-${employee.id}` || employee.id === currentUser.id}
                                onChange={(e) => handleRoleChange(employee.id, e.target.value as Role)}
                                className={`appearance-none block w-full pl-3 pr-8 py-1.5 text-xs font-medium rounded-full border focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors cursor-pointer text-slate-900
                                    ${employee.role === Role.ADMIN ? 'bg-purple-50 text-purple-700 border-purple-200 focus:ring-purple-500' : 
                                      employee.role === Role.LEADER ? 'bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-500' : 
                                      'bg-slate-50 text-slate-700 border-slate-200 focus:ring-slate-500'}
                                    ${loadingAction === `role-${employee.id}` ? 'opacity-50' : ''}
                                `}
                            >
                                <option value={Role.EMPLOYEE}>Colaborador</option>
                                <option value={Role.LEADER}>Líder</option>
                                <option value={Role.ADMIN}>Administrador</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                {loadingAction === `role-${employee.id}` ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : (
                                    <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                                )}
                            </div>
                        </div>
                    ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          employee.role === Role.ADMIN ? 'bg-purple-100 text-purple-800' :
                          employee.role === Role.LEADER ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {employee.role === Role.ADMIN ? <Shield size={10} className="mr-1"/> : <Briefcase size={10} className="mr-1"/>}
                          {employee.role === Role.ADMIN ? 'Administrador' : employee.role === Role.LEADER ? 'Líder' : 'Colaborador'}
                        </span>
                    )}
                  </div>
                  
                  {isAdmin && (
                      <div className="flex items-center gap-1 border-l border-slate-200 pl-3 ml-2">
                        <button 
                          onClick={() => openEditModal(employee)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100"
                          title="Editar Detalhes"
                          disabled={loadingAction !== null}
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => requestDelete(employee.id)}
                          className={`text-slate-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50 ${employee.id === currentUser.id ? 'opacity-20 cursor-not-allowed' : ''}`}
                          title="Excluir"
                          disabled={loadingAction !== null || employee.id === currentUser.id}
                        >
                          {loadingAction === employee.id ? (
                            <Loader2 size={18} className="animate-spin text-red-600" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                  )}
                </div>
              </div>
            </li>
          ))}
          {filteredEmployees.length === 0 && (
            <li className="p-8 text-center text-slate-500">
              Nenhum colaborador encontrado com este filtro.
            </li>
          )}
        </ul>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800">
                {editingId ? 'Editar Colaborador' : 'Pré-cadastrar Colaborador'}
              </h3>
              <p className="text-xs text-slate-500">
                  {editingId ? 'Atualizar dados cadastrais.' : 'Cria um perfil que será vinculado quando o usuário fizer login.'}
              </p>
            </div>
            
            <form onSubmit={handleSaveEmployee} className="space-y-4 overflow-y-auto pr-3 custom-scrollbar flex-1 min-h-0">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome Completo</label>
                <input required type="text" className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email <span className="text-slate-400 text-xs">(Vinculação Google/Firebase)</span></label>
                <input 
                  type="email" 
                  required
                  placeholder="email@arcaplast.com.br"
                  className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" 
                  value={newEmail} 
                  onChange={e => setNewEmail(e.target.value)} 
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Empresa</label>
                    <select 
                      className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" 
                      value={newCompany} 
                      onChange={e => setNewCompany(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {companyList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    {companyList.length === 0 && <span className="text-xs text-red-500">Nenhuma empresa cadastrada. Vá em Configurações.</span>}
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Equipe (Área)</label>
                    <select 
                      className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900" 
                      value={newTeam} 
                      onChange={e => setNewTeam(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {teamList.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                    {teamList.length === 0 && <span className="text-xs text-red-500">Nenhuma área cadastrada. Vá em Configurações.</span>}
                 </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={loadingAction === 'save'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center font-bold">
                  {loadingAction === 'save' && <Loader2 size={16} className="animate-spin mr-2" />}
                  {editingId ? 'Salvar Alterações' : 'Criar Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal 
        isOpen={!!employeeToDelete}
        onClose={() => setEmployeeToDelete(null)}
        onConfirm={executeDelete}
        isLoading={loadingAction === employeeToDelete}
        title="Excluir Colaborador"
        message="Tem certeza que deseja remover este colaborador? Esta ação removerá o acesso ao sistema, mas o histórico de registros pode ser mantido."
        confirmLabel="Sim, Excluir"
        isDestructive={true}
      />
    </div>
  );
};

export default EmployeeList;