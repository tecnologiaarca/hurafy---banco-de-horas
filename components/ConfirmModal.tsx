import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  isLoading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Exclusão',
  message = 'Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.',
  isLoading = false,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  isDestructive = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm transform transition-all scale-100 animate-fade-in-up overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            
            <h3 className={`text-lg font-bold ${isDestructive ? 'text-red-600' : 'text-slate-800'}`}>
              {title}
            </h3>
            
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {message}
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
            
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center
                ${isDestructive 
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 hover:shadow-red-200' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 hover:shadow-indigo-200'}
                ${isLoading ? 'opacity-80 cursor-wait' : ''}
              `}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;