import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  User as UserIcon,
  LogOut,
  LogIn
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  startOfToday,
  parseISO,
  isWithinInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Checkin {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkinTime: Timestamp;
  checkoutTime?: Timestamp;
  status: 'active' | 'completed';
}

export function CheckinSystem({ 
  user, 
  isAdmin,
  founders = []
}: { 
  user: User; 
  isAdmin: boolean;
  founders?: any[];
}) {
  const [activeTab, setActiveTab] = useState<'checkin' | 'checkout' | 'overview'>('checkin');
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string>(user.uid);
  const [loading, setLoading] = useState(true);

  // Fetch checkins for the selected user
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'checkins'),
      where('userId', '==', selectedUserId),
      orderBy('checkinTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Checkin));
      setCheckins(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'checkins'));

    return () => unsubscribe();
  }, [selectedUserId]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayCheckin = checkins.find(c => c.date === todayStr);

  const handleCheckin = async () => {
    if (todayCheckin) return;

    try {
      await addDoc(collection(db, 'checkins'), {
        userId: user.uid,
        date: todayStr,
        checkinTime: serverTimestamp(),
        status: 'active'
      });
      setActiveTab('overview');
    } catch (error) {
      console.error('Error during check-in:', error);
    }
  };

  const handleCheckout = async () => {
    if (!todayCheckin || todayCheckin.status === 'completed') return;

    try {
      await updateDoc(doc(db, 'checkins', todayCheckin.id), {
        checkoutTime: serverTimestamp(),
        status: 'completed'
      });
      setActiveTab('overview');
    } catch (error) {
      console.error('Error during check-out:', error);
    }
  };

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const checkinDays = useMemo(() => {
    return checkins.filter(c => {
      const d = parseISO(c.date);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });
  }, [checkins, monthStart, monthEnd]);

  // Metrics Logic
  const currentMonthCheckins = checkinDays.length;
  
  const prevMonthStart = startOfMonth(subMonths(currentMonth, 1));
  const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1));
  const prevMonthCheckins = checkins.filter(c => {
    const d = parseISO(c.date);
    return isWithinInterval(d, { start: prevMonthStart, end: prevMonthEnd });
  }).length;

  const diff = currentMonthCheckins - prevMonthCheckins;
  const percentChange = prevMonthCheckins === 0 ? 100 : Math.round((diff / prevMonthCheckins) * 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Sub-tabs */}
      <div className="flex gap-4 mb-8">
        {[
          { id: 'checkin', label: 'Check-in', icon: LogIn },
          { id: 'checkout', label: 'Check-out', icon: LogOut },
          { id: 'overview', label: 'Visão Geral', icon: CalendarIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all",
              activeTab === tab.id 
                ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20" 
                : "bg-white text-stone-400 border border-stone-200 hover:border-stone-400"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Admin User Selector */}
      {isAdmin && (
        <div className="bg-white p-6 rounded-3xl border border-stone-200 flex items-center gap-4">
          <UserIcon size={20} className="text-stone-400" />
          <select 
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="bg-transparent border-none focus:ring-0 font-bold text-stone-900 flex-1"
          >
            <option value={user.uid}>Meu Calendário ({user.displayName || 'Eu'})</option>
            {founders.map(f => (
              <option key={f.id} value={f.id}>{f.name} (@{f.username})</option>
            ))}
          </select>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white rounded-[40px] p-12 border border-stone-200 shadow-sm">
        {activeTab === 'checkin' && (
          <div className="max-w-md mx-auto text-center space-y-8">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
              <LogIn size={48} className="text-stone-900" />
            </div>
            <div>
              <h3 className="text-3xl font-serif italic mb-2">Bem-vindo!</h3>
              <p className="text-stone-500">Registre sua chegada no espaço QDDO hoje.</p>
            </div>
            
            {todayCheckin ? (
              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} />
                  Check-in realizado às {format(todayCheckin.checkinTime.toDate(), 'HH:mm')}
                </p>
              </div>
            ) : (
              <button 
                onClick={handleCheckin}
                className="w-full bg-stone-900 text-white py-6 rounded-3xl font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 flex items-center justify-center gap-3"
              >
                <LogIn size={24} />
                Realizar Check-in
              </button>
            )}
          </div>
        )}

        {activeTab === 'checkout' && (
          <div className="max-w-md mx-auto text-center space-y-8">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
              <LogOut size={48} className="text-stone-900" />
            </div>
            <div>
              <h3 className="text-3xl font-serif italic mb-2">Até logo!</h3>
              <p className="text-stone-500">Não esqueça de registrar sua saída.</p>
            </div>

            {!todayCheckin ? (
              <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                <p className="text-stone-500 italic">Você ainda não realizou check-in hoje.</p>
              </div>
            ) : todayCheckin.status === 'completed' ? (
              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} />
                  Check-out realizado às {format(todayCheckin.checkoutTime?.toDate() || new Date(), 'HH:mm')}
                </p>
              </div>
            ) : (
              <button 
                onClick={handleCheckout}
                className="w-full bg-stone-900 text-white py-6 rounded-3xl font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 flex items-center justify-center gap-3"
              >
                <LogOut size={24} />
                Realizar Check-out
              </button>
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-12">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
                <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400 block mb-2">Visitas este mês</span>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-serif italic text-stone-900">{currentMonthCheckins}</span>
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-bold mb-1",
                    diff >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {diff >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(percentChange)}%
                  </div>
                </div>
              </div>
              
              <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
                <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400 block mb-2">Média Semanal</span>
                <span className="text-4xl font-serif italic text-stone-900">
                  {(currentMonthCheckins / 4).toFixed(1)}
                </span>
              </div>

              <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
                <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400 block mb-2">Status Atual</span>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    todayCheckin?.status === 'active' ? "bg-emerald-500" : "bg-stone-300"
                  )} />
                  <span className="font-bold text-stone-900">
                    {todayCheckin?.status === 'active' ? 'Presente no Espaço' : 'Ausente'}
                  </span>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-2xl font-serif italic capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h4>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-stone-400 py-2">
                    {day}
                  </div>
                ))}
                
                {/* Empty slots for start of month */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {daysInMonth.map(day => {
                  const hasCheckin = checkins.some(c => c.date === format(day, 'yyyy-MM-dd'));
                  return (
                    <div 
                      key={day.toString()}
                      className={cn(
                        "aspect-square rounded-2xl border flex flex-col items-center justify-center relative transition-all",
                        isToday(day) ? "border-stone-900 bg-stone-50" : "border-stone-100",
                        hasCheckin ? "bg-emerald-50 border-emerald-100" : "hover:bg-stone-50"
                      )}
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        isToday(day) ? "text-stone-900 font-bold" : "text-stone-500",
                        hasCheckin && "text-emerald-700"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {hasCheckin && (
                        <CheckCircle2 size={14} className="text-emerald-500 mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
