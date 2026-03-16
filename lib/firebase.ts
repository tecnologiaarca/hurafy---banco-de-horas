import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Configuração direta para evitar erros de leitura de variáveis de ambiente
const firebaseConfig = {
  apiKey: "AIzaSyCi1MINg44TN11lf7cswbFYcK1hjdKfj7I",
  authDomain: "hurafy-9b853.firebaseapp.com",
  projectId: "hurafy-9b853",
  storageBucket: "hurafy-9b853.firebasestorage.app",
  messagingSenderId: "592048385877",
  appId: "1:592048385877:web:d759b14bf5e6c1b2d289dc",
  measurementId: "G-V567VPXXGV"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("🔥 Firebase inicializado com sucesso!");
} catch (error) {
  console.error("❌ CRITICAL: Falha ao inicializar Firebase:", error);
  throw error; // Isso será capturado pelo Error Boundary no index.tsx
}

export { auth, db };
export default app;