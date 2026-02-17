import { Employee, Role, RecordType, TimeRecord } from './types';

export const TEAMS = [
  'Colaborador',
  'Embalagem',
  'Engenharia',
  'Estoque',
  'Excelência Operacional',
  'Financeiro',
  'Gente e Gestão',
  'Gestão',
  'Gestão da Produção',
  'Gestão Estratégica',
  'Injeção',
  'Logística',
  'Manutenção',
  'Marketing',
  'Mercado',
  'Serviços Gerais',
  'Sopro',
  'Suprimentos',
  'TI'
];

export const COMPANIES = [
  'Arca Plast',
  'Arca Mania',
  'Rearca',
  'Taex Transportadora'
];

// Mock Data Removed. 
// User must define employees in the Google Sheet 'Colaboradores' tab.
export const INITIAL_EMPLOYEES: Employee[] = [];

// Empty records initially.
export const INITIAL_RECORDS: TimeRecord[] = [];