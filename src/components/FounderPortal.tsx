import React, { useState, useEffect, useRef } from 'react';
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
  Check,
  Trash2,
  Shield,
  Search
} from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';
import { Founder, Challenge } from '../types';
import { ChallengeComments } from './ChallengeComments';
import { CheckinSystem } from './CheckinSystem';
import { ImageCropModal } from './ImageCropModal';
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
  isMasterAdmin = false,
  founders = []
}: {
  user: any | null;
  activeSubTab: string;
  setActiveSubTab?: (tab: string) => void;
  isAdmin: boolean;
  isMasterAdmin?: boolean;
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
  const [localLogoURL, setLocalLogoURL] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [logoPendingBlob, setLogoPendingBlob] = useState<Blob | null>(null);
  const [logoPendingPreview, setLogoPendingPreview] = useState('');
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [selectedCompanyFounder, setSelectedCompanyFounder] = useState<any | null>(null);
  const [localFounders, setLocalFounders] = useState<any[]>(founders);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [addCompanyData, setAddCompanyData] = useState({ founderName: '', username: '', companyName: '', tipo: '', cnpj: '', bio: '' });
  const [savingAddCompany, setSavingAddCompany] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingFounder, setDeletingFounder] = useState(false);

  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [addAdminSearch, setAddAdminSearch] = useState('');
  const [savingAdminRole, setSavingAdminRole] = useState(false);
  const [confirmRemoveAdminId, setConfirmRemoveAdminId] = useState<string | null>(null);

  const [adminEditingCompany, setAdminEditingCompany] = useState(false);
  const [adminCompanyEditData, setAdminCompanyEditData] = useState({ name: '', cnpj: '', bio: '', tipo: '' });
  const [adminSavingCompany, setAdminSavingCompany] = useState(false);
  const [adminLogoPendingBlob, setAdminLogoPendingBlob] = useState<Blob | null>(null);
  const [adminLogoPendingPreview, setAdminLogoPendingPreview] = useState('');
  const [adminCropImageSrc, setAdminCropImageSrc] = useState('');
  const [adminShowCropModal, setAdminShowCropModal] = useState(false);
  const [adminUploadError, setAdminUploadError] = useState('');
  const adminLogoInputRef = useRef<HTMLInputElement>(null);

  // Sync localLogoURL from founder whenever it (re)loads
  useEffect(() => {
    if (founder?.company?.logoURL) setLocalLogoURL(founder.company.logoURL);
  }, [founder?.company?.logoURL]);

  useEffect(() => {
    setLocalFounders(prev => founders.map(f => {
      const existing = prev.find(p => (p._id || p.id) === (f._id || f.id));
      if (existing?.company?.logoURL && !f.company?.logoURL) {
        return { ...f, company: { ...f.company, logoURL: existing.company.logoURL } };
      }
      return f;
    }));
  }, [founders]);

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
      if (fId === user._id) {
        setFounder(prev => {
          const incoming = { ...f, id: fId };
          // Preserve logoURL from local state if the backend event doesn't include it
          if (prev?.company?.logoURL && !incoming.company?.logoURL) {
            incoming.company = { ...incoming.company, logoURL: prev.company.logoURL };
          }
          return incoming;
        });
      }
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

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleCropConfirm = (blob: Blob) => {
    if (logoPendingPreview) URL.revokeObjectURL(logoPendingPreview);
    setLogoPendingBlob(blob);
    setLogoPendingPreview(URL.createObjectURL(blob));
    setShowCropModal(false);
    setCropImageSrc('');
  };

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
    setUploadError('');
    try {
      let logoUrl = localLogoURL || founder?.company?.logoURL || '';

      if (logoPendingBlob) {
        const formData = new FormData();
        formData.append('file', logoPendingBlob, 'logo.jpg');
        const { data } = await api.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        logoUrl = data.url;
        setLocalLogoURL(logoUrl);
      }

      await api.put(`/api/founders/${user._id}`, {
        company: {
          ...founder?.company,
          name: companyEditData.name,
          cnpj: companyEditData.cnpj,
          bio: companyEditData.bio,
          tipo: companyEditData.tipo,
          ...(logoUrl ? { logoURL: logoUrl } : {})
        }
      });

      const res = await api.get(`/api/founders/${user._id}`);
      if (res.data) {
        const saved = { ...res.data, id: res.data._id || res.data.id };
        if (!saved.company?.logoURL && logoUrl) {
          saved.company = { ...(saved.company ?? {}), logoURL: logoUrl };
        }
        setFounder(saved);
      }

      if (logoPendingPreview) URL.revokeObjectURL(logoPendingPreview);
      setLogoPendingBlob(null);
      setLogoPendingPreview('');
      setEditingCompany(false);
    } catch (error) {
      console.error('Error updating company:', error);
      setUploadError('Erro ao salvar. Tente novamente.');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCompanyData.founderName || !addCompanyData.companyName) return;
    setSavingAddCompany(true);
    try {
      const res = await api.post('/api/founders', {
        name: addCompanyData.founderName,
        username: addCompanyData.username,
        company: {
          name: addCompanyData.companyName,
          tipo: addCompanyData.tipo,
          cnpj: addCompanyData.cnpj,
          bio: addCompanyData.bio,
        }
      });
      const newFounder = { ...res.data, id: res.data._id || res.data.id };
      setLocalFounders(prev => [...prev, newFounder]);
      setShowAddCompany(false);
      setAddCompanyData({ founderName: '', username: '', companyName: '', tipo: '', cnpj: '', bio: '' });
    } catch (error) {
      console.error('Error adding company:', error);
    } finally {
      setSavingAddCompany(false);
    }
  };

  const handleDeleteFounder = async () => {
    if (!selectedCompanyFounder) return;
    setDeletingFounder(true);
    try {
      const id = selectedCompanyFounder._id || selectedCompanyFounder.id;
      await api.delete(`/api/founders/${id}`);
      setLocalFounders(prev => prev.filter(f => (f._id || f.id) !== id));
      setSelectedCompanyFounder(null);
      setConfirmDelete(false);
    } catch (error) {
      console.error('Error deleting founder:', error);
    } finally {
      setDeletingFounder(false);
    }
  };

  const handleAdminStartEdit = () => {
    setAdminCompanyEditData({
      name: selectedCompanyFounder?.company?.name || '',
      cnpj: selectedCompanyFounder?.company?.cnpj || '',
      bio: selectedCompanyFounder?.company?.bio || '',
      tipo: selectedCompanyFounder?.company?.tipo || ''
    });
    setAdminEditingCompany(true);
  };

  const handleAdminLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAdminCropImageSrc(reader.result as string);
      setAdminShowCropModal(true);
    };
    reader.readAsDataURL(file);
    if (adminLogoInputRef.current) adminLogoInputRef.current.value = '';
  };

  const handleAdminCropConfirm = (blob: Blob) => {
    if (adminLogoPendingPreview) URL.revokeObjectURL(adminLogoPendingPreview);
    setAdminLogoPendingBlob(blob);
    setAdminLogoPendingPreview(URL.createObjectURL(blob));
    setAdminShowCropModal(false);
    setAdminCropImageSrc('');
  };

  const handleAdminSaveCompany = async () => {
    if (!selectedCompanyFounder) return;
    const founderId = selectedCompanyFounder._id || selectedCompanyFounder.id;
    setAdminSavingCompany(true);
    setAdminUploadError('');
    try {
      let logoUrl = selectedCompanyFounder.company?.logoURL || '';

      if (adminLogoPendingBlob) {
        const formData = new FormData();
        formData.append('file', adminLogoPendingBlob, 'logo.jpg');
        const { data } = await api.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        logoUrl = data.url;
      }

      await api.put(`/api/founders/${founderId}`, {
        company: {
          ...selectedCompanyFounder.company,
          name: adminCompanyEditData.name,
          cnpj: adminCompanyEditData.cnpj,
          bio: adminCompanyEditData.bio,
          tipo: adminCompanyEditData.tipo,
          ...(logoUrl ? { logoURL: logoUrl } : {})
        }
      });

      const updated = {
        ...selectedCompanyFounder,
        company: {
          ...selectedCompanyFounder.company,
          name: adminCompanyEditData.name,
          cnpj: adminCompanyEditData.cnpj,
          bio: adminCompanyEditData.bio,
          tipo: adminCompanyEditData.tipo,
          ...(logoUrl ? { logoURL: logoUrl } : {})
        }
      };
      setSelectedCompanyFounder(updated);
      setLocalFounders(prev => prev.map(f => (f._id || f.id) === founderId ? updated : f));

      if (adminLogoPendingPreview) URL.revokeObjectURL(adminLogoPendingPreview);
      setAdminLogoPendingBlob(null);
      setAdminLogoPendingPreview('');
      setAdminEditingCompany(false);
    } catch (error) {
      console.error('Error updating company (admin):', error);
      setAdminUploadError('Erro ao salvar. Tente novamente.');
    } finally {
      setAdminSavingCompany(false);
    }
  };

  const handleSetAdminRole = async (founderId: string, role: 'admin' | 'user') => {
    setSavingAdminRole(true);
    try {
      await api.put(`/api/founders/${founderId}`, { role });
      setLocalFounders(prev => prev.map(f =>
        (f._id || f.id) === founderId ? { ...f, role } : f
      ));
      if (role === 'user') setConfirmRemoveAdminId(null);
      if (role === 'admin') { setShowAddAdmin(false); setAddAdminSearch(''); }
    } catch (error) {
      console.error('Error updating admin role:', error);
    } finally {
      setSavingAdminRole(false);
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
          <div className="grid grid-cols-1 gap-6">
              {selectedCompanyFounder ? (
                <div className="bg-white rounded-xl p-12 border border-stone-100 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between mb-8">
                    <button
                      onClick={() => {
                        if (adminLogoPendingPreview) URL.revokeObjectURL(adminLogoPendingPreview);
                        setSelectedCompanyFounder(null);
                        setConfirmDelete(false);
                        setAdminEditingCompany(false);
                        setAdminLogoPendingBlob(null);
                        setAdminLogoPendingPreview('');
                        setAdminUploadError('');
                      }}
                      className="text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 flex items-center gap-2"
                    >
                      <ArrowRight size={16} className="rotate-180" />
                      Voltar para lista
                    </button>
                    {isAdmin && (confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">Confirmar exclusão?</span>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDeleteFounder}
                          disabled={deletingFounder}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 rounded-md transition-all disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                          {deletingFounder ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                      >
                        <Trash2 size={13} />
                        Excluir Empresa
                      </button>
                    ))}
                  </div>

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
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-h1 font-sans">Dados da Empresa</h3>
                          {isAdmin && (!adminEditingCompany ? (
                            <button
                              onClick={handleAdminStartEdit}
                              className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-all"
                            >
                              <Pencil size={14} />
                              Editar
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (adminLogoPendingPreview) URL.revokeObjectURL(adminLogoPendingPreview);
                                  setAdminLogoPendingBlob(null);
                                  setAdminLogoPendingPreview('');
                                  setAdminCropImageSrc('');
                                  setAdminShowCropModal(false);
                                  setAdminUploadError('');
                                  setAdminEditingCompany(false);
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-all"
                              >
                                <X size={14} />
                                Cancelar
                              </button>
                              <button
                                onClick={handleAdminSaveCompany}
                                disabled={adminSavingCompany}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest bg-primary text-white hover:bg-primary/80 transition-all disabled:opacity-50"
                              >
                                <Check size={14} />
                                {adminSavingCompany ? 'Salvando...' : 'Salvar'}
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-2">Logo</span>
                            <div className="flex flex-col gap-3">
                              <div className="w-full max-w-xs aspect-[3/1] rounded-xl bg-white border-2 border-stone-200 overflow-hidden flex items-center justify-center shadow-sm p-2">
                                {(adminLogoPendingPreview || selectedCompanyFounder.company?.logoURL) ? (
                                  <img
                                    src={adminLogoPendingPreview || selectedCompanyFounder.company!.logoURL}
                                    alt="Logo"
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <Building2 size={24} className="text-stone-300" />
                                )}
                              </div>
                              {adminEditingCompany && (
                                <div className="flex flex-col gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => adminLogoInputRef.current?.click()}
                                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold uppercase tracking-widest transition-all self-start"
                                  >
                                    <Plus size={14} />
                                    {(adminLogoPendingPreview || selectedCompanyFounder.company?.logoURL) ? 'Alterar logo' : 'Adicionar logo'}
                                  </button>
                                  <p className="text-xs text-stone-400">Formato retangular 3:1. JPG, PNG ou WebP.</p>
                                  {adminUploadError && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertTriangle size={12} />
                                      {adminUploadError}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <input ref={adminLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleAdminLogoFileSelect} />
                          </div>
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Nome da Empresa</span>
                            {adminEditingCompany ? (
                              <input
                                type="text"
                                value={adminCompanyEditData.name}
                                onChange={e => setAdminCompanyEditData({ ...adminCompanyEditData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-bold text-stone-900"
                              />
                            ) : (
                              <p className="font-bold text-stone-900 text-h3">{selectedCompanyFounder.company?.name || 'N/A'}</p>
                            )}
                          </div>
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Categoria</span>
                            {adminEditingCompany ? (
                              <select
                                value={adminCompanyEditData.tipo}
                                onChange={e => setAdminCompanyEditData({ ...adminCompanyEditData, tipo: e.target.value })}
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
                              <p className="font-bold text-stone-900">{selectedCompanyFounder.company?.tipo || 'Não informado'}</p>
                            )}
                          </div>
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">CNPJ</span>
                            {adminEditingCompany ? (
                              <input
                                type="text"
                                value={adminCompanyEditData.cnpj}
                                onChange={e => setAdminCompanyEditData({ ...adminCompanyEditData, cnpj: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                              />
                            ) : isAdmin || selectedCompanyFounder._id === user._id || selectedCompanyFounder.id === user._id ? (
                              <p className="font-bold text-stone-900">{selectedCompanyFounder.company?.cnpj || 'Não informado'}</p>
                            ) : (
                              <p className="flex items-center gap-1.5 text-stone-400 text-sm italic">
                                <Lock size={13} className="shrink-0" />
                                Visível apenas para a empresa e admins
                              </p>
                            )}
                          </div>
                          <div>
                            <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-1">Sobre a Empresa</span>
                            {adminEditingCompany ? (
                              <textarea
                                rows={4}
                                value={adminCompanyEditData.bio}
                                onChange={e => setAdminCompanyEditData({ ...adminCompanyEditData, bio: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                              />
                            ) : (
                              <p className="text-sm text-stone-500 leading-relaxed">{selectedCompanyFounder.company?.bio || 'Sem descrição informada'}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-h3 font-sans">Empresas que estão no QDDO</h3>
                      <p className="text-stone-400 text-sm mt-1">Classificadas por segmento de atuação.</p>
                    </div>
                    <button
                      onClick={() => setShowAddCompany(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-primary/80 transition-all"
                    >
                      <Plus size={14} />
                      Adicionar Empresa
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(() => {
                      const visibleCats = COMPANY_CATEGORIES.map(cat => {
                        const seenNames = new Set<string>();
                        const catFounders = localFounders
                          .filter((f: any) =>
                            f.company?.name && (
                              cat === 'Variados'
                                ? !f.company?.tipo || !COMPANY_CATEGORIES.slice(0, -1).includes(f.company.tipo)
                                : f.company?.tipo === cat
                            )
                          )
                          .sort((a: any, b: any) => {
                            const score = (f: any) => (f.company?.logoURL ? 4 : 0) + (f.company?.bio ? 2 : 0) + (f.company?.cnpj ? 1 : 0);
                            return score(b) - score(a);
                          })
                          .filter((f: any) => {
                            const key = (f.company?.name || '').toLowerCase().trim();
                            if (!key || seenNames.has(key)) return false;
                            seenNames.add(key);
                            return true;
                          });
                        if (catFounders.length === 0) return null;
                        return { cat, catFounders };
                      }).filter(Boolean) as { cat: string; catFounders: any[] }[];
                      return visibleCats.map(({ cat, catFounders }, idx) => {
                      const isLastAlone = idx === visibleCats.length - 1 && visibleCats.length % 2 !== 0;
                      const CategoryIcon = CATEGORY_ICONS[cat] || Building2;
                      return (
                        <div key={cat} className={`bg-white rounded-xl p-6 border border-stone-100 shadow-sm${isLastAlone ? ' md:col-span-2' : ''}`}>
                          <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 rounded-md bg-stone-100 flex items-center justify-center flex-shrink-0">
                              <CategoryIcon size={16} className="text-stone-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold uppercase tracking-widest text-stone-900">{cat}</h4>
                              <p className="text-xs text-stone-400">{catFounders.length} empresa{catFounders.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className={`grid gap-2 ${isLastAlone ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>
                            {catFounders.map((f: any) => (
                              <button
                                key={f._id || f.id}
                                onClick={() => setSelectedCompanyFounder(f)}
                                className="bg-stone-50 hover:bg-primary border border-stone-100 hover:border-primary rounded-md text-center transition-all group flex items-center justify-center overflow-hidden w-full aspect-[3/1]"
                              >
                                {f.company?.logoURL ? (
                                  <img
                                    src={f.company.logoURL}
                                    alt={f.company.name}
                                    className="w-full h-full object-cover group-hover:brightness-0 group-hover:invert transition-all"
                                  />
                                ) : (
                                  <span className="text-xs font-semibold text-stone-700 group-hover:text-white leading-snug block truncate px-3">
                                    {f.company?.name}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    });
                    })()}
                  </div>
                </div>
              )}
            </div>
          {!isAdmin && (
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
                            onClick={() => {
                              if (logoPendingPreview) URL.revokeObjectURL(logoPendingPreview);
                              setLogoPendingBlob(null);
                              setLogoPendingPreview('');
                              setCropImageSrc('');
                              setShowCropModal(false);
                              setUploadError('');
                              setEditingCompany(false);
                            }}
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
                        <span className="text-overline uppercase tracking-widest font-bold text-stone-400 block mb-2">Logo da Empresa</span>
                        <div className="flex flex-col gap-3">
                          <div className="w-full max-w-xs aspect-[3/1] rounded-xl bg-white border-2 border-stone-200 overflow-hidden flex items-center justify-center shadow-sm p-2">
                            {(logoPendingPreview || localLogoURL || founder?.company?.logoURL) ? (
                              <img
                                src={logoPendingPreview || localLogoURL || founder!.company!.logoURL}
                                alt="Logo"
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <Building2 size={24} className="text-stone-300" />
                            )}
                          </div>
                          {editingCompany && (
                            <div className="flex flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold uppercase tracking-widest transition-all self-start"
                              >
                                <Plus size={14} />
                                {(logoPendingPreview || localLogoURL || founder?.company?.logoURL) ? 'Alterar logo' : 'Adicionar logo'}
                              </button>
                              <p className="text-xs text-stone-400">Formato retangular 3:1. JPG, PNG ou WebP.</p>
                              {uploadError && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  {uploadError}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileSelect} />
                      </div>
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

          {isAdmin && showAddCompany && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <div className="bg-white rounded-xl p-10 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-h1 font-sans mb-8">Adicionar Empresa</h3>
                <form onSubmit={handleAddCompany} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-overline uppercase tracking-wider font-bold text-stone-400 text-xs">Nome do Founder *</label>
                      <input
                        required
                        type="text"
                        placeholder="Nome completo"
                        value={addCompanyData.founderName}
                        onChange={e => setAddCompanyData({ ...addCompanyData, founderName: e.target.value })}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-overline uppercase tracking-wider font-bold text-stone-400 text-xs">Username</label>
                      <input
                        type="text"
                        placeholder="@username"
                        value={addCompanyData.username}
                        onChange={e => setAddCompanyData({ ...addCompanyData, username: e.target.value })}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 text-xs">Nome da Empresa *</label>
                    <input
                      required
                      type="text"
                      placeholder="Nome da empresa"
                      value={addCompanyData.companyName}
                      onChange={e => setAddCompanyData({ ...addCompanyData, companyName: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-overline uppercase tracking-wider font-bold text-stone-400 text-xs">Categoria</label>
                      <select
                        value={addCompanyData.tipo}
                        onChange={e => setAddCompanyData({ ...addCompanyData, tipo: e.target.value })}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all appearance-none"
                      >
                        <option value="">Selecione...</option>
                        <option value="HealthTech">HealthTech</option>
                        <option value="EdTech">EdTech</option>
                        <option value="SaaS/Software">SaaS/Software</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Eventos">Eventos</option>
                        <option value="Variados">Variados</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-overline uppercase tracking-wider font-bold text-stone-400 text-xs">CNPJ</label>
                      <input
                        type="text"
                        placeholder="00.000.000/0000-00"
                        value={addCompanyData.cnpj}
                        onChange={e => setAddCompanyData({ ...addCompanyData, cnpj: e.target.value })}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 text-xs">Sobre a Empresa</label>
                    <textarea
                      rows={3}
                      placeholder="Descreva a empresa..."
                      value={addCompanyData.bio}
                      onChange={e => setAddCompanyData({ ...addCompanyData, bio: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowAddCompany(false); setAddCompanyData({ founderName: '', username: '', companyName: '', tipo: '', cnpj: '', bio: '' }); }}
                      className="flex-1 px-4 py-3 rounded-md text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingAddCompany}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-xs font-bold uppercase tracking-widest bg-primary text-white hover:bg-primary/80 transition-all disabled:opacity-50"
                    >
                      <Plus size={14} />
                      {savingAddCompany ? 'Salvando...' : 'Adicionar'}
                    </button>
                  </div>
                </form>
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

      {activeSubTab === 'admins' && isMasterAdmin && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-h3 font-sans">Gestão de Admins</h3>
              <p className="text-stone-400 text-sm mt-1">Adicione ou remova permissões de administrador para outros membros.</p>
            </div>
            <button
              onClick={() => { setShowAddAdmin(true); setAddAdminSearch(''); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-primary/80 transition-all"
            >
              <Plus size={14} />
              Adicionar Admin
            </button>
          </div>

          {/* Lista de admins atuais */}
          <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
            {localFounders.filter(f => f.role === 'admin').length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield size={24} className="text-stone-300" />
                </div>
                <p className="text-stone-400 text-sm">Nenhum admin cadastrado além de você.</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {localFounders.filter(f => f.role === 'admin').map(f => {
                  const fId = f._id || f.id;
                  return (
                    <div key={fId} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-4">
                        {f.photoURL ? (
                          <img src={f.photoURL} alt={f.name} className="w-10 h-10 rounded-full object-cover border border-stone-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
                            <UserIcon size={18} className="text-stone-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-stone-900 text-sm">{f.name}</p>
                          <p className="text-xs text-stone-400">@{f.username?.replace(/@/g, '')}</p>
                        </div>
                        <span className="ml-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-overline font-bold uppercase tracking-widest flex items-center gap-1">
                          <Shield size={10} />
                          Admin
                        </span>
                      </div>
                      <div>
                        {confirmRemoveAdminId === fId ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-400">Confirmar?</span>
                            <button
                              onClick={() => setConfirmRemoveAdminId(null)}
                              className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSetAdminRole(fId, 'user')}
                              disabled={savingAdminRole}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 rounded-md transition-all disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                              {savingAdminRole ? 'Removendo...' : 'Remover'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRemoveAdminId(fId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                          >
                            <Trash2 size={12} />
                            Remover Admin
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal para adicionar admin */}
          {showAddAdmin && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-h3 font-sans">Adicionar Admin</h3>
                  <button
                    onClick={() => { setShowAddAdmin(false); setAddAdminSearch(''); }}
                    className="w-8 h-8 rounded-md bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-400 hover:text-stone-900 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou username..."
                    value={addAdminSearch}
                    onChange={e => setAddAdminSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                    autoFocus
                  />
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-stone-50 rounded-lg border border-stone-100">
                  {localFounders
                    .filter(f => f.role !== 'admin')
                    .filter(f => {
                      const q = addAdminSearch.toLowerCase();
                      return !q || f.name?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q);
                    })
                    .length === 0 ? (
                    <div className="p-8 text-center text-stone-400 text-sm">Nenhum membro encontrado.</div>
                  ) : (
                    localFounders
                      .filter(f => f.role !== 'admin')
                      .filter(f => {
                        const q = addAdminSearch.toLowerCase();
                        return !q || f.name?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q);
                      })
                      .map(f => {
                        const fId = f._id || f.id;
                        return (
                          <div key={fId} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-all">
                            <div className="flex items-center gap-3">
                              {f.photoURL ? (
                                <img src={f.photoURL} alt={f.name} className="w-8 h-8 rounded-full object-cover border border-stone-200" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                                  <UserIcon size={14} className="text-stone-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-stone-900 text-sm">{f.name}</p>
                                <p className="text-xs text-stone-400">@{f.username?.replace(/@/g, '')}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleSetAdminRole(fId, 'admin')}
                              disabled={savingAdminRole}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-primary text-white hover:bg-primary/80 rounded-md transition-all disabled:opacity-50"
                            >
                              <Shield size={12} />
                              Tornar Admin
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showCropModal && cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          aspect={3}
          title="Ajustar logo da empresa"
          onConfirm={handleCropConfirm}
          onClose={() => { setShowCropModal(false); setCropImageSrc(''); }}
        />
      )}

      {adminShowCropModal && adminCropImageSrc && (
        <ImageCropModal
          imageSrc={adminCropImageSrc}
          aspect={3}
          title="Ajustar logo da empresa"
          onConfirm={handleAdminCropConfirm}
          onClose={() => { setAdminShowCropModal(false); setAdminCropImageSrc(''); }}
        />
      )}
    </div>
  );
}
