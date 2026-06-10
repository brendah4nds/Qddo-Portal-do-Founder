import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
  Settings,
  AlertCircle,
  Trash2,
  Plus,
  Globe,
  Lock,
  Info,
  AlertTriangle,
  CalendarDays,
  Newspaper,
  ShieldCheck,
  MessageSquare,
  Pencil,
  Paperclip,
  XCircle,
  FileText,
  UserPlus,
  CheckCircle2,
  X,
  Eye,
  LayoutGrid,
  Calendar,
  CheckSquare,
  Building2,
  Trophy
} from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';
import { Room, Booking, Challenge } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { ImageCropModal } from './ImageCropModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_BUSINESS_HOURS = Array.from({ length: 21 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

function toDateStr(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.split('T')[0];
  if (val?.toDate) return val.toDate().toISOString().split('T')[0];
  return new Date(val).toISOString().split('T')[0];
}

export function AdminPanel({
  user,
  onLogin,
  rooms,
  bookings,
  businessHours,
  isAdmin,
  founders = [],
  initialTab = 'bookings',
  initialEditNewsItem = null,
  onEditNewsConsumed,
  hiddenMenuItems = [],
  onRestoreMenuItem
}: {
  user: any | null;
  onLogin: () => void;
  rooms: Room[];
  bookings: Booking[];
  businessHours: string[];
  isAdmin: boolean;
  founders?: any[];
  initialTab?: 'bookings' | 'settings' | 'founders' | 'challenges' | 'news' | 'indicacoes' | 'hidden-items';
  initialEditNewsItem?: any;
  onEditNewsConsumed?: () => void;
  hiddenMenuItems?: string[];
  onRestoreMenuItem?: (key: string) => void;
}) {
  const [adminTab, setAdminTab] = useState<'bookings' | 'settings' | 'founders' | 'challenges' | 'news' | 'indicacoes' | 'hidden-items'>(initialTab);
  const [indicacoes, setIndicacoes] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [newHour, setNewHour] = useState('');
  const [newNews, setNewNews] = useState({
    title: '',
    content: '',
    category: 'aviso' as 'aviso' | 'info' | 'evento' | 'noticia' | 'regras' | 'comunicacao',
    eventDate: '',
    startTime: '',
    endTime: '',
    imageUrl: '',
    attachmentUrl: '',
    attachmentName: '',
    attachmentType: '' as 'pdf' | 'png' | ''
  });
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingImageFileName, setPendingImageFileName] = useState<string>('');
  const [isAddingNews, setIsAddingNews] = useState(false);
  const [editingFounder, setEditingFounder] = useState<any | null>(null);
  const [editFounderForm, setEditFounderForm] = useState({
    name: '',
    username: '',
    companyName: '',
    companyBio: '',
  });
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    variant?: "danger" | "primary";
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAddingNews) return;
    if (contentRef.current) {
      contentRef.current.innerHTML = newNews.content || '';
    }
  }, [isAddingNews, editingNewsId]);

  const applyFormat = (command: string) => {
    contentRef.current?.focus();
    document.execCommand(command, false);
    if (contentRef.current) {
      setNewNews(prev => ({ ...prev, content: contentRef.current?.innerHTML ?? '' }));
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <Settings size={40} className="text-stone-400" />
        </div>
        <h2 className="text-h1 font-sans mb-4">Área Administrativa</h2>
        <p className="text-stone-500 mb-10 leading-relaxed">Acesse para gerenciar agendamentos, salas e configurações do sistema.</p>
        <button
          onClick={onLogin}
          className="w-full bg-primary text-white py-4 rounded-md font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
          Entrar com Google
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-h2 font-sans mb-2">Acesso Negado</h2>
        <p className="text-stone-500 mb-8">Você não tem permissão para acessar esta área.</p>
        <button onClick={() => signOut(auth)} className="text-stone-900 underline font-semibold">Sair</button>
      </div>
    );
  }

  const sortedBookings = [...bookings].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.startTime}`);
    const dateB = new Date(`${b.date}T${b.startTime}`);
    return dateB.getTime() - dateA.getTime();
  });

  useEffect(() => {
    if (!initialEditNewsItem) return;
    setNewNews({
      title: initialEditNewsItem.title || '',
      content: initialEditNewsItem.content || '',
      category: initialEditNewsItem.category || 'aviso',
      eventDate: toDateStr(initialEditNewsItem.eventDate),
      startTime: initialEditNewsItem.startTime || '',
      endTime: initialEditNewsItem.endTime || '',
      imageUrl: initialEditNewsItem.imageUrl || '',
      attachmentUrl: initialEditNewsItem.attachmentUrl || '',
      attachmentName: initialEditNewsItem.attachmentName || '',
      attachmentType: initialEditNewsItem.attachmentType || ''
    });
    setEditingNewsId(initialEditNewsItem.id);
    setAdminTab('news');
    setIsAddingNews(true);
    onEditNewsConsumed?.();
  }, [initialEditNewsItem]);

  useEffect(() => {
    if (!isAdmin) return;

    api.get('/api/challenges').then(r => {
      const sorted = r.data
        .map((c: any) => ({ ...c, id: c._id || c.id }))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setChallenges(sorted);
    }).catch(console.error);

    api.get('/api/news').then(r => {
      const sorted = r.data
        .map((n: any) => ({ ...n, id: n._id || n.id }))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNewsItems(sorted);
    }).catch(console.error);

    api.get('/api/indicacoes').then(r => {
      const sorted = r.data
        .map((i: any) => ({ ...i, id: i._id || i.id }))
        .sort((a: any, b: any) => new Date(b.criadoEm || b.createdAt).getTime() - new Date(a.criadoEm || a.createdAt).getTime());
      setIndicacoes(sorted);
    }).catch(console.error);

    const socket = getSocket();

    const onChallengeNew = (c: any) => {
      const norm = { ...c, id: c._id || c.id };
      setChallenges(prev => [norm, ...prev.filter(x => x.id !== norm.id)]);
    };
    const onChallengeUpdate = (c: any) => {
      const norm = { ...c, id: c._id || c.id };
      setChallenges(prev => prev.map(x => x.id === norm.id ? norm : x));
    };
    const onChallengeDelete = ({ id }: any) => setChallenges(prev => prev.filter(x => x.id !== id));

    const onNewsNew = (n: any) => {
      const norm = { ...n, id: n._id || n.id };
      setNewsItems(prev => [norm, ...prev.filter(x => x.id !== norm.id)]);
    };
    const onNewsUpdate = (n: any) => {
      const norm = { ...n, id: n._id || n.id };
      setNewsItems(prev => prev.map(x => x.id === norm.id ? norm : x));
    };
    const onNewsDelete = ({ id }: any) => setNewsItems(prev => prev.filter(x => x.id !== id));

    const onIndicacaoNew = (i: any) => {
      const norm = { ...i, id: i._id || i.id };
      setIndicacoes(prev => [norm, ...prev.filter(x => x.id !== norm.id)]);
    };
    const onIndicacaoUpdate = (i: any) => {
      const norm = { ...i, id: i._id || i.id };
      setIndicacoes(prev => prev.map(x => x.id === norm.id ? norm : x));
    };

    socket.on('challenge:new', onChallengeNew);
    socket.on('challenge:update', onChallengeUpdate);
    socket.on('challenge:delete', onChallengeDelete);
    socket.on('news:new', onNewsNew);
    socket.on('news:update', onNewsUpdate);
    socket.on('news:delete', onNewsDelete);
    socket.on('indicacao:new', onIndicacaoNew);
    socket.on('indicacao:update', onIndicacaoUpdate);

    return () => {
      socket.off('challenge:new', onChallengeNew);
      socket.off('challenge:update', onChallengeUpdate);
      socket.off('challenge:delete', onChallengeDelete);
      socket.off('news:new', onNewsNew);
      socket.off('news:update', onNewsUpdate);
      socket.off('news:delete', onNewsDelete);
      socket.off('indicacao:new', onIndicacaoNew);
      socket.off('indicacao:update', onIndicacaoUpdate);
    };
  }, [isAdmin]);

  const handleAprovarIndicacao = async (id: string) => {
    try {
      await api.put(`/api/indicacoes/${id}`, { status: 'aprovada' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleRejeitarIndicacao = (id: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Rejeitar Indicação',
      message: 'Tem certeza que deseja rejeitar esta indicação?',
      variant: 'danger',
      confirmText: 'Rejeitar',
      onConfirm: async () => {
        try {
          await api.put(`/api/indicacoes/${id}`, { status: 'rejeitada' });
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  const handleDelete = async (id: string) => {
    setModalConfig({
      isOpen: true,
      title: "Cancelar Agendamento",
      message: "Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.",
      confirmText: "Cancelar Reserva",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/api/bookings/${id}`);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  const handleDeleteFounder = (founder: any) => {
    const founderId = founder._id || founder.id;
    if (founderId === user._id) return;
    setModalConfig({
      isOpen: true,
      title: 'Excluir Conta',
      message: `Tem certeza que deseja excluir a conta de ${founder.name}? Esta ação não pode ser desfeita.`,
      variant: 'danger',
      confirmText: 'Excluir Conta',
      onConfirm: async () => {
        try {
          await api.delete(`/api/founders/${founderId}`);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  const handleOpenEditFounder = (founder: any) => {
    setEditFounderForm({
      name: founder.name || '',
      username: (founder.username || '').replace(/@/g, ''),
      companyName: founder.company?.name || '',
      companyBio: founder.company?.bio || '',
    });
    setEditingFounder(founder);
  };

  const handleSaveFounderEdit = async () => {
    if (!editingFounder) return;
    const founderId = editingFounder._id || editingFounder.id;
    try {
      await api.put(`/api/founders/${founderId}`, {
        name: editFounderForm.name,
        username: editFounderForm.username.replace(/@/g, ''),
        company: {
          ...editingFounder.company,
          name: editFounderForm.companyName,
          bio: editFounderForm.companyBio,
        }
      });
      setEditingFounder(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteChallenge = (id: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Excluir Desafio',
      message: 'Tem certeza que deseja excluir este desafio? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await api.delete(`/api/challenges/${id}`);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  const handleAddHour = async () => {
    if (!newHour.match(/^\d{2}:\d{2}$/)) return;
    const updated = [...businessHours, newHour].sort();
    await api.put('/api/settings/global', { businessHours: updated });
    setNewHour('');
  };

  const handleRemoveHour = async (hour: string) => {
    const updated = businessHours.filter(h => h !== hour);
    await api.put('/api/settings/global', { businessHours: updated });
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNews.title || !newNews.content) return;

    try {
      const newsData = {
        ...newNews,
        eventDate: newNews.eventDate || null
      };

      if (editingNewsId) {
        await api.put(`/api/news/${editingNewsId}`, newsData);
      } else {
        await api.post('/api/news', newsData);
      }

      setNewNews({
        title: '', content: '', category: 'aviso', eventDate: '', startTime: '', endTime: '',
        imageUrl: '', attachmentUrl: '', attachmentName: '', attachmentType: ''
      });
      setEditingNewsId(null);
      setIsAddingNews(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditNews = (item: any) => {
    setNewNews({
      title: item.title || '',
      content: item.content || '',
      category: item.category || 'aviso',
      eventDate: toDateStr(item.eventDate),
      startTime: item.startTime || '',
      endTime: item.endTime || '',
      imageUrl: item.imageUrl || '',
      attachmentUrl: item.attachmentUrl || '',
      attachmentName: item.attachmentName || '',
      attachmentType: item.attachmentType || ''
    });
    setEditingNewsId(item.id);
    setIsAddingNews(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      alert('Apenas imagens são permitidas.');
      return;
    }
    setPendingImageFileName(file.name);
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropImageSrc(null);
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, pendingImageFileName || 'cover.jpg');
      const { data } = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setNewNews(prev => ({ ...prev, imageUrl: data.url }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Erro ao enviar imagem.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPDF = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPDF && !isImage) {
      alert('Apenas arquivos PDF e Imagens são permitidos.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setNewNews(prev => ({
        ...prev,
        attachmentUrl: data.url,
        attachmentName: file.name,
        attachmentType: isPDF ? 'pdf' : 'png'
      }));
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteNews = (id: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Excluir Notícia',
      message: 'Tem certeza que deseja excluir esta notícia? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await api.delete(`/api/news/${id}`);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-h1 font-sans mb-1">Painel de Controle</h2>
          <p className="text-stone-500 text-sm md:text-base">Gerencie todos os agendamentos e salas do sistema.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <div className="bg-white px-4 py-2.5 md:px-6 md:py-3 rounded-lg border border-stone-100 shadow-sm flex flex-col">
            <span className="text-overline uppercase tracking-widest font-bold text-stone-400">Total Reservas</span>
            <span className="text-h3 md:text-h2 font-sans">{bookings.length}</span>
          </div>
          <div className="bg-white px-4 py-2.5 md:px-6 md:py-3 rounded-lg border border-stone-100 shadow-sm flex flex-col">
            <span className="text-overline uppercase tracking-widest font-bold text-stone-400">Salas Ativas</span>
            <span className="text-h3 md:text-h2 font-sans">{rooms.length}</span>
          </div>
        </div>
      </header>

      <div className="flex gap-4 md:gap-6 border-b border-stone-200 overflow-x-auto scrollbar-hide pb-px">
        {[
          { id: 'bookings', label: 'Agendamentos' },
          { id: 'settings', label: 'Configurações' },
          { id: 'founders', label: 'Usuários' },
          { id: 'challenges', label: 'Desafios' },
          { id: 'news', label: 'News' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setAdminTab(tab.id as any)}
            className={cn(
              "pb-4 text-xs md:text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap shrink-0",
              adminTab === tab.id ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setAdminTab('indicacoes')}
          className={cn(
            "pb-4 text-xs md:text-sm font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
            adminTab === 'indicacoes' ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
          )}
        >
          Indicações
          {indicacoes.filter((i: any) => !i.status || i.status === 'pendente').length > 0 && (
            <span className="bg-primary text-white text-overline font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {indicacoes.filter((i: any) => !i.status || i.status === 'pendente').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAdminTab('hidden-items')}
          className={cn(
            "pb-4 text-xs md:text-sm font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
            adminTab === 'hidden-items' ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
          )}
        >
          Itens Ocultados
          {hiddenMenuItems.length > 0 && (
            <span className="bg-stone-400 text-white text-overline font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {hiddenMenuItems.length}
            </span>
          )}
        </button>
      </div>

      {adminTab === 'bookings' && (
        <section className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Data e Hora</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Sala</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Usuário</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedBookings.map(booking => {
                  const room = rooms.find(r => r.id === booking.roomId);
                  return (
                    <tr key={booking.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-bold text-stone-900">{booking.date}</div>
                        <div className="text-xs text-stone-400">{booking.startTime} - {booking.endTime}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-sans text-stone-700">{room?.name || 'Sala excluída'}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-stone-900">{booking.userName}</div>
                        <div className="text-xs text-stone-400">{booking.userEmail}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => handleDelete(booking.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-md transition-all font-bold text-xs"
                        >
                          <Trash2 size={14} />
                          <span>Cancelar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-stone-400">Nenhum agendamento encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adminTab === 'founders' && (
        <section className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Nome</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Empresa</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Categoria</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Role</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {founders.map(founder => {
                  const founderId = founder._id || founder.id;
                  return (
                    <tr key={founderId} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-bold text-stone-900">{founder.name}</div>
                        <div className="text-xs text-stone-400">@{founder.username?.replace(/@/g, '')}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-sans text-stone-700">{founder.company?.name || 'N/A'}</div>
                      </td>
                      <td className="px-8 py-6">
                        <select
                          value={founder.company?.tipo || ''}
                          onChange={async (e) => {
                            const novoTipo = e.target.value;
                            await api.put(`/api/founders/${founderId}`, {
                              company: { ...founder.company, tipo: novoTipo }
                            });
                          }}
                          className="px-3 py-2 bg-stone-50 border border-stone-100 rounded-md text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-primary transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Sem categoria</option>
                          <option value="HealthTech">HealthTech</option>
                          <option value="EdTech">EdTech</option>
                          <option value="SaaS/ Software">SaaS/ Software</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Eventos">Eventos</option>
                          <option value="Variados">Variados</option>
                        </select>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-overline font-bold uppercase tracking-wider",
                          founder.role === 'admin' ? "bg-primary text-white" : "bg-stone-100 text-stone-400"
                        )}>
                          {founder.role || 'user'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {founderId !== user._id && (
                            <button
                              onClick={async () => {
                                const newRole = founder.role === 'admin' ? 'user' : 'admin';
                                setModalConfig({
                                  isOpen: true,
                                  title: "Alterar Permissão",
                                  message: `Deseja alterar o cargo de ${founder.name} para ${newRole}?`,
                                  confirmText: "Confirmar",
                                  variant: "primary",
                                  onConfirm: async () => {
                                    await api.put(`/api/founders/${founderId}`, { role: newRole });
                                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                                  }
                                });
                              }}
                              className="text-xs font-bold text-stone-900 hover:underline px-2 py-1"
                            >
                              Tornar {founder.role === 'admin' ? 'User' : 'Admin'}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditFounder(founder)}
                            title="Editar perfil"
                            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-all"
                          >
                            <Pencil size={15} />
                          </button>
                          {founderId !== user._id && (
                            <button
                              onClick={() => handleDeleteFounder(founder)}
                              title="Excluir conta"
                              className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adminTab === 'challenges' && (
        <section className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Desafio</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Tipo</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Status</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Autor</th>
                  <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map(challenge => {
                  const challengeFounder = founders.find(f =>
                    (f._id || f.id) === challenge.founderId ||
                    (f._id || f.id)?.toString() === challenge.founderId?.toString()
                  );
                  return (
                    <tr key={challenge.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-bold text-stone-900">{challenge.title}</div>
                        <div className="text-xs text-stone-400 line-clamp-1">{challenge.description}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-stone-600">
                          {challenge.type === 'private' ? <Lock size={12} /> : <Globe size={12} />}
                          {challenge.type === 'private' ? 'Privado' : 'Público'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-overline font-bold uppercase tracking-widest",
                          challenge.status === 'completed' ? "bg-emerald-100 text-emerald-600" : "bg-terracota-100 text-primary"
                        )}>
                          {challenge.status === 'completed' ? 'Concluído' : 'Aberto'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-stone-900 text-xs">{challengeFounder?.name || 'Desconhecido'}</div>
                        <div className="text-overline text-stone-400">@{String(challenge.founderId).slice(0, 8)}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => handleDeleteChallenge(challenge.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-md transition-all font-bold text-xs"
                        >
                          <Trash2 size={14} />
                          <span>Excluir</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {challenges.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-stone-400">Nenhum desafio encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adminTab === 'news' && (
        <section className="space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <h3 className="text-h2 font-sans">Gerenciar News</h3>
            <button
              onClick={() => setIsAddingNews(!isAddingNews)}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-stone-900/10"
            >
              <Plus size={20} />
              Nova Notícia
            </button>
          </div>

          {isAddingNews && (
            <div className="bg-white rounded-xl md:rounded-xl p-6 md:p-10 border border-stone-100 shadow-sm animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-h2 font-sans">{editingNewsId ? 'Editar Notícia' : 'Nova Notícia'}</h3>
                {editingNewsId && (
                  <button
                    onClick={() => {
                      setEditingNewsId(null);
                      setNewNews({
                        title: '', content: '', category: 'aviso', eventDate: '', startTime: '', endTime: '',
                        imageUrl: '', attachmentUrl: '', attachmentName: '', attachmentType: ''
                      });
                      setIsAddingNews(false);
                    }}
                    className="text-stone-400 hover:text-stone-900 transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                )}
              </div>
              <form onSubmit={handleCreateNews} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Título</label>
                    <input
                      required
                      type="text"
                      value={newNews.title}
                      onChange={e => setNewNews({ ...newNews, title: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Categoria</label>
                    <select
                      value={newNews.category}
                      onChange={e => setNewNews({ ...newNews, category: e.target.value as any })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                    >
                      <option value="aviso">Aviso</option>
                      <option value="info">Info</option>
                      <option value="evento">Evento</option>
                      <option value="noticia">Notícia</option>
                      <option value="regras">Regras</option>
                      <option value="comunicacao">Comunicação</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Data</label>
                    <input
                      type="date"
                      value={newNews.eventDate}
                      onChange={e => setNewNews({ ...newNews, eventDate: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Início</label>
                    <input
                      type="time"
                      value={newNews.startTime}
                      onChange={e => setNewNews({ ...newNews, startTime: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Término</label>
                    <input
                      type="time"
                      value={newNews.endTime}
                      onChange={e => setNewNews({ ...newNews, endTime: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Conteúdo</label>
                  <div className="border border-stone-100 rounded-lg overflow-hidden focus-within:border-primary transition-all">
                    <div className="flex items-center gap-1 px-3 py-2 bg-stone-100 border-b border-stone-100">
                      <button
                        type="button"
                        onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); applyFormat('bold'); }}
                        className="w-7 h-7 flex items-center justify-center rounded font-bold text-sm text-stone-600 hover:bg-stone-200 transition-colors"
                        title="Negrito"
                      >B</button>
                      <button
                        type="button"
                        onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); applyFormat('italic'); }}
                        className="w-7 h-7 flex items-center justify-center rounded italic text-sm text-stone-600 hover:bg-stone-200 transition-colors"
                        title="Itálico"
                      >I</button>
                      <button
                        type="button"
                        onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); applyFormat('underline'); }}
                        className="w-7 h-7 flex items-center justify-center rounded underline text-sm text-stone-600 hover:bg-stone-200 transition-colors"
                        title="Sublinhado"
                      >U</button>
                    </div>
                    <div
                      ref={contentRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => {
                        const html = contentRef.current?.innerHTML ?? '';
                        setNewNews({ ...newNews, content: html });
                      }}
                      className="w-full px-6 py-4 bg-stone-50 min-h-[100px] focus:outline-none text-sm leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400"
                      data-placeholder="Digite o conteúdo aqui..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Imagem de Capa</label>
                  <div className="flex items-center gap-4">
                    <label className={cn(
                      "flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-stone-50 border border-dashed border-stone-200 rounded-lg cursor-pointer hover:bg-stone-100 transition-all",
                      isUploadingImage && "opacity-50 cursor-not-allowed"
                    )}>
                      <Newspaper size={20} className="text-stone-400" />
                      <span className="text-sm font-medium text-stone-500">
                        {isUploadingImage ? 'Enviando...' : newNews.imageUrl ? 'Alterar imagem' : 'Selecionar imagem'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                    </label>
                    {newNews.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setNewNews({ ...newNews, imageUrl: '' })}
                        className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400 hover:text-stone-700"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                  </div>
                  {newNews.imageUrl && (
                    <img src={newNews.imageUrl} alt="preview" className="w-full h-32 object-cover rounded-lg border border-stone-100 mt-1" />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Anexo (PDF ou Imagem)</label>
                  <div className="flex items-center gap-4">
                    <label className={cn(
                      "flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-stone-50 border border-dashed border-stone-200 rounded-lg cursor-pointer hover:bg-stone-100 transition-all",
                      isUploading && "opacity-50 cursor-not-allowed"
                    )}>
                      <Paperclip size={20} className="text-stone-400" />
                      <span className="text-sm font-medium text-stone-500">
                        {isUploading ? 'Enviando...' : newNews.attachmentName ? 'Alterar arquivo' : 'Selecionar arquivo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                    {newNews.attachmentUrl && (
                      <div className="flex items-center gap-2 p-4 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                        {newNews.attachmentType === 'pdf' ? <FileText size={20} /> : <Newspaper size={20} />}
                        <div className="flex flex-col">
                          <span className="text-overline uppercase font-bold tracking-widest leading-none">Anexo Pronto</span>
                          <span className="text-xs font-medium truncate max-w-[150px]">{newNews.attachmentName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewNews(prev => ({ ...prev, attachmentUrl: '', attachmentName: '', attachmentType: '' }))}
                          className="p-1 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingNews(false)}
                    className="flex-1 border border-stone-100 text-stone-600 py-4 rounded-lg font-bold hover:bg-stone-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 bg-primary text-white py-4 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {editingNewsId ? 'Salvar Alterações' : 'Publicar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Notícia</th>
                    <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Categoria</th>
                    <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Data</th>
                    <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {newsItems.map(item => (
                    <tr key={item.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-bold text-stone-900">{item.title}</div>
                        <div className="text-xs text-stone-400 line-clamp-1">{item.content}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-overline font-bold uppercase tracking-widest",
                          item.category === 'aviso' ? "bg-rose-50 text-rose-500" :
                          item.category === 'info' ? "bg-blue-50 text-blue-500" :
                          item.category === 'evento' ? "bg-emerald-50 text-emerald-500" :
                          item.category === 'regras' ? "bg-terracota-50 text-primary" :
                          item.category === 'comunicacao' ? "bg-purple-50 text-purple-500" :
                          "bg-stone-100 text-stone-500"
                        )}>
                          {item.category === 'aviso' ? <AlertTriangle size={12} /> :
                           item.category === 'info' ? <Info size={12} /> :
                           item.category === 'evento' ? <CalendarDays size={12} /> :
                           item.category === 'regras' ? <ShieldCheck size={12} /> :
                           item.category === 'comunicacao' ? <MessageSquare size={12} /> :
                           <Newspaper size={12} />}
                          {item.category}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-xs text-stone-600">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '...'}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditNews(item)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-50 rounded-md transition-all font-bold text-xs"
                          >
                            <Pencil size={14} />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteNews(item.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-md transition-all font-bold text-xs"
                          >
                            <Trash2 size={14} />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {newsItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-stone-400">Nenhuma notícia publicada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {adminTab === 'settings' && (
        <section className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white rounded-xl p-8 border border-stone-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-sans text-lg">Horários Disponíveis</h4>
              <button
                onClick={() => {
                  setModalConfig({
                    isOpen: true,
                    title: "Restaurar Horários",
                    message: "Deseja restaurar os horários para o padrão de 30 minutos? Suas configurações personalizadas serão perdidas.",
                    confirmText: "Restaurar",
                    variant: "primary",
                    onConfirm: async () => {
                      await api.put('/api/settings/global', { businessHours: DEFAULT_BUSINESS_HOURS });
                      setModalConfig(prev => ({ ...prev, isOpen: false }));
                    }
                  });
                }}
                className="text-overline bg-primary text-white px-3 py-1.5 rounded-lg font-bold hover:bg-primary/90 transition-colors"
              >
                Restaurar Padrão (30 min)
              </button>
            </div>
            <p className="text-stone-500 text-sm mb-8">Edite os horários que estarão disponíveis para agendamento em todas as salas.</p>

            <div className="flex flex-wrap gap-3 mb-12">
              {businessHours.map(hour => (
                <div key={hour} className="flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-full text-sm font-medium group">
                  {hour}
                  <button onClick={() => handleRemoveHour(hour)} className="text-stone-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-4 max-w-xs mb-12">
              <input
                type="text"
                placeholder="HH:mm"
                value={newHour}
                onChange={e => setNewHour(e.target.value)}
                className="flex-1 px-4 py-3 bg-stone-50 border border-stone-100 rounded-md focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleAddHour}
                className="bg-primary text-white px-6 py-3 rounded-md hover:bg-primary/90 transition-all"
              >
                <Plus size={20} />
              </button>
            </div>

            <h4 className="font-sans text-lg mb-4">Links de Agendamento</h4>
            <p className="text-stone-500 text-sm mb-6">Compartilhe estes links para que os usuários acessem diretamente o agendamento de cada sala.</p>
            <div className="space-y-3">
              {rooms.map(room => {
                const link = `${window.location.origin}/sala/${room.id}`;
                return (
                  <div key={room.id} className="p-4 bg-stone-50 border border-stone-100 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">{room.name}</span>
                      <div className="text-sm font-mono text-stone-600 break-all">{link}</div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        alert('Link copiado!');
                      }}
                      className="text-xs bg-white border border-stone-100 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors font-bold"
                    >
                      Copiar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {adminTab === 'indicacoes' && (
        <section className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-h3 md:text-h2 font-sans">Indicações de Founders</h3>
              <p className="text-stone-500 text-sm mt-1">Revise e aprove ou rejeite as indicações enviadas pela comunidade.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <div className="bg-terracota-50 border border-terracota-200 px-4 py-2.5 rounded-lg flex flex-col items-center">
                <span className="text-overline uppercase tracking-widest font-bold text-primary">Pendentes</span>
                <span className="text-h3 md:text-h2 font-sans text-primary">
                  {indicacoes.filter((i: any) => !i.status || i.status === 'pendente').length}
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-lg flex flex-col items-center">
                <span className="text-overline uppercase tracking-widest font-bold text-emerald-500">Aprovadas</span>
                <span className="text-h3 md:text-h2 font-sans text-emerald-600">
                  {indicacoes.filter((i: any) => i.status === 'aprovada').length}
                </span>
              </div>
            </div>
          </div>

          {indicacoes.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-12 md:p-20 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus size={28} className="text-stone-400" />
              </div>
              <p className="text-stone-400">Nenhuma indicação recebida ainda.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-100">
                      <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Founder Indicado</th>
                      <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Empresa / Projeto</th>
                      <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Área de Atuação</th>
                      <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Indicado por</th>
                      <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400">Status</th>
                      <th className="px-8 py-5 text-overline uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicacoes.map((ind: any) => {
                      const isPendente = !ind.status || ind.status === 'pendente';
                      const isAprovada = ind.status === 'aprovada';
                      return (
                        <tr key={ind.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="font-bold text-stone-900">{ind.nomeIndicado}</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-sans text-stone-700">{ind.empresa}</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-sm text-stone-600">{ind.area}</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-xs text-stone-500">{ind.indicadoPorEmail || '—'}</div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-overline font-bold uppercase tracking-widest",
                              isAprovada
                                ? "bg-emerald-100 text-emerald-600"
                                : ind.status === 'rejeitada'
                                ? "bg-red-100 text-red-500"
                                : "bg-terracota-100 text-primary"
                            )}>
                              {isAprovada ? 'Aprovada' : ind.status === 'rejeitada' ? 'Rejeitada' : 'Pendente'}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            {isPendente && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleAprovarIndicacao(ind.id)}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-all font-bold text-xs"
                                >
                                  <CheckCircle2 size={14} />
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => handleRejeitarIndicacao(ind.id)}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-md transition-all font-bold text-xs"
                                >
                                  <X size={14} />
                                  Rejeitar
                                </button>
                              </div>
                            )}
                            {!isPendente && (
                              <span className="text-xs text-stone-300">Revisado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {adminTab === 'hidden-items' && (
        <section className="animate-in fade-in duration-500">
          {hiddenMenuItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm px-8 py-20 text-center">
              <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye size={24} className="text-stone-400" />
              </div>
              <p className="text-stone-500 font-medium">Nenhum item oculto no momento.</p>
              <p className="text-xs text-stone-400 mt-1">Passe o mouse sobre um tópico no menu lateral para ocultar.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-stone-100 bg-stone-50">
                <p className="text-overline uppercase tracking-widest font-bold text-stone-400">
                  {hiddenMenuItems.length} {hiddenMenuItems.length === 1 ? 'item oculto' : 'itens ocultos'}
                </p>
              </div>
              {(() => {
                const MENU_LABELS: Record<string, { label: string; Icon: React.ElementType }> = {
                  geral:       { label: 'Geral',       Icon: LayoutGrid },
                  agendamento: { label: 'Agendamento', Icon: Calendar },
                  checkin:     { label: 'Check-in',    Icon: CheckSquare },
                  empresa:     { label: 'Empresa',     Icon: Building2 },
                  desafios:    { label: 'Desafios',    Icon: Globe },
                  noticias:    { label: 'Notícias',    Icon: Newspaper },
                  qcoin:       { label: 'QCoin',       Icon: Trophy },
                  'bate-papo': { label: 'Bate-papo',  Icon: MessageSquare },
                  regras:      { label: 'Regras',      Icon: ShieldCheck },
                };
                return hiddenMenuItems.map(key => {
                  const meta = MENU_LABELS[key];
                  if (!meta) return null;
                  const { label, Icon } = meta;
                  return (
                    <div key={key} className="flex items-center justify-between px-8 py-5 border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center">
                          <Icon size={18} className="text-stone-400" />
                        </div>
                        <span className="font-semibold text-stone-700">{label}</span>
                      </div>
                      <button
                        onClick={() => onRestoreMenuItem?.(key)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-all"
                      >
                        <Eye size={14} />
                        Restaurar
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </section>
      )}

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        variant={modalConfig.variant}
      />

      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onConfirm={handleCropConfirm}
          onClose={() => {
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
          }}
        />
      )}

      {editingFounder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-h3 font-sans text-stone-900">Editar Perfil</h3>
              <button
                onClick={() => setEditingFounder(null)}
                className="p-2 hover:bg-stone-100 rounded-md transition-all text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-overline uppercase tracking-widest font-bold text-stone-400 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={editFounderForm.name}
                  onChange={e => setEditFounderForm({ ...editFounderForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-overline uppercase tracking-widest font-bold text-stone-400 mb-1.5">Username</label>
                <input
                  type="text"
                  value={editFounderForm.username}
                  onChange={e => setEditFounderForm({ ...editFounderForm, username: e.target.value.replace(/@/g, '') })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-overline uppercase tracking-widest font-bold text-stone-400 mb-1.5">Empresa</label>
                <input
                  type="text"
                  value={editFounderForm.companyName}
                  onChange={e => setEditFounderForm({ ...editFounderForm, companyName: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-overline uppercase tracking-widest font-bold text-stone-400 mb-1.5">Bio da Empresa</label>
                <textarea
                  value={editFounderForm.companyBio}
                  onChange={e => setEditFounderForm({ ...editFounderForm, companyBio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-md text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-primary transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingFounder(null)}
                className="flex-1 py-3 rounded-md border border-stone-100 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFounderEdit}
                className="flex-1 py-3 rounded-md bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
