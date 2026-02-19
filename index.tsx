import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Error Boundary para capturar erros de renderização e evitar tela branca total
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in application:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ color: '#ef4444' }}>Ops! Algo deu errado.</h1>
          <p>A aplicação encontrou um erro crítico e não pôde ser carregada.</p>
          
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: '0.5rem', overflow: 'auto' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Erro:</p>
            <code style={{ color: '#b91c1c' }}>{this.state.error?.toString()}</code>
          </div>
          
          <div style={{ marginTop: '1rem' }}>
             <p>Verifique o console do navegador (F12) para mais detalhes.</p>
             <button 
               onClick={() => window.location.reload()}
               style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
             >
               Recarregar Página
             </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);