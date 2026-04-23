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
  LogIn,
  Trophy
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

const ULYSSES_LOCATION = {
  lat: -15.789209930873332,
  lng: -47.90071054840695,
  radius: 300 // metros de tolerância
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // raio da Terra em metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // metros
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
  const [activeTab, setActiveTab] = useState<'checkin' | 'checkout' | 'overview' | 'score'>('checkin');
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string>(user.uid);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);

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

  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinSuccess, setCheckinSuccess] = useState<string | null>(null);

  const performCheckAction = async (isCheckin: boolean) => {
    setCheckinError(null);
    setCheckinSuccess(null);
    setLocationLoading(true);

    if (!navigator.geolocation) {
      setCheckinError('Seu navegador não suporta geolocalização.');
      setLocationLoading(false);
      return;
    }

    // Usar getCurrentPosition diretamente para melhor suporte a gestos no iOS
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistance(
          latitude,
          longitude,
          ULYSSES_LOCATION.lat,
          ULYSSES_LOCATION.lng
        );

        if (distance > ULYSSES_LOCATION.radius) {
          setCheckinError(`Você está fora do perímetro permitido (${Math.round(distance)}m do local).`);
          setLocationLoading(false);
          return;
        }

        try {
          if (isCheckin) {
            await addDoc(collection(db, 'checkins'), {
              userId: user.uid,
              date: todayStr,
              checkinTime: serverTimestamp(),
              status: 'active'
            });
            setCheckinSuccess('Check-in realizado com sucesso');
          } else {
            if (todayCheckin) {
              await updateDoc(doc(db, 'checkins', todayCheckin.id), {
                checkoutTime: serverTimestamp(),
                status: 'completed'
              });
              setCheckinSuccess('Check-out realizado com sucesso');
            }
          }
          setTimeout(() => setActiveTab('overview'), 2000);
        } catch (error) {
          console.error(`Error during ${isCheckin ? 'check-in' : 'check-out'}:`, error);
          setCheckinError(`Erro ao salvar no banco de dados.`);
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        let msg = 'Erro ao obter localização.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Permissão de localização negada pelo usuário.';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = 'Informações de localização indisponíveis.';
            break;
          case error.TIMEOUT:
            msg = 'Tempo limite de localização esgotado.';
            break;
        }
        setCheckinError(msg);
        setLocationLoading(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, // Aumentado para 15s para dar mais tempo ao GPS mobile
        maximumAge: 0   // Forçar localização atual, crítico para iOS
      }
    );
  };

  const handleCheckin = () => {
    if (todayCheckin || locationLoading) return;
    performCheckAction(true);
  };

  const handleCheckout = () => {
    if (!todayCheckin || todayCheckin.status === 'completed' || locationLoading) return;
    performCheckAction(false);
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { id: 'checkin', label: 'Check-in', icon: LogIn },
          { id: 'checkout', label: 'Check-out', icon: LogOut },
          { id: 'overview', label: 'Visão Geral', icon: CalendarIcon },
          { id: 'score', label: 'Score', icon: Trophy },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold transition-all whitespace-nowrap text-sm shrink-0",
              activeTab === tab.id
                ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20"
                : "bg-white text-stone-400 border border-stone-200 hover:border-stone-400"
            )}
          >
            <tab.icon size={16} />
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
      <div className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-10 border border-stone-200 shadow-sm">
        {activeTab === 'checkin' && (
          <div className="max-w-md mx-auto text-center space-y-8">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
              <LogIn size={48} className="text-stone-900" />
            </div>
            <div>
              <h3 className="text-3xl font-sans mb-2">Bem-vindo!</h3>
              <p className="text-stone-500">Registre sua chegada no espaço QDDO hoje.</p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-stone-100 rounded-full">
                <Trophy size={14} className="text-stone-900" />
                <span className="text-xs font-bold text-stone-900 uppercase tracking-widest">
                  Seu Score: {currentMonthCheckins * 10} pts
                </span>
              </div>
            </div>
            
            {checkinSuccess && (
              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-300">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} />
                  {checkinSuccess}
                </p>
              </div>
            )}

            {checkinError && (
              <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 animate-in fade-in shake duration-300">
                <p className="text-rose-700 font-bold mb-1 flex items-center justify-center gap-2">
                  Erro ao realizar o check-in
                </p>
                <p className="text-rose-500 text-sm">{checkinError}</p>
              </div>
            )}
            
            {todayCheckin ? (
              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} />
                  Check-in realizado às {todayCheckin.checkinTime?.toDate ? format(todayCheckin.checkinTime.toDate(), 'HH:mm') : '...'}
                </p>
              </div>
            ) : (
              !checkinSuccess && (
                <button 
                  onClick={handleCheckin}
                  disabled={locationLoading}
                  className={cn(
                    "w-full py-6 rounded-3xl font-bold transition-all shadow-xl flex items-center justify-center gap-3",
                    locationLoading 
                      ? "bg-stone-100 text-stone-400 cursor-not-allowed" 
                      : "bg-stone-900 text-white hover:bg-stone-800 shadow-stone-900/20 active:scale-[0.98]"
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {locationLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                      Validando Localização...
                    </>
                  ) : (
                    <>
                      <LogIn size={24} />
                      Realizar Check-in
                    </>
                  )}
                </button>
              )
            )}
          </div>
        )}

        {activeTab === 'checkout' && (
          <div className="max-w-md mx-auto text-center space-y-8">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
              <LogOut size={48} className="text-stone-900" />
            </div>
            <div>
              <h3 className="text-3xl font-sans mb-2">Até logo!</h3>
              <p className="text-stone-500">Não esqueça de registrar sua saída.</p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-stone-100 rounded-full">
                <Trophy size={14} className="text-stone-900" />
                <span className="text-xs font-bold text-stone-900 uppercase tracking-widest">
                  Seu Score: {currentMonthCheckins * 10} pts
                </span>
              </div>
            </div>

            {checkinSuccess && (
              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-300">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} />
                  {checkinSuccess}
                </p>
              </div>
            )}

            {checkinError && (
              <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 animate-in fade-in shake duration-300">
                <p className="text-rose-700 font-bold mb-1 flex items-center justify-center gap-2">
                  Erro ao realizar o check-out
                </p>
                <p className="text-rose-500 text-sm">{checkinError}</p>
              </div>
            )}

            {!todayCheckin ? (
              <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                <p className="text-stone-500">Você ainda não realizou check-in hoje.</p>
              </div>
            ) : todayCheckin.status === 'completed' ? (
              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} />
                  Check-out realizado às {todayCheckin.checkoutTime?.toDate ? format(todayCheckin.checkoutTime.toDate(), 'HH:mm') : '...'}
                </p>
              </div>
            ) : (
              !checkinSuccess && (
                <button 
                  onClick={handleCheckout}
                  disabled={locationLoading}
                  className={cn(
                    "w-full py-6 rounded-3xl font-bold transition-all shadow-xl flex items-center justify-center gap-3",
                    locationLoading 
                      ? "bg-stone-100 text-stone-400 cursor-not-allowed" 
                      : "bg-stone-900 text-white hover:bg-stone-800 shadow-stone-900/20 active:scale-[0.98]"
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {locationLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                      Validando Localização...
                    </>
                  ) : (
                    <>
                      <LogOut size={24} />
                      Realizar Check-out
                    </>
                  )}
                </button>
              )
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8 md:space-y-12">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              <div className="bg-stone-50 p-4 md:p-6 rounded-2xl border border-stone-100">
                <span className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-stone-400 block mb-2">Visitas este mês</span>
                <div className="flex items-end gap-2">
                  <span className="text-3xl md:text-4xl font-sans text-stone-900">{currentMonthCheckins}</span>
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-bold mb-1",
                    diff >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(percentChange)}%
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 p-4 md:p-6 rounded-2xl border border-stone-100">
                <span className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-stone-400 block mb-2">Média Semanal</span>
                <span className="text-3xl md:text-4xl font-sans text-stone-900">
                  {(currentMonthCheckins / 4).toFixed(1)}
                </span>
              </div>

              <div className="bg-stone-50 p-4 md:p-6 rounded-2xl border border-stone-100">
                <span className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-stone-400 block mb-2">Score QDDO</span>
                <div className="flex items-end gap-2">
                  <span className="text-3xl md:text-4xl font-sans text-stone-900">{currentMonthCheckins * 10}</span>
                  <span className="text-xs font-bold text-stone-400 mb-1">pts</span>
                </div>
              </div>

              <div className="bg-stone-50 p-4 md:p-6 rounded-2xl border border-stone-100 col-span-2 md:col-span-1">
                <span className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-stone-400 block mb-2">Status Atual</span>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse shrink-0",
                    todayCheckin?.status === 'active' ? "bg-emerald-500" : "bg-stone-300"
                  )} />
                  <span className="font-bold text-stone-900 text-sm md:text-base">
                    {todayCheckin?.status === 'active' ? 'Presente no Espaço' : 'Ausente'}
                  </span>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xl md:text-2xl font-sans capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h4>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 md:gap-2">
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
                  const checkinDay = checkins.find(c => c.date === format(day, 'yyyy-MM-dd'));
                  return (
                    <div 
                      key={day.toString()}
                      className={cn(
                        "aspect-square rounded-2xl border flex flex-col items-center justify-center relative transition-all",
                        isToday(day) ? "border-stone-900 bg-stone-50" : "border-stone-100",
                        checkinDay ? "bg-emerald-50 border-emerald-100" : "hover:bg-stone-50"
                      )}
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        isToday(day) ? "text-stone-900 font-bold" : "text-stone-500",
                        checkinDay && "text-emerald-700"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {checkinDay && (
                        <CheckCircle2 size={14} className="text-emerald-500 mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'score' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-900 text-white rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-stone-900/20">
                <Trophy size={32} />
              </div>
              <h3 className="text-2xl md:text-4xl font-sans mb-3">Sistema de Score QDDO</h3>
              <p className="text-stone-500 text-sm md:text-base">Valorizamos sua presença e participação na nossa comunidade. Entenda como funciona nossa pontuação.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-3 text-stone-900">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold shrink-0">01</div>
                  <h4 className="font-sans text-lg md:text-xl">Descrição</h4>
                </div>
                <div className="bg-stone-50 p-5 md:p-8 rounded-[24px] md:rounded-[32px] border border-stone-100">
                  <p className="text-stone-600 leading-relaxed text-sm">
                    O Score QDDO é uma métrica de engajamento que recompensa os Founders que utilizam o espaço físico e participam ativamente do ecossistema.
                    É a sua "moeda de presença" dentro da nossa comunidade.
                  </p>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-3 text-stone-900">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold shrink-0">02</div>
                  <h4 className="font-sans text-lg md:text-xl">Regras</h4>
                </div>
                <div className="bg-stone-50 p-5 md:p-8 rounded-[24px] md:rounded-[32px] border border-stone-100">
                  <ul className="space-y-3">
                    {[
                      'Cada check-in diário vale 10 pontos.',
                      'O check-in deve ser realizado presencialmente.',
                      'Pontuação é zerada no início de cada mês.',
                      'Mínimo de 4 horas de permanência sugerida.'
                    ].map((rule, i) => (
                      <li key={i} className="flex gap-3 text-sm text-stone-600">
                        <span className="text-stone-900 font-bold">•</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-3 text-stone-900">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold shrink-0">03</div>
                  <h4 className="font-sans text-lg md:text-xl">Benefícios</h4>
                </div>
                <div className="bg-stone-50 p-5 md:p-8 rounded-[24px] md:rounded-[32px] border border-stone-100">
                  <ul className="space-y-3">
                    {[
                      'Prioridade na reserva de salas de reunião.',
                      'Acesso antecipado a eventos exclusivos.',
                      'Badges de destaque no perfil Founder.',
                      'Descontos em parceiros do ecossistema.'
                    ].map((benefit, i) => (
                      <li key={i} className="flex gap-3 text-sm text-stone-600">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 rounded-[24px] md:rounded-[32px] p-6 md:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-lg md:text-xl font-sans mb-1">Seu Score Atual</h4>
                <p className="text-stone-400 text-sm">Continue frequentando para subir no ranking!</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-4xl md:text-5xl font-sans">{currentMonthCheckins * 10}</span>
                <span className="text-stone-400 uppercase tracking-widest text-xs font-bold">Pontos Acumulados</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
