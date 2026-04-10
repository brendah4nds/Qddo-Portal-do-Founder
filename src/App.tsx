/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  startOfToday,
  startOfDay,
  subHours,
  subDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  format,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LogOut,
  Calendar,
  Users,
  Building2,
  Lock,
  Globe,
  CheckSquare,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Bell,
  Newspaper,
  ArrowRight,
  LayoutGrid,
  Info,
  ShieldCheck,
  AlertTriangle,
  Trophy,
  CalendarDays,
  Clock,
  X,
  Plus,
  Paperclip,
  ExternalLink,
  FileText,
  Menu,
  UserPlus,
  Send
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { Room, Booking, BookingStatus, Challenge } from './types';
import { BookingFlow } from './components/BookingFlow';
import { AdminPanel } from './components/AdminPanel';
import { FounderPortal } from './components/FounderPortal';
import { LandingPage } from './components/LandingPage';
import { RegistrationFlow } from './components/RegistrationFlow';
import { Chat } from './components/Chat';
import { TermsModal } from './components/TermsModal';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "bbrendaribeiroc@gmail.com";

const DEFAULT_BUSINESS_HOURS = Array.from({ length: 21 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeGeneralCategory, setActiveGeneralCategory] = useState<string | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [businessHours, setBusinessHours] = useState<string[]>(DEFAULT_BUSINESS_HOURS);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'booking' | 'admin' | 'portal' | 'chat' | 'general' | 'news' | 'quads'>('general');
  const [activeSubTab, setActiveSubTab] = useState<string>('general');
  const [adminInitialTab, setAdminInitialTab] = useState<'bookings' | 'settings' | 'founders' | 'challenges' | 'news' | 'indicacoes'>('bookings');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [view, activeSubTab]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [expandedTopics, setExpandedTopics] = useState<string[]>(['agendamento', 'portal']);
  const [isRegistering, setIsRegistering] = useState(false);
  const [founderData, setFounderData] = useState<any>(null);
  const [checkingFounder, setCheckingFounder] = useState(true);
  const [allFounders, setAllFounders] = useState<any[]>([]);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [userCheckins, setUserCheckins] = useState<any[]>([]);
  const [allCheckins, setAllCheckins] = useState<any[]>([]);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [showIndicarFounderModal, setShowIndicarFounderModal] = useState(false);
  const [indicarNome, setIndicarNome] = useState('');
  const [indicarEmpresa, setIndicarEmpresa] = useState('');
  const [indicarArea, setIndicarArea] = useState('');
  const [indicarSubmitting, setIndicarSubmitting] = useState(false);
  const [indicarSuccess, setIndicarSuccess] = useState(false);

  const handleAcceptTerms = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'founders', user.uid), {
        termsAccepted: true,
        termsAcceptedAt: serverTimestamp()
      });
      setIsTermsModalOpen(false);
    } catch (error) {
      console.error("Error accepting terms:", error);
    }
  };

  const handleIndicarFounderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indicarNome.trim() || !indicarEmpresa.trim() || !indicarArea.trim()) return;
    setIndicarSubmitting(true);
    try {
      await setDoc(doc(collection(db, 'indicacoes')), {
        nomeIndicado: indicarNome.trim(),
        empresa: indicarEmpresa.trim(),
        area: indicarArea.trim(),
        indicadoPor: user?.uid || null,
        indicadoPorEmail: user?.email || null,
        criadoEm: serverTimestamp(),
      });
      setIndicarSuccess(true);
      setIndicarNome('');
      setIndicarEmpresa('');
      setIndicarArea('');
    } catch (error) {
      console.error('Erro ao enviar indicação:', error);
    } finally {
      setIndicarSubmitting(false);
    }
  };

  const toggleTopic = (topic: string) => {
    setExpandedTopics(prev => 
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  // URL handling for specific rooms
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/sala\/([^\/]+)/);
    if (match) {
      setSelectedRoomId(match[1]);
    } else if (path === '/admin') {
      setView('admin');
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setFounderData(null);
        setCheckingFounder(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Founder data listener
  useEffect(() => {
    if (!user) {
      setCheckingFounder(false);
      return;
    }

    setCheckingFounder(true);
    const unsubscribe = onSnapshot(doc(db, 'founders', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setFounderData(snapshot.data());
      } else {
        setFounderData(null);
      }
      setCheckingFounder(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `founders/${user.uid}`);
      setCheckingFounder(false);
    });

    return unsubscribe;
  }, [user]);

  // Firestore listeners
  useEffect(() => {
    const roomsUnsubscribe = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomsData);
      
      // Auto-seed if empty (for first run)
      if (roomsData.length === 0 && user?.email === ADMIN_EMAIL) {
        seedRooms();
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'rooms'));

    const bookingsUnsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setBookings(bookingsData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings'));

    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setBusinessHours(snapshot.data().businessHours || DEFAULT_BUSINESS_HOURS);
      } else if (user?.email === ADMIN_EMAIL) {
        setDoc(doc(db, 'settings', 'global'), { businessHours: DEFAULT_BUSINESS_HOURS });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/global'));

    const foundersUnsubscribe = onSnapshot(collection(db, 'founders'), (snapshot) => {
      const foundersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllFounders(foundersData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'founders'));

    const challengesUnsubscribe = onSnapshot(collection(db, 'challenges'), (snapshot) => {
      const challengesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge));
      setAllChallenges(challengesData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'challenges'));

    const newsUnsubscribe = onSnapshot(collection(db, 'news'), (snapshot) => {
      const newsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNewsItems(newsData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'news'));

    let checkinsUnsubscribe = () => {};
    if (user) {
      const q = collection(db, 'checkins');
      checkinsUnsubscribe = onSnapshot(q, (snapshot) => {
        const checkinsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllCheckins(checkinsData);
        setUserCheckins(checkinsData.filter((c: any) => c.userId === user.uid));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'checkins'));
    }

    return () => {
      roomsUnsubscribe();
      bookingsUnsubscribe();
      settingsUnsubscribe();
      foundersUnsubscribe();
      challengesUnsubscribe();
      newsUnsubscribe();
      checkinsUnsubscribe();
    };
  }, [user, founderData]);

  const seedRooms = async () => {
    const initialRooms = [
      { id: '1', name: 'Sala de Reunião 1', description: 'Sala individual' },
      { id: '2', name: 'Sala de Reunião 2', description: 'Sala para 2 a 4 pessoas' },
      { id: '3', name: 'Sala de Reunião 3', description: 'Sala de reunião para 6 a 8 pessoas' },
    ];
    for (const room of initialRooms) {
      await setDoc(doc(db, 'rooms', room.id), { name: room.name, description: room.description });
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleRegister = async () => {
    setIsRegistering(true);
    await handleLogin();
  };

  const handleLogout = () => signOut(auth);

  const isAdmin = user?.email === ADMIN_EMAIL || founderData?.role === 'admin';

  if (loading || (user && checkingFounder)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="animate-pulse text-stone-500 font-serif italic text-xl">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} onRegister={handleRegister} />;
  }

  if (!founderData && !isAdmin) {
    return <RegistrationFlow user={user} onComplete={() => {
      setView('general');
      setActiveSubTab('general');
    }} />;
  }

  return (
    <div className="h-[100svh] overflow-hidden bg-[#F5F5F0] text-stone-900 font-sans selection:bg-stone-200 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-xl text-stone-500 hover:bg-stone-100 transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => {
                window.history.pushState({}, '', '/');
                setView('general');
                setActiveSubTab('general');
                setSelectedRoomId(null);
              }}
            >
            <div className="relative w-10 h-10 bg-black rounded-lg flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
              <div className="w-6 h-6 border-[3px] border-white rounded-full"></div>
              <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF4500] rounded-full shadow-[0_0_8px_rgba(255,69,0,0.4)]"></div>
            </div>
            <h1 className="font-sans font-black text-2xl tracking-tighter italic">qddo</h1>
          </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button 
                onClick={() => setView(view === 'admin' ? 'booking' : 'admin')}
                className="text-xs uppercase tracking-widest font-semibold text-stone-500 hover:text-stone-900 transition-colors"
              >
                {view === 'admin' ? 'Sair do Admin' : 'Painel Admin'}
              </button>
            )}
            
            {user && (
              <div className="flex items-center gap-3 pl-4 border-l border-stone-200">
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-stone-200" referrerPolicy="no-referrer" />
                <button onClick={handleLogout} className="text-stone-400 hover:text-red-500 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "absolute md:relative z-50 flex flex-col bg-white border-r border-stone-200 h-full overflow-y-auto transition-all duration-300 ease-in-out w-72 shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:-ml-72"
        )}>
          <div className="p-6 space-y-8">
            {/* Geral Section */}
            <div>
              <button 
                onClick={() => {
                  setView('general');
                  setActiveSubTab('general');
                }}
                className={`flex items-center justify-between w-full text-left group transition-all p-2 rounded-xl ${
                  view === 'general' ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'general' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white'
                  }`}>
                    <LayoutGrid size={18} />
                  </div>
                  <span className={`font-serif italic text-lg ${view === 'general' ? 'text-white' : 'text-stone-900'}`}>Geral</span>
                </div>
              </button>
            </div>

            {/* Agendamento Section */}
            <div>
              <button 
                onClick={() => {
                  setView('booking');
                  setActiveSubTab('escolha-sala');
                }}
                className={`flex items-center justify-between w-full text-left group transition-all p-2 rounded-xl ${
                  view === 'booking' ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'booking' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white'
                  }`}>
                    <Calendar size={18} />
                  </div>
                  <span className={`font-serif italic text-lg ${view === 'booking' ? 'text-white' : 'text-stone-900'}`}>Agendamento</span>
                </div>
              </button>
            </div>

            {/* Check-in Section */}
            <div>
              <button 
                onClick={() => {
                  setView('portal');
                  setActiveSubTab('checkin');
                }}
                className={`flex items-center justify-between w-full text-left group transition-all p-2 rounded-xl ${
                  view === 'portal' && activeSubTab === 'checkin' ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'portal' && activeSubTab === 'checkin' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white'
                  }`}>
                    <CheckSquare size={18} />
                  </div>
                  <span className={`font-serif italic text-lg ${view === 'portal' && activeSubTab === 'checkin' ? 'text-white' : 'text-stone-900'}`}>Check-in</span>
                </div>
              </button>
            </div>

            {/* Empresa Section */}
            <div>
              <button 
                onClick={() => {
                  setView('portal');
                  setActiveSubTab('empresa');
                }}
                className={`flex items-center justify-between w-full text-left group transition-all p-2 rounded-xl ${
                  view === 'portal' && activeSubTab === 'empresa' ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'portal' && activeSubTab === 'empresa' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white'
                  }`}>
                    <Building2 size={18} />
                  </div>
                  <span className={`font-serif italic text-lg ${view === 'portal' && activeSubTab === 'empresa' ? 'text-white' : 'text-stone-900'}`}>Empresa</span>
                </div>
              </button>
            </div>

            {/* Desafios Section */}
            <div>
              <button 
                onClick={() => {
                  setView('portal');
                  setActiveSubTab('desafios-publicos');
                }}
                className={`flex items-center justify-between w-full text-left group transition-all p-2 rounded-xl ${
                  view === 'portal' && (activeSubTab === 'desafios-publicos' || activeSubTab === 'desafios-privados') ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'portal' && (activeSubTab === 'desafios-publicos' || activeSubTab === 'desafios-privados') ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white'
                  }`}>
                    <Globe size={18} />
                  </div>
                  <span className={`font-serif italic text-lg ${view === 'portal' && (activeSubTab === 'desafios-publicos' || activeSubTab === 'desafios-privados') ? 'text-white' : 'text-stone-900'}`}>Desafios</span>
                </div>
              </button>
            </div>

            {/* Notícias Section */}
            <div>
              <button 
                onClick={() => {
                  setView('news');
                  setActiveSubTab('news');
                }}
                className={`flex items-center justify-between w-full text-left group transition-all p-2 rounded-xl ${
                  view === 'news' ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'news' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white'
                  }`}>
                    <Newspaper size={18} />
                  </div>
                  <span className={`font-serif italic text-lg ${view === 'news' ? 'text-white' : 'text-stone-900'}`}>Notícias</span>
                </div>
              </button>
            </div>

            {/* Quads Section */}
            <div>
              <button 
                onClick={() => {
                  setView('quads');
                  setActiveSubTab('quads');
                }}
                className={`flex items-center justify-between w-full text-left group transition-all p-2 rounded-xl ${
                  view === 'quads' ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'quads' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white'
                  }`}>
                    <Trophy size={18} />
                  </div>
                  <span className={`font-serif italic text-lg ${view === 'quads' ? 'text-white' : 'text-stone-900'}`}>Quads</span>
                </div>
              </button>
            </div>

            {/* Bate-papo Section */}
            <div>
              <button 
                onClick={() => {
                  setView('chat');
                  setActiveSubTab('bate-papo');
                }}
                className={`flex items-center justify-between w-full text-left group transition-all p-2 rounded-xl ${
                  view === 'chat' ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'chat' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white'
                  }`}>
                    <MessageSquare size={18} />
                  </div>
                  <span className={`font-serif italic text-lg ${view === 'chat' ? 'text-white' : 'text-stone-900'}`}>Bate-papo</span>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-auto p-6 border-t border-stone-100">
            <div className="bg-stone-50 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1">Status do Sistema</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-stone-600">Operacional</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 w-full">
          <div className="max-w-5xl mx-auto">
            {view === 'admin' ? (
              <AdminPanel 
                user={user} 
                onLogin={handleLogin} 
                rooms={rooms} 
                bookings={bookings} 
                businessHours={businessHours}
                isAdmin={isAdmin}
                founders={allFounders}
                initialTab={adminInitialTab}
              />
            ) : view === 'portal' ? (
              <FounderPortal 
                user={user} 
                activeSubTab={activeSubTab}
                setActiveSubTab={setActiveSubTab}
                isAdmin={isAdmin}
                founders={allFounders}
              />
            ) : view === 'chat' ? (
              <Chat user={user} />
            ) : view === 'news' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-12">
                  <h2 className="text-4xl font-serif italic mb-2">Notícias</h2>
                  <p className="text-stone-500 font-serif italic">Fique por dentro das novidades da comunidade QDDO.</p>
                </div>
                <div className="grid grid-cols-1 gap-8">
                  {newsItems
                    .filter(item => item.category === 'evento')
                    .sort((a, b) => {
                      const dateA = a.eventDate?.toDate ? a.eventDate.toDate() : new Date(a.eventDate + 'T00:00:00');
                      const dateB = b.eventDate?.toDate ? b.eventDate.toDate() : new Date(b.eventDate + 'T00:00:00');
                      return dateB.getTime() - dateA.getTime();
                    })
                    .map((item, i) => (
                    <div key={item.id || i} className="bg-white rounded-[40px] p-10 border border-stone-200 shadow-sm hover:shadow-xl transition-all group">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-[10px] uppercase tracking-widest font-bold bg-stone-100 px-3 py-1 rounded-full text-stone-500">Evento</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
                          {item.eventDate ? new Date(item.eventDate + 'T00:00:00').toLocaleDateString('pt-BR') : 
                           item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : ''}
                        </span>
                        {(item.startTime || item.endTime) && (
                          <span className="text-[10px] uppercase tracking-widest font-bold text-amber-500 flex items-center gap-2">
                            <Clock size={12} />
                            <span>Início: {item.startTime || '--:--'}</span>
                            {item.endTime && <span>Término: {item.endTime}</span>}
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl font-serif italic mb-4 group-hover:text-stone-600 transition-colors uppercase tracking-tight">{item.title}</h3>
                      <p className="text-stone-500 leading-relaxed mb-6 whitespace-pre-wrap">{item.content}</p>
                      
                      <div className="flex flex-wrap gap-4 items-center justify-between">
                        <button 
                          onClick={() => {
                            setActiveGeneralCategory('evento');
                          }}
                          className="text-xs font-bold uppercase tracking-widest text-stone-900 flex items-center gap-2 group-hover:gap-3 transition-all"
                        >
                          Detalhes do Evento <ArrowRight size={16} />
                        </button>

                        {item.attachmentUrl && (
                          <a 
                            href={item.attachmentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-all"
                          >
                            <Paperclip size={14} />
                            {item.attachmentName || 'Ver Anexo'}
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {newsItems.filter(item => item.category === 'evento').length === 0 && (
                    <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-stone-200">
                      <p className="text-stone-400 italic">Nenhum evento publicado no momento.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : view === 'quads' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-12">
                  <h2 className="text-4xl font-serif italic mb-2">Quads</h2>
                  <p className="text-stone-500 font-serif italic">Consulte as ações e suas respectivas pontuações na comunidade QDDO.</p>
                </div>
                
                <div className="bg-white rounded-[40px] border border-stone-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-900 border-b border-stone-800">
                          <th className="px-8 py-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Ação</th>
                          <th className="px-8 py-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Pontuação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { action: "Check-in diário", points: "1" },
                          { action: "Evento interno QDDO", points: "2" },
                          { action: "Streak 5 dias consecutivos", points: "3 (bônus)" },
                          { action: "Resolução de desafio aberto de outro founder", points: "5" },
                          { action: "Indicação founder com fit para o hub", points: "5" },
                          { action: "Aprovação de founder indicado por você", points: "10" },
                          { action: "Mentoria espontânea (mín. 30 min)", points: "5" },
                          { action: "Contribuição técnica ao app/site/infra QDDO", points: "8" },
                          { action: "Realização do Desafio Mensal", points: "10" },
                          { action: "Avançar estágio", points: "25" },
                          { action: "Crescimento de faturamento MoM", points: "5" },
                          { action: "Completar desafio de Mantenedor", points: "15" },
                          { action: "Participar de hackathon corporativo", points: "10" },
                          { action: "Vencer hackathon", points: "30 (bônus)" },
                          { action: "Relatório mensal para mantenedor de sala", points: "8" },
                          { action: "Convidado no podcast QDDO", points: "8" },
                          { action: "Pitch no Demo Day", points: "10" }
                        ].map((item, idx) => (
                          <tr key={idx} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors group">
                            <td className="px-8 py-6">
                              <span className="font-bold text-stone-900 group-hover:text-stone-600 transition-colors">{item.action}</span>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <span className="inline-flex items-center justify-center min-w-[32px] h-8 px-3 bg-stone-100 rounded-full text-xs font-black text-stone-900 group-hover:bg-stone-900 group-hover:text-white transition-all">
                                {item.points}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : view === 'general' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-12">
                  <h2 className="text-4xl font-serif italic mb-2">Visão Geral</h2>
                  <p className="text-stone-500 font-serif italic">Bem-vindo ao painel geral da comunidade QDDO.</p>
                </div>

                {/* Pendência Banner */}
                {founderData && !founderData.termsAccepted && (
                  <div className="mb-8 bg-amber-50 border border-amber-200 rounded-[30px] p-6 flex items-center justify-between group animate-in slide-in-from-top-4 duration-500 cursor-pointer" onClick={() => setIsTermsModalOpen(true)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-amber-900">Você está com uma pendência</h4>
                        <p className="text-amber-700 text-sm">
                          Para continuar utilizando o portal, você precisa aceitar os nossos termos de uso e autorizações.
                          <span className="ml-1 font-bold underline hover:text-amber-900 transition-colors">
                            Clique aqui para resolver
                          </span>
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="text-amber-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}

                {/* News Box */}
                <div className="mb-12 bg-white rounded-[40px] border border-stone-200 shadow-sm overflow-hidden">
                  <div className="bg-stone-900 px-8 py-4 flex items-center gap-3">
                    <Bell size={20} className="text-white" />
                    <h3 className="text-white font-serif italic text-xl">News</h3>
                  </div>
                  <div className="p-8 space-y-6">
                    {/* Filtered News Items */}
                    {(() => {
                      const now = new Date();
                      const last24h = subHours(now, 24);
                      const last72h = subDays(now, 3);
                      const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
                      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

                      const relevantEvents = newsItems.filter(item => {
                        if (!item.eventDate) return false;
                        const eventDate = item.eventDate?.toDate ? item.eventDate.toDate() : new Date(item.eventDate + 'T00:00:00');
                        return isWithinInterval(eventDate, { start: weekStart, end: weekEnd });
                      }).sort((a, b) => {
                        const dateA = a.eventDate?.toDate ? a.eventDate.toDate() : new Date(a.eventDate);
                        const dateB = b.eventDate?.toDate ? b.eventDate.toDate() : new Date(b.eventDate);
                        return dateA.getTime() - dateB.getTime();
                      });

                      const publicChallenges = allChallenges
                        .filter(c => c.type === 'public' && c.status === 'open')
                        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                        .slice(0, 1);

                      const currentMonthStart = startOfMonth(now);
                      const currentMonthEnd = endOfMonth(now);
                      const currentMonthCheckins = userCheckins.filter(c => {
                        const d = c.checkinTime?.toDate ? c.checkinTime.toDate() : (c.checkinTime?.seconds ? new Date(c.checkinTime.seconds * 1000) : new Date(c.checkinTime));
                        return isWithinInterval(d, { start: currentMonthStart, end: currentMonthEnd });
                      }).length;
                      const userScore = currentMonthCheckins * 10;

                      // Ranking Top 5 calculation
                      const allCurrentMonthCheckins = allCheckins.filter(c => {
                        const d = c.checkinTime?.toDate ? c.checkinTime.toDate() : (c.checkinTime?.seconds ? new Date(c.checkinTime.seconds * 1000) : new Date(c.checkinTime));
                        return isWithinInterval(d, { start: currentMonthStart, end: currentMonthEnd });
                      });

                      const scoresMap: Record<string, number> = {};
                      allCurrentMonthCheckins.forEach(c => {
                        scoresMap[c.userId] = (scoresMap[c.userId] || 0) + 10;
                      });

                      const fullRanking = Object.entries(scoresMap)
                        .map(([userId, score]) => {
                          const founder = allFounders.find(f => f.id === userId);
                          return {
                            userId,
                            score,
                            name: founder?.name || 'Founder',
                            username: founder?.username || userId.slice(0, 6)
                          };
                        })
                        .sort((a, b) => b.score - a.score);

                      const ranking = fullRanking.slice(0, 5);
                      const userRankPosition = fullRanking.findIndex(r => r.userId === user?.uid) + 1;

                      return (
                        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[400px]">
                          {/* Part 1: Eventos & Desafios (66%) */}
                          <div className="lg:w-[66%] flex flex-col gap-6">
                            {/* Eventos da Semana */}
                            <div className="bg-white rounded-[40px] p-8 border border-stone-200 shadow-sm flex flex-col">
                              <div className="flex items-center justify-between mb-6">
                                <h4 className="text-2xl font-serif italic text-stone-900 flex items-center gap-2">
                                  <CalendarDays className="text-amber-500" size={24} />
                                  Eventos da Semana
                                </h4>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                  {format(weekStart, 'dd/MM')} - {format(weekEnd, 'dd/MM')}
                                </span>
                              </div>
                              
                              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                {relevantEvents.length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                                    <p className="text-stone-400 italic">Nenhum evento programado para esta semana.</p>
                                  </div>
                                ) : (
                                  relevantEvents.map((event, idx) => (
                                    <div key={event.id || idx} className="p-6 bg-stone-50 rounded-3xl border border-stone-100 hover:border-stone-300 transition-all group">
                                      <div className="flex items-start justify-between gap-4">
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className={cn(
                                              "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full",
                                              event.category === 'evento' ? "bg-amber-100 text-amber-700" :
                                              event.category === 'aviso' ? "bg-rose-100 text-rose-700" :
                                              event.category === 'info' ? "bg-blue-100 text-blue-700" :
                                              "bg-stone-100 text-stone-700"
                                            )}>
                                              {format(event.eventDate?.toDate ? event.eventDate.toDate() : new Date(event.eventDate + 'T00:00:00'), 'EEEE', { locale: ptBR })}
                                            </span>
                                            {(event.startTime || event.endTime) && (
                                              <span className="text-stone-400 text-[10px] font-bold uppercase flex items-center gap-2">
                                                <Clock size={10} />
                                                <span>Início: {event.startTime || '--:--'}</span>
                                                {event.endTime && <span>Término: {event.endTime}</span>}
                                              </span>
                                            )}
                                          </div>
                                          <h5 className="font-bold text-stone-900 mb-1 group-hover:text-amber-600 transition-colors">{event.title}</h5>
                                          <p className="text-stone-500 text-xs line-clamp-2">{event.content}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <div className="text-2xl font-serif italic text-stone-300 group-hover:text-amber-200 transition-colors">
                                            {format(event.eventDate?.toDate ? event.eventDate.toDate() : new Date(event.eventDate + 'T00:00:00'), 'dd')}
                                          </div>
                                          <div className="text-[10px] font-bold uppercase text-stone-400">
                                            {format(event.eventDate?.toDate ? event.eventDate.toDate() : new Date(event.eventDate + 'T00:00:00'), 'MMM', { locale: ptBR })}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Desafios Públicos (Moved here) */}
                            <div className="bg-stone-900 rounded-[40px] p-8 text-white shadow-xl shadow-stone-900/20 flex flex-col">
                              <div className="flex items-center gap-2 mb-6">
                                <Trophy className="text-amber-400" size={20} />
                                <h4 className="text-lg font-serif italic">Desafios Públicos</h4>
                              </div>
                              
                              <div className="flex-1 flex flex-col justify-center">
                                {publicChallenges.length === 0 ? (
                                  <p className="text-stone-500 italic text-sm text-center">Nenhum desafio público aberto no momento.</p>
                                ) : (
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-500 mb-1">
                                        Lançado por {allFounders.find(f => f.id === publicChallenges[0].founderId)?.name || 'Founder'}
                                      </p>
                                      <h5 className="text-xl font-bold leading-tight mb-2">{publicChallenges[0].title}</h5>
                                      <p className="text-stone-400 text-xs line-clamp-3 italic">"{publicChallenges[0].description}"</p>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        setView('portal');
                                        setActiveSubTab('desafios-publicos');
                                      }}
                                      className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                    >
                                      clique aqui para ajuda-lo a resolver <ArrowRight size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Part 2: Ranking & Score (33%) */}
                          <div className="lg:w-[33%] flex flex-col gap-6">
                            {/* Ranking Top 5 */}
                            <div className="bg-white rounded-[40px] p-8 border border-stone-200 shadow-sm flex flex-col">
                              <div className="flex items-center gap-2 mb-6">
                                <Trophy className="text-stone-900" size={20} />
                                <h4 className="text-lg font-serif italic text-stone-900">Ranking Top 5</h4>
                              </div>
                              <div className="space-y-4">
                                {ranking.map((item, idx) => (
                                  <div key={item.userId} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                        idx === 0 ? "bg-amber-100 text-amber-600" : 
                                        idx === 1 ? "bg-stone-200 text-stone-600" :
                                        idx === 2 ? "bg-orange-100 text-orange-600" :
                                        "bg-stone-50 text-stone-400"
                                      )}>
                                        {idx + 1}
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-stone-900 line-clamp-1">{item.name}</p>
                                        <p className="text-[10px] text-stone-400">@{item.username}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs font-black text-stone-900">{item.score}</span>
                                      <span className="text-[10px] text-stone-400 ml-1">pts</span>
                                    </div>
                                  </div>
                                ))}
                                {ranking.length === 0 && (
                                  <p className="text-stone-400 italic text-xs text-center py-4">Nenhum ponto este mês.</p>
                                )}
                              </div>
                            </div>

                            {/* User Score */}
                            <div className="flex-1 bg-emerald-500 rounded-[40px] p-8 text-white shadow-xl shadow-emerald-500/20 flex flex-col justify-center items-center text-center relative overflow-hidden">
                              <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                                <Trophy size={120} />
                              </div>
                              <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-100 mb-2 relative z-10">Seu Score QDDO</span>
                              <div className="text-6xl font-serif italic mb-1 relative z-10">{userScore}</div>
                              <span className="text-xs font-bold text-emerald-100 relative z-10">pontos este mês</span>
                              {userRankPosition > 0 && (
                                <span className="text-[11px] text-emerald-200 relative z-10 mt-1">#{userRankPosition}º no ranking</span>
                              )}
                              
                              <div className="mt-6 pt-6 border-t border-emerald-400/30 w-full relative z-10">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-100">
                                  <span>Check-ins</span>
                                  <span>{currentMonthCheckins}</span>
                                </div>
                                <div className="w-full h-1.5 bg-emerald-600/30 rounded-full mt-2 overflow-hidden">
                                  <div 
                                    className="h-full bg-white rounded-full transition-all duration-1000" 
                                    style={{ width: `${Math.min((currentMonthCheckins / 20) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                  {/* Infos */}
                  <div 
                    onClick={() => setActiveGeneralCategory('info')}
                    className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                      <Info size={24} />
                    </div>
                    <h3 className="text-xl font-serif italic mb-2">Infos</h3>
                    <p className="text-stone-400 text-sm">Informações essenciais sobre a nossa comunidade e espaço.</p>
                  </div>
                  
                  {/* Regras */}
                  <div 
                    onClick={() => setActiveGeneralCategory('regras')}
                    className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                      <ShieldCheck size={24} />
                    </div>
                    <h3 className="text-xl font-serif italic mb-2">Regras</h3>
                    <p className="text-stone-400 text-sm">Diretrizes de convivência e uso das salas QDDO.</p>
                  </div>

                  {/* Avisos */}
                  <div 
                    onClick={() => setActiveGeneralCategory('aviso')}
                    className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                      <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-xl font-serif italic mb-2">Avisos</h3>
                    <p className="text-stone-400 text-sm">Comunicados importantes e atualizações de última hora.</p>
                  </div>

                  {/* Eventos */}
                  <div 
                    onClick={() => setActiveGeneralCategory('evento')}
                    className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                      <CalendarDays size={24} />
                    </div>
                    <h3 className="text-xl font-serif italic mb-2">Eventos</h3>
                    <p className="text-stone-400 text-sm">Calendário de workshops, meetups e encontros.</p>
                  </div>

                  {/* Desafios */}
                  <div 
                    onClick={() => {
                      setView('portal');
                      setActiveSubTab('desafios-publicos');
                    }}
                    className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                      <Trophy size={24} />
                    </div>
                    <h3 className="text-xl font-serif italic mb-2">Desafios</h3>
                    <p className="text-stone-400 text-sm">Participe dos desafios e colabore com outros founders.</p>
                  </div>

                  {/* Comunicação */}
                  <div 
                    onClick={() => setActiveGeneralCategory('comunicacao')}
                    className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                      <MessageSquare size={24} />
                    </div>
                    <h3 className="text-xl font-serif italic mb-2">Comunicação</h3>
                    <p className="text-stone-400 text-sm">Canais oficiais de suporte e interação entre membros.</p>
                  </div>
                </div>

                {activeGeneralCategory && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                      <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-stone-900 text-white rounded-2xl flex items-center justify-center">
                            {activeGeneralCategory === 'info' ? <Info size={24} /> :
                             activeGeneralCategory === 'regras' ? <ShieldCheck size={24} /> :
                             activeGeneralCategory === 'aviso' ? <AlertTriangle size={24} /> :
                             activeGeneralCategory === 'evento' ? <CalendarDays size={24} /> :
                             <MessageSquare size={24} />}
                          </div>
                          <div>
                            <h3 className="text-2xl font-serif italic text-stone-900 capitalize">{activeGeneralCategory}</h3>
                            <p className="text-stone-400 text-xs uppercase tracking-widest font-bold">Portal Founder</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setActiveGeneralCategory(null)}
                          className="w-10 h-10 rounded-full hover:bg-stone-200 flex items-center justify-center transition-colors"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
                        {newsItems.filter(item => item.category === activeGeneralCategory).length > 0 ? (
                          newsItems
                            .filter(item => item.category === activeGeneralCategory)
                            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                            .map(item => (
                              <div key={item.id} className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-bold text-stone-900">{item.title}</h4>
                                  <span className="text-[10px] text-stone-400 font-bold">
                                    {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : ''}
                                  </span>
                                </div>
                                <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
                                 {item.eventDate && (
                                   <div className="mt-4 flex flex-wrap items-center gap-4">
                                     <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                                       <CalendarDays size={14} />
                                       <span>Data: {new Date(item.eventDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                     </div>
                                     {(item.startTime || item.endTime) && (
                                       <div className="flex flex-wrap items-center gap-4 text-amber-600 font-bold text-xs uppercase tracking-widest">
                                         <div className="flex items-center gap-2">
                                           <Clock size={14} />
                                           <span>Início: {item.startTime || '--:--'}</span>
                                         </div>
                                         {item.endTime && (
                                           <div className="flex items-center gap-2">
                                             <Clock size={14} />
                                             <span>Término: {item.endTime}</span>
                                           </div>
                                         )}
                                       </div>
                                     )}
                                     {item.attachmentUrl && (
                                       <a 
                                         href={item.attachmentUrl}
                                         target="_blank"
                                         rel="noopener noreferrer"
                                         className="flex items-center gap-2 text-stone-900 font-bold text-xs hover:underline decoration-stone-900/30"
                                       >
                                         <Paperclip size={14} />
                                         <span>Anexo: {item.attachmentName || 'Ver Arquivo'}</span>
                                         <ExternalLink size={14} />
                                       </a>
                                     )}
                                   </div>
                                 )}
                              </div>
                            ))
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-stone-400 italic">Nenhum conteúdo disponível nesta categoria.</p>
                          </div>
                        )}
                      </div>
                      {(user?.email === ADMIN_EMAIL || founderData?.role === 'admin') && (
                        <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-center">
                          <button 
                            onClick={() => {
                              setActiveGeneralCategory(null);
                              setAdminInitialTab('news');
                              setView('admin');
                            }}
                            className="bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center gap-2"
                          >
                            <Plus size={18} />
                            Adicionar Conteúdo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowIndicarFounderModal(true);
                    setIndicarSuccess(false);
                    setIndicarNome('');
                    setIndicarEmpresa('');
                    setIndicarArea('');
                  }}
                  className="w-full text-left bg-stone-900 text-white p-12 rounded-[48px] relative overflow-hidden hover:bg-stone-800 transition-all group"
                >
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-white/10 p-3 rounded-2xl group-hover:bg-white/20 transition-all">
                        <UserPlus size={28} className="text-white" />
                      </div>
                    </div>
                    <h2 className="text-3xl font-serif italic mb-4">Indicar um Founder</h2>
                    <p className="text-stone-400 max-w-md">Conhece alguém que deveria fazer parte da nossa comunidade? Indique um founder e ajude a fortalecer a rede.</p>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                  <ArrowRight size={24} className="absolute bottom-10 right-12 text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            ) : (
              <BookingFlow 
                rooms={rooms} 
                bookings={bookings} 
                businessHours={businessHours}
                selectedRoomId={selectedRoomId}
                setSelectedRoomId={setSelectedRoomId}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                status={bookingStatus}
                setStatus={setBookingStatus}
                activeSubTab={activeSubTab}
                onStepChange={(stepId) => {
                  const subTabs = ['escolha-sala', 'escolha-data', 'escolha-horario'];
                  setActiveSubTab(subTabs[stepId - 1]);
                }}
              />
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-stone-200 py-6 bg-white z-50">
        <div className="max-w-[1600px] mx-auto px-6 text-center">
          <p className="text-stone-400 text-[10px] uppercase tracking-widest font-bold">© 2026 qddo - Gestão Inteligente de Espaços - Brenda Ribeiro</p>
        </div>
      </footer>
      {showIndicarFounderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowIndicarFounderModal(false)}>
          <div className="bg-white rounded-[32px] w-full max-w-md p-8 relative shadow-2xl" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <button
              onClick={() => setShowIndicarFounderModal(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-stone-900 p-3 rounded-2xl">
                <UserPlus size={22} className="text-white" />
              </div>
              <h2 className="text-2xl font-serif italic text-stone-900">Indicar um Founder</h2>
            </div>

            {indicarSuccess ? (
              <div className="text-center py-8">
                <div className="bg-green-50 text-green-700 rounded-2xl p-6 mb-4">
                  <p className="font-bold text-lg mb-1">Indicação enviada!</p>
                  <p className="text-sm text-green-600">Obrigado por fortalecer a nossa rede.</p>
                </div>
                <button
                  onClick={() => setShowIndicarFounderModal(false)}
                  className="bg-stone-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-stone-700 transition-all"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleIndicarFounderSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Nome do Founder indicado
                  </label>
                  <input
                    type="text"
                    value={indicarNome}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarNome(e.target.value)}
                    placeholder="Ex: João Silva"
                    required
                    className="w-full border border-stone-200 rounded-2xl px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Empresa / Projeto
                  </label>
                  <input
                    type="text"
                    value={indicarEmpresa}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarEmpresa(e.target.value)}
                    placeholder="Ex: Startup XYZ"
                    required
                    className="w-full border border-stone-200 rounded-2xl px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Área de atuação do mercado
                  </label>
                  <input
                    type="text"
                    value={indicarArea}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarArea(e.target.value)}
                    placeholder="Ex: Fintech, Saúde, Educação..."
                    required
                    className="w-full border border-stone-200 rounded-2xl px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={indicarSubmitting}
                  className="mt-2 bg-stone-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Send size={18} />
                  {indicarSubmitting ? 'Enviando...' : 'Enviar indicação'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onAccept={handleAcceptTerms}
      />
    </div>
  );
}
