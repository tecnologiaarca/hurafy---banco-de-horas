import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TimeEntryForm from './components/TimeEntryForm';
import EmployeeList from './components/EmployeeList';
import Reports from './components/Reports';
import Login from './components/Login';
import { Role, Employee, TimeRecord } from './types';
import { firebaseService } from './services/firebaseService';
import { Menu } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const App: React.FC = () => {
  // Application State
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Load User Session Persistent
  useEffect(() => {
    if (!firebaseService.auth) {
      setAuthChecked(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseService.auth, async (user) => {
      if (user) {
        // Se existe sessão no Firebase, carrega o perfil completo do Firestore
        try {
          const profile = await firebaseService.getOrCreateProfile(user);
          setCurrentUser(profile);
          // Opcional: Manter página se reload
        } catch (e) {
          console.error("Error loading profile:", e);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  // Load Data function
  const fetchData = async () => {
    if (currentUser) {
      // Carrega colaboradores
      const emps = await firebaseService.getEmployees();
      
      // Carrega registros (Admin vê tudo, Líder vê tudo para relatórios/dashboard por enquanto, ou podemos filtrar no backend)
      // Para manter a paridade com o Dashboard atual que filtra no frontend, pegamos tudo.
      const recs = await firebaseService.getRecords();

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
    setCurrentUser(user);
    setCurrentPage('dashboard');
  };

  const handleLogout = async () => {
    await firebaseService.logout();
    setCurrentUser(null);
    setEmployees([]);
    setRecords([]);
  };

  // Optimistic Update Helpers (UI only, data refreshed via refreshData typically)
  const handleLocalRecordUpdate = (updatedRecord: TimeRecord) => {
    setRecords(prevRecords => 
      prevRecords.map(r => r.id === updatedRecord.id ? updatedRecord : r)
    );
  };

  const handleLocalRecordDelete = (recordId: string) => {
    setRecords(prevRecords => prevRecords.filter(r => r.id !== recordId));
  };

  if (!authChecked) {
    return <div className="h-screen flex items-center justify-center bg-slate-100">Carregando...</div>;
  }

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