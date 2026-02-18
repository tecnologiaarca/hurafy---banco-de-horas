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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Employee, Role, TimeRecord, RecordType } from '../types';

export const firebaseService = {
  auth,
  db,

  // --- AUTHENTICATION ---
  
  async login(email: string, pass: string): Promise<{ success: boolean; user?: Employee; message?: string }> {
    try {
      if (!auth) {
         throw new Error("Serviço de autenticação não está pronto.");
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await this.getOrCreateProfile(userCredential.user);
      return { success: true, user: profile };
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = "Erro ao realizar login.";
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        msg = "E-mail ou senha inválidos.";
      } else if (error.code === 'auth/too-many-requests') {
        msg = "Muitas tentativas. Tente novamente mais tarde.";
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
    try {
      const docRef = doc(db, 'employees', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as Employee) : null;
    } catch (e) {
      console.error("Erro ao buscar perfil:", e);
      return null;
    }
  },

  async getOrCreateProfile(user: User, name?: string): Promise<Employee> {
    const email = user.email?.toLowerCase() || '';
    const isSuperAdmin = email === 'ti@arcaplast.com.br';
    
    // Tenta buscar pelo UID primeiro (Login padrão)
    let existingProfile = await this.getUserProfile(user.uid);
    
    // Se não achar pelo UID, tenta buscar pelo username (caso tenha sido importado via CSV e seja o primeiro login)
    if (!existingProfile && email) {
        const username = email.split('@')[0];
        const docRefUser = doc(db, 'employees', username);
        const docSnapUser = await getDoc(docRefUser);
        
        if (docSnapUser.exists()) {
            console.log("Perfil encontrado via username (importado). Vinculando UID...");
            existingProfile = docSnapUser.data() as Employee;
        }
    }
    
    if (existingProfile) {
      if (isSuperAdmin && existingProfile.role !== Role.ADMIN) {
        console.log("Atualizando permissão de Super Admin...");
        const updated = { ...existingProfile, role: Role.ADMIN };
        await setDoc(doc(db, 'employees', user.uid), updated, { merge: true });
        return updated;
      }
      return existingProfile;
    }

    console.log("Criando novo perfil para:", email);
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

  async getAllUsers(): Promise<Employee[]> {
    return this.getEmployees();
  },

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

  // Função robusta para deletar todos os usuários exceto TI e usuário atual
  async deleteAllEmployees(currentUserEmail: string): Promise<boolean> {
    console.log("🚀 LIMPEZA INICIADA...");
    
    try {
      const q = query(collection(db, 'employees'));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      let deleteCount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Employee;
        const email = data.email?.toLowerCase();

        // Proteção Crítica: Não apagar o Admin TI e nem o usuário que está logado executando a ação
        if (email === 'ti@arcaplast.com.br' || email === currentUserEmail?.toLowerCase()) {
          console.log(`🛡️ Protegendo usuário admin: ${data.name} (${email})`);
          return;
        }

        console.log(`🗑️ Agendando exclusão: ${data.name} (${doc.id})`);
        batch.delete(doc.ref);
        deleteCount++;
      });

      if (deleteCount > 0) {
        await batch.commit();
        console.log(`✅ LIMPEZA CONCLUÍDA! ${deleteCount} colaboradores removidos.`);
        return true;
      } else {
        console.log("ℹ️ Nenhum colaborador elegível para remoção encontrado.");
        return true;
      }
    } catch (error) {
      console.error("❌ Erro fatal ao limpar banco:", error);
      throw error;
    }
  },

  async importUsersFromCSV(usersList: any[]) {
    return this.importAllColaboradores(usersList);
  },

  async importAllColaboradores(usersList: any[]) {
    console.log(`🚀 Iniciando importação em lote de ${usersList.length} registros...`);
    try {
      const batch = writeBatch(db);
      let count = 0;

      usersList.forEach((user, index) => {
        if (!user.id || !user.name) {
          console.warn(`Linha ${index + 1} ignorada: ID ou Nome faltando.`);
          return;
        }

        // Garante que o ID não tenha espaços ou caracteres inválidos para documento
        const safeId = user.id.trim().toLowerCase();
        const userRef = doc(db, 'employees', safeId);
        
        // Mapeia os campos do CSV para a estrutura da interface Employee
        const userData = {
          id: safeId,
          username: safeId,
          name: user.name,
          email: `${safeId}@arcaplast.com.br`, 
          role: user.role,
          team: user.department, 
          department: user.department,
          company: user.company,
          active: true,
          canLogin: user.role === 'ADMIN' || user.role === 'LEADER',
          updatedAt: serverTimestamp()
        };
        
        console.log(`📄 Processando linha ${index + 1}: ${user.name}`);
        batch.set(userRef, userData, { merge: true });
        count++;
      });
      
      if (count > 0) {
        await batch.commit();
        console.log("✅ Lote (batch) enviado com sucesso ao Firebase!");
        return true;
      } else {
        console.log("⚠️ Nenhum registro válido para importar.");
        return false;
      }
    } catch (error) {
      console.error("❌ Erro detalhado na importação:", error);
      throw error;
    }
  },

  async updateUserRole(uid: string, newRole: Role): Promise<boolean> {
    try {
      const docRef = doc(db, 'employees', uid);
      await updateDoc(docRef, { role: newRole });
      return true;
    } catch (e) {
      console.error("Erro ao atualizar cargo:", e);
      return false;
    }
  },

  async addEmployee(employee: Employee): Promise<void> {
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
    await setDoc(doc(db, 'time_records', record.id), {
      ...record,
      timestamp: serverTimestamp()
    });
  },

  // Nova função para lançamentos manuais do RH
  async saveManualOccurrence(occurrenceData: any): Promise<void> {
    try {
      // Reutiliza a estrutura de TimeRecord, mas mapeia campos específicos se necessário
      // occurrenceData já deve vir formatado ou podemos formatar aqui
      await setDoc(doc(db, 'time_records', occurrenceData.id), {
        ...occurrenceData,
        timestamp: serverTimestamp()
      });
      console.log("✅ Ocorrência manual salva com sucesso.");
    } catch (e) {
      console.error("Erro ao salvar ocorrência manual:", e);
      throw e;
    }
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
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        const { timestamp, ...recordData } = data; 
        return recordData as TimeRecord;
      });
    } catch (e) {
      console.error(`Error fetching records for user ${userId}:`, e);
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