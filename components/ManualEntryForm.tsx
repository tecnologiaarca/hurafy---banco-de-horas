import React, { useState, useRef, useEffect } from 'react';
import { Save, User, ChevronDown, Check, Loader2, ClipboardList, AlertCircle, Clock } from 'lucide-react';
import { Employee, RecordType, TimeRecord, Role } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { firebaseService } from '../services/firebaseService';

interface ManualEntryFormProps {
  currentUser: Employee;
  employees: Employee[];
  onRecordAdded: () => void;
}

const MANUAL_OCCURRENCE_OPTIONS = [
  { label: 'Ajuste de Ponto (Esquecimento)', type: RecordType.CREDIT },
  { label: 'Trabalho Externo', type: RecordType.CREDIT },
  { label: 'Batida Esquecida (Regularização)', type: RecordType.NEUTRAL }, // Nova Opção
  { label: 'Hora Extra', type: RecordType.CREDIT },
  { label: 'Falta Não Justificada', type: RecordType.DEBIT },
  { label: 'Suspensão', type: RecordType.DEBIT },
  { label: 'Saída Antecipada', type: RecordType.DEBIT },
  { label: 'Atestado Médico', type: RecordType.NEUTRAL },
  { label: 'Falta Justificada', type: RecordType.NEUTRAL },
];

