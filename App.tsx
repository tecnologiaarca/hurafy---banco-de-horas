import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TimeEntryForm from './components/TimeEntryForm';
import EmployeeList from './components/EmployeeList';
import Reports from './components/Reports';
import BulkOccurrence from './components/BulkOccurrence';
import Settings from './components/Settings';
import Login from './components/Login';
import { Role, Employee, TimeRecord, AppSetting } from './types';
import { firebaseService } from './services/firebaseService';
import { Menu } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

// Expose service to window for console scripts
(window as any).firebaseService = firebaseService;

const App: React.FC = () => {
  // Debug Log
  useEffect(() => {
    console.log("🚀 App Component Mounted");
  }, []);

  // Application State
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  
  // Settings State (Dynamic Lists)
  const [companies, setCompanies] = useState<AppSetting[]>([]);
  const [teams, setTeams] = useState<AppSetting[]>([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Load User Session Persistent
  useEffect(() => {
    // Check if auth is initialized safely
    if (!firebaseService.auth) {
      const msg = "Firebase Auth service not initialized. Verifique as configurações.";
      console.error(msg);
      setInitError(msg);
      setAuthChecked(true);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(firebaseService.auth, async (user) => {
        console.log("Auth State Changed:", user ? `User: ${user.email}` : "No User");
        
        if (user) {
          try {
            const profile = await firebaseService.getOrCreateProfile(user);
            setCurrentUser(profile);
          } catch (e: any) {
            console.error("Error loading profile:", e);
            setInitError("Erro ao carregar perfil do usuário: " + e.message);
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
        setAuthChecked(true);
      }, (error) => {
        console.error("Auth Subscription Error:", error);
        setInitError("Erro na conexão com autenticação.");
        setAuthChecked(true);
      });

      return () => unsubscribe();
    } catch (error: any) {
       console.error("Critical error setting up auth listener:", error);
       setInitError(error.message);
       setAuthChecked(true);
    }
  }, []);

  // Load Data function
  const fetchData = async () => {
    if (currentUser) {
      try {
        console.log("Fetching data from Firestore...");
        
        // Fetch Parallel
        const [emps, recs, comps, areas] = await Promise.all([
           firebaseService.getEmployees(),
           firebaseService.getRecords(),
           firebaseService.getSettingsList('settings_companies'),
           firebaseService.getSettingsList('settings_areas')
        ]);

        setEmployees(emps);
        setRecords(recs);
        setCompanies(comps);
        setTeams(areas);
        
        console.log("Data fetched successfully:", { 
          employees: emps.length, 
          records: recs.length,
          companies: comps.length,
          areas: areas.length
        });
      } catch (e) {
        console.error("Error fetching data:", e);
      }
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

  // Optimistic Update Helpers
  const handleLocalRecordUpdate = (updatedRecord: TimeRecord) => {
    setRecords(prevRecords => 
      prevRecords.map(r => r.id === updatedRecord.id ? updatedRecord : r)
    );
  };

  const handleLocalRecordDelete = (recordId: string) => {
    setRecords(prevRecords => prevRecords.filter(r => r.id !== recordId));
  };

  if (initError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
          <h2 className="text-red-600 text-xl font-bold mb-2">Erro de Inicialização</h2>
          <p className="text-slate-600">{initError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-100 space-y-4">
         <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
         <p className="text-slate-500 font-medium">Conectando ao banco de dados...</p>
      </div>
    );
  }

  // If not logged in, show Login Screen
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render Page Content based on route
  const renderContent = () => {
    try {
      switch (currentPage) {
        case 'dashboard':
          return <Dashboard records={records} employees={employees} />;
        case 'form':
          return <TimeEntryForm currentUser={currentUser} employees={employees} onRecordAdded={fetchData} />;
        case 'bulk':
          return currentUser.role === Role.ADMIN ? 
            <BulkOccurrence 
              employees={employees} 
              currentUser={currentUser} 
              onRecordsAdded={fetchData} 
              companyList={companies}
              teamList={teams}
            /> : <div className="p-10 text-center text-slate-500">Acesso Restrito ao RH.</div>;
        case 'employees':
          return currentUser.role === Role.ADMIN ? 
            <EmployeeList 
              employees={employees} 
              refreshData={fetchData} 
              currentUser={currentUser}
              companyList={companies}
              teamList={teams}
            /> : 
            <div className="text-center p-10 text-slate-500">Acesso negado. Esta área é restrita ao RH.</div>;
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
        case 'settings':
          return currentUser.role === Role.ADMIN ? 
            <Settings 
               companies={companies}
               teams={teams}
               employees={employees} // Passed for migration logic
               refreshData={fetchData}
            /> : 
            <div className="text-center p-10 text-slate-500">Acesso negado.</div>;
        default:
          return <Dashboard records={records} employees={employees} />;
      }
    } catch (e) {
      console.error("Error rendering page content:", e);
      return <div className="p-4 text-red-500">Erro ao carregar conteúdo da página. Verifique o console.</div>;
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