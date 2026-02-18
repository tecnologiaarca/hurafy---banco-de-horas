import React, { useState, useEffect } from 'react';
import { FileText, Download, Users, Edit, Trash2, Loader2, Save, X, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TimeRecord, Employee, RecordType, Role } from '../types';
import { firebaseService } from '../services/firebaseService';

interface ReportsProps {
  records: TimeRecord[];
  employees: Employee[];
  currentUser: Employee;
  refreshData: () => void;
  onUpdateRecord: (record: TimeRecord) => void;
  onDeleteRecord: (id: string) => void;
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

const Reports: React.FC<ReportsProps> = ({ records, employees, currentUser, refreshData, onUpdateRecord, onDeleteRecord }) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  // Success Popup State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editOccurrenceType, setEditOccurrenceType] = useState('');
  const [editCalculatedDuration, setEditCalculatedDuration] = useState({ hours: 0, minutes: 0 });
  const [isEditTimeValid, setIsEditTimeValid] = useState(true);

  // --- Logic Checks ---
  const canUserEdit = (record: TimeRecord) => {
    // Admin can edit all
    if (currentUser.role === Role.ADMIN) return true;
    // Leader can edit ONLY if they created it
    if (currentUser.role === Role.LEADER && record.createdBy === currentUser.id) return true;
    return false;
  };

  // --- Helper: Format minutes to HH:MM ---
  const formatTime = (totalMinutes: number) => {
    const hours = Math.floor(Math.abs(totalMinutes) / 60);
    const minutes = Math.abs(totalMinutes) % 60;
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  // --- Helper: Format Date ---
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (error) {
      return dateString;
    }
  };

  const formatTimeOnly = (val?: string | number) => {
    if (val === undefined || val === null || val === '') return '-';
    const strVal = String(val);
    if (strVal.includes('T')) return strVal.split('T')[1].substring(0, 5);
    if (strVal.includes(':')) return strVal.substring(0, 5);
    return strVal.length > 5 ? strVal.substring(0, 5) : strVal;
  };
  
  const safeDateForInput = (dateString: string) => {
    if (!dateString) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    if (dateString.includes('T')) return dateString.split('T')[0];
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return '';
  };

  const getLeaderName = (leaderId: string) => {
    const leader = employees.find(e => e.id === leaderId);
    return leader ? leader.name : 'Desconhecido';
  };

