import { Employee, TimeRecord } from '../types';
import { INITIAL_EMPLOYEES, INITIAL_RECORDS } from '../constants';

// ============================================================================
// CONFIGURATION
// ============================================================================
// 1. Deploy your Google Apps Script as a Web App.
// 2. Set 'Who has access' to 'Anyone'.
// 3. Paste the Web App URL below inside the quotes.
const API_URL = "https://script.google.com/macros/s/AKfycbxqJH6HEFuxn6u0zooPvPOIkjSXDRaQ7-dHHB_5rX9h5JPl_4kzCu5-6M8ZjKclpIKsOg/exec"; 

// --- OFFLINE/DEMO STATE ---
// Used only if API_URL is empty or fails
let localEmployees: Employee[] = [...INITIAL_EMPLOYEES];
let localRecords: TimeRecord[] = [...INITIAL_RECORDS];

export const sheetService = {
  
  // --- AUTHENTICATION ---
  login: async (username: string, password: string): Promise<{ success: boolean; user?: Employee; message?: string }> => {
    
    // 1. Try API (Server-side validation)
    if (API_URL) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          redirect: 'follow',
          cache: 'no-store',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'login', payload: { username: username.trim(), password: password.trim() } })
        });

        if (response.ok) {
           const data = await response.json();
           if (data.success && data.user) {
             return { success: true, user: data.user };
           } else if (data.success === false) {
             console.warn("Server Login Failed. Message:", data.message);
             if (data.error) {
                return { success: false, message: "Erro no Servidor: " + data.error };
             }
             return { success: false, message: data.message || "Credenciais inválidas." };
           }
        }
      } catch (error) {
        console.error("Login API check failed", error);
        return { success: false, message: "Erro de conexão com o servidor. Tente novamente." };
      }
    } else {
        return { success: false, message: "URL da API não configurada." };
    }

    return { success: false, message: "Usuário não encontrado." };
  },

  // --- EMPLOYEES ---
  getEmployees: async (): Promise<Employee[]> => {
    if (!API_URL) return [];

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        cache: 'no-store', // Prevent caching
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getEmployees', payload: {} })
      });
      
      if (!response.ok) throw new Error("Network error");
      
      const data = await response.json();
      
      // Case 1: Success - Array of employees
      if (Array.isArray(data)) {
        return data;
      } 
      
      // Case 2: Explicit GAS Error (e.g., sheet not found)
      if (data && data.success === false) {
         console.error("Google Sheets API Error (getEmployees):", data.error || data.message);
         // Return empty array so UI doesn't crash, but logged error helps debug
         return [];
      }

      console.error("Received invalid employees format. Expected Array, got:", JSON.stringify(data));
      return [];

    } catch (e) {
      console.error("Fetch employees failed:", e);
      return [];
    }
  },

  addEmployee: async (employee: Employee): Promise<void> => {
    if (!API_URL) return;

    try {
      await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addEmployee', payload: employee })
      });
    } catch (e) {
      console.error("Failed to add employee to Sheet:", e);
    }
  },

  updateEmployee: async (updatedEmployee: Employee): Promise<void> => {
    if (!API_URL) return;

    try {
      await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateEmployee', payload: updatedEmployee })
      });
    } catch (e) {
      console.error("Failed to update employee on Sheet:", e);
    }
  },

  deleteEmployee: async (id: string): Promise<boolean> => {
    if (!API_URL) return true;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteEmployee', payload: { id: String(id).trim() } })
      });
      
      if (!response.ok) return false;
      
      const text = await response.text();
      try {
        const result = JSON.parse(text);
        if (result && result.success === false) {
            console.error("GAS Error:", result.error);
            return false;
        }
        return true;
      } catch (e) {
        // If response is not JSON (e.g. empty string or plain text "Success"), but status is 200, assume success
        console.warn("deleteEmployee response was not JSON, assuming success:", text);
        return true;
      }
    } catch (e) {
      console.error("Failed to delete employee on Sheet:", e);
      return false;
    }
  },

  // --- RECORDS ---
  getRecords: async (): Promise<TimeRecord[]> => {
    if (!API_URL) return [];

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getRecords', payload: {} })
      });
      
      if (!response.ok) throw new Error("Network error");
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        return data;
      }
      
      if (data && data.success === false) {
        console.error("Google Sheets API Error (getRecords):", data.error || data.message);
        return [];
      }

      console.error("Received invalid records format:", JSON.stringify(data));
      return [];

    } catch (e) {
      console.error("Fetch records failed:", e);
      return [];
    }
  },

  addRecord: async (record: TimeRecord): Promise<void> => {
    if (!API_URL) return;

    try {
      await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addRecord', payload: record })
      });
    } catch (e) {
      console.error("Failed to add record to Sheet:", e);
    }
  },

  updateRecord: async (record: TimeRecord): Promise<boolean> => {
    if (!API_URL) return true;
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateRecord', payload: record })
      });
      
      if (!response.ok) return false;
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return data.success === true;
      } catch (e) {
        // If parsing fails but request was OK, assume success if backend is quirky
        console.warn("updateRecord response not JSON:", text);
        return true; 
      }
    } catch (e) {
      console.error("Failed to update record on Sheet:", e);
      return false;
    }
  },

  deleteRecord: async (id: string): Promise<boolean> => {
    if (!API_URL) return true;
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteRecord', payload: { id: String(id).trim() } })
      });
      
      if (!response.ok) return false;
      
      const text = await response.text();
      try {
          const result = JSON.parse(text);
          if (result && result.success === false) return false;
          return true;
      } catch (e) {
          // JSON parsing failed. If status is 200, assume success.
          console.warn("deleteRecord response not JSON, assuming success:", text);
          return true;
      }
    } catch (e) {
      console.error("Failed to delete record on Sheet:", e);
      return false;
    }
  }
};