import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Filter, Calendar, CheckSquare, Square, 
  Save, Loader2, Building2, Briefcase, Check, AlertCircle 
} from 'lucide-react';
import { Employee, RecordType, TimeRecord, AppSetting } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { firebaseService } from '../services/firebaseService';

interface BulkOccurrenceProps {
  employees: Employee[];
  currentUser: Employee;
  onRecordsAdded: () => void;
  companyList: AppSetting[];
  teamList: AppSetting[];
}

const BULK_TYPES = [
  { label: 'BH Positivo (Crédito)', type: RecordType.CREDIT },
  { label: 'BH Negativo (Débito)', type: RecordType.DEBIT },
  { label: 'Ajuste de Ponto (Manual)', type: RecordType.NEUTRAL },
];

const BulkOccurrence: React.FC<BulkOccurrenceProps> = ({ 
  employees, 
  currentUser, 
  onRecordsAdded,
  companyList,
  teamList
}) => {
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [occurrenceLabel, setOccurrenceLabel] = useState(BULK_TYPES[0].label);
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [observation, setObservation] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchCompany = selectedCompany ? e.company === selectedCompany : true;
      const matchTeam = selectedTeam ? e.team === selectedTeam : true;
      return matchCompany && matchTeam && e.active;
    });
  }, [employees, selectedCompany, selectedTeam]);

  const handleSelectAll = () => {
    if (selectedUserIds.size === filteredEmployees.length) {
      setSelectedUserIds(new Set()); 
    } else {
      setSelectedUserIds(new Set(filteredEmployees.map(e => e.id))); 
    }
  };

  const handleToggleUser = (id: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedUserIds(newSet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.size === 0) {
      alert("Selecione pelo menos um colaborador.");
      return;
    }
    if (!observation) {
      alert("A observação é obrigatória para lançamentos em massa.");
      return;
    }

    setLoading(true);

    try {
      const typeObj = BULK_TYPES.find(t => t.label === occurrenceLabel);
      const recordType = typeObj ? typeObj.type : RecordType.NEUTRAL;
      const batchId = uuidv4();

      const recordsToSave: TimeRecord[] = Array.from(selectedUserIds).map(userId => {
        const emp = employees.find(e => e.id === userId);
        return {
          id: uuidv4(),
          batchId: batchId,
          employeeId: userId,
          employeeName: emp?.name || 'Desconhecido',
          date: date,
          hours: Number(hours),
          minutes: Number(minutes),
          startTime: '', 
          endTime: '',   
          type: recordType,
          occurrenceType: occurrenceLabel,
          reason: observation,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.id,
        };
      });

      const result = await firebaseService.saveBulkOccurrences(recordsToSave);

      if (result.success) {
        setSuccessMsg(`Lançamento concluído com sucesso para ${result.count} colaboradores!`);
        onRecordsAdded();
        
        setSelectedUserIds(new Set());
        setObservation('');
        setHours(0);
        setMinutes(0);
        
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
          throw new Error("Falha na gravação em massa.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro de conexão: Não foi possível salvar os dados. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  };

  const getSelectedTypeImpact = () => {
    const typeObj = BULK_TYPES.find(t => t.label === occurrenceLabel);
    if (!typeObj) return null;
    if (typeObj.type === RecordType.CREDIT) return <span className="text-emerald-600 font-medium text-xs ml-2">(Adiciona Horas)</span>;
    if (typeObj.type === RecordType.DEBIT) return <span className="text-red-600 font-medium text-xs ml-2">(Desconta Horas)</span>;
    return <span className="text-slate-500 font-medium text-xs ml-2">(Apenas Histórico)</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      
      {successMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-md w-full mx-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check size={32} className="text-green-600" strokeWidth={3} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Sucesso!</h3>
            <p className="text-slate-600 text-center">{successMsg}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
          <Users size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Lançamento em Massa (RH)</h2>
          <p className="text-slate-500">Aplique ocorrências para múltiplos colaboradores de uma só vez.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
          
          <div className="p-4 border-b border-slate-200 space-y-4 bg-slate-50/50 rounded-t-2xl">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                 <Building2 className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                 <select 
                   value={selectedCompany} 
                   onChange={e => setSelectedCompany(e.target.value)}
                   className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-white text-slate-700"
                 >
                   <option value="">Todas as Empresas</option>
                   {companyList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                 </select>
              </div>
              <div className="flex-1 relative">
                 <Briefcase className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                 <select 
                   value={selectedTeam} 
                   onChange={e => setSelectedTeam(e.target.value)}
                   className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-white text-slate-700"
                 >
                   <option value="">Todos os Setores</option>
                   {teamList.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                 </select>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {filteredEmployees.length} Colaboradores
              </span>
              <button 
                onClick={handleSelectAll}
                className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1 transition-colors"
              >
                {selectedUserIds.size === filteredEmployees.length && filteredEmployees.length > 0 ? (
                  <><CheckSquare size={16}/> Desmarcar Todos</>
                ) : (
                  <><Square size={16}/> Selecionar Todos</>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredEmployees.length > 0 ? (
              <div className="space-y-1">
                {filteredEmployees.map(emp => {
                  const isSelected = selectedUserIds.has(emp.id);
                  return (
                    <div 
                      key={emp.id}
                      onClick={() => handleToggleUser(emp.id)}
                      className={`flex items-center p-3 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                    >
                      <div className={`mr-4 transition-colors ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{emp.name}</p>
                        <p className="text-xs text-slate-500">{emp.company} - {emp.team}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Nenhum colaborador encontrado com os filtros atuais.
              </div>
            )}
          </div>
          
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 rounded-b-2xl">
             {selectedUserIds.size} selecionados
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 h-fit sticky top-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
             <Filter className="mr-2 text-indigo-600" size={20}/>
             Detalhes do Lançamento
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Data da Ocorrência</label>
              <div className="relative">
                 <Calendar className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                 <input 
                   type="date" 
                   required
                   value={date}
                   onChange={e => setDate(e.target.value)}
                   className="block w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900 placeholder-slate-400 text-sm transition-all shadow-sm"
                 />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Tipo de Ocorrência {getSelectedTypeImpact()}
              </label>
              <select 
                value={occurrenceLabel}
                onChange={e => setOccurrenceLabel(e.target.value)}
                className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900 text-sm transition-all shadow-sm"
              >
                {BULK_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Impacto (Opcional)</label>
              <div className="grid grid-cols-2 gap-3">
                 <div>
                    <input 
                      type="number" 
                      min="0" 
                      value={hours}
                      onChange={e => setHours(Number(e.target.value))}
                      placeholder="0"
                      className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900 placeholder-slate-400 text-sm transition-all shadow-sm"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block text-center uppercase tracking-wide">Horas</span>
                 </div>
                 <div>
                    <input 
                      type="number" 
                      min="0" max="59"
                      value={minutes}
                      onChange={e => setMinutes(Number(e.target.value))}
                      placeholder="0"
                      className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900 placeholder-slate-400 text-sm transition-all shadow-sm"
                    />
                     <span className="text-[10px] text-slate-400 mt-1 block text-center uppercase tracking-wide">Minutos</span>
                 </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Observação Coletiva</label>
              <textarea 
                required
                rows={3}
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder="Justificativa para o lançamento em lote..."
                className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900 placeholder-slate-400 text-sm transition-all resize-none shadow-sm"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || selectedUserIds.size === 0}
                className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold transition-all duration-300 ${
                  loading || selectedUserIds.size === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5 shadow-md'
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Processando...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Save className="mr-2" size={18} />
                    {selectedUserIds.size > 0 ? `Lançar para ${selectedUserIds.size} colaboradores` : 'Selecione Colaboradores'}
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default BulkOccurrence;