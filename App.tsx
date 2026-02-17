import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TimeEntryForm from './components/TimeEntryForm';
import EmployeeList from './components/EmployeeList';
import Reports from './components/Reports';
import Login from './components/Login';
import { Role, Employee, TimeRecord } from './types';
import { sheetService } from './services/sheetService';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  // Application State
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Authentication State
  // Initialize from localStorage if available to persist session on refresh
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    try {
      const savedUser = localStorage.getItem('hurafy_session_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Error parsing session user:", error);
      return null;
    }
  });

  // Load Data function (Called after login and on updates)
  const fetchData = async () => {
    // Only fetch if logged in to save API calls
    if (currentUser) {
      const emps = await sheetService.getEmployees();
      const recs = await sheetService.getRecords();

      setEmployees(emps);
      setRecords(recs);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: Employee) => {
    // Save to localStorage
    localStorage.setItem('hurafy_session_user', JSON.stringify(user));
    setCurrentUser(user);
    // Reset page to dashboard on login
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('hurafy_session_user');
    setCurrentUser(null);
    setEmployees([]);
    setRecords([]);
  };

  // Optimistic Update Helper
  const handleLocalRecordUpdate = (updatedRecord: TimeRecord) => {
    setRecords(prevRecords => 
      prevRecords.map(r => r.id === updatedRecord.id ? updatedRecord : r)
    );
  };

  // Optimistic Delete Helper
  const handleLocalRecordDelete = (recordId: string) => {
    setRecords(prevRecords => prevRecords.filter(r => r.id !== recordId));
  };

  // If not logged in, show Login Screen
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render Page Content based on route
  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard records={records} employees={employees} />;
      case 'form':
        return <TimeEntryForm currentUser={currentUser} employees={employees} onRecordAdded={fetchData} />;
      case 'employees':
        return currentUser.role === Role.ADMIN ? <EmployeeList employees={employees} refreshData={fetchData} /> : <div className="text-center p-10 text-slate-500">Acesso negado. Esta área é restrita ao RH.</div>;
      case 'reports':
        // Acesso permitido para ADMIN e LEADER
        return (currentUser.role === Role.ADMIN || currentUser.role === Role.LEADER) ? 
          <Reports 
            records={records} 
            employees={employees} 
            currentUser={currentUser} 
            refreshData={fetchData} 
            onUpdateRecord={handleLocalRecordUpdate}
            onDeleteRecord={handleLocalRecordDelete}
          /> : 
          <div className="text-center p-10 text-slate-500">Acesso negado.</div>;
      default:
        return <Dashboard records={records} employees={employees} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed w-full top-0 z-40 bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
         <span className="font-bold">Hurafy</span>
         <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
           <Menu size={24} />
         </button>
      </div>

      <Sidebar 
        currentUser={currentUser}
        currentRole={currentUser.role} 
        currentPage={currentPage} 
        setPage={(page) => {
          setCurrentPage(page);
          setIsSidebarOpen(false);
        }}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
      />

      <main className="flex-1 overflow-auto w-full pt-16 md:pt-0">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;