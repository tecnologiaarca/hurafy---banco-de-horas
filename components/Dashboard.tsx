import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { Clock, Users, TrendingUp, TrendingDown, Info, Filter, X, Briefcase, Building2 } from 'lucide-react';
import { TimeRecord, Employee, RecordType } from '../types';

interface DashboardProps {
  records: TimeRecord[];
  employees: Employee[];
}

const Dashboard: React.FC<DashboardProps> = ({ records, employees }) => {
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  
  const companies = useMemo(() => {
    const unique = new Set(employees.map(e => e.company).filter(Boolean));
    return Array.from(unique).sort();
  }, [employees]);

  const availableTeams = useMemo(() => {
    let filtered = employees;
    if (selectedCompany) {
      filtered = filtered.filter(e => e.company === selectedCompany);
    }
    const unique = new Set(filtered.map(e => e.team).filter(Boolean));
    return Array.from(unique).sort();
  }, [employees, selectedCompany]);

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

  const filteredRecords = useMemo(() => {
    let result = records || [];
    const validEmployeeIds = availableEmployees.map(e => e.id);
    result = result.filter(r => validEmployeeIds.includes(r.employeeId));
    if (selectedEmpId) {
      result = result.filter(r => r.employeeId === selectedEmpId);
    }
    return result;
  }, [records, availableEmployees, selectedEmpId]);

  const handleCompanyChange = (company: string) => {
    setSelectedCompany(company);
    setSelectedTeam('');
    setSelectedEmpId('');
  };

  const handleTeamChange = (team: string) => {
    setSelectedTeam(team);
    setSelectedEmpId('');
  };

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

  const companyChartData = useMemo(() => {
    const dataMap: Record<string, { name: string, horasPositivas: number, horasNegativas: number }> = {};
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

  const drillDownChartData = useMemo(() => {
    const dataMap: Record<string, { name: string, horasPositivas: number, horasNegativas: number }> = {};
    filteredRecords.forEach(r => {
      let groupKey = '';
      if (selectedEmpId) {
         groupKey = r.occurrenceType || 'Geral';
      } else if (selectedTeam) {
         groupKey = r.employeeName;
      } else {
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
  
  // Updated Colors for Minimalist Look (Medium Purple & Blue-Grey)
  const COLORS = ['#818cf8', '#94a3b8'];

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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Cards - No Border, Shadow-sm, White BG */}
        <div className="bg-white p-6 rounded-xl shadow-sm transition-all">
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

        <div className="bg-white p-6 rounded-xl shadow-sm transition-all">
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

        <div className="bg-white p-6 rounded-xl shadow-sm transition-all">
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

        <div className="bg-white p-6 rounded-xl shadow-sm transition-all">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="bg-white p-6 rounded-xl shadow-sm">
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

        <div className="bg-white p-6 rounded-xl shadow-sm">
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

        <div className="bg-white p-6 rounded-xl shadow-sm lg:col-span-2">
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