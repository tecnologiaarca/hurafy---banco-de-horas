import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Users, Edit, Trash2, Loader2, Save, X, Check, Layers, ChevronDown, ChevronRight, AlertTriangle, FileSpreadsheet, Search, Download, ChevronLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TimeRecord, Employee, RecordType, Role } from '../types';
import { firebaseService } from '../services/firebaseService';
import ConfirmModal from './ConfirmModal';

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

const ITEMS_PER_PAGE = 20;

const Reports: React.FC<ReportsProps> = ({ records, employees, currentUser, refreshData, onUpdateRecord, onDeleteRecord }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageChanging, setIsPageChanging] = useState(false);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
  const [isBatchEdit, setIsBatchEdit] = useState(false); 
  
  // Delete Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<{id: string, batchId?: string} | null>(null);

  // Form States
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editOccurrenceType, setEditOccurrenceType] = useState('');
  const [editCalculatedDuration, setEditCalculatedDuration] = useState({ hours: 0, minutes: 0 });
  const [isEditTimeValid, setIsEditTimeValid] = useState(true);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const canUserEdit = (record: TimeRecord) => {
    if (currentUser.role === Role.ADMIN) return true;
    if (currentUser.role === Role.LEADER && record.createdBy === currentUser.id) return true;
    return false;
  };

  const formatTime = (totalMinutes: number) => {
    const hours = Math.floor(Math.abs(totalMinutes) / 60);
    const minutes = Math.abs(totalMinutes) % 60;
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

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

  const formatTimeForInput = (val?: string | number) => {
    if (!val) return '';
    const strVal = String(val);
    if (strVal.includes('T')) return strVal.split('T')[1].substring(0, 5);
    if (strVal.includes(':')) return strVal.substring(0, 5);
    return '';
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

  // --- EFFECT: HYDRATION ---
  useEffect(() => {
    if (editingRecord && isEditModalOpen) {
      setEditDate(safeDateForInput(editingRecord.date));
      const start = formatTimeForInput(editingRecord.startTime);
      const end = formatTimeForInput(editingRecord.endTime);
      setEditStartTime(start);
      setEditEndTime(end);
      setEditReason(editingRecord.reason || '');
      setEditOccurrenceType(editingRecord.occurrenceType || 'BH Positivo');
      setEditCalculatedDuration({
        hours: editingRecord.hours || 0,
        minutes: editingRecord.minutes || 0
      });
      setIsEditTimeValid(true);
    }
  }, [editingRecord, isEditModalOpen]);

  // --- EFFECT: CALCULATION ---
  useEffect(() => {
    if (!editStartTime || !editEndTime) return;
    if (editingRecord && isEditModalOpen) {
        const currentStart = formatTimeForInput(editingRecord.startTime);
        const currentEnd = formatTimeForInput(editingRecord.endTime);
        if (editStartTime === currentStart && editEndTime === currentEnd) return;
    }
    const [startH, startM] = editStartTime.split(':').map(Number);
    const [endH, endM] = editEndTime.split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return;

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
  }, [editStartTime, editEndTime, editingRecord, isEditModalOpen]);

  const showSuccessPopup = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  // --- DELETE HANDLERS ---
  const handleOpenDeleteModal = (id: string, batchId?: string) => {
    setRecordToDelete({ id, batchId });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    
    const { id, batchId } = recordToDelete;
    
    setLoadingAction('deleting');

    try {
        if (batchId) {
           const result = await firebaseService.deleteBatchRecords(batchId);
           if (result.success) {
               refreshData(); 
               showSuccessPopup(`Lote excluído! ${result.count} registros removidos.`);
           } else {
               alert("Erro ao excluir lote.");
           }
        } else {
            const success = await firebaseService.deleteRecord(id);
            if (success) {
              onDeleteRecord(id);
              showSuccessPopup('Registro excluído com sucesso.');
            } else {
              alert('Erro ao excluir registro.');
            }
        }
    } catch(e) {
        console.error(e);
        alert("Erro de conexão.");
    } finally {
        setLoadingAction(null);
        setIsDeleteModalOpen(false);
        setRecordToDelete(null);
    }
  };

  const openEditModal = (record: TimeRecord, isBatch: boolean = false) => {
    setEditingRecord(record);
    setIsBatchEdit(isBatch);
    setIsEditModalOpen(true);
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !isEditTimeValid) return;

    // --- TRAVA DE JUSTIFICATIVA ---
    if (!editReason || !editReason.trim()) {
      alert('A justificativa é obrigatória para editar um registro.');
      return;
    }

    if (editCalculatedDuration.hours === 0 && editCalculatedDuration.minutes === 0) {
      alert("Duração inválida ou zerada.");
      return;
    }

    setLoadingAction('modal-save');
    const option = OCCURRENCE_OPTIONS.find(o => o.label === editOccurrenceType);
    const newType = option ? option.type : RecordType.CREDIT;

    const updateData: Partial<TimeRecord> = {
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
        if (isBatchEdit && editingRecord.batchId) {
            const result = await firebaseService.updateBatchRecords(editingRecord.batchId, updateData);
            if (result.success) {
                refreshData();
                showSuccessPopup(`Lote atualizado! ${result.count} registros alterados.`);
            } else {
                alert("Falha ao atualizar lote.");
            }
        } else {
            const updatedRecord = { ...editingRecord, ...updateData };
            const success = await firebaseService.updateRecord(updatedRecord);
            if (success) {
                onUpdateRecord(updatedRecord);
                showSuccessPopup('Registro atualizado com sucesso.');
            } else {
                alert("Falha ao salvar no banco.");
            }
        }
        setIsEditModalOpen(false);
        setEditingRecord(null);
    } catch (error) {
        console.error("Error updating record:", error);
        alert("Erro ao conectar com o servidor.");
    } finally {
        setLoadingAction(null);
    }
  };

  const { processedRecords, batchMap } = useMemo(() => {
    let filtered = records.filter(r => {
      // Role Filter
      if (currentUser.role === Role.ADMIN) return true;
      if (currentUser.role === Role.LEADER) return r.createdBy === currentUser.id;
      return false;
    });

    // Search Filter
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.employeeName.toLowerCase().includes(lowerTerm) ||
        r.occurrenceType.toLowerCase().includes(lowerTerm) ||
        r.reason.toLowerCase().includes(lowerTerm)
      );
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const viewList: any[] = [];
    const batches: Record<string, TimeRecord[]> = {};
    const seenBatches = new Set<string>();

    filtered.forEach(record => {
       if (record.batchId) {
          if (!batches[record.batchId]) {
             batches[record.batchId] = [];
          }
          batches[record.batchId].push(record);

          if (!seenBatches.has(record.batchId)) {
             viewList.push({ ...record, isBatchLeader: true });
             seenBatches.add(record.batchId);
          }
       } else {
          viewList.push(record);
       }
    });

    return { processedRecords: viewList, batchMap: batches };
  }, [records, currentUser, searchTerm]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(processedRecords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRecords = processedRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
       setIsPageChanging(true);
       setCurrentPage(newPage);
       setTimeout(() => setIsPageChanging(false), 200);
    }
  };

  const toggleBatch = (batchId: string) => {
     const newSet = new Set(expandedBatches);
     if (newSet.has(batchId)) newSet.delete(batchId);
     else newSet.add(batchId);
     setExpandedBatches(newSet);
  };

  // --- EXPORT FUNCTIONS (PDF/EXCEL) - Same as before ---
  const generateDetailedPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Extrato Detalhado de Ocorrências', 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    const tableData = records.map(r => [ 
      formatDate(r.date), getEmployeeCompany(r.employeeId), r.employeeName, getLeaderName(r.createdBy), r.occurrenceType || r.type, r.reason, formatTimeOnly(r.startTime), formatTimeOnly(r.endTime), `${r.hours}h ${r.minutes}m`
    ]);
    autoTable(doc, {
      head: [['Data', 'Empresa', 'Colaborador', 'Líder', 'Tipo', 'Descrição', 'Início', 'Fim', 'Tempo']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] }, // Slate-700
      columnStyles: { 5: { cellWidth: 35 } } 
    });
    doc.save('extrato-detalhado.pdf');
  };

  const generateDetailedExcel = () => {
    const ws = XLSX.utils.json_to_sheet(records.map(r => ({
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
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
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

  return (
    <div className="space-y-8 animate-fade-in relative min-h-[500px]">
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

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        isLoading={loadingAction === 'deleting'}
        title={recordToDelete?.batchId ? "Excluir Lote Completo" : "Confirmar Exclusão"}
        message={recordToDelete?.batchId 
          ? "Atenção: Este registro faz parte de um Lançamento em Massa. Ao confirmar, TODOS os registros deste lote serão excluídos permanentemente."
          : "Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita."
        }
      />
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Central de Relatórios</h2>
        <p className="text-slate-500">
           {currentUser.role === Role.ADMIN 
             ? "Gerenciamento completo e auditoria de logs." 
             : "Visualize relatórios e gerencie seus lançamentos."}
        </p>
      </div>

      {/* --- EXPORT SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
        
        {/* Card 1: Balanço Geral (Admin Only) */}
        {currentUser.role === Role.ADMIN && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                <div className="flex items-start gap-4 mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                    <Users size={24} />
                    </div>
                    <div>
                    <h3 className="text-lg font-bold text-slate-800">Balanço Geral</h3>
                    <p className="text-sm text-slate-500">Saldo final consolidado por colaborador.</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-3 mt-auto">
                    <button 
                    onClick={generateGeneralPDF} 
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-indigo-600 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                    <FileText className="mr-2" size={16} /> 
                    PDF
                    </button>
                    <button 
                    onClick={generateGeneralExcel} 
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-indigo-600 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                    <FileSpreadsheet className="mr-2" size={16} /> 
                    Excel
                    </button>
                </div>
            </div>
        )}

        {/* Card 2: Extrato Detalhado */}
        <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full ${currentUser.role !== Role.ADMIN ? 'md:col-span-2' : ''}`}>
            <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                <FileText size={24} />
                </div>
                <div>
                <h3 className="text-lg font-bold text-slate-800">Extrato de Ocorrências</h3>
                <p className="text-sm text-slate-500">Histórico completo de lançamentos.</p>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-auto">
                <button 
                onClick={generateDetailedPDF} 
                className="flex-1 flex items-center justify-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-indigo-600 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm"
                >
                <FileText className="mr-2" size={16} /> 
                PDF
                </button>
                <button 
                onClick={generateDetailedExcel} 
                className="flex-1 flex items-center justify-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-indigo-600 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm"
                >
                <FileSpreadsheet className="mr-2" size={16} /> 
                Excel
                </button>
            </div>
        </div>
      </div>

      {/* --- DIVIDER --- */}
      <div className="border-t border-slate-200 my-2" />

      {/* --- QUERY SECTION --- */}
      <div className="animate-fade-in space-y-6">
        
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 whitespace-nowrap hidden sm:block">
                Consulta de Registros
            </h3>
            <div className="relative w-full sm:max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                type="text"
                placeholder="Buscar por colaborador, tipo ou motivo..."
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="text-sm text-slate-500 whitespace-nowrap">
                Total: {processedRecords.length}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className={`min-w-full divide-y divide-slate-200 transition-opacity duration-200 ${isPageChanging ? 'opacity-50' : 'opacity-100'}`}>
                <thead className="bg-slate-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Colaborador / Lote</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Início</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Fim</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Tempo</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Ações</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                {paginatedRecords.length === 0 ? (
                    <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                            Nenhum registro encontrado com os filtros atuais.
                        </td>
                    </tr>
                ) : (
                    paginatedRecords.map((item) => {
                    const isBatchRow = item.isBatchLeader === true;
                    const batchCount = isBatchRow ? batchMap[item.batchId]?.length : 0;
                    const isExpanded = isBatchRow && expandedBatches.has(item.batchId);
                    const editable = canUserEdit(item);

                    if (isBatchRow) {
                    return (
                        <React.Fragment key={`batch-${item.batchId}`}>
                            <tr className="bg-purple-50/50 hover:bg-purple-50 border-l-4 border-l-purple-500">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">{formatDate(item.date)}</td>
                            
                            {/* Colaborador / Lote */}
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => toggleBatch(item.batchId)} className="p-1 rounded hover:bg-purple-200 text-purple-700 transition-colors">
                                    {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                    </button>
                                    <div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-purple-900">
                                        <Layers size={16} /> Lançamento em Massa
                                    </div>
                                    <div className="text-xs text-purple-600 font-medium mt-0.5">
                                        {batchCount} colaboradores afetados
                                    </div>
                                    </div>
                                </div>
                            </td>

                            {/* Tipo */}
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200`}>
                                    {item.occurrenceType} (Lote)
                                </span>
                            </td>

                            {/* Descrição */}
                            <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate font-medium italic">
                                {item.reason}
                            </td>

                            {/* Início */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">{formatTimeOnly(item.startTime)}</td>
                            
                            {/* Fim */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">{formatTimeOnly(item.endTime)}</td>
                            
                            {/* Tempo */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                                {item.hours}h {item.minutes}m <span className="text-xs font-normal text-slate-400">(cada)</span>
                            </td>

                            {/* Ações */}
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {editable && (
                                    <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => openEditModal(item, true)} className="text-indigo-600 hover:text-indigo-800 p-1.5 hover:bg-slate-100 rounded-lg flex items-center gap-1 border border-transparent hover:border-slate-200 transition-all" title="Editar Lote Completo">
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleOpenDeleteModal(item.id, item.batchId)} 
                                        className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded-lg flex items-center gap-1 border border-transparent hover:border-red-100 transition-all" 
                                        title="Excluir Lote Completo"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    </div>
                                )}
                            </td>
                            </tr>
                            {isExpanded && batchMap[item.batchId].map((child: TimeRecord) => (
                            <tr key={child.id} className="bg-slate-50/50 hover:bg-slate-100 animate-fade-in">
                                <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-400 pl-12 border-l-4 border-l-transparent">↳</td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                    <div className="text-sm text-slate-700">{child.employeeName}</div>
                                    <div className="text-xs text-slate-400">{getEmployeeCompany(child.employeeId)}</div>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-400">Ver Lote</td>
                                <td className="px-6 py-3 text-xs text-slate-400 italic">Ver Lote</td>
                                <td className="px-6 py-3 whitespace-nowrap text-xs font-mono text-slate-400">{formatTimeOnly(child.startTime)}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-xs font-mono text-slate-400">{formatTimeOnly(child.endTime)}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">
                                    {child.hours}h {child.minutes}m
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-right text-xs">
                                    <span className="text-slate-300 select-none">Vinculado ao Lote</span>
                                </td>
                            </tr>
                            ))}
                        </React.Fragment>
                    );
                    }

                    return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatDate(item.date)}</td>
                        
                        {/* Colaborador */}
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{item.employeeName}</div>
                        <div className="text-xs text-slate-400">{getEmployeeCompany(item.employeeId)}</div>
                        </td>

                        {/* Tipo */}
                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.type === RecordType.CREDIT ? 'bg-green-100 text-green-800' : item.type === RecordType.DEBIT ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>{item.occurrenceType}</span>
                        </td>

                        {/* Descrição */}
                        <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title={item.reason}>{item.reason}</td>
                        
                        {/* Início */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">{formatTimeOnly(item.startTime)}</td>
                        
                        {/* Fim */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">{formatTimeOnly(item.endTime)}</td>

                        {/* Tempo */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{item.hours}h {item.minutes}m</td>
                        
                        {/* Ações */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editable && (
                            <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditModal(item)} className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-slate-50 rounded" title="Editar"><Edit size={16} /></button>
                            <button onClick={() => handleOpenDeleteModal(item.id)} className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={16} /></button>
                            </div>
                        )}
                        </td>
                    </tr>
                    );
                })
                )}
                </tbody>
            </table>
            
            {/* Pagination Controls */}
            {processedRecords.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Próximo
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Mostrando <span className="font-medium">{startIndex + 1}</span> até <span className="font-medium">{Math.min(startIndex + ITEMS_PER_PAGE, processedRecords.length)}</span> de <span className="font-medium">{processedRecords.length}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Anterior</span>
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 focus:outline-offset-0">
                         Página {currentPage} de {totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Próximo</span>
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
            </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingRecord && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in-up flex flex-col max-h-[90vh]">
               {isBatchEdit && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700 font-bold">
                                    Atenção: Você está editando um LANÇAMENTO EM MASSA.
                                </p>
                                <p className="text-xs text-red-600 mt-1">
                                    As alterações afetarão todos os colaboradores deste grupo.
                                </p>
                            </div>
                        </div>
                    </div>
               )}
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {isBatchEdit ? <><Layers size={20} className="text-indigo-600"/> Editar Lote Completo</> : 'Editar Lançamento'}
                    </h3>
                    {!isBatchEdit && (
                        <p className="text-sm text-slate-500">{editingRecord.employeeName}</p>
                    )}
                  </div>
                  <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
               </div>
               <form onSubmit={handleUpdateRecord} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                  <div><label className="block text-sm font-medium text-slate-700">Data da Ocorrência</label><input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900"/></div>
                  <div><label className="block text-sm font-medium text-slate-700">Tipo</label><select value={editOccurrenceType} onChange={e => setEditOccurrenceType(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900">{OCCURRENCE_OPTIONS.map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                     <div><label className="block text-xs font-medium text-slate-500">Início</label><input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="w-full mt-1 border border-slate-300 rounded px-2 py-1 bg-white text-slate-900"/></div>
                     <div><label className="block text-xs font-medium text-slate-500">Fim</label><input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className={`w-full mt-1 border rounded px-2 py-1 bg-white text-slate-900 ${!isEditTimeValid ? 'border-red-500' : 'border-slate-300'}`}/></div>
                     <div className="col-span-2 text-center text-sm font-bold text-indigo-600 border-t border-slate-200 pt-2">{isEditTimeValid ? `${editCalculatedDuration.hours}h ${editCalculatedDuration.minutes}m` : <span className="text-red-500">Horário Inválido</span>}</div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700">Justificativa</label><textarea required rows={3} value={editReason} onChange={e => setEditReason(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900"/></div>
                  <div className="flex justify-end gap-3 pt-2">
                     <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancelar</button>
                     <button type="submit" disabled={loadingAction === 'modal-save' || !isEditTimeValid} className={`px-4 py-2 text-white rounded-lg flex items-center shadow-lg ${isBatchEdit ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {loadingAction === 'modal-save' ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                        {isBatchEdit ? 'Confirmar Edição em Lote' : 'Salvar Alterações'}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
};

export default Reports;