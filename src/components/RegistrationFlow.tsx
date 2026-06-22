import React, { useState, useEffect, useRef } from 'react';
import { Instagram, Building2, Search, Check, X, Plus } from 'lucide-react';
import { api } from '../api';

type Company = { name: string; bio: string; cnpj: string; tipo: string; logoURL?: string };

export function RegistrationFlow({ user, onComplete }: { user: any; onComplete: () => void }) {
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

  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [companyMode, setCompanyMode] = useState<'search' | 'existing' | 'new'>('search');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/api/founders').then(res => {
      const seen = new Set<string>();
      const companies: Company[] = [];
      for (const f of (res.data || [])) {
        const key = (f.company?.name || '').toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        companies.push({
          name: f.company.name,
          bio: f.company.bio || '',
          cnpj: f.company.cnpj || '',
          tipo: f.company.tipo || '',
          logoURL: f.company.logoURL || ''
        });
      }
      setAllCompanies(companies.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    }).catch(() => {});
  }, []);

  const filteredCompanies = companyQuery.length > 0
    ? allCompanies.filter(c => c.name.toLowerCase().includes(companyQuery.toLowerCase()))
    : allCompanies;

  const exactMatch = allCompanies.some(
    c => c.name.toLowerCase() === companyQuery.toLowerCase().trim()
  );

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    setCompanyQuery(company.name);
    setFormData(prev => ({
      ...prev,
      companyName: company.name,
      companyBio: company.bio,
      cnpj: company.cnpj,
      companyTipo: company.tipo
    }));
    setCompanyMode('existing');
    setShowDropdown(false);
  };

  const handleAddNewCompany = () => {
    const name = companyQuery.trim();
    setFormData(prev => ({ ...prev, companyName: name, companyBio: '', cnpj: '', companyTipo: '' }));
    setSelectedCompany(null);
    setCompanyMode('new');
    setShowDropdown(false);
  };

  const handleResetCompany = () => {
    setCompanyQuery('');
    setSelectedCompany(null);
    setCompanyMode('search');
    setFormData(prev => ({ ...prev, companyName: '', companyBio: '', cnpj: '', companyTipo: '' }));
    setTimeout(() => companyInputRef.current?.focus(), 50);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!termsAccepted) {
      alert('Você precisa aceitar os termos e autorizações para continuar.');
      return;
    }
    setRegistering(true);
    try {
      await api.post('/api/founders', {
        name: formData.name,
        username: formData.username.replace(/@/g, '').trim().toLowerCase(),
        instagram: formData.instagram,
        bio: formData.bio,
        company: {
          name: formData.companyName,
          bio: formData.companyBio,
          cnpj: formData.cnpj,
          tipo: formData.companyTipo,
          ...(selectedCompany?.logoURL ? { logoURL: selectedCompany.logoURL } : {})
        },
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
          <h2 className="text-display font-sans mb-4">Bem-vindo ao QDDO</h2>
          <p className="text-stone-500 font-sans text-lg">Complete seu cadastro de Founder para acessar a plataforma.</p>
        </div>

        <form onSubmit={handleRegister} className="bg-white rounded-xl p-12 border border-stone-100 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Nome</label>
              <input
                required
                type="text"
                placeholder="Seu nome real"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Nome de Usuário</label>
              <input
                required
                type="text"
                placeholder="@username"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value.replace(/@/g, '') })}
                className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Instagram</label>
            <div className="relative">
              <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
              <input
                type="text"
                placeholder="link do seu perfil"
                value={formData.instagram}
                onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                className="w-full pl-12 pr-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Bio</label>
            <textarea
              rows={3}
              placeholder="Conte um pouco sobre você..."
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
            />
          </div>

          {/* ── Empresa ───────────────────────────────────────────── */}
          <div className="pt-8 border-t border-stone-100">
            <h3 className="font-sans text-h2 mb-8 flex items-center gap-3">
              <Building2 size={24} className="text-stone-400" />
              Sua Empresa
            </h3>
            <div className="space-y-6">

              <div className="space-y-2">
                <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Nome da Empresa</label>

                {companyMode === 'search' ? (
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" size={18} />
                    <input
                      ref={companyInputRef}
                      type="text"
                      placeholder="Buscar empresa existente ou digitar nome novo..."
                      value={companyQuery}
                      onChange={e => { setCompanyQuery(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      className="w-full pl-12 pr-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                    />

                    {showDropdown && (filteredCompanies.length > 0 || companyQuery.trim().length > 0) && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden">
                        {filteredCompanies.length > 0 && (
                          <div className="max-h-56 overflow-y-auto">
                            {filteredCompanies.map(c => (
                              <button
                                key={c.name}
                                type="button"
                                onMouseDown={() => handleSelectCompany(c)}
                                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 text-left transition-colors border-b border-stone-50 last:border-0"
                              >
                                <span className="font-semibold text-stone-900 text-sm">{c.name}</span>
                                {c.tipo && (
                                  <span className="text-xs text-stone-400 font-bold uppercase tracking-wider ml-3 shrink-0">{c.tipo}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {companyQuery.trim().length > 0 && !exactMatch && (
                          <div className={filteredCompanies.length > 0 ? 'border-t border-stone-100' : ''}>
                            <button
                              type="button"
                              onMouseDown={handleAddNewCompany}
                              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-primary/5 text-left transition-colors"
                            >
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Plus size={14} className="text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-primary">Adicionar "{companyQuery.trim()}"</p>
                                <p className="text-xs text-stone-400">Cadastrar como nova empresa no QDDO</p>
                              </div>
                            </button>
                          </div>
                        )}

                        {filteredCompanies.length === 0 && companyQuery.trim().length === 0 && (
                          <div className="px-5 py-4 text-sm text-stone-400 text-center">
                            Digite para buscar uma empresa...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center justify-between px-5 py-4 rounded-xl border-2 transition-all ${
                    companyMode === 'existing'
                      ? 'bg-primary/5 border-primary/25'
                      : 'bg-stone-50 border-stone-200'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      {companyMode === 'existing' ? (
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                          <Check size={16} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center shrink-0">
                          <Plus size={16} className="text-stone-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate">{formData.companyName}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {companyMode === 'existing' ? 'Empresa já cadastrada no QDDO' : 'Nova empresa'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetCompany}
                      className="flex items-center gap-1.5 text-xs font-bold text-stone-400 hover:text-stone-700 ml-4 shrink-0 transition-colors"
                    >
                      <X size={13} />
                      Trocar
                    </button>
                  </div>
                )}
              </div>

              {/* Campos de detalhe — aparecem só após selecionar/criar empresa */}
              {companyMode !== 'search' && (
                <>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">CNPJ</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={formData.cnpj}
                      onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Categoria de Empresa</label>
                    <select
                      value={formData.companyTipo}
                      onChange={e => setFormData({ ...formData, companyTipo: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none"
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
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Bio da Empresa</label>
                    <textarea
                      rows={2}
                      placeholder="O que sua empresa faz?"
                      value={formData.companyBio}
                      onChange={e => setFormData({ ...formData, companyBio: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                    />
                  </div>
                </>
              )}
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
            className="w-full bg-primary text-white py-6 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20 text-lg"
          >
            {registering ? 'Cadastrando...' : 'Finalizar Cadastro e Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
