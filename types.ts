export enum Role {
  ADMIN = 'ADMIN', // HR
  LEADER = 'LEADER',
  EMPLOYEE = 'EMPLOYEE'
}

export enum RecordType {
  CREDIT = 'Positivo',
  DEBIT = 'Negativo',
  NEUTRAL = 'Neutro'
}

export interface Employee {
  id: string;
  username: string;
  password?: string; // Optional because we don't fetch passwords back from server
  name: string;
  role: Role;
  team: string; // Used to link leaders to employees
  company: string; // New field for Company Entity
  active: boolean;
  email: string;
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hours: number;
  minutes: number;
  startTime?: string;
  endTime?: string;
  type: RecordType;
  occurrenceType: string; // The specific dropdown label
  reason: string;
  createdAt: string;
  createdBy: string; // Leader ID
  status?: string; // 'regularized' or undefined
  isAdjustment?: boolean; // New field for zero-impact adjustments
}

export interface DashboardStats {
  totalEmployees: number;
  totalPositiveHours: number;
  totalNegativeHours: number;
  netBalance: number;
}