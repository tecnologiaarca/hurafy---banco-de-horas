import React, { useState } from 'react';
import { AlertCircle, Lock, Mail, ShieldCheck, CheckCircle } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';
import { Employee } from '../types';

interface LoginProps {
  onLoginSuccess: (user: Employee) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const result = await firebaseService.login(email, password);
      
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.message || 'Credenciais inválidas.');
      }
    } catch (err: any) {
      setError('Erro inesperado. Verifique o console.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, digite seu e-mail no campo acima para recuperar a senha.');
      return;
    }

    setResetLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const result = await firebaseService.sendPasswordReset(email);
      if (result.success) {
        setSuccessMsg(result.message);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Erro ao enviar solicitação.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <h1 className="text-3xl font-bold text-white tracking-wider uppercase relative z-10">Hurafy</h1>
          <p className="text-indigo-300 mt-2 text-sm relative z-10 font-medium">Banco de Horas Digital</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mb-4 border border-slate-200">
               <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Acesso ao Sistema</h2>
            <p className="text-sm text-slate-500 mt-1">Entre com seu login corporativo</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center text-sm animate-fade-in">
              <AlertCircle size={16} className="mr-2 shrink-0" />
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center text-sm animate-fade-in">
              <CheckCircle size={16} className="mr-2 shrink-0" />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="seu.email@arcaplast.com.br"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading || loading}
                  className="text-sm text-slate-500 hover:text-indigo-600 hover:underline transition-colors focus:outline-none"
                >
                  {resetLoading ? 'Enviando solicitação...' : 'Esqueceu sua senha?'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || resetLoading}
              className={`w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                (loading || resetLoading) ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <div className="flex items-center">
                   <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                   Acessando...
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;