import React from 'react';
import { X, Shield, Camera, MapPin, FileText } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div>
            <h2 className="text-2xl font-serif italic text-stone-900">Termos e Autorizações</h2>
            <p className="text-stone-500 text-xs uppercase tracking-widest font-bold mt-1">Pendência de Cadastro</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-stone-200 rounded-full transition-colors"
          >
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-stone-900">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
                <Shield size={20} className="text-stone-600" />
              </div>
              <h3 className="font-bold text-lg">1. Proteção de Dados (LGPD)</h3>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">
              Ao utilizar o Portal do Founder, você concorda com a coleta e tratamento de seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Seus dados (nome, e-mail, foto, informações de empresa) serão utilizados exclusivamente para a gestão da comunidade, controle de acesso e comunicações pertinentes ao QDDO.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-stone-900">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
                <Camera size={20} className="text-stone-600" />
              </div>
              <h3 className="font-bold text-lg">2. Uso de Imagem e Voz</h3>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">
              Você autoriza o uso gratuito de sua imagem e voz captadas durante eventos, workshops ou no dia a dia do hub QDDO. Estas mídias poderão ser utilizadas em redes sociais, materiais promocionais, apresentações institucionais e site oficial da comunidade, sem limite de tempo ou território.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-stone-900">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
                <MapPin size={20} className="text-stone-600" />
              </div>
              <h3 className="font-bold text-lg">3. Localização e Check-in</h3>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">
              Para fins de registro de presença e pontuação no sistema Quads, o portal poderá solicitar acesso à sua localização em tempo real no momento do check-in. Estes dados não serão compartilhados com terceiros e servirão apenas para validar sua presença física no hub.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-stone-900">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
                <FileText size={20} className="text-stone-600" />
              </div>
              <h3 className="font-bold text-lg">4. Regras da Comunidade</h3>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">
              Você se compromete a seguir as diretrizes de convivência do QDDO, mantendo um ambiente de respeito, colaboração e confidencialidade sobre informações sensíveis compartilhadas por outros founders dentro da plataforma.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-stone-100 bg-stone-50">
          <button
            onClick={onAccept}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 text-lg"
          >
            Aceitar Termos e Autorizações
          </button>
          <p className="text-center text-stone-400 text-[10px] mt-4 uppercase tracking-tighter">
            Ao clicar em aceitar, você confirma que leu e concorda com todos os pontos acima.
          </p>
        </div>
      </div>
    </div>
  );
}
