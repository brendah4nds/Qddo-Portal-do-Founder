import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = "Confirmar",
  variant = "danger"
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string;
  confirmText?: string;
  variant?: "danger" | "primary"
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-sans mb-3">{title}</h3>
        <p className="text-stone-500 mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-stone-400 hover:bg-stone-50 transition-colors"
          >
            Voltar
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-lg",
              variant === "danger" ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-stone-900 hover:bg-stone-800 shadow-stone-900/20"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
