import React, { useState, useRef, useEffect } from 'react';
import { Save, AlertTriangle, Calendar, Clock, User, ChevronDown, Check, Calculator, Info } from 'lucide-react';
import { Employee, RecordType, TimeRecord, Role } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { firebaseService } from '../services/firebaseService';

interface TimeEntryFormProps {
  currentUser: Employee;
  employees: Employee[];
  onRecordAdded: () => void;
}

const OCCURRENCE_OPTIONS = [
  { label: 'BH Positivo', type: RecordType.CREDIT },
  { label: 'BH Negativo', type: RecordType.DEBIT },
  { label: 'Compensação de horas positivas', type: RecordType.DEBIT },
  { label: 'Falta do dia inteiro', type: RecordType.DEBIT },
  { label: 'Ausência de Batida', type: RecordType.NEUTRAL },
  { label: 'Pagamento de horas', type: RecordType.DEBIT },
  { label: 'Exame periódico', type: RecordType.NEUTRAL },
  { label: 'Atrasos e saídas antecipadas (desconto em folha)', type: RecordType.NEUTRAL },
  { label: 'Liberação por atestado médico', type: RecordType.NEUTRAL },
];

const TimeEntryForm: React.FC<TimeEntryFormProps> = ({ currentUser, employees, onRecordAdded }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form State
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Time Calculation State
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [calculatedDuration, setCalculatedDuration] = useState({ hours: 0, minutes: 0 });
  const [isTimeValid, setIsTimeValid] = useState(true);

  const [occurrenceType, setOccurrenceType] = useState<string>('BH Positivo');
  const [mappedRecordType, setMappedRecordType] = useState<RecordType>(RecordType.CREDIT);
  const [reason, setReason] = useState('');

  // Search/Autocomplete State
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set current user default selection logic
  useEffect(() => {
    if (currentUser.role === Role.EMPLOYEE) {
       setSelectedEmployee(currentUser.id);
       setSearchTerm(currentUser.name);
    }
  }, [currentUser]);

  // Update Mapped Record Type when Occurrence Selection Changes
  useEffect(() => {
    const option = OCCURRENCE_OPTIONS.find(o => o.label === occurrenceType);
    if (option) {
      setMappedRecordType(option.type);
    }
  }, [occurrenceType]);

  // Calculate duration whenever times change
  useEffect(() => {
    if (!startTime || !endTime) {
      setCalculatedDuration({ hours: 0, minutes: 0 });
      setIsTimeValid(true);
      return;
    }

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startTotalMins = startH * 60 + startM;
    const endTotalMins = endH * 60 + endM;

    if (endTotalMins <= startTotalMins) {
      setIsTimeValid(false);
      setCalculatedDuration({ hours: 0, minutes: 0 });
    } else {
      setIsTimeValid(true);
      const diffMins = endTotalMins - startTotalMins;
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      setCalculatedDuration({ hours: h, minutes: m });
    }
  }, [startTime, endTime]);

  const availableEmployees = employees;

  const filteredEmployees = availableEmployees.filter(emp => 
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
    if (!selectedEmployee || !date || !reason || !startTime || !endTime || !isTimeValid) return;

    if (calculatedDuration.hours === 0 && calculatedDuration.minutes === 0) {
      alert("A duração deve ser maior que zero.");
      return;
    }

    setLoading(true);
    
    const employee = employees.find(e => e.id === selectedEmployee);
    
    const newRecord: TimeRecord = {
      id: uuidv4(),
      employeeId: selectedEmployee,
      employeeName: employee?.name || 'Desconhecido',
      date,
      hours: calculatedDuration.hours,
      minutes: calculatedDuration.minutes,
      startTime,
      endTime,
      type: mappedRecordType,
      occurrenceType,
      reason,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id
    };

    try {
      // Usando Firebase Service
      await firebaseService.saveTimeRecord(newRecord);
      setSuccess(true);
      onRecordAdded();
      
      // Reset form
      if (currentUser.role !== Role.EMPLOYEE) {
         setSelectedEmployee('');
         setSearchTerm('');
      }
      setStartTime('');
      setEndTime('');
      setReason('');
      setCalculatedDuration({ hours: 0, minutes: 0 });
      setOccurrenceType('BH Positivo');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving record", error);
      alert("Erro ao salvar no banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  const getTypeStyles = (type: RecordType) => {
    switch (type) {
      case RecordType.CREDIT:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case RecordType.DEBIT:
        return 'bg-red-100 text-red-800 border-red-200';
      case RecordType.NEUTRAL:
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      
      {/* SUCCESS POPUP MODAL */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4 transform transition-all scale-100">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check size={32} className="text-green-600" strokeWidth={3} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Sucesso!</h3>
            <p className="text-slate-600 text-center">Ocorrência salva na nuvem.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Nova Ocorrência
          </h2>
          <p className="text-indigo-100 text-sm mt-1">Os dados serão sincronizados com o servidor.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
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
                  disabled={currentUser.role === Role.EMPLOYEE}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedEmployee(''); 
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Buscar colaborador..."
                  className={`block w-full pl-10 pr-10 py-3 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg border bg-slate-50 text-slate-900 placeholder-slate-400 ${selectedEmployee ? 'border-green-500 ring-1 ring-green-500 bg-green-50' : ''} ${currentUser.role === Role.EMPLOYEE ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
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
              {isDropdownOpen && currentUser.role !== Role.EMPLOYEE && (
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
                        <span className="text-xs text-slate-500 ml-2">({emp.team})</span>
                        
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
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border-slate-300 rounded-lg border bg-slate-50 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900"
                />
              </div>
            </div>

            {/* Type Dropdown */}
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Ocorrência</label>
               <div className="relative">
                 <select
                    value={occurrenceType}
                    onChange={(e) => setOccurrenceType(e.target.value)}
                    className="block w-full pl-3 pr-10 py-3 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg border bg-slate-50 text-slate-900"
                 >
                   {OCCURRENCE_OPTIONS.map((opt) => (
                     <option key={opt.label} value={opt.label}>{opt.label}</option>
                   ))}
                 </select>
               </div>
               {/* Visual Indicator of Effect */}
               <div className={`mt-2 p-2 rounded-lg border text-xs font-semibold flex items-center justify-center ${getTypeStyles(mappedRecordType)}`}>
                  {mappedRecordType === RecordType.CREDIT && <span className="flex items-center"><Check size={14} className="mr-1"/> Adiciona ao Banco de Horas (Crédito)</span>}
                  {mappedRecordType === RecordType.DEBIT && <span className="flex items-center"><AlertTriangle size={14} className="mr-1"/> Desconta do Banco de Horas (Débito)</span>}
                  {mappedRecordType === RecordType.NEUTRAL && <span className="flex items-center"><Info size={14} className="mr-1"/> Informativo (Não altera o saldo)</span>}
               </div>
            </div>

            {/* Time Range Calculation */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Período da Atividade</label>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Hora Início/Entrada</label>
                  <input 
                    type="time" 
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Hora Fim/Saída</label>
                  <input 
                    type="time" 
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`block w-full px-3 py-2 border rounded-lg bg-white text-slate-900 focus:ring-indigo-500 focus:border-indigo-500 ${!isTimeValid ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                  />
                </div>
                
                {/* Duration Result */}
                <div className="col-span-1 sm:col-span-2 mt-2 pt-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center text-slate-600">
                    <Calculator size={18} className="mr-2" />
                    <span className="text-sm font-medium">Tempo Calculado:</span>
                  </div>
                  <div className={`text-lg font-bold ${!isTimeValid ? 'text-red-500' : 'text-indigo-600'}`}>
                    {!isTimeValid ? (
                      <span className="text-sm">Horário Inválido</span>
                    ) : (
                      <span>
                        {calculatedDuration.hours}h {calculatedDuration.minutes}m
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!isTimeValid && (
                <p className="text-xs text-red-500 mt-1">A hora de término deve ser posterior à hora de início.</p>
              )}
            </div>

          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Justificativa</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Detalhes adicionais..."
              className="block w-full px-3 py-3 border-slate-300 rounded-lg border bg-slate-50 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !selectedEmployee || !isTimeValid || (calculatedDuration.hours === 0 && calculatedDuration.minutes === 0)}
              className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-base font-bold text-white transition-all ${loading || !selectedEmployee || !isTimeValid || (calculatedDuration.hours === 0 && calculatedDuration.minutes === 0) ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="mr-2" size={20} />
                  Registrar Ocorrência
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeEntryForm;