import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Instagram,
  Building2,
  Heart,
  BookOpen,
  Code2,
  Megaphone,
  CalendarDays,
  Layers,
  Plus,
  Lock,
  Globe,
  CheckCircle2,
  Clock,
  ArrowRight,
  HelpCircle,
  CheckSquare,
  MessageCircle,
  AlertTriangle,
  Pencil,
  X,
  Check
} from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';
import { Founder, Challenge } from '../types';
import { ChallengeComments } from './ChallengeComments';
import { CheckinSystem } from './CheckinSystem';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function FounderPortal({
  user,
  activeSubTab,
  setActiveSubTab,
  isAdmin,
  founders = []
}: {
  user: any | null;
  activeSubTab: string;
  setActiveSubTab?: (tab: string) => void;
  isAdmin: boolean;
  founders?: any[];
}) {
  const [founder, setFounder] = useState<Founder | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [completingChallenge, setCompletingChallenge] = useState<Challenge | null>(null);
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(null);

  const [challengeData, setChallengeData] = useState({
    title: '',
    description: '',
    type: 'public' as 'public' | 'private'
  });

  const [completionData, setCompletionData] = useState({
    helperName: '',
    helperUsername: '',
    resolutionDescription: ''
  });

  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    type: 'public' as 'public' | 'private'
  });

  const [editingCompany, setEditingCompany] = useState(false);
  const [companyEditData, setCompanyEditData] = useState({ name: '', cnpj: '', bio: '', tipo: '' });
  const [savingCompany, setSavingCompany] = useState(false);

  const [selectedCompanyFounder, setSelectedCompanyFounder] = useState<any | null>(null);

  const COMPANY_CATEGORIES = ['HealthTech', 'EdTech', 'SaaS/Software', 'Marketing', 'Eventos', 'Variados'];

  const CATEGORY_ICONS: Record<string, React.ElementType> = {
    'HealthTech': Heart,
    'EdTech': BookOpen,
    'SaaS/Software': Code2,
    'Marketing': Megaphone,
    'Eventos': CalendarDays,
    'Variados': Layers,
  };

  // Load current user's founder data
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    api.get(`/api/founders/${user._id}`)
      .then(r => {
        if (r.data) setFounder({ ...r.data, id: r.data._id || r.data.id });
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const socket = getSocket();
    const onUpdate = (f: any) => {
      const fId = f._id || f.id;
      if (fId === user._id) setFounder({ ...f, id: fId });
    };
    socket.on('founder:update', onUpdate);
    return () => { socket.off('founder:update', onUpdate); };
  }, [user]);

  // Load challenges
  useEffect(() => {
    if (!user) return;

    api.get('/api/challenges')
      .then(r => {
        const all = r.data.map((c: any) => ({ ...c, id: c._id || c.id }));
        const sorted = all.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        // Non-admin: filter to public + own private
        if (!isAdmin) {
          setChallenges(sorted.filter((c: any) =>
            c.type === 'public' ||
            (c.type === 'private' && (c.founderId === user._id || c.founderId?.toString() === user._id?.toString()))
          ));
        } else {
          setChallenges(sorted);
        }
      })
      .catch(console.error);

    const socket = getSocket();
    const onNew = (c: any) => {
      const norm = { ...c, id: c._id || c.id };
      if (isAdmin || norm.type === 'public' || norm.founderId?.toString() === user._id?.toString()) {
        setChallenges(prev =>
          [norm, ...prev.filter(x => x.id !== norm.id)]
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
      }
    };
    const onUpdate = (c: any) => {
      const norm = { ...c, id: c._id || c.id };
      setChallenges(prev => prev.map(x => x.id === norm.id ? norm : x));
    };
    const onDelete = ({ id }: any) => setChallenges(prev => prev.filter(x => x.id !== id));
    socket.on('challenge:new', onNew);
    socket.on('challenge:update', onUpdate);
    socket.on('challenge:delete', onDelete);
    return () => {
      socket.off('challenge:new', onNew);
      socket.off('challenge:update', onUpdate);
      socket.off('challenge:delete', onDelete);
    };
  }, [user, isAdmin]);

  const handleStartEditCompany = () => {
    setCompanyEditData({
      name: founder?.company?.name || '',
      cnpj: founder?.company?.cnpj || '',
      bio: founder?.company?.bio || '',
      tipo: founder?.company?.tipo || ''
    });
    setEditingCompany(true);
  };

  const handleUpdateCompany = async () => {
    if (!user) return;
    setSavingCompany(true);
    try {
      await api.put(`/api/founders/${user._id}`, {
        company: {
          ...founder?.company,
          name: companyEditData.name,
          cnpj: companyEditData.cnpj,
          bio: companyEditData.bio,
          tipo: companyEditData.tipo
        }
      });
      setEditingCompany(false);
    } catch (error) {
      console.error('Error updating company:', error);
    } finally {
      setSavingCompany(false);
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !challengeData.title) return;
    try {
      await api.post('/api/challenges', {
        title: challengeData.title,
        description: challengeData.description,
        type: challengeData.type,
      });
      setShowNewChallenge(false);
      setChallengeData({ title: '', description: '', type: 'public' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleCompleteChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingChallenge) return;
    try {
      await api.put(`/api/challenges/${completingChallenge.id}`, {
        status: 'completed',
        helperName: completionData.helperName,
        helperUsername: completionData.helperUsername,
        resolutionDescription: completionData.resolutionDescription,
      });
      setCompletingChallenge(null);
      setCompletionData({ helperName: '', helperUsername: '', resolutionDescription: '' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChallenge) return;
    try {
      await api.put(`/api/challenges/${editingChallenge.id}`, {
        title: editData.title,
        description: editData.description,
        type: editData.type,
      });
      setEditingChallenge(null);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-stone-400">Carregando portal...</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-h1 font-sans mb-4">Acesso Restrito</h2>
        <p className="text-stone-500">Por favor, faça login para acessar o Portal Founders.</p>
      </div>
    );
  }

  if (!founder && !isAdmin) {
    return (
      <div className="text-center py-20">
        <h2 className="text-h1 font-sans mb-4">Perfil não encontrado</h2>
        <p className="text-stone-500">Por favor, complete seu cadastro para acessar o portal.</p>
      </div>
    );
  }

  const filteredChallenges = challenges.filter(c => {
    if (activeSubTab === 'desafios-privados') return c.type === 'private';
    if (activeSubTab === 'desafios-publicos') return c.type === 'public';
    return true;
  });

  const isMyChallenge = (challenge: Challenge) =>
    challenge.founderId === user._id ||
    (challenge.founderId as any)?.toString() === user._id?.toString();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      {(activeSubTab === 'desafios-publicos' || activeSubTab === 'desafios-privados') && (
        <div className="flex flex-row items-center justify-between gap-3 mb-8">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveSubTab?.('desafios-publicos')}
              className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                activeSubTab === 'desafios-publicos' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
              }`}
            >
              Públicos
            </button>
            <button
              onClick={() => setActiveSubTab?.('desafios-privados')}
              className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                activeSubTab === 'desafios-privados' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
              }`}
            >
              Privados
            </button>
          </div>
          <button
            onClick={() => setShowNewChallenge(true)}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-stone-900/10"
          >
            <Plus size={20} />
            Novo Desafio
          </button>
        </div>
      )}

      {activeSubTab === 'checkin' && (
        <CheckinSystem user={user} isAdmin={isAdmin} founders={founders} />
      )}

      {activeSubTab === 'empresa' && (
        <div className="space-y-8">
          {isAdmin ? (
            <div className="grid grid-cols-1 gap-6">
              {selectedCompanyFounder ? (
                <div className="bg-white rounded-xl p-12 border border-stone-100 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                  <button
                    onClick={() => setSelectedCompanyFounder(null)}
                    className="text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-8 flex items-center gap-2"
                  >
                    <ArrowRight size={16} className="rotate-180" />
                    Voltar para lista
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-h1 font-sans mb-6">Dados do Founder</h3>
                        {selectedCompanyFounder.photoURL && (
                          <div className="mb-6">
                            <img
                              src={selectedCompanyFounder.photoURL}
                              alt={selectedCompanyFounder.name}
                              className="w-24 h-24 rounded-full object-cover border-2 border-stone-200 shadow-sm"
                            />
                          </div>
                        )}
                        <div className="space-y-4">
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Nome Completo</span>
                            <p className="font-bold text-stone-900">{selectedCompanyFounder.name}</p>
                          </div>
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Username</span>
                            <p className="text-stone-600">@{selectedCompanyFounder.username?.replace(/@/g, '')}</p>
                          </div>
                          {selectedCompanyFounder.instagram && (
                            <div>
                              <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Instagram</span>
                              <p className="text-stone-600">{selectedCompanyFounder.instagram}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Bio</span>
                            <p className="text-sm text-stone-500 leading-relaxed">{selectedCompanyFounder.bio || 'Sem bio informada'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="bg-stone-50 rounded-xl p-8 border border-stone-100">
                        <h3 className="text-h1 font-sans mb-6">Dados da Empresa</h3>
                        <div className="space-y-4">
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Nome da Empresa</span>
                            <p className="font-bold text-stone-900 text-h3">{selectedCompanyFounder.company?.name || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Categoria</span>
                            <p className="font-bold text-stone-900">{selectedCompanyFounder.company?.tipo || 'Não informado'}</p>
                          </div>
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">CNPJ</span>
                            <p className="font-bold text-stone-900">{selectedCompanyFounder.company?.cnpj || 'Não informado'}</p>
                          </div>
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Sobre a Empresa</span>
                            <p className="text-sm text-stone-500 leading-relaxed">{selectedCompanyFounder.company?.bio || 'Sem descrição informada'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-h3 font-sans">Empresas que estão no QDDO</h3>
                    <p className="text-stone-400 text-sm mt-1">Classificadas por segmento de atuação.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {COMPANY_CATEGORIES.map(cat => {
                      const catFounders = founders.filter(f =>
                        f.company?.name && (
                          cat === 'Variados'
                            ? !f.company?.tipo || !COMPANY_CATEGORIES.slice(0, -1).includes(f.company.tipo)
                            : f.company?.tipo === cat
                        )
                      );
                      if (catFounders.length === 0) return null;
                      const CategoryIcon = CATEGORY_ICONS[cat] || Building2;
                      return (
                        <div key={cat} className="bg-white rounded-xl p-6 border border-stone-100 shadow-sm">
                          <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 rounded-md bg-stone-100 flex items-center justify-center flex-shrink-0">
                              <CategoryIcon size={16} className="text-stone-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold uppercase tracking-widest text-stone-900">{cat}</h4>
                              <p className="text-xs text-stone-400">{catFounders.length} empresa{catFounders.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                            {catFounders.map(f => (
                              <button
                                key={f._id || f.id}
                                onClick={() => setSelectedCompanyFounder(f)}
                                className="bg-stone-50 hover:bg-primary border border-stone-100 hover:border-primary rounded-md px-3 py-2.5 text-left transition-all group"
                              >
                                <span className="text-xs font-semibold text-stone-700 group-hover:text-white leading-snug block truncate">
                                  {f.company?.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 border border-stone-100 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div>
                    <h3 className="text-h1 font-sans mb-6">Seu Perfil Founder</h3>
                    <div className="space-y-4">
                      <div>
                        <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Nome Completo</span>
                        <p className="font-bold text-stone-900">{founder?.name}</p>
                      </div>
                      <div>
                        <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Username</span>
                        <p className="text-stone-600">@{founder?.username}</p>
                      </div>
                      {founder?.instagram && (
                        <div>
                          <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Instagram</span>
                          <p className="text-stone-600">{founder.instagram}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Sua Bio</span>
                        <p className="text-sm text-stone-500 leading-relaxed">{founder?.bio || 'Você ainda não adicionou uma bio.'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-stone-50 rounded-xl p-8 border border-stone-100">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-h1 font-sans">Sua Empresa</h3>
                      {!editingCompany ? (
                        <button
                          onClick={handleStartEditCompany}
                          className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-all"
                        >
                          <Pencil size={14} />
                          Editar
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingCompany(false)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-all"
                          >
                            <X size={14} />
                            Cancelar
                          </button>
                          <button
                            onClick={handleUpdateCompany}
                            disabled={savingCompany}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest bg-primary text-white hover:bg-primary/80 transition-all disabled:opacity-50"
                          >
                            <Check size={14} />
                            {savingCompany ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Nome da Empresa</span>
                        {editingCompany ? (
                          <input
                            type="text"
                            value={companyEditData.name}
                            onChange={e => setCompanyEditData({ ...companyEditData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-bold text-stone-900"
                            placeholder="Nome da sua empresa"
                          />
                        ) : (
                          <p className="font-bold text-stone-900 text-h3">{founder?.company?.name || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Categoria de Empresa</span>
                        {editingCompany ? (
                          <select
                            value={companyEditData.tipo}
                            onChange={e => setCompanyEditData({ ...companyEditData, tipo: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all appearance-none"
                          >
                            <option value="">Selecione a categoria...</option>
                            <option value="HealthTech">HealthTech</option>
                            <option value="EdTech">EdTech</option>
                            <option value="SaaS/ Software">SaaS/ Software</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Eventos">Eventos</option>
                            <option value="Variados">Variados</option>
                          </select>
                        ) : (
                          <p className="font-bold text-stone-900">{founder?.company?.tipo || 'Não informado'}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">CNPJ</span>
                        {editingCompany ? (
                          <input
                            type="text"
                            value={companyEditData.cnpj}
                            onChange={e => setCompanyEditData({ ...companyEditData, cnpj: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                            placeholder="00.000.000/0000-00"
                          />
                        ) : founder?.company?.cnpj ? (
                          <p className="font-bold text-stone-900">{founder.company.cnpj}</p>
                        ) : (
                          <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg">
                            <p className="text-xs text-rose-600 font-bold flex items-center gap-2">
                              <AlertTriangle size={14} />
                              Pendência: CNPJ não informado. Clique em "Editar" para adicionar.
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Sobre a Empresa</span>
                        {editingCompany ? (
                          <textarea
                            rows={4}
                            value={companyEditData.bio}
                            onChange={e => setCompanyEditData({ ...companyEditData, bio: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                            placeholder="Descreva sua empresa..."
                          />
                        ) : (
                          <p className="text-sm text-stone-500 leading-relaxed">{founder?.company?.bio || 'Você ainda não adicionou uma descrição para sua empresa.'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(activeSubTab === 'desafios-publicos' || activeSubTab === 'desafios-privados') && (
        <>
          {showNewChallenge && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <div className="bg-white rounded-xl p-12 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-h1 font-sans mb-8">Criar Novo Desafio</h3>
                <form onSubmit={handleCreateChallenge} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Título do Desafio</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Otimizar funil de vendas"
                      value={challengeData.title}
                      onChange={e => setChallengeData({ ...challengeData, title: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Descrição</label>
                    <textarea
                      rows={4}
                      placeholder="Descreva o que você precisa resolver..."
                      value={challengeData.description}
                      onChange={e => setChallengeData({ ...challengeData, description: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Visibilidade</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setChallengeData({ ...challengeData, type: 'public' })}
                        className={cn(
                          "flex items-center justify-center gap-2 py-4 rounded-lg border font-bold transition-all",
                          challengeData.type === 'public' ? "bg-primary border-primary text-white" : "border-stone-200 text-stone-400 hover:border-stone-400"
                        )}
                      >
                        <Globe size={18} />
                        Público
                      </button>
                      <button
                        type="button"
                        onClick={() => setChallengeData({ ...challengeData, type: 'private' })}
                        className={cn(
                          "flex items-center justify-center gap-2 py-4 rounded-lg border font-bold transition-all",
                          challengeData.type === 'private' ? "bg-primary border-primary text-white" : "border-stone-200 text-stone-400 hover:border-stone-400"
                        )}
                      >
                        <Lock size={18} />
                        Privado
                      </button>
                    </div>
                    <p className="text-overline text-stone-400 mt-2">
                      * Desafios privados são visíveis apenas para você e administradores do QDDO.
                    </p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowNewChallenge(false)}
                      className="flex-1 border border-stone-100 text-stone-600 py-4 rounded-lg font-bold hover:bg-stone-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-white py-4 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
                      Criar Desafio
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {completingChallenge && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <div className="bg-white rounded-xl p-12 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-h1 font-sans mb-2">Concluir Desafio</h3>
                <p className="text-stone-500 mb-8 font-sans">"{completingChallenge.title}"</p>
                <form onSubmit={handleCompleteChallenge} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Quem te ajudou?</label>
                    <div className="relative">
                      <HelpCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
                      <input
                        required
                        type="text"
                        placeholder="Nome da pessoa ou parceiro"
                        value={completionData.helperName}
                        onChange={e => setCompletionData({ ...completionData, helperName: e.target.value })}
                        className="w-full pl-12 pr-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">@ do usuário que te ajudou</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">@</span>
                      <input
                        type="text"
                        placeholder="username"
                        value={completionData.helperUsername}
                        onChange={e => setCompletionData({ ...completionData, helperUsername: e.target.value.replace(/^@/, '') })}
                        className="w-full pl-9 pr-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Como foi resolvido?</label>
                    <textarea
                      rows={4}
                      placeholder="Descreva a solução encontrada..."
                      value={completionData.resolutionDescription}
                      onChange={e => setCompletionData({ ...completionData, resolutionDescription: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setCompletingChallenge(null)}
                      className="flex-1 border border-stone-100 text-stone-600 py-4 rounded-lg font-bold hover:bg-stone-50 transition-all"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 text-white py-4 rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      Finalizar Tarefa
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingChallenge && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <div className="bg-white rounded-xl p-12 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-h1 font-sans mb-8">Editar Desafio</h3>
                <form onSubmit={handleEditChallenge} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Título do Desafio</label>
                    <input
                      required
                      type="text"
                      value={editData.title}
                      onChange={e => setEditData({ ...editData, title: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Descrição</label>
                    <textarea
                      rows={4}
                      value={editData.description}
                      onChange={e => setEditData({ ...editData, description: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Visibilidade</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setEditData({ ...editData, type: 'public' })}
                        className={cn(
                          "flex items-center justify-center gap-2 py-4 rounded-lg border font-bold transition-all",
                          editData.type === 'public' ? "bg-primary border-primary text-white" : "border-stone-200 text-stone-400 hover:border-stone-400"
                        )}
                      >
                        <Globe size={18} />
                        Público
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditData({ ...editData, type: 'private' })}
                        className={cn(
                          "flex items-center justify-center gap-2 py-4 rounded-lg border font-bold transition-all",
                          editData.type === 'private' ? "bg-primary border-primary text-white" : "border-stone-200 text-stone-400 hover:border-stone-400"
                        )}
                      >
                        <Lock size={18} />
                        Privado
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingChallenge(null)}
                      className="flex-1 border border-stone-100 text-stone-600 py-4 rounded-lg font-bold hover:bg-stone-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-white py-4 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {filteredChallenges.length === 0 ? (
            <div className="bg-white rounded-xl p-20 border border-stone-100 shadow-sm text-center">
              <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-300">
                <CheckSquare size={32} />
              </div>
              <h3 className="text-h3 font-sans text-stone-400">Nenhum desafio encontrado nesta categoria</h3>
              <button
                onClick={() => setShowNewChallenge(true)}
                className="mt-6 text-stone-900 font-bold underline underline-offset-4 hover:text-stone-600 transition-colors"
              >
                Criar meu primeiro desafio
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="flex flex-col gap-4">
                <h3 className="text-overline uppercase tracking-widest font-bold text-stone-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-stone-400 inline-block" />
                  Desafios a Serem Resolvidos
                </h3>
                {filteredChallenges.filter(c => c.status === 'open').length === 0 ? (
                  <div className="bg-white rounded-xl p-10 border border-stone-100 text-center">
                    <p className="text-stone-400 text-sm">Nenhum desafio em aberto</p>
                  </div>
                ) : (
                  filteredChallenges.filter(c => c.status === 'open').map(challenge => (
                    <div
                      key={challenge.id}
                      className={cn(
                        "bg-white rounded-xl px-4 py-5 border transition-all flex flex-col gap-5 relative",
                        "border-stone-100 hover:border-stone-300 hover:shadow-xl",
                        expandedChallengeId === challenge.id && "border-stone-900 shadow-2xl"
                      )}
                    >
                      {isMyChallenge(challenge) && (
                        <button
                          onClick={() => {
                            setEditingChallenge(challenge);
                            setEditData({ title: challenge.title, description: challenge.description || '', type: challenge.type });
                          }}
                          className="absolute top-6 right-6 w-8 h-8 rounded-md bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-400 hover:text-stone-900 transition-all"
                          title="Editar desafio"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <div className="flex flex-col sm:flex-row gap-8">
                        <div className="flex-1">
                          <h3 className="text-h2 font-sans mb-2">{challenge.title}</h3>
                          <p className="text-stone-500 text-sm mb-6 leading-relaxed">{challenge.description}</p>
                          <div className="mt-6 flex items-center gap-4">
                            <button
                              onClick={() => setExpandedChallengeId(expandedChallengeId === challenge.id ? null : challenge.id)}
                              className="text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-2"
                            >
                              <MessageCircle size={16} />
                              {expandedChallengeId === challenge.id ? 'Fechar Comentários' : 'Ver Comentários'}
                            </button>
                          </div>
                        </div>
                        <div className="sm:w-48 flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-stone-100 pt-6 sm:pt-0 sm:pl-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-stone-400">
                              <Clock size={16} />
                              <span className="text-overline font-bold uppercase">
                                {challenge.createdAt ? new Date(challenge.createdAt).toLocaleDateString('pt-BR') : '...'}
                              </span>
                            </div>
                            {isMyChallenge(challenge) && (
                              <button
                                onClick={() => setCompletingChallenge(challenge)}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-md font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10"
                              >
                                Concluir
                                <ArrowRight size={18} />
                              </button>
                            )}
                          </div>
                          {!isMyChallenge(challenge) && (
                            <div className="mt-4 pt-4 border-t border-stone-50">
                              <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-2">Founder</span>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                                  <UserIcon size={12} />
                                </div>
                                <span className="text-xs font-bold text-stone-900">
                                  {founders.find(f => (f._id || f.id) === challenge.founderId || (f._id || f.id)?.toString() === challenge.founderId?.toString())?.name || `@${String(challenge.founderId).slice(0, 6)}`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {expandedChallengeId === challenge.id && (
                        <ChallengeComments challengeId={challenge.id} user={user} />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-overline uppercase tracking-widest font-bold text-emerald-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Desafios Cumpridos
                </h3>
                {filteredChallenges.filter(c => c.status === 'completed').length === 0 ? (
                  <div className="bg-white rounded-xl p-10 border border-stone-100 text-center">
                    <p className="text-stone-400 text-sm">Nenhum desafio concluído ainda</p>
                  </div>
                ) : (
                  filteredChallenges.filter(c => c.status === 'completed').map(challenge => (
                    <div
                      key={challenge.id}
                      className={cn(
                        "bg-white rounded-xl px-4 py-5 border transition-all flex flex-col gap-5 relative",
                        "border-emerald-100 bg-emerald-50/10",
                        expandedChallengeId === challenge.id && "border-emerald-400 shadow-2xl"
                      )}
                    >
                      {isMyChallenge(challenge) && (
                        <button
                          onClick={() => {
                            setEditingChallenge(challenge);
                            setEditData({ title: challenge.title, description: challenge.description || '', type: challenge.type });
                          }}
                          className="absolute top-6 right-6 w-8 h-8 rounded-md bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-400 hover:text-stone-900 transition-all"
                          title="Editar desafio"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <div className="flex flex-col sm:flex-row gap-8">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-overline font-bold uppercase tracking-widest flex items-center gap-1.5">
                              <CheckCircle2 size={12} />
                              Concluído
                            </div>
                          </div>
                          <h3 className="text-h2 font-sans mb-2">{challenge.title}</h3>
                          <p className="text-stone-500 text-sm mb-6 leading-relaxed">{challenge.description}</p>
                          <div className="mt-4 px-3 py-4 bg-white rounded-lg border border-emerald-100 space-y-4">
                            <div>
                              <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Ajudado por</span>
                              <p className="font-bold text-stone-900">{challenge.helperName}</p>
                              {challenge.helperUsername && (
                                <p className="text-sm text-stone-500 mt-0.5">@{challenge.helperUsername}</p>
                              )}
                            </div>
                            <div>
                              <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Solução</span>
                              <p className="text-sm text-stone-600">"{challenge.resolutionDescription}"</p>
                            </div>
                          </div>
                          <div className="mt-6 flex items-center gap-4">
                            <button
                              onClick={() => setExpandedChallengeId(expandedChallengeId === challenge.id ? null : challenge.id)}
                              className="text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-2"
                            >
                              <MessageCircle size={16} />
                              {expandedChallengeId === challenge.id ? 'Fechar Comentários' : 'Ver Comentários'}
                            </button>
                          </div>
                        </div>
                        <div className="sm:w-48 flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-stone-100 pt-6 sm:pt-0 sm:pl-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-stone-400">
                              <Clock size={16} />
                              <span className="text-overline font-bold uppercase">
                                {challenge.createdAt ? new Date(challenge.createdAt).toLocaleDateString('pt-BR') : '...'}
                              </span>
                            </div>
                          </div>
                          {!isMyChallenge(challenge) && (
                            <div className="mt-4 pt-4 border-t border-stone-50">
                              <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-2">Founder</span>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                                  <UserIcon size={12} />
                                </div>
                                <span className="text-xs font-bold text-stone-900">
                                  {founders.find(f => (f._id || f.id) === challenge.founderId || (f._id || f.id)?.toString() === challenge.founderId?.toString())?.name || `@${String(challenge.founderId).slice(0, 6)}`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {expandedChallengeId === challenge.id && (
                        <ChallengeComments challengeId={challenge.id} user={user} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
