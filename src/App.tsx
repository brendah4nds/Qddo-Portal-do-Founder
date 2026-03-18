/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc
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
  startOfDay
} from 'date-fns';
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
  MessageSquare
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { Room, Booking, BookingStatus } from './types';
import { BookingFlow } from './components/BookingFlow';
import { AdminPanel } from './components/AdminPanel';
import { FounderPortal } from './components/FounderPortal';
import { LandingPage } from './components/LandingPage';
import { RegistrationFlow } from './components/RegistrationFlow';
import { Chat } from './components/Chat';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "bbrendaribeiroc@gmail.com";

const DEFAULT_BUSINESS_HOURS = Array.from({ length: 21 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [businessHours, setBusinessHours] = useState<string[]>(DEFAULT_BUSINESS_HOURS);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'booking' | 'admin' | 'portal' | 'chat'>('booking');
  const [activeSubTab, setActiveSubTab] = useState<string>('escolha-sala');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<string[]>(['agendamento', 'portal']);
  const [isRegistering, setIsRegistering] = useState(false);
  const [founderData, setFounderData] = useState<any>(null);
  const [checkingFounder, setCheckingFounder] = useState(true);
  const [allFounders, setAllFounders] = useState<any[]>([]);

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

    let foundersUnsubscribe = () => {};
    if (user?.email === ADMIN_EMAIL || founderData?.role === 'admin') {
      foundersUnsubscribe = onSnapshot(collection(db, 'founders'), (snapshot) => {
        const foundersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllFounders(foundersData);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'founders'));
    }

    return () => {
      roomsUnsubscribe();
      bookingsUnsubscribe();
      settingsUnsubscribe();
      foundersUnsubscribe();
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
    return <RegistrationFlow user={user} onComplete={() => setView('portal')} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-stone-900 font-sans selection:bg-stone-200 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => {
              window.history.pushState({}, '', '/');
              setView('booking');
              setActiveSubTab('escolha-sala');
              setSelectedRoomId(null);
            }}
          >
            <div className="relative w-10 h-10 bg-black rounded-lg flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
              <div className="w-6 h-6 border-[3px] border-white rounded-full"></div>
              <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF4500] rounded-full shadow-[0_0_8px_rgba(255,69,0,0.4)]"></div>
            </div>
            <h1 className="font-sans font-black text-2xl tracking-tighter italic">qddo</h1>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-stone-200 bg-white flex flex-col sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <div className="p-6 space-y-8">
            {/* Agendamento Section */}
            <div>
              <button 
                onClick={() => toggleTopic('agendamento')}
                className="flex items-center justify-between w-full text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <Calendar size={18} />
                  </div>
                  <span className="font-serif italic text-lg">Agendamento de Sala</span>
                </div>
                {expandedTopics.includes('agendamento') ? <ChevronDown size={16} className="text-stone-400" /> : <ChevronRight size={16} className="text-stone-400" />}
              </button>
              
              {expandedTopics.includes('agendamento') && (
                <div className="mt-4 ml-11 space-y-2 border-l-2 border-stone-100">
                  {[
                    { id: 'escolha-sala', label: 'Escolha a sala' },
                    { id: 'escolha-data', label: 'Escolha a data' },
                    { id: 'escolha-horario', label: 'Escolha o horário' }
                  ].map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setView('booking');
                        setActiveSubTab(sub.id);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm transition-all rounded-r-lg ${
                        view === 'booking' && activeSubTab === sub.id 
                        ? "text-stone-900 font-bold border-l-2 border-stone-900 -ml-[2px] bg-stone-50" 
                        : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Portal Founders Section */}
            <div>
              <button 
                onClick={() => toggleTopic('portal')}
                className="flex items-center justify-between w-full text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <LayoutDashboard size={18} />
                  </div>
                  <span className="font-serif italic text-lg">Portal Founders</span>
                </div>
                {expandedTopics.includes('portal') ? <ChevronDown size={16} className="text-stone-400" /> : <ChevronRight size={16} className="text-stone-400" />}
              </button>
              
              {expandedTopics.includes('portal') && (
                <div className="mt-4 ml-11 space-y-2 border-l-2 border-stone-100">
                  {[
                    { id: 'checkin', label: 'Checkin', icon: CheckSquare },
                    { id: 'empresa', label: 'Empresa', icon: Building2 },
                    { id: 'desafios-privados', label: 'Desafios Privados', icon: Lock },
                    { id: 'desafios-publicos', label: 'Desafios Públicos', icon: Globe },
                    { id: 'bate-papo', label: 'Bate-papo', icon: MessageSquare }
                  ].map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        if (sub.id === 'bate-papo') {
                          setView('chat');
                        } else {
                          setView('portal');
                        }
                        setActiveSubTab(sub.id);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm transition-all rounded-r-lg ${
                        (view === 'portal' || view === 'chat') && activeSubTab === sub.id 
                        ? "text-stone-900 font-bold border-l-2 border-stone-900 -ml-[2px] bg-stone-50" 
                        : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
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
        <main className="flex-1 overflow-y-auto p-12">
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
              />
            ) : view === 'portal' ? (
              <FounderPortal 
                user={user} 
                activeSubTab={activeSubTab}
                isAdmin={isAdmin}
                founders={allFounders}
              />
            ) : view === 'chat' ? (
              <Chat user={user} />
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
    </div>
  );
}
