import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  User as UserIcon,
  LogOut,
  LogIn,
  Trophy,
  Users,
  Shield,
  MapPin,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
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
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string>(user.uid);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [todayFoundersCount, setTodayFoundersCount] = useState<number | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

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

  // Fetch count of unique founders present today
  useEffect(() => {
    const q = query(
      collection(db, 'checkins'),
      where('date', '==', todayStr)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const uniqueUsers = new Set(snapshot.docs.map(d => d.data().userId));
      setTodayFoundersCount(uniqueUsers.size);
    }, () => {
      setTodayFoundersCount(null);
    });
    return () => unsubscribe();
  }, [todayStr]);

  const todayCheckin = checkins.find(c => c.date === todayStr);

  const performCheckAction = async (isCheckin: boolean) => {
    setActionMessage(null);
    setLocationLoading(true);

    if (!navigator.geolocation) {
      setActionMessage({ type: 'error', text: 'Seu navegador não suporta geolocalização.' });
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistance(
          latitude, longitude,
          ULYSSES_LOCATION.lat, ULYSSES_LOCATION.lng
        );

        if (distance > ULYSSES_LOCATION.radius) {
          setActionMessage({ type: 'error', text: `Você está fora do perímetro permitido (${Math.round(distance)}m do local).` });
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
            setActionMessage({ type: 'success', text: 'Check-in realizado com sucesso!' });
          } else {
            if (todayCheckin) {
              await updateDoc(doc(db, 'checkins', todayCheckin.id), {
                checkoutTime: serverTimestamp(),
                status: 'completed'
              });
              setActionMessage({ type: 'success', text: 'Check-out realizado com sucesso!' });
            }
          }
          setTimeout(() => setActionMessage(null), 5000);
        } catch (error) {
          setActionMessage({ type: 'error', text: 'Erro ao salvar no banco de dados.' });
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        let msg = 'Erro ao obter localização.';
        if (error.code === error.PERMISSION_DENIED) msg = 'Permissão de localização negada.';
        else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Localização indisponível.';
        else if (error.code === error.TIMEOUT) msg = 'Tempo limite de localização esgotado.';
        setActionMessage({ type: 'error', text: msg });
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const checkinDays = useMemo(() => {
    return checkins.filter(c => {
      const d = parseISO(c.date);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });
  }, [checkins, monthStart, monthEnd]);

  const currentMonthCheckins = checkinDays.length;

  const prevMonthStart = startOfMonth(subMonths(currentMonth, 1));
  const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1));
  const prevMonthCheckins = checkins.filter(c => {
    const d = parseISO(c.date);
    return isWithinInterval(d, { start: prevMonthStart, end: prevMonthEnd });
  }).length;

  const diff = currentMonthCheckins - prevMonthCheckins;
  const percentChange = prevMonthCheckins === 0 ? 100 : Math.round((diff / prevMonthCheckins) * 100);

  const checkinStatus = todayCheckin?.status === 'active'
    ? 'present'
    : todayCheckin?.status === 'completed'
      ? 'completed'
      : 'absent';

  return (
    <div className="space-y-3 animate-in fade-in duration-500">

      {/* Admin User Selector */}
      {isAdmin && (
        <div className="bg-white px-4 py-2.5 rounded-xl border border-stone-200 flex items-center gap-3">
          <UserIcon size={16} className="text-stone-400 shrink-0" />
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="bg-transparent border-none focus:ring-0 font-bold text-stone-900 flex-1 text-sm"
          >
            <option value={user.uid}>Meu Calendário ({user.displayName || 'Eu'})</option>
            {founders.map(f => (
              <option key={f.id} value={f.id}>{f.name} (@{f.username})</option>
            ))}
          </select>
        </div>
      )}

      {/* Global action feedback */}
      {actionMessage && (
        <div className={cn(
          "px-4 py-2.5 rounded-xl border animate-in fade-in zoom-in-95 duration-300 flex items-center gap-2",
          actionMessage.type === 'success'
            ? "bg-emerald-50 border-emerald-100"
            : "bg-rose-50 border-rose-100"
        )}>
          {actionMessage.type === 'success'
            ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            : <MapPin size={15} className="text-rose-500 shrink-0" />
          }
          <p className={cn(
            "font-bold text-xs",
            actionMessage.type === 'success' ? "text-emerald-700" : "text-rose-700"
          )}>
            {actionMessage.text}
          </p>
        </div>
      )}

      {/* Main layout: left dashboard + right actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">

        {/* ── LEFT: Dashboard ── */}
        <div className="space-y-3">

          {/* Metrics grid — 3 colunas, 2 linhas */}
          <div className="grid grid-cols-3 gap-2">

            {/* Visitas este mês */}
            <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">
                Visitas este mês
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-stone-900">{currentMonthCheckins}</span>
                <div className={cn(
                  "flex items-center gap-0.5 text-[9px] font-bold",
                  diff >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {diff >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {Math.abs(percentChange)}%
                </div>
              </div>
              <span className="text-[9px] text-stone-400 leading-none">vs. mês anterior</span>
            </div>

            {/* Média semanal */}
            <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">
                Média Semanal
              </span>
              <span className="text-xl font-bold text-stone-900 block">
                {(currentMonthCheckins / 4).toFixed(1)}
              </span>
              <span className="text-[9px] text-stone-400 leading-none">visitas / semana</span>
            </div>

            {/* Score QDDO */}
            <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">
                Score QDDO
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-bold text-stone-900">{currentMonthCheckins * 10}</span>
                <span className="text-[10px] font-bold text-stone-400">pts</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Trophy size={9} className="text-amber-500" />
                <span className="text-[9px] text-stone-400 leading-none">acumulados</span>
              </div>
            </div>

            {/* Founders no QDDO hoje */}
            <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">
                No QDDO hoje
              </span>
              <span className="text-xl font-bold text-stone-900 block">
                {todayFoundersCount !== null ? todayFoundersCount : '—'}
              </span>
              <div className="flex items-center gap-0.5">
                <Users size={9} className="text-stone-400" />
                <span className="text-[9px] text-stone-400 leading-none">founders</span>
              </div>
            </div>

            {/* Nível de acesso */}
            <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">
                Nível de Acesso
              </span>
              <div className="flex items-center gap-1 mt-1">
                <Shield size={13} className={isAdmin ? "text-primary" : "text-stone-400"} />
                <span className="text-sm font-bold text-stone-900">
                  {isAdmin ? 'Admin' : 'Founder'}
                </span>
              </div>
            </div>

            {/* Status atual */}
            <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">
                Status Atual
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  checkinStatus === 'present'
                    ? "bg-emerald-500 animate-pulse"
                    : checkinStatus === 'completed'
                      ? "bg-blue-400"
                      : "bg-stone-300"
                )} />
                <span className="text-sm font-bold text-stone-900">
                  {checkinStatus === 'present' ? 'Presente' : checkinStatus === 'completed' ? 'Saiu' : 'Ausente'}
                </span>
              </div>
              {todayCheckin?.checkinTime?.toDate && (
                <span className="text-[9px] text-stone-400 leading-none">
                  Entrada {format(todayCheckin.checkinTime.toDate(), 'HH:mm')}
                </span>
              )}
            </div>
          </div>

          {/* Calendário de frequência */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-stone-900 capitalize text-sm">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h4>
              <div className="flex gap-0.5">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-1 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                <div key={i} className="text-center text-[9px] font-bold uppercase text-stone-400 py-0.5">
                  {day}
                </div>
              ))}

              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-[4/3]" />
              ))}

              {daysInMonth.map(day => {
                const checkinDay = checkins.find(c => c.date === format(day, 'yyyy-MM-dd'));
                return (
                  <div
                    key={day.toString()}
                    className={cn(
                      "aspect-[4/3] rounded border flex items-center justify-center transition-all",
                      isToday(day) ? "border-primary bg-orange-50" : "border-stone-100",
                      checkinDay ? "bg-emerald-50 border-emerald-200" : "hover:bg-stone-50"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] font-medium leading-none",
                      isToday(day) ? "text-primary font-bold" : "text-stone-500",
                      checkinDay && "text-emerald-700 font-bold"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Ações ── */}
        <div className="flex flex-col gap-3 h-full">

          {/* Container Check-in */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col items-center text-center justify-center gap-4 flex-1">
            <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
              <LogIn size={20} className="text-stone-900" />
            </div>

            <div>
              <h3 className="font-bold text-base text-stone-900 mb-0.5">Check-in</h3>
              <p className="text-stone-400 text-xs">Registre sua chegada no QDDO.</p>
            </div>

            {todayCheckin ? (
              <div className="w-full px-3 py-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-1.5 text-xs">
                  <CheckCircle2 size={14} />
                  Chegou às {todayCheckin.checkinTime?.toDate
                    ? format(todayCheckin.checkinTime.toDate(), 'HH:mm')
                    : '...'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => performCheckAction(true)}
                disabled={locationLoading}
                className={cn(
                  "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm",
                  locationLoading
                    ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20 active:scale-[0.98]"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {locationLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    Fazer Check-in
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-1 text-[10px] text-stone-400">
              <MapPin size={10} />
              <span>Presença validada por GPS</span>
            </div>
          </div>

          {/* Container Check-out */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col items-center text-center justify-center gap-4 flex-1">
            <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
              <LogOut size={20} className="text-stone-900" />
            </div>

            <div>
              <h3 className="font-bold text-base text-stone-900 mb-0.5">Check-out</h3>
              <p className="text-stone-400 text-xs">Registre sua saída do QDDO.</p>
            </div>

            {!todayCheckin ? (
              <div className="w-full px-3 py-2.5 bg-stone-50 rounded-lg border border-stone-100">
                <p className="text-stone-400 text-xs">Realize o check-in primeiro.</p>
              </div>
            ) : todayCheckin.status === 'completed' ? (
              <div className="w-full px-3 py-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-1.5 text-xs">
                  <CheckCircle2 size={14} />
                  Saiu às {todayCheckin.checkoutTime?.toDate
                    ? format(todayCheckin.checkoutTime.toDate(), 'HH:mm')
                    : '...'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => performCheckAction(false)}
                disabled={locationLoading}
                className={cn(
                  "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm",
                  locationLoading
                    ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                    : "bg-stone-900 text-white hover:bg-stone-800 shadow-md shadow-stone-900/20 active:scale-[0.98]"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {locationLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <LogOut size={15} />
                    Fazer Check-out
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-1 text-[10px] text-stone-400">
              <MapPin size={10} />
              <span>Presença validada por GPS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
