import { 
  signInWithEmailAndPassword, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  getDocs, 
  where, 
  orderBy, 
  deleteDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Employee, Role, TimeRecord } from '../types';

export const firebaseService = {
  auth,
  db,

  // --- AUTHENTICATION ---
  
  async login(email: string, pass: string): Promise<{ success: boolean; user?: Employee; message?: string }> {
    try {
      if (!auth) {
         return { success: false, message: "Erro: Serviço de autenticação não inicializado." };
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await this.getOrCreateProfile(userCredential.user);
      return { success: true, user: profile };
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = "Erro ao realizar login.";
      
      // Tratamento de erros comuns do Firebase Auth
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        msg = "E-mail ou senha inválidos.";
      } else if (error.code === 'auth/too-many-requests') {
        msg = "Muitas tentativas. Tente novamente mais tarde.";
      } else if (error.code === 'auth/invalid-api-key') {
        msg = "Erro de configuração: API Key inválida ou ausente.";
      } else if (error.code === 'auth/network-request-failed') {
        msg = "Erro de conexão. Verifique sua internet.";
      }
      
      return { success: false, message: msg };
    }
  },

  async logout(): Promise<void> {
    if (auth) await signOut(auth);
  },

  // --- USER PROFILE ---

  async getUserProfile(uid: string): Promise<Employee | null> {
    const docRef = doc(db, 'employees', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Employee) : null;
  },

  async getOrCreateProfile(user: User, name?: string): Promise<Employee> {
    const existingProfile = await this.getUserProfile(user.uid);
    if (existingProfile) return existingProfile;

    // Regra de Negócio: Dono do projeto é ADMIN
    const email = user.email?.toLowerCase() || '';
    const isSuperAdmin = email === 'ti@arcaplast.com.br';
    
    const newEmployee: Employee = {
      id: user.uid,
      name: name || user.displayName || 'Colaborador',
      email: email,
      username: email.split('@')[0],
      role: isSuperAdmin ? Role.ADMIN : Role.EMPLOYEE,
      team: 'Geral',
      company: 'Arca Plast',
      active: true
    };

    await setDoc(doc(db, 'employees', user.uid), newEmployee);
    return newEmployee;
  },

  // --- EMPLOYEES CRUD ---

  async getEmployees(): Promise<Employee[]> {
    try {
      const q = query(collection(db, 'employees'), orderBy('name'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Employee);
    } catch (e) {
      console.error("Error fetching employees:", e);
      return [];
    }
  },

  async addEmployee(employee: Employee): Promise<void> {
    // Nota: Criar o documento no Firestore não cria o usuário no Auth automaticamente.
    await setDoc(doc(db, 'employees', employee.id), employee);
  },

  async updateEmployee(employee: Employee): Promise<void> {
    const { id, ...data } = employee;
    await updateDoc(doc(db, 'employees', id), data as any);
  },

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'employees', id));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  // --- TIME RECORDS CRUD ---

  async saveTimeRecord(record: TimeRecord): Promise<void> {
    // Salva com serverTimestamp para ordenação precisa no backend
    await setDoc(doc(db, 'time_records', record.id), {
      ...record,
      timestamp: serverTimestamp() // Campo auxiliar para ordenação
    });
  },

  async getRecords(): Promise<TimeRecord[]> {
    try {
      const q = query(collection(db, 'time_records'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        const { timestamp, ...recordData } = data; 
        return recordData as TimeRecord;
      });
    } catch (e) {
      console.error("Error fetching records:", e);
      return [];
    }
  },

  async getUserRecords(userId: string): Promise<TimeRecord[]> {
    try {
      const q = query(
        collection(db, 'time_records'), 
        where('employeeId', '==', userId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as TimeRecord);
    } catch (e) {
      console.error("Error fetching user records:", e);
      return [];
    }
  },

  async updateRecord(record: TimeRecord): Promise<boolean> {
    try {
      const { id, ...data } = record;
      await updateDoc(doc(db, 'time_records', id), data as any);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async deleteRecord(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'time_records', id));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
};