const ManualEntryForm: React.FC<ManualEntryFormProps> = ({ currentUser, employees, onRecordAdded }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // States para Quantidade (Duração)
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);

  // State para Regularização (Horário específico)
  const [specificTime, setSpecificTime] = useState('');

  // Define o valor inicial com o primeiro item da lista atualizada
  const [occurrenceType, setOccurrenceType] = useState<string>(MANUAL_OCCURRENCE_OPTIONS[0].label);
  const [mappedRecordType, setMappedRecordType] = useState<RecordType>(MANUAL_OCCURRENCE_OPTIONS[0].type);
  const [observations, setObservations] = useState('');

  // Search/Autocomplete State
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Verifica se é uma regularização de esquecimento
  const isRegularization = occurrenceType === 'Batida Esquecida (Regularização)';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const option = MANUAL_OCCURRENCE_OPTIONS.find(o => o.label === occurrenceType);
    if (option) {
      setMappedRecordType(option.type);
    }
    // Limpa campos ao trocar de tipo para evitar confusão visual
    if (occurrenceType !== 'Batida Esquecida (Regularização)') {
      setSpecificTime('');
    } else {
      setHours(0);
      setMinutes(0);
    }
  }, [occurrenceType]);

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp.id);
    setSearchTerm(emp.name);
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedEmployee || !date || !observations) {
        setError("Preencha todos os campos obrigatórios.");
        return;
    }

    // Validação Específica por Tipo
    if (isRegularization) {
      if (!specificTime) {
        setError("Informe o horário da batida esquecida.");
        return;
      }
    } else {
      // Validação de tempo para tipos normais (exceto Neutros informativos que não sejam regularização)
      // Ajuste de Ponto e Trabalho Externo exigem tempo pois impactam o banco.
      if (hours === 0 && minutes === 0 && mappedRecordType !== RecordType.NEUTRAL) {
         setError("Informe a quantidade de horas/minutos para este tipo de lançamento.");
         return;
      }
    }

    setLoading(true);
    
    const employee = employees.find(e => e.id === selectedEmployee);
    
    // Objeto de registro manual
    const newRecord: TimeRecord = {
      id: uuidv4(),
      employeeId: selectedEmployee,
      employeeName: employee?.name || 'Desconhecido',
      date,
      // Se for regularização, o impacto no banco é ZERO.
      hours: isRegularization ? 0 : Number(hours),
      minutes: isRegularization ? 0 : Number(minutes),
      
      // Se for regularização, salvamos o horário específico no startTime para referência.
      // Caso contrário, deixamos vazio pois é um lançamento por quantidade (duração).
      startTime: isRegularization ? specificTime : '', 
      endTime: '',
      
      type: mappedRecordType,
      occurrenceType,
      reason: observations, 
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
      
      // Campo especial para identificar regularização no banco
      status: isRegularization ? 'regularized' : undefined
    };

    try {
      await firebaseService.saveManualOccurrence(newRecord);
      
      setSuccess(true);
      onRecordAdded();
      
      // Reset form parcial
      setSelectedEmployee('');
      setSearchTerm('');
      setObservations('');
      setHours(0);
      setMinutes(0);
      setSpecificTime('');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar lançamento manual:", error);
      setError("Erro ao salvar no banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      
      {/* SUCCESS POPUP MODAL */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4 transform transition-all scale-100">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check size={32} className="text-green-600" strokeWidth={3} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Lançamento Efetuado!</h3>
            <p className="text-slate-600 text-center">Ocorrência registrada no histórico do colaborador.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 p-6 text-white border-b border-slate-700">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-700 rounded-lg">
                <ClipboardList className="w-6 h-6 text-indigo-400" />
             </div>
             <div>
                <h2 className="text-xl font-bold">Lançamento Manual (RH)</h2>
                <p className="text-slate-400 text-sm mt-1">Registre ajustes, faltas ou trabalhos externos.</p>
             </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {error && (
             <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center text-sm">
                <AlertCircle size={16} className="mr-2" />
                {error}
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Employee Autocomplete */}
            <div className="col-span-1 md:col-span-2 relative" ref={dropdownRef}>
              <label className="block text-sm font-medium text-slate-700 mb-2">Colaborador</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedEmployee(''); 
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Pesquisar por nome..."
                  className={`block w-full pl-10 pr-10 py-3 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg border bg-slate-50 text-slate-900 placeholder-slate-400 ${selectedEmployee ? 'border-green-500 ring-1 ring-green-500 bg-green-50' : ''}`}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                   {selectedEmployee ? (
                     <div className="text-green-600 bg-green-100 rounded-full p-0.5">
                        <Check size={14} strokeWidth={3} />
                     </div>
                   ) : (
                     <ChevronDown className="h-5 w-5 text-slate-400" />
                   )}
                </div>
              </div>

              {/* Dropdown List */}
              {isDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-xl max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => handleSelectEmployee(emp)}
                        className="cursor-pointer select-none relative py-3 pl-10 pr-4 hover:bg-slate-100 text-slate-900 border-b border-slate-50 last:border-0 transition-colors"
                      >
                         <span className={`block truncate ${selectedEmployee === emp.id ? 'font-semibold text-indigo-700' : 'font-normal'}`}>
                          {emp.name}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">({emp.team} - {emp.company})</span>
                        
                        {selectedEmployee === emp.id && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                            <Check className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="cursor-default select-none relative py-3 px-4 text-slate-500 text-center">
                      Nenhum colaborador encontrado.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Data da Ocorrência</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full px-3 py-3 border-slate-300 rounded-lg border bg-slate-50 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900"
              />
            </div>

            {/* Type Dropdown */}
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Ocorrência</label>
               <select
                  value={occurrenceType}
                  onChange={(e) => setOccurrenceType(e.target.value)}
                  className="block w-full px-3 py-3 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg border bg-slate-50 text-slate-900"
               >
                 {MANUAL_OCCURRENCE_OPTIONS.map((opt) => (
                   <option key={opt.label} value={opt.label}>{opt.label}</option>
                 ))}
               </select>
               <div className={`mt-2 text-xs font-semibold ${mappedRecordType === RecordType.CREDIT ? 'text-green-600' : mappedRecordType === RecordType.DEBIT ? 'text-red-600' : 'text-slate-500'}`}>
                  {mappedRecordType === RecordType.CREDIT ? 'Adiciona Saldo (+)' : mappedRecordType === RecordType.DEBIT ? 'Desconta Saldo (-)' : 'Informativo (Neutro)'}
                  {isRegularization && ' - Sem impacto no saldo (0h)'}
               </div>
            </div>

            {/* Condicional: Input de Horário (Regularização) OU Duração (Outros) */}
            {isRegularization ? (
               <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Horário da Batida Esquecida</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Clock className="h-5 w-5 text-indigo-500" />
                    </div>
                    <input 
                      type="time"
                      required 
                      value={specificTime}
                      onChange={(e) => setSpecificTime(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-indigo-300 bg-indigo-50 rounded-lg text-slate-900 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    * Este registro serve apenas para regularizar o histórico e <strong>não altera</strong> o saldo de horas (0h 00m).
                  </p>
               </div>
            ) : (
               <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Quantidade de Tempo (Duração)</label>
                  <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Horas</label>
                        <input 
                          type="number" 
                          min="0"
                          value={hours}
                          onChange={(e) => setHours(Number(e.target.value))}
                          className="block w-full px-3 py-3 border-slate-300 rounded-lg border bg-slate-50 text-slate-900 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Minutos</label>
                        <input 
                          type="number" 
                          min="0"
                          max="59"
                          value={minutes}
                          onChange={(e) => setMinutes(Number(e.target.value))}
                          className="block w-full px-3 py-3 border-slate-300 rounded-lg border bg-slate-50 text-slate-900 focus:ring-indigo-500"
                        />
                      </div>
                  </div>
               </div>
            )}

          </div>

          {/* Observations */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Observações / Motivo</label>
            <textarea
              required
              rows={3}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Descreva o motivo (obrigatório)..."
              className="block w-full px-3 py-3 border-slate-300 rounded-lg border bg-slate-50 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !selectedEmployee}
              className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-base font-bold text-white transition-all ${loading || !selectedEmployee ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 focus:ring-2 focus:ring-offset-2 focus:ring-slate-500'}`}
            >
              {loading ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Processando...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="mr-2" size={20} />
                  Salvar Lançamento Manual
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualEntryForm;