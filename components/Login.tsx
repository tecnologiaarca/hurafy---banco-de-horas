import React, { useState, useEffect } from 'react';
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
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

  // Limpa mensagens automaticamente após 5 segundos
  useEffect(() => {
    if (error || successMsg) {
      const timer = setTimeout(() => {
        setError('');
        setSuccessMsg('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMsg]);

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
        setError(result.message || 'Erro de conexão.');
      }
    } catch (err: any) {
      setError('Erro de conexão: Verifique sua internet.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Digite seu e-mail no campo acima para recuperar a senha.');
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
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      
      {/* LADO ESQUERDO - FORMULÁRIO (50% em telas grandes, 100% em mobile) */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 sm:p-12 lg:p-24 relative z-10 bg-white">
        
        {/* Logo Area (Mobile/Desktop Left) */}
        <div className="absolute top-8 left-8 lg:top-12 lg:left-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-indigo-200 shadow-lg">
              H
            </div>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">Hurafy</span>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto animate-fade-in-up">
          <div className="mb-10">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
              Acesso ao Painel
            </h1>
            <p className="text-slate-500 text-lg">
              Insira suas credenciais para acessar sua conta.
            </p>
          </div>

          {/* Mensagens de Feedback */}
          <div className="space-y-4 mb-6 min-h-[20px]">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg flex items-center animate-fade-in shadow-sm">
                <AlertCircle size={20} className="mr-3 shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-r-lg flex items-center animate-fade-in shadow-sm">
                <CheckCircle size={20} className="mr-3 shrink-0" />
                <span className="text-sm font-medium">{successMsg}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Input Email */}
            <div className="group">
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">E-mail Corporativo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all duration-200 font-medium"
                  placeholder="exemplo@arcaplast.com.br"
                  required
                />
              </div>
            </div>

            {/* Input Senha */}
            <div className="group">
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all duration-200 font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Links e Botão */}
            <div className="flex flex-col gap-6 pt-2">
              <button
                type="submit"
                disabled={loading || resetLoading}
                className="w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-xl shadow-lg shadow-indigo-200 text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    Entrar no Sistema <ArrowRight size={20} className="ml-2" />
                  </>
                )}
              </button>
              
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading || loading}
                  className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors focus:outline-none"
                >
                  {resetLoading ? 'Enviando email...' : 'Esqueceu sua senha?'}
                </button>
              </div>
            </div>
          </form>
          
          <div className="mt-12 text-center">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Grupo Arca. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>

      {/* LADO DIREITO - BRANDING MINIMALISTA (50% - Escondido no Mobile) */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-900 items-center justify-center">
        
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 opacity-100 z-0"></div>

        {/* Formas Abstratas / Glassmorphism */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] rounded-full bg-purple-600 opacity-20 blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[600px] h-[600px] rounded-full bg-indigo-600 opacity-20 blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-indigo-500 opacity-5 blur-[80px]"></div>

        {/* Textura Sutil (Dot Grid) */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

        {/* Conteúdo Centralizado */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-16 max-w-2xl">
            
            {/* Logo Central */}
            <div className="mb-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mb-6 border border-white/20 shadow-2xl">
                    <span className="text-4xl font-extrabold text-white">H</span>
                </div>
                <h1 className="text-6xl font-extrabold text-white tracking-tighter drop-shadow-2xl">
                    Hurafy
                </h1>
            </div>

            {/* Título de Boas Vindas */}
            <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-md">
                Olá, seja bem-vindo.
            </h2>

            {/* Descrição */}
            <p className="text-lg text-indigo-100 font-light leading-relaxed max-w-md mx-auto">
                Na Hurafy você registra e controla suas ocorrências de ponto, hora extra e compensação.
            </p>

            {/* Indicador Decorativo Inferior */}
            <div className="mt-12 flex gap-2">
                <div className="w-12 h-1.5 bg-white rounded-full opacity-80"></div>
                <div className="w-3 h-1.5 bg-white rounded-full opacity-40"></div>
                <div className="w-3 h-1.5 bg-white rounded-full opacity-20"></div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Login;