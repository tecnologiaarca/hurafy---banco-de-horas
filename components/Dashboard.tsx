import React, { useMemo, useState, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { Clock, Users, TrendingUp, TrendingDown, Info, Filter, X, Briefcase, Building2, Database, Upload, Download, Trash2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { TimeRecord, Employee, RecordType } from '../types';
import { firebaseService } from '../services/firebaseService';
import { auth } from '../lib/firebase';

interface DashboardProps {
  records: TimeRecord[];
  employees: Employee[];
}

const Dashboard: React.FC<DashboardProps> = ({ records, employees }) => {
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  
  // Data Management State
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- MANAGEMENT TOOLS LOGIC ---

  const handleDownloadTemplate = () => {
    console.log("📥 Gerando modelo CSV...");
    // Header + Example
    const content = "id,name,role,department,company\na.exemplo,Usuario Exemplo,EMPLOYEE,Financeiro,Arca Plast";
    
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_colaboradores.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("✅ Download iniciado.");
  };

  const handleResetDatabase = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error("Usuário não autenticado. Ação abortada.");
        return;
    }

    setIsProcessing(true);
    setStatusMessage("Limpando banco de dados...");
    
    try {
      await firebaseService.deleteAllEmployees(currentUser.email || '');
      // Recarrega a página após 1.5s para refletir mudanças
      setTimeout(() => {
          window.location.reload();
      }, 1500);
    } catch (e) {
      console.error("Erro na limpeza:", e);
      setStatusMessage("Erro ao limpar banco (ver console).");
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      setIsProcessing(true);
      setStatusMessage("Processando arquivo...");
      console.log("📂 Arquivo carregado. Iniciando leitura...");
      
      try {
        const lines = text.split(/\r\n|\n/);
        const usersToImport: any[] = [];
        
        // Começa do index 1 para pular o cabeçalho
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // CSV simples: id,name,role,department,company
          const cols = line.split(',');
          if (cols.length < 5) {
             console.warn(`⚠️ Linha ${i + 1} incompleta/ignorada:`, line);
             continue;
          }

          const [id, name, role, department, company] = cols.map(c => c.trim());
          
          // Validação básica de Role
          const validRoles = ['ADMIN', 'LEADER', 'EMPLOYEE'];
          const cleanRole = validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : 'EMPLOYEE';

          usersToImport.push({
            id,
            name,
            role: cleanRole,
            department,
            company
          });
        }

        if (usersToImport.length === 0) {
          console.error("Nenhum dado válido encontrado.");
          setStatusMessage("Arquivo inválido ou vazio.");
          setIsProcessing(false);
          return;
        }

        console.log(`📋 ${usersToImport.length} registros prontos para envio.`);
        const success = await firebaseService.importAllColaboradores(usersToImport);
        
        if (success) {
          setStatusMessage("Importação concluída!");
          setTimeout(() => {
             window.location.reload();
          }, 1500);
        } else {
            setStatusMessage("Falha na importação.");
            setIsProcessing(false);
        }

      } catch (error) {
        console.error("Erro no processamento:", error);
        setStatusMessage("Erro fatal (ver console).");
        setIsProcessing(false);
      } finally {
        // Reset input para permitir selecionar o mesmo arquivo novamente se falhar
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // --- EXISTING DASHBOARD LOGIC ---

  // 1. Extract Unique Companies
  const companies = useMemo(() => {
    const unique = new Set(employees.map(e => e.company).filter(Boolean));
    return Array.from(unique).sort();
  }, [employees]);

  // 2. Extract Available Teams (Filtered by selected Company)
  const availableTeams = useMemo(() => {
    let filtered = employees;
    if (selectedCompany) {
      filtered = filtered.filter(e => e.company === selectedCompany);
    }
    const unique = new Set(filtered.map(e => e.team).filter(Boolean));
    return Array.from(unique).sort();
  }, [employees, selectedCompany]);

  // 3. Filter Available Employees (Filtered by Company AND Team)
  const availableEmployees = useMemo(() => {
    let result = employees;
    if (selectedCompany) {
      result = result.filter(e => e.company === selectedCompany);
    }
    if (selectedTeam) {
      result = result.filter(e => e.team === selectedTeam);
    }
    return result;
  }, [employees, selectedCompany, selectedTeam]);

  // 4. Filter Records based on the filtered employees
  const filteredRecords = useMemo(() => {
    // Começamos com os registros reais vindos do Firebase
    let result = records || [];
    
    // Get valid employee IDs based on current filters (Company/Team)
    const validEmployeeIds = availableEmployees.map(e => e.id);
    
    // First, filter records to only show those belonging to the currently filtered employee pool
    result = result.filter(r => validEmployeeIds.includes(r.employeeId));

    // Finally, if a specific employee is selected, filter just for them
    if (selectedEmpId) {
      result = result.filter(r => r.employeeId === selectedEmpId);
    }

    return result;
  }, [records, availableEmployees, selectedEmpId]);

  // Handle Changes
  const handleCompanyChange = (company: string) => {
    setSelectedCompany(company);
    setSelectedTeam(''); // Reset team when company changes
    setSelectedEmpId(''); // Reset employee
  };

  const handleTeamChange = (team: string) => {
    setSelectedTeam(team);
    setSelectedEmpId(''); // Reset employee when team changes
  };

  // 5. Calculate stats
  const stats = useMemo(() => {
    let totalMinutes = 0;
    let positiveMins = 0;
    let negativeMins = 0;
    let neutralCount = 0;

    filteredRecords.forEach(r => {
      const mins = (r.hours * 60) + r.minutes;
      if (r.type === RecordType.CREDIT) {
        positiveMins += mins;
        totalMinutes += mins;
      } else if (r.type === RecordType.DEBIT) {
        negativeMins += mins;
        totalMinutes -= mins;
      } else {
        neutralCount++;
      }
    });

    const isPositive = totalMinutes >= 0;
    const absTotalMinutes = Math.abs(totalMinutes);

    // Calculate Active Employee Count based on current filter scope
    let activeCount = 0;
    if (selectedEmpId) {
      activeCount = 1;
    } else {
      activeCount = availableEmployees.filter(e => e.active).length;
    }

    return {
      balance: `${isPositive ? '' : '-'}${Math.floor(absTotalMinutes / 60)}:${(absTotalMinutes % 60).toString().padStart(2, '0')}`,
      positive: Math.floor(positiveMins / 60) + 'h ' + (positiveMins % 60) + 'm',
      negative: Math.floor(negativeMins / 60) + 'h ' + (negativeMins % 60) + 'm',
      neutralCount,
      employeeCount: activeCount,
      isPositive
    };
  }, [filteredRecords, availableEmployees, selectedEmpId]);

  // 6. Data for CHART 1: BY COMPANY (Always visible/aggregated)
  const companyChartData = useMemo(() => {
    const dataMap: Record<string, { name: string, horasPositivas: number, horasNegativas: number }> = {};
    
    // Usa records filtrados pelos critérios atuais
    filteredRecords.forEach(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const groupKey = emp ? emp.company : 'Desconhecido';
      
      const hours = r.hours + (r.minutes / 60);
      
      if (!dataMap[groupKey]) {
        dataMap[groupKey] = { name: groupKey, horasPositivas: 0, horasNegativas: 0 };
      }

      if (r.type === RecordType.CREDIT) {
        dataMap[groupKey].horasPositivas += hours;
      } else if (r.type === RecordType.DEBIT) {
        dataMap[groupKey].horasNegativas += hours;
      }
    });
    return Object.values(dataMap);
  }, [filteredRecords, employees]);

  // 7. Data for CHART 2: BY SECTOR (Drilldown: Team -> Employee)
  const drillDownChartData = useMemo(() => {
    const dataMap: Record<string, { name: string, horasPositivas: number, horasNegativas: number }> = {};
    
    filteredRecords.forEach(r => {
      let groupKey = '';
      
      if (selectedEmpId) {
         // If single employee selected, breakdown by OccurrenceType
         groupKey = r.occurrenceType || 'Geral';
      } else if (selectedTeam) {
         // Viewing a Team: Group by Employee Name
         groupKey = r.employeeName;
      } else {
         // Global or Company View: Group by Team
         const emp = employees.find(e => e.id === r.employeeId);
         groupKey = emp ? emp.team : 'Outros'; 
      }
      
      const hours = r.hours + (r.minutes / 60);
      
      if (!dataMap[groupKey]) {
        dataMap[groupKey] = { name: groupKey, horasPositivas: 0, horasNegativas: 0 };
      }

      if (r.type === RecordType.CREDIT) {
        dataMap[groupKey].horasPositivas += hours;
      } else if (r.type === RecordType.DEBIT) {
        dataMap[groupKey].horasNegativas += hours;
      }
    });

    return Object.values(dataMap);
  }, [filteredRecords, employees, selectedTeam, selectedEmpId]);

  const typeData = [
    { name: 'Horas Positivas', value: parseFloat(stats.positive.split('h')[0]) },
    { name: 'Horas Negativas', value: parseFloat(stats.negative.split('h')[0]) }
  ];
  
  const COLORS = ['#10b981', '#ef4444'];

  const getDashboardTitle = () => {
    if (selectedEmpId) return 'Visão Individual';
    if (selectedTeam) return `Setor: ${selectedTeam}`;
    if (selectedCompany) return `Empresa: ${selectedCompany}`;
    return 'Visão Geral (Holding)';
  };

  const getDashboardSubtitle = () => {
    if (selectedEmpId) return `Analisando saldo de: ${employees.find(e => e.id === selectedEmpId)?.name}`;
    if (selectedTeam) return 'Acompanhamento de banco de horas da equipe';
    if (selectedCompany) return 'Visão consolidada da empresa';
    return 'Acompanhamento global de todas as empresas';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* --- MANAGEMENT TOOLS SECTION --- */}
      <div className="bg-slate-800 text-white rounded-xl shadow-md overflow-hidden">
         <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
               <Database className="text-indigo-400" />
               <h3 className="font-bold">Ferramentas de Gestão</h3>
            </div>
            {statusMessage && (
               <span className="text-sm bg-indigo-600 px-3 py-1 rounded-full animate-pulse">
                  {statusMessage}
               </span>
            )}
         </div>
         
         <div className="p-4 flex flex-wrap gap-3 items-center">
             {/* 1. Download Template */}
             <button 
                onClick={handleDownloadTemplate}
                className="flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
             >
                <FileSpreadsheet size={16} className="mr-2" />
                Baixar Modelo CSV
             </button>

             {/* 2. Import CSV */}
             <input 
               type="file" 
               accept=".csv" 
               ref={fileInputRef} 
               className="hidden" 
               onChange={handleFileSelect} 
             />
             <button 
                onClick={triggerFileInput}
                disabled={isProcessing}
                className={`flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
             >
                {isProcessing ? <Loader2 className="mr-2 animate-spin" size={16}/> : <Upload size={16} className="mr-2" />}
                Importar CSV
             </button>

             {/* 3. Reset Database */}
             <div className="h-6 w-px bg-slate-600 mx-2 hidden sm:block"></div>
             
             <button 
                onClick={handleResetDatabase}
                disabled={isProcessing}
                className="flex items-center px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800/50 rounded-lg text-sm font-medium transition-colors"
                title="Apagar dados (verifique o console para logs)"
             >
                {isProcessing ? <Loader2 className="mr-2 animate-spin" size={16}/> : <Trash2 size={16} className="mr-2" />}
                Resetar Banco
             </button>
             
             <div className="ml-auto text-xs text-slate-400 italic">
               * Verifique o console do navegador (F12) para detalhes.
             </div>
         </div>
      </div>

      {/* Header with Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {getDashboardTitle()}
          </h2>
          <p className="text-sm text-slate-500">
            {getDashboardSubtitle()}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          
          {/* Company Filter */}
          <div className="relative min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building2 className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={selectedCompany}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-700 shadow-sm"
            >
              <option value="">Todas Empresas</option>
              {companies.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
            {selectedCompany && (
              <button 
                onClick={() => handleCompanyChange('')}
                className="absolute inset-y-0 right-8 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                title="Limpar empresa"
              >
                <X size={14} />
              </button>
            )}
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Team Filter */}
          <div className="relative min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Briefcase className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={selectedTeam}
              onChange={(e) => handleTeamChange(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-700 shadow-sm"
            >
              <option value="">Todos Setores</option>
              {availableTeams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
            {selectedTeam && (
              <button 
                onClick={() => handleTeamChange('')}
                className="absolute inset-y-0 right-8 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                title="Limpar setor"
              >
                <X size={14} />
              </button>
            )}
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Employee Filter */}
          <div className="relative min-w-[240px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-700 shadow-sm"
            >
              <option value="">{selectedTeam ? 'Todos da Equipe' : 'Todos Colaboradores'}</option>
              {availableEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            {selectedEmpId && (
              <button 
                onClick={() => setSelectedEmpId('')}
                className="absolute inset-y-0 right-8 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                title="Limpar colaborador"
              >
                <X size={14} />
              </button>
            )}
             <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-all hover:border-indigo-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Saldo {selectedEmpId ? 'Atual' : (selectedTeam ? 'do Setor' : (selectedCompany ? 'da Empresa' : 'Global'))}</p>
              <h3 className={`text-2xl font-bold mt-1 ${stats.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.balance} h
              </h3>
            </div>
            <div className={`p-2 rounded-lg ${stats.isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              <Clock size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {selectedEmpId ? 'Saldo líquido do colaborador' : 'Saldo líquido acumulado'}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-all hover:border-blue-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Colaboradores</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.employeeCount}</h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Users size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {selectedEmpId 
              ? 'Visualizando 1 colaborador' 
              : 'Ativos neste filtro'}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-all hover:border-emerald-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Positivo</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">+{stats.positive}</h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-all hover:border-red-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Negativo</p>
              <h3 className="text-2xl font-bold mt-1 text-red-600">-{stats.negative}</h3>
            </div>
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <TrendingDown size={20} />
            </div>
          </div>
        </div>
      </div>

      {stats.neutralCount > 0 && (
         <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center text-slate-600">
            <Info className="w-5 h-5 mr-2" />
            <span className="text-sm">
              Existem {stats.neutralCount} registros informativos (Atestados, Exames, etc) neste filtro.
            </span>
         </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: Company Overview */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Horas por Empresa</h3>
          <div className="h-80 w-full">
            {companyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{fill: '#64748b', fontSize: 11}} 
                    axisLine={false} 
                    tickLine={false} 
                    interval={0}
                  />
                  <YAxis tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{fill: '#f1f5f9'}}
                  />
                  <Legend />
                  <Bar dataKey="horasPositivas" name="Horas Positivas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="horasNegativas" name="Horas Negativas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400">
                Sem dados suficientes para exibir o gráfico.
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Proportion Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Proporção Geral (Crédito vs Débito)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Sector/Employee Drilldown - Full Width */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
             {selectedEmpId 
               ? 'Detalhe do Colaborador (Por Tipo)' 
               : selectedTeam 
                 ? 'Horas por Colaborador (Neste Setor)' 
                 : 'Horas por Setor'}
          </h3>
          <div className="h-96 w-full">
            {drillDownChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={drillDownChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{fill: '#64748b', fontSize: 11}} 
                    axisLine={false} 
                    tickLine={false} 
                    interval={0}
                    angle={drillDownChartData.length > 8 ? -45 : 0}
                    textAnchor={drillDownChartData.length > 8 ? 'end' : 'middle'}
                    height={drillDownChartData.length > 8 ? 60 : 30}
                  />
                  <YAxis tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{fill: '#f1f5f9'}}
                  />
                  <Legend />
                  <Bar dataKey="horasPositivas" name="Horas Positivas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  <Bar dataKey="horasNegativas" name="Horas Negativas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400">
                Sem dados neste filtro.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;