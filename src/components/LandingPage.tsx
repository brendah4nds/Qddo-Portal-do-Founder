import React from 'react';
import { LogIn, UserPlus } from 'lucide-react';

export function LandingPage({ onLogin, onRegister }: { onLogin: () => void, onRegister: () => void }) {
  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-12">
          <div className="inline-flex relative w-20 h-20 bg-black rounded-2xl items-center justify-center overflow-hidden mb-8 shadow-2xl shadow-black/20">
            <div className="w-12 h-12 border-[6px] border-white rounded-full"></div>
            <div className="absolute bottom-3 right-3 w-5 h-5 bg-[#FF4500] rounded-full shadow-[0_0_15px_rgba(255,69,0,0.6)]"></div>
          </div>
          <h1 className="font-sans font-black text-6xl tracking-tighter italic mb-4">qddo</h1>
          <p className="text-stone-500 font-serif italic text-lg">Gestão Inteligente de Espaços & Comunidade Founders</p>
        </div>

        <div className="bg-white rounded-[40px] p-10 border border-stone-200 shadow-xl space-y-8">
          <div className="space-y-4">
            <button 
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-3 bg-stone-900 text-white py-5 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/20 group"
            >
              <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
              Entrar com Google
            </button>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold text-stone-300">
                <span className="bg-white px-4">ou</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-stone-500 text-sm mb-4">Caso não tenha cadastro,</p>
              <button 
                onClick={onRegister}
                className="inline-flex items-center gap-2 text-stone-900 font-bold hover:text-stone-600 transition-colors group"
              >
                <UserPlus size={18} />
                <span className="underline underline-offset-4 decoration-2 decoration-stone-200 group-hover:decoration-stone-900 transition-all">
                  cadastre-se aqui
                </span>
              </button>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-50 text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-300">
              Exclusivo para Founders & Equipe QDDO
            </p>
          </div>
        </div>
        
        <p className="text-center mt-12 text-stone-400 text-xs font-serif italic">
          © 2026 qddo - Brenda Ribeiro
        </p>
      </div>
    </div>
  );
}
