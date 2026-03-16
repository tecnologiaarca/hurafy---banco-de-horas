import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
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
  writeBatch,
  addDoc
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Employee, Role, TimeRecord, AppSetting } from '../types';

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

  async sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!auth) throw new Error("Auth service not initialized");
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: "E-mail de recuperação enviado! Verifique sua caixa de entrada." };
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      let msg = "Erro ao enviar e-mail de recuperação.";
      
      if (error.code === 'auth/user-not-found') {
        msg = "Este e-mail não está cadastrado no sistema.";
      } else if (error.code === 'auth/invalid-email') {
        msg = "Formato de e-mail inválido.";
      } else if (error.code === 'auth/too-many-requests') {
        msg = "Muitas tentativas. Aguarde um momento.";
      }

      return { success: false, message: msg };
    }
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
          console.log(`🛡️ Protegendo usuário admin: ${data.name} (${data.email})`);
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

  // --- SETTINGS (COMPANIES & AREAS) ---
  
  async getSettingsList(collectionName: 'settings_companies' | 'settings_areas'): Promise<AppSetting[]> {
    try {
      const q = query(collection(db, collectionName), orderBy('name'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
    } catch (e) {
      console.error(`Error fetching ${collectionName}:`, e);
      return [];
    }
  },

  async addSettingItem(collectionName: 'settings_companies' | 'settings_areas', name: string): Promise<boolean> {
    try {
      await addDoc(collection(db, collectionName), { 
        name, 
        createdAt: serverTimestamp() 
      });
      return true;
    } catch (e) {
      console.error(`Error adding to ${collectionName}:`, e);
      return false;
    }
  },

  async updateSettingItem(collectionName: 'settings_companies' | 'settings_areas', id: string, name: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, collectionName, id), { name });
      return true;
    } catch (e) {
      console.error(`Error updating ${collectionName}:`, e);
      return false;
    }
  },

  async deleteSettingItem(collectionName: 'settings_companies' | 'settings_areas', id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, collectionName, id));
      return true;
    } catch (e) {
      console.error(`Error deleting from ${collectionName}:`, e);
      return false;
    }
  },

  // --- TIME RECORDS CRUD ---

  async saveTimeRecord(record: TimeRecord): Promise<void> {
    // Usamos setDoc com o record.id que é um UUID gerado no client.
    // Isso garante que o ID do documento seja igual ao ID do registro, facilitando updates e deletes.
    // A coleção DEVE ser 'time_records'.
    
    // Tratamento de segurança: Firestore rejeita campos undefined.
    // Usamos JSON.parse(JSON.stringify()) para remover qualquer propriedade undefined do objeto.
    const cleanRecord = JSON.parse(JSON.stringify(record));

    await setDoc(doc(db, 'time_records', cleanRecord.id), {
      ...cleanRecord,
      timestamp: serverTimestamp()
    });
  },

  // Nova função para lançamentos manuais do RH
  async saveManualOccurrence(occurrenceData: any): Promise<void> {
    try {
      // Clean undefined
      const cleanData = JSON.parse(JSON.stringify(occurrenceData));
      
      await setDoc(doc(db, 'time_records', cleanData.id), {
        ...cleanData,
        timestamp: serverTimestamp()
      });
      console.log("✅ Ocorrência manual salva com sucesso.");
    } catch (e) {
      console.error("Erro ao salvar ocorrência manual:", e);
      throw e;
    }
  },

  // --- GRAVAÇÃO EM LOTE (BULK) ---
  async saveBulkOccurrences(records: TimeRecord[]): Promise<{ success: boolean; count: number }> {
    console.log(`🚀 Iniciando gravação em massa de ${records.length} registros...`);
    try {
      const CHUNK_SIZE = 450; 
      const chunks = [];
      
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        chunks.push(records.slice(i, i + CHUNK_SIZE));
      }

      let totalCommitted = 0;

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(record => {
           // Clean record
           const cleanRecord = JSON.parse(JSON.stringify(record));
           const docRef = doc(db, 'time_records', cleanRecord.id);
           batch.set(docRef, {
             ...cleanRecord,
             timestamp: serverTimestamp()
           });
        });
        await batch.commit();
        totalCommitted += chunk.length;
        console.log(`✅ Lote de ${chunk.length} registros processado.`);
      }

      return { success: true, count: totalCommitted };
    } catch (error) {
      console.error("❌ Erro na gravação em massa:", error);
      throw error;
    }
  },

  // EXCLUSÃO EM LOTE (POR BATCH_ID)
  async deleteBatchRecords(batchId: string): Promise<{ success: boolean; count: number }> {
    console.log(`🗑️ Iniciando exclusão do lote ${batchId}...`);
    try {
      const q = query(collection(db, 'time_records'), where('batchId', '==', batchId));
      const querySnapshot = await getDocs(q);
      
      const recordsToDelete = querySnapshot.docs;
      
      if (recordsToDelete.length === 0) return { success: true, count: 0 };

      const CHUNK_SIZE = 450; 
      const chunks = [];
      
      for (let i = 0; i < recordsToDelete.length; i += CHUNK_SIZE) {
        chunks.push(recordsToDelete.slice(i, i + CHUNK_SIZE));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(docSnap => {
           batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
      
      console.log(`✅ Exclusão em lote concluída: ${recordsToDelete.length} removidos.`);
      return { success: true, count: recordsToDelete.length };

    } catch (error) {
      console.error("❌ Erro na exclusão em massa:", error);
      return { success: false, count: 0 };
    }
  },
  
  // EXCLUSÃO TOTAL (LIMPEZA DE BASE)
  async deleteAllRecords(): Promise<{ success: boolean; count: number }> {
    console.log("🔥 LIMPEZA TOTAL DE REGISTROS INICIADA...");
    try {
        const q = query(collection(db, 'time_records'));
        const querySnapshot = await getDocs(q);
        const totalDocs = querySnapshot.docs.length;
        
        if (totalDocs === 0) return { success: true, count: 0 };
        
        // Chunking para respeitar o limite de 500 ops por batch
        const CHUNK_SIZE = 400; // Margem de segurança
        const chunks = [];
        
        for (let i = 0; i < totalDocs; i += CHUNK_SIZE) {
            chunks.push(querySnapshot.docs.slice(i, i + CHUNK_SIZE));
        }
        
        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log(`🗑️ Lote de limpeza processado (${chunk.length} itens)`);
        }
        
        return { success: true, count: totalDocs };
    } catch (error) {
        console.error("❌ Erro fatal na limpeza total:", error);
        throw error;
    }
  },

  // ATUALIZAÇÃO EM LOTE (POR BATCH_ID)
  async updateBatchRecords(batchId: string, updateData: Partial<TimeRecord>): Promise<{ success: boolean; count: number }> {
    console.log(`✏️ Iniciando atualização do lote ${batchId}...`);
    try {
       const q = query(collection(db, 'time_records'), where('batchId', '==', batchId));
       const querySnapshot = await getDocs(q);
       
       const recordsToUpdate = querySnapshot.docs;
       
       if (recordsToUpdate.length === 0) return { success: true, count: 0 };

       const CHUNK_SIZE = 450;
       const chunks = [];

       for (let i = 0; i < recordsToUpdate.length; i += CHUNK_SIZE) {
         chunks.push(recordsToUpdate.slice(i, i + CHUNK_SIZE));
       }

       for (const chunk of chunks) {
         const batch = writeBatch(db);
         chunk.forEach(docSnap => {
            batch.update(docSnap.ref, updateData as any);
         });
         await batch.commit();
       }

       console.log(`✅ Atualização em lote concluída: ${recordsToUpdate.length} atualizados.`);
       return { success: true, count: recordsToUpdate.length };
    } catch (error) {
       console.error("❌ Erro na atualização em massa:", error);
       return { success: false, count: 0 };
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
      // Clean undefined before update
      const cleanData = JSON.parse(JSON.stringify(data));
      await updateDoc(doc(db, 'time_records', id), cleanData as any);
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