  const getEmployeeCompany = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    return emp ? (emp.company || 'N/A') : '-';
  };

  const getConsolidatedData = () => {
    return employees.filter(e => e.active).map(emp => {
      const empRecords = records.filter(r => r.employeeId === emp.id);
      let creditMins = 0;
      let debitMins = 0;
      empRecords.forEach(r => {
        const mins = (r.hours * 60) + r.minutes;
        if (r.type === RecordType.CREDIT) creditMins += mins;
        else if (r.type === RecordType.DEBIT) debitMins += mins;
      });
      const netBalance = creditMins - debitMins;
      return {
        name: emp.name,
        company: emp.company || 'N/A',
        team: emp.team,
        role: emp.role,
        positive: formatTime(creditMins),
        negative: formatTime(debitMins),
        balance: formatTime(netBalance),
        rawBalance: netBalance 
      };
    }).sort((a, b) => {
      if (a.company !== b.company) return a.company.localeCompare(b.company);
      return a.name.localeCompare(b.name);
    }); 
  };

  useEffect(() => {
    if (!editStartTime || !editEndTime) return;
    const [startH, startM] = editStartTime.split(':').map(Number);
    const [endH, endM] = editEndTime.split(':').map(Number);
    const startTotalMins = startH * 60 + startM;
    const endTotalMins = endH * 60 + endM;

    if (endTotalMins <= startTotalMins) {
      setIsEditTimeValid(false);
      setEditCalculatedDuration({ hours: 0, minutes: 0 });
    } else {
      setIsEditTimeValid(true);
      const diffMins = endTotalMins - startTotalMins;
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      setEditCalculatedDuration({ hours: h, minutes: m });
    }
  }, [editStartTime, editEndTime]);

  const showSuccessPopup = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro permanentemente?')) return;
    setLoadingAction(id);
    try {
        const success = await firebaseService.deleteRecord(id);
        if (success) {
          onDeleteRecord(id);
          showSuccessPopup('Registro excluído com sucesso.');
        } else {
          alert('Erro ao excluir registro.');
        }
    } catch (e) {
        alert("Erro de conexão.");
    } finally {
        setLoadingAction(null);
    }
  };

  const openEditModal = (record: TimeRecord) => {
    setEditingRecord(record);
    setEditDate(safeDateForInput(record.date));
    const cleanStart = formatTimeOnly(record.startTime);
    const cleanEnd = formatTimeOnly(record.endTime);
    setEditStartTime(cleanStart === '-' ? '' : cleanStart);
    setEditEndTime(cleanEnd === '-' ? '' : cleanEnd);
    setEditReason(record.reason);
    setEditOccurrenceType(record.occurrenceType);
    setEditCalculatedDuration({ hours: record.hours, minutes: record.minutes });
    setIsEditTimeValid(true);
    setIsEditModalOpen(true);
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !isEditTimeValid) return;
    if (editCalculatedDuration.hours === 0 && editCalculatedDuration.minutes === 0) {
      alert("Duração inválida.");
      return;
    }

    setLoadingAction('modal-save');
    const option = OCCURRENCE_OPTIONS.find(o => o.label === editOccurrenceType);
    const newType = option ? option.type : RecordType.CREDIT;

    const updatedRecord: TimeRecord = {
      ...editingRecord,
      date: editDate,
      startTime: editStartTime,
      endTime: editEndTime,
      hours: editCalculatedDuration.hours,
      minutes: editCalculatedDuration.minutes,
      reason: editReason,
      occurrenceType: editOccurrenceType,
      type: newType
    };

    try {
        const success = await firebaseService.updateRecord(updatedRecord);
        if (success) {
            onUpdateRecord(updatedRecord);
            setIsEditModalOpen(false);
            setEditingRecord(null);
            showSuccessPopup('Registro atualizado com sucesso.');
        } else {
            alert("Falha ao salvar no banco.");
        }
    } catch (error) {
        console.error("Error updating record:", error);
        alert("Erro ao conectar com o servidor.");
    } finally {
        setLoadingAction(null);
    }
  };

  // --- PDF/Excel Generation functions preserved for functionality ---
  const generateDetailedPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Extrato Detalhado de Ocorrências', 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    const tableData = displayRecords.map(r => [
      formatDate(r.date), getEmployeeCompany(r.employeeId), r.employeeName, getLeaderName(r.createdBy), r.occurrenceType || r.type, r.reason, formatTimeOnly(r.startTime), formatTimeOnly(r.endTime), `${r.hours}h ${r.minutes}m`
    ]);
    autoTable(doc, {
      head: [['Data', 'Empresa', 'Colaborador', 'Líder', 'Tipo', 'Descrição', 'Início', 'Fim', 'Tempo']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] },
      columnStyles: { 5: { cellWidth: 35 } } 
    });
    doc.save('extrato-detalhado.pdf');
  };

  const generateDetailedExcel = () => {
    const ws = XLSX.utils.json_to_sheet(displayRecords.map(r => ({
      Data: formatDate(r.date), Empresa: getEmployeeCompany(r.employeeId), Colaborador: r.employeeName, Líder: getLeaderName(r.createdBy), 'Tipo de Ocorrência': r.occurrenceType, 'Descrição': r.reason, 'Início': formatTimeOnly(r.startTime), 'Fim': formatTimeOnly(r.endTime), Horas: r.hours, Minutos: r.minutes
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extrato Detalhado");
    XLSX.writeFile(wb, "extrato-detalhado.xlsx");
  };

  const generateGeneralPDF = () => {
    const doc = new jsPDF();
    const data = getConsolidatedData();
    doc.setFontSize(18);
    doc.text('Balanço Geral de Horas por Colaborador', 14, 22);
    doc.setFontSize(11);
    doc.text(`Posição consolidada em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    const tableData = data.map(d => [d.company, d.name, d.team, d.positive, d.negative, d.balance]);
    autoTable(doc, {
      head: [['Empresa', 'Colaborador', 'Setor', 'Total Positivo', 'Total Negativo', 'Saldo Líquido']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' }, 5: { fontStyle: 'bold' } },
      headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save('balanco-geral-consolidado.pdf');
  };

  const generateGeneralExcel = () => {
    const data = getConsolidatedData();
    const ws = XLSX.utils.json_to_sheet(data.map(d => ({
      Empresa: d.company, Colaborador: d.name, Setor: d.team, 'Total Positivo': d.positive, 'Total Negativo': d.negative, 'Saldo Líquido': d.balance
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Saldos Consolidados");
    XLSX.writeFile(wb, "balanco-geral-consolidado.xlsx");
  };

  const displayRecords = records
    .filter(r => {
      if (currentUser.role === Role.ADMIN) return true;
      if (currentUser.role === Role.LEADER) return r.createdBy === currentUser.id;
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-10 animate-fade-in relative">
      {successMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4 transform transition-all scale-100">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check size={32} className="text-green-600" strokeWidth={3} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Sucesso!</h3>
            <p className="text-slate-600 text-center">{successMessage}</p>
          </div>
        </div>
      )}
      
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Central de Relatórios</h2>
        <p className="text-slate-500">
           {currentUser.role === Role.ADMIN 
             ? "Gerenciamento completo e auditoria de logs." 
             : "Visualize relatórios e gerencie seus lançamentos."}
        </p>
      </div>

      {currentUser.role === Role.ADMIN && (
        <div className="bg-gradient-to-r from-indigo-50 to-white p-6 rounded-xl border border-indigo-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Balanço Geral (Consolidado)</h3>
              <p className="text-sm text-slate-500">Resumo de saldo final de horas por colaborador e setor.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={generateGeneralPDF} className="flex items-center justify-center px-4 py-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"><Download className="mr-2" size={18} /> Baixar Resumo em PDF</button>
            <button onClick={generateGeneralExcel} className="flex items-center justify-center px-4 py-4 border border-indigo-200 text-sm font-medium rounded-lg text-indigo-700 bg-white hover:bg-indigo-50 shadow-sm transition-all"><Download className="mr-2" size={18} /> Baixar Resumo em Excel</button>
          </div>
        </div>
      )}

      <div className={`p-6 rounded-xl border border-indigo-100 shadow-sm ${currentUser.role === Role.ADMIN ? 'bg-gradient-to-r from-indigo-50 to-white' : 'bg-white'}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Extrato de Ocorrências</h3>
            <p className="text-sm text-slate-500">{currentUser.role === Role.ADMIN ? "Lista completa de todos os registros lançados." : "Lista dos registros lançados por você."}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={generateDetailedPDF} className="flex items-center justify-center px-4 py-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"><Download className="mr-2" size={18} /> Baixar PDF</button>
          <button onClick={generateDetailedExcel} className="flex items-center justify-center px-4 py-4 border border-indigo-200 text-sm font-medium rounded-lg text-indigo-700 bg-white hover:bg-indigo-50 shadow-sm transition-all"><Download className="mr-2" size={18} /> Baixar Excel</button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
           <h3 className="font-semibold text-slate-700">Registros Encontrados</h3>
           <span className="text-xs text-slate-400">{displayRecords.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Colaborador</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Líder</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Início</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fim</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tempo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {displayRecords.map((record) => {
                const editable = canUserEdit(record);
                return (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatDate(record.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm text-slate-900">{record.employeeName}</div>
                       <div className="text-xs text-slate-400">{getEmployeeCompany(record.employeeId)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">{getLeaderName(record.createdBy)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.type === RecordType.CREDIT ? 'bg-green-100 text-green-800' : record.type === RecordType.DEBIT ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>{record.occurrenceType}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title={record.reason}>{record.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{formatTimeOnly(record.startTime)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{formatTimeOnly(record.endTime)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{record.hours}h {record.minutes}m</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editable && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditModal(record)} className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded" title="Editar"><Edit size={16} /></button>
                          <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded" title="Excluir" disabled={loadingAction === record.id}>{loadingAction === record.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isEditModalOpen && editingRecord && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in-up flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Editar Lançamento</h3>
                    <p className="text-sm text-slate-500">{editingRecord.employeeName}</p>
                  </div>
                  <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
               </div>
               <form onSubmit={handleUpdateRecord} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                  <div><label className="block text-sm font-medium text-slate-700">Data da Ocorrência</label><input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900"/></div>
                  <div><label className="block text-sm font-medium text-slate-700">Tipo</label><select value={editOccurrenceType} onChange={e => setEditOccurrenceType(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900">{OCCURRENCE_OPTIONS.map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                     <div><label className="block text-xs font-medium text-slate-500">Início</label><input type="time" required value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="w-full mt-1 border border-slate-300 rounded px-2 py-1 bg-white text-slate-900"/></div>
                     <div><label className="block text-xs font-medium text-slate-500">Fim</label><input type="time" required value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className={`w-full mt-1 border rounded px-2 py-1 bg-white text-slate-900 ${!isEditTimeValid ? 'border-red-500' : 'border-slate-300'}`}/></div>
                     <div className="col-span-2 text-center text-sm font-bold text-indigo-600 border-t border-slate-200 pt-2">{isEditTimeValid ? `${editCalculatedDuration.hours}h ${editCalculatedDuration.minutes}m` : <span className="text-red-500">Horário Inválido</span>}</div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700">Justificativa</label><textarea required rows={3} value={editReason} onChange={e => setEditReason(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900"/></div>
                  <div className="flex justify-end gap-3 pt-2">
                     <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancelar</button>
                     <button type="submit" disabled={loadingAction === 'modal-save' || !isEditTimeValid} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center">{loadingAction === 'modal-save' ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}Salvar Alterações</button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
};

export default Reports;