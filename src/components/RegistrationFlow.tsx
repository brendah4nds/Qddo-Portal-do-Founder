import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Instagram, Building2 } from 'lucide-react';
import { db } from '../firebase';

export function RegistrationFlow({ user, onComplete }: { user: User; onComplete: () => void }) {
  const [registering, setRegistering] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    instagram: '',
    bio: '',
    companyName: '',
    companyBio: '',
    cnpj: '',
    companyTipo: ''
  });

  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!termsAccepted) {
      alert('Você precisa aceitar os termos e autorizações para continuar.');
      return;
    }

    setRegistering(true);
    try {
      await setDoc(doc(db, 'founders', user.uid), {
        name: formData.name,
        username: formData.username,
        instagram: formData.instagram,
        bio: formData.bio,
        company: {
          name: formData.companyName,
          bio: formData.companyBio,
          cnpj: formData.cnpj,
          tipo: formData.companyTipo
        },
        registeredAt: serverTimestamp(),
        termsAccepted: true,
        termsAcceptedAt: serverTimestamp(),
        role: 'user'
      });
      onComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6 py-20">
      <div className="max-w-2xl w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-sans mb-4">Bem-vindo ao QDDO</h2>
          <p className="text-stone-500 font-sans text-lg">Complete seu cadastro de Founder para acessar a plataforma.</p>
        </div>

        <form onSubmit={handleRegister} className="bg-white rounded-[40px] p-12 border border-stone-200 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Nome</label>
              <input 
                required
                type="text" 
                placeholder="Seu nome real"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Nome de Usuário</label>
              <input 
                required
                type="text" 
                placeholder="@username"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Instagram</label>
            <div className="relative">
              <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
              <input 
                type="text" 
                placeholder="link do seu perfil"
                value={formData.instagram}
                onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                className="w-full pl-12 pr-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Bio</label>
            <textarea 
              rows={3}
              placeholder="Conte um pouco sobre você..."
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all resize-none"
            />
          </div>

          <div className="pt-8 border-t border-stone-100">
            <h3 className="font-sans text-2xl mb-8 flex items-center gap-3">
              <Building2 size={24} className="text-stone-400" />
              Sua Empresa
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Nome da Empresa</label>
                <input 
                  type="text" 
                  placeholder="Nome da sua startup/negócio"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">CNPJ</label>
                <input 
                  type="text" 
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                  className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Categoria de Empresa</label>
                <select
                  value={formData.companyTipo}
                  onChange={e => setFormData({ ...formData, companyTipo: e.target.value })}
                  className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Selecione a categoria...</option>
                  <option value="HealthTech">HealthTech</option>
                  <option value="EdTech">EdTech</option>
                  <option value="SaaS/ Software">SaaS/ Software</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Eventos">Eventos</option>
                  <option value="Variados">Variados</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Bio da Empresa</label>
                <textarea
                  rows={2}
                  placeholder="O que sua empresa faz?"
                  value={formData.companyBio}
                  onChange={e => setFormData({ ...formData, companyBio: e.target.value })}
                  className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-start gap-4 cursor-pointer group" onClick={() => setTermsAccepted(!termsAccepted)}>
            <div className={`mt-1 w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center shrink-0 ${
              termsAccepted ? 'bg-stone-900 border-stone-900' : 'bg-stone-50 border-stone-200 group-hover:border-stone-400'
            }`}>
              {termsAccepted && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
            </div>
            <label className="text-sm text-stone-600 leading-tight cursor-pointer">
              Aceito os <span className="font-bold underline text-stone-900">termos e autorizações</span> (LGPD, uso de imagem e localização).
            </label>
          </div>

          <button 
            type="submit"
            disabled={registering}
            className="w-full bg-stone-900 text-white py-6 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-2xl shadow-stone-900/20 text-lg"
          >
            {registering ? 'Cadastrando...' : 'Finalizar Cadastro e Entrar'}
          </button>
        </form>

      </div>
    </div>
  );
}
