import React, { useState, useEffect } from 'react';
import { 
  collection, 
  deleteDoc, 
  doc, 
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  signOut,
  User
} from 'firebase/auth';
import {
  Settings,
  AlertCircle,
  Trash2,
  Plus,
  Globe,
  Lock,
  CheckSquare,
  Bell,
  Info,
  AlertTriangle,
  CalendarDays,
  Newspaper,
  ShieldCheck,
  MessageSquare,
  Pencil,
  Paperclip,
  ExternalLink,
  XCircle,
  FileText,
  UserPlus,
  CheckCircle2,
  X
} from 'lucide-react';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Room, Booking, Challenge } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
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

export function AdminPanel({
  user,
  onLogin,
  rooms,
  bookings,
  businessHours,
  isAdmin,
  founders = [],
  initialTab = 'bookings'
}: {
  user: User | null;
  onLogin: () => void;
  rooms: Room[];
  bookings: Booking[];
  businessHours: string[];
  isAdmin: boolean;
  founders?: any[];
  initialTab?: 'bookings' | 'settings' | 'founders' | 'challenges' | 'news' | 'indicacoes';
}) {
  const [adminTab, setAdminTab] = useState<'bookings' | 'settings' | 'founders' | 'challenges' | 'news' | 'indicacoes'>(initialTab);
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
    attachmentUrl: '',
    attachmentName: '',
    attachmentType: '' as 'pdf' | 'png' | ''
  });
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <Settings size={40} className="text-stone-400" />
        </div>
        <h2 className="text-3xl font-sans mb-4">Área Administrativa</h2>
        <p className="text-stone-500 mb-10 leading-relaxed">Acesse para gerenciar agendamentos, salas e configurações do sistema.</p>
        <button 
          onClick={onLogin}
          className="w-full bg-stone-900 text-white py-4 rounded-xl font-semibold hover:bg-stone-800 transition-all flex items-center justify-center gap-3"
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
        <h2 className="text-2xl font-sans mb-2">Acesso Negado</h2>
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
    if (!isAdmin) return;

    const q = query(collection(db, 'challenges'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allChallenges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge));
      setChallenges(allChallenges);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'challenges'));

    const newsQ = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const newsUnsubscribe = onSnapshot(newsQ, (snapshot) => {
      const allNews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNewsItems(allNews);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'news'));

    const indicacoesQ = query(collection(db, 'indicacoes'), orderBy('criadoEm', 'desc'));
    const indicacoesUnsubscribe = onSnapshot(indicacoesQ, (snapshot) => {
      setIndicacoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'indicacoes'));

    return () => {
      unsubscribe();
      newsUnsubscribe();
      indicacoesUnsubscribe();
    };
  }, [isAdmin]);

  const handleAprovarIndicacao = async (id: string) => {
    try {
      await updateDoc(doc(db, 'indicacoes', id), { status: 'aprovada' });
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
          await updateDoc(doc(db, 'indicacoes', id), { status: 'rejeitada' });
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
          await deleteDoc(doc(db, 'bookings', id));
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  const handleDeleteFounder = (founder: any) => {
    if (founder.id === user.uid) return;
    setModalConfig({
      isOpen: true,
      title: 'Excluir Conta',
      message: `Tem certeza que deseja excluir a conta de ${founder.name}? Esta ação não pode ser desfeita.`,
      variant: 'danger',
      confirmText: 'Excluir Conta',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'founders', founder.id));
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
      username: founder.username || '',
      companyName: founder.company?.name || '',
      companyBio: founder.company?.bio || '',
    });
    setEditingFounder(founder);
  };

  const handleSaveFounderEdit = async () => {
    if (!editingFounder) return;
    try {
      await setDoc(doc(db, 'founders', editingFounder.id), {
        ...editingFounder,
        name: editFounderForm.name,
        username: editFounderForm.username,
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
          await deleteDoc(doc(db, 'challenges', id));
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
    await setDoc(doc(db, 'settings', 'global'), { businessHours: updated });
    setNewHour('');
  };

  const handleRemoveHour = async (hour: string) => {
    const updated = businessHours.filter(h => h !== hour);
    await setDoc(doc(db, 'settings', 'global'), { businessHours: updated });
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNews.title || !newNews.content) return;

    try {
      const newsData = {
        ...newNews,
        updatedAt: serverTimestamp(),
        eventDate: newNews.eventDate ? Timestamp.fromDate(new Date(newNews.eventDate + 'T00:00:00')) : null
      };

      if (editingNewsId) {
        await updateDoc(doc(db, 'news', editingNewsId), newsData);
      } else {
        await addDoc(collection(db, 'news'), {
          ...newsData,
          createdAt: serverTimestamp()
        });
      }

      setNewNews({ 
        title: '', 
        content: '', 
        category: 'aviso', 
        eventDate: '', 
        startTime: '', 
        endTime: '',
        attachmentUrl: '',
        attachmentName: '',
        attachmentType: ''
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
      eventDate: item.eventDate?.toDate ? item.eventDate.toDate().toISOString().split('T')[0] : (item.eventDate || ''),
      startTime: item.startTime || '',
      endTime: item.endTime || '',
      attachmentUrl: item.attachmentUrl || '',
      attachmentName: item.attachmentName || '',
      attachmentType: item.attachmentType || ''
    });
    setEditingNewsId(item.id);
    setIsAddingNews(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isPDF = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPDF && !isImage) {
      alert('Apenas arquivos PDF e Imagens são permitidos.');
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `news-attachments/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      setNewNews(prev => ({
        ...prev,
        attachmentUrl: url,
        attachmentName: file.name,
        attachmentType: isPDF ? 'pdf' : 'png' // simplified type tracking
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
          await deleteDoc(doc(db, 'news', id));
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
          <h2 className="text-3xl md:text-4xl font-sans mb-1">Painel de Controle</h2>
          <p className="text-stone-500 text-sm md:text-base">Gerencie todos os agendamentos e salas do sistema.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <div className="bg-white px-4 py-2.5 md:px-6 md:py-3 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Total Reservas</span>
            <span className="text-xl md:text-2xl font-sans">{bookings.length}</span>
          </div>
          <div className="bg-white px-4 py-2.5 md:px-6 md:py-3 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Salas Ativas</span>
            <span className="text-xl md:text-2xl font-sans">{rooms.length}</span>
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
            <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {indicacoes.filter((i: any) => !i.status || i.status === 'pendente').length}
            </span>
          )}
        </button>
      </div>

      {adminTab === 'bookings' && (
        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Data e Hora</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Sala</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Usuário</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
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
                          className="inline-flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold text-xs"
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
        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Nome</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Empresa</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Categoria</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Role</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {founders.map(founder => (
                  <tr key={founder.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-bold text-stone-900">{founder.name}</div>
                      <div className="text-xs text-stone-400">@{founder.username}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-sans text-stone-700">{founder.company?.name || 'N/A'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <select
                        value={founder.company?.tipo || ''}
                        onChange={async (e) => {
                          const novoTipo = e.target.value;
                          await setDoc(doc(db, 'founders', founder.id), {
                            ...founder,
                            company: { ...founder.company, tipo: novoTipo }
                          });
                        }}
                        className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all appearance-none cursor-pointer"
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
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        founder.role === 'admin' ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-400"
                      )}>
                        {founder.role || 'user'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {founder.id !== user.uid && (
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
                                  await setDoc(doc(db, 'founders', founder.id), { ...founder, role: newRole });
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
                          className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
                        >
                          <Pencil size={15} />
                        </button>
                        {founder.id !== user.uid && (
                          <button
                            onClick={() => handleDeleteFounder(founder)}
                            title="Excluir conta"
                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adminTab === 'challenges' && (
        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Desafio</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Tipo</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Status</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Autor</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map(challenge => {
                  const founder = founders.find(f => f.id === challenge.founderId);
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
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          challenge.status === 'completed' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                        )}>
                          {challenge.status === 'completed' ? 'Concluído' : 'Aberto'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-stone-900 text-xs">{founder?.name || 'Desconhecido'}</div>
                        <div className="text-[10px] text-stone-400">@{challenge.founderId.slice(0, 8)}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => handleDeleteChallenge(challenge.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold text-xs"
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
            <h3 className="text-2xl font-sans">Gerenciar News</h3>
            <button 
              onClick={() => setIsAddingNews(!isAddingNews)}
              className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
            >
              <Plus size={20} />
              Nova Notícia
            </button>
          </div>

          {isAddingNews && (
            <div className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-10 border border-stone-200 shadow-sm animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-sans">{editingNewsId ? 'Editar Notícia' : 'Nova Notícia'}</h3>
                {editingNewsId && (
                  <button 
                    onClick={() => {
                      setEditingNewsId(null);
                      setNewNews({ 
                        title: '', content: '', category: 'aviso', eventDate: '', startTime: '', endTime: '',
                        attachmentUrl: '', attachmentName: '', attachmentType: ''
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
                    <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Título</label>
                    <input 
                      required
                      type="text" 
                      value={newNews.title}
                      onChange={e => setNewNews({ ...newNews, title: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:border-stone-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Categoria</label>
                    <select 
                      value={newNews.category}
                      onChange={e => setNewNews({ ...newNews, category: e.target.value as any })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:border-stone-900 transition-all"
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
                    <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Data</label>
                    <input 
                      type="date" 
                      value={newNews.eventDate}
                      onChange={e => setNewNews({ ...newNews, eventDate: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:border-stone-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Início</label>
                    <input 
                      type="time" 
                      value={newNews.startTime}
                      onChange={e => setNewNews({ ...newNews, startTime: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:border-stone-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Término</label>
                    <input 
                      type="time" 
                      value={newNews.endTime}
                      onChange={e => setNewNews({ ...newNews, endTime: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:border-stone-900 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Conteúdo</label>
                  <textarea 
                    required
                    rows={4}
                    value={newNews.content}
                    onChange={e => setNewNews({ ...newNews, content: e.target.value })}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:border-stone-900 transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-stone-400 ml-1">Anexo (PDF ou Imagem)</label>
                  <div className="flex items-center gap-4">
                    <label className={cn(
                      "flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-stone-50 border border-dashed border-stone-200 rounded-2xl cursor-pointer hover:bg-stone-100 transition-all",
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
                      <div className="flex items-center gap-2 p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                        {newNews.attachmentType === 'pdf' ? <FileText size={20} /> : <Newspaper size={20} />}
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-widest leading-none">Anexo Pronto</span>
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
                    className="flex-1 border border-stone-200 text-stone-600 py-4 rounded-2xl font-bold hover:bg-stone-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/20 disabled:opacity-50"
                  >
                    {editingNewsId ? 'Salvar Alterações' : 'Publicar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Notícia</th>
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Categoria</th>
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Data</th>
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
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
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          item.category === 'aviso' ? "bg-rose-50 text-rose-500" :
                          item.category === 'info' ? "bg-blue-50 text-blue-500" :
                          item.category === 'evento' ? "bg-emerald-50 text-emerald-500" :
                          item.category === 'regras' ? "bg-amber-50 text-amber-500" :
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
                          {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : '...'}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleEditNews(item)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-50 rounded-xl transition-all font-bold text-xs"
                          >
                            <Pencil size={14} />
                            <span>Editar</span>
                          </button>
                          <button 
                            onClick={() => handleDeleteNews(item.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold text-xs"
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
          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
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
                      await setDoc(doc(db, 'settings', 'global'), { businessHours: DEFAULT_BUSINESS_HOURS });
                    }
                  });
                }}
                className="text-[10px] bg-stone-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-stone-800 transition-colors"
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
                className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900"
              />
              <button 
                onClick={handleAddHour}
                className="bg-stone-900 text-white px-6 py-3 rounded-xl hover:bg-stone-800 transition-all"
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
                  <div key={room.id} className="p-4 bg-stone-50 border border-stone-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">{room.name}</span>
                      <div className="text-sm font-mono text-stone-600 break-all">{link}</div>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        alert('Link copiado!');
                      }}
                      className="text-xs bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors font-bold"
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
              <h3 className="text-xl md:text-2xl font-sans">Indicações de Founders</h3>
              <p className="text-stone-500 text-sm mt-1">Revise e aprove ou rejeite as indicações enviadas pela comunidade.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-2xl flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-widest font-bold text-amber-500">Pendentes</span>
                <span className="text-xl md:text-2xl font-sans text-amber-600">
                  {indicacoes.filter((i: any) => !i.status || i.status === 'pendente').length}
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-2xl flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-500">Aprovadas</span>
                <span className="text-xl md:text-2xl font-sans text-emerald-600">
                  {indicacoes.filter((i: any) => i.status === 'aprovada').length}
                </span>
              </div>
            </div>
          </div>

          {indicacoes.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-12 md:p-20 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus size={28} className="text-stone-400" />
              </div>
              <p className="text-stone-400">Nenhuma indicação recebida ainda.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Founder Indicado</th>
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Empresa / Projeto</th>
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Área de Atuação</th>
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Indicado por</th>
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400">Status</th>
                    <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Ações</th>
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
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                            isAprovada
                              ? "bg-emerald-100 text-emerald-600"
                              : ind.status === 'rejeitada'
                              ? "bg-red-100 text-red-500"
                              : "bg-amber-100 text-amber-600"
                          )}>
                            {isAprovada ? 'Aprovada' : ind.status === 'rejeitada' ? 'Rejeitada' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {isPendente && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleAprovarIndicacao(ind.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all font-bold text-xs"
                              >
                                <CheckCircle2 size={14} />
                                Aprovar
                              </button>
                              <button
                                onClick={() => handleRejeitarIndicacao(ind.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all font-bold text-xs"
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

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        variant={modalConfig.variant}
      />

      {/* Modal de Edição de Founder */}
      {editingFounder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-sans text-stone-900">Editar Perfil</h3>
              <button
                onClick={() => setEditingFounder(null)}
                className="p-2 hover:bg-stone-100 rounded-xl transition-all text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={editFounderForm.name}
                  onChange={e => setEditFounderForm({ ...editFounderForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1.5">Username</label>
                <input
                  type="text"
                  value={editFounderForm.username}
                  onChange={e => setEditFounderForm({ ...editFounderForm, username: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1.5">Empresa</label>
                <input
                  type="text"
                  value={editFounderForm.companyName}
                  onChange={e => setEditFounderForm({ ...editFounderForm, companyName: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1.5">Bio da Empresa</label>
                <textarea
                  value={editFounderForm.companyBio}
                  onChange={e => setEditFounderForm({ ...editFounderForm, companyBio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingFounder(null)}
                className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFounderEdit}
                className="flex-1 py-3 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-800 transition-all"
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
