import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';
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
  X,
} from 'lucide-react';
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
  date: string;
  checkinTime: any;
  checkoutTime?: any;
  status: 'active' | 'completed';
}

const ULYSSES_LOCATION = {
  lat: -15.789209930873332,
  lng: -47.90071054840695,
  radius: 300
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
  user: any;
  isAdmin: boolean;
  founders?: any[];
}) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string>(user._id);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [presentUserIds, setPresentUserIds] = useState<string[] | null>(null);
  const [showPresentModal, setShowPresentModal] = useState(false);
  const [selectedFounderMonthlyPoints, setSelectedFounderMonthlyPoints] = useState<number>(0);

  // Use native JS local-date methods — format() uses UTC on some environments
  const getLocalDateStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [todayStr, setTodayStr] = useState(() => getLocalDateStr());

  // Load checkins for selected user + real-time updates
  useEffect(() => {
    setLoading(true);
    api.get('/api/checkins', { params: { userId: selectedUserId } })
      .then(r => {
        const data = r.data.map((c: any) => ({ ...c, id: c._id || c.id }));
        setCheckins(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const socket = getSocket();
    const onNew = (c: any) => {
      const norm = { ...c, id: c._id || c.id };
      if (norm.userId === selectedUserId || norm.userId?._id === selectedUserId || norm.userId?.toString() === selectedUserId) {
        setCheckins(prev => [...prev, norm]);
      }
      if (norm.date === todayStr) {
        const uid = norm.userId?.toString?.() || norm.userId;
        setPresentUserIds(prev => {
          const list = prev ?? [];
          return list.includes(uid) ? list : [...list, uid];
        });
      }
    };
    const onUpdate = (c: any) => {
      const norm = { ...c, id: c._id || c.id };
      setCheckins(prev => prev.map(x => x.id === norm.id ? norm : x));
    };
    socket.on('checkin:new', onNew);
    socket.on('checkin:update', onUpdate);
    return () => {
      socket.off('checkin:new', onNew);
      socket.off('checkin:update', onUpdate);
    };
  }, [selectedUserId]);

  // Load selected founder's points + real-time updates
  useEffect(() => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyPointsOf = (f: any) => f?.monthlyPoints?.[currentYM] ?? f?.monthlyPoints?.get?.(currentYM) ?? 0;

    api.get(`/api/founders/${selectedUserId}`)
      .then(r => setSelectedFounderMonthlyPoints(monthlyPointsOf(r.data)))
      .catch(() => {});

    const socket = getSocket();
    const onUpdate = (f: any) => {
      const fId = f._id || f.id;
      if (fId === selectedUserId) setSelectedFounderMonthlyPoints(monthlyPointsOf(f));
    };
    socket.on('founder:update', onUpdate);
    return () => { socket.off('founder:update', onUpdate); };
  }, [selectedUserId]);

  // Midnight: auto-checkout active check-in and roll todayStr to the new date
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const timer = setTimeout(async () => {
      const activeCheckin = checkins.find(c => c.status === 'active');
      if (activeCheckin) {
        try { await api.put(`/api/checkins/${activeCheckin.id}/checkout`); } catch {}
      }
      setTodayStr(getLocalDateStr());
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [checkins]);

  // Load today's present users (who checked in today)
  useEffect(() => {
    api.get('/api/checkins', { params: { date: todayStr } })
      .then(r => {
        const uniqueUsers = Array.from(new Set(r.data.map((c: any) => c.userId?.toString?.() || c.userId)));
        setPresentUserIds(uniqueUsers);
      })
      .catch(() => setPresentUserIds(null));
  }, [todayStr]);

  const todayFoundersCount = presentUserIds !== null ? presentUserIds.length : null;

  const founderById = useMemo(() => {
    const map = new Map<string, any>();
    founders.forEach(f => map.set(String(f._id || f.id), f));
    map.set(String(user._id), user);
    return map;
  }, [founders, user]);

  const presentFounders = useMemo(() => {
    return (presentUserIds ?? [])
      .map(id => founderById.get(String(id)) || { _id: id, name: null, username: null })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }, [presentUserIds, founderById]);

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
            const { data: checkinRes } = await api.post('/api/checkins', { date: todayStr });

            // Pontos são calculados e gravados atomicamente pelo backend
            // (ver POST /api/checkins) — não recalcular nem gravar aqui,
            // isso já causou dessincronia com totalPoints/monthlyPoints.
            const pointsEarned = checkinRes?.pointsEarned ?? 10;
            const bonusPoints = checkinRes?.bonus ?? 0;

            const successMsg = bonusPoints > 0
              ? `Check-in realizado! +${pointsEarned} pts (bônus streak semanal)`
              : `Check-in realizado! +${pointsEarned} pts`;
            setActionMessage({ type: 'success', text: successMsg });
          } else {
            if (todayCheckin) {
              await api.put(`/api/checkins/${todayCheckin.id}/checkout`);
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

  const sortedFounders = useMemo(() => {
    return [...founders].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }, [founders]);

  const checkinStatus = todayCheckin?.status === 'active'
    ? 'present'
    : todayCheckin?.status === 'completed'
      ? 'completed'
      : 'absent';

  return (
    <div className="space-y-3 animate-in fade-in duration-500 w-full">

      {/* Admin User Selector */}
      {isAdmin && (
        <div className="bg-white px-4 py-2.5 rounded-xl border border-stone-200 flex items-center gap-3">
          <UserIcon size={16} className="text-stone-400 shrink-0" />
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="bg-transparent border-none focus:ring-0 font-bold text-stone-900 flex-1 text-sm"
          >
            <option value={user._id}>Meu Calendário ({user.name || user.displayName || 'Eu'})</option>
            {sortedFounders.map(f => (
              <option key={f._id || f.id} value={f._id || f.id}>{f.name} (@{f.username})</option>
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

      {/* Main layout */}
      <div className="space-y-3">

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

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

            <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">
                Média Semanal
              </span>
              <span className="text-xl font-bold text-stone-900 block">
                {(currentMonthCheckins / 4).toFixed(1)}
              </span>
              <span className="text-[9px] text-stone-400 leading-none">visitas / semana</span>
            </div>

            <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">
                Score QDDO
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-bold text-stone-900">{selectedFounderMonthlyPoints}</span>
                <span className="text-[10px] font-bold text-stone-400">pts</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Trophy size={9} className="text-amber-500" />
                <span className="text-[9px] text-stone-400 leading-none">neste mês</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPresentModal(true)}
              className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm text-left cursor-pointer hover:border-stone-300 hover:shadow-md transition-all"
            >
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
            </button>

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
              {todayCheckin?.checkinTime && (
                <span className="text-[9px] text-stone-400 leading-none">
                  Entrada {format(new Date(todayCheckin.checkinTime), 'HH:mm')}
                </span>
              )}
            </div>
          </div>

          {/* Check-in + Check-out side by side */}
          <div className="grid grid-cols-2 gap-3">

          {/* Container Check-in */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-3 flex flex-col items-center text-center justify-center gap-2">
            <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center">
              <LogIn size={16} className="text-stone-900" />
            </div>

            <h3 className="font-bold text-sm text-stone-900">Check-in</h3>

            {todayCheckin ? (
              <div className="w-full px-2 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-1 text-xs">
                  <CheckCircle2 size={12} />
                  Chegou às {todayCheckin.checkinTime
                    ? format(new Date(todayCheckin.checkinTime), 'HH:mm')
                    : '...'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => performCheckAction(true)}
                disabled={locationLoading}
                className={cn(
                  "w-full py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs",
                  locationLoading
                    ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20 active:scale-[0.98]"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {locationLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <LogIn size={13} />
                    Fazer Check-in
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-1 text-[9px] text-stone-400">
              <MapPin size={9} />
              <span>Validado por GPS</span>
            </div>
          </div>

          {/* Container Check-out */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-3 flex flex-col items-center text-center justify-center gap-2">
            <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center">
              <LogOut size={16} className="text-stone-900" />
            </div>

            <h3 className="font-bold text-sm text-stone-900">Check-out</h3>

            {!todayCheckin ? (
              <div className="w-full px-2 py-1.5 bg-stone-50 rounded-lg border border-stone-100">
                <p className="text-stone-400 text-xs">Faça o check-in primeiro.</p>
              </div>
            ) : todayCheckin.status === 'completed' ? (
              <div className="w-full px-2 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-emerald-700 font-bold flex items-center justify-center gap-1 text-xs">
                  <CheckCircle2 size={12} />
                  Saiu às {todayCheckin.checkoutTime
                    ? format(new Date(todayCheckin.checkoutTime), 'HH:mm')
                    : '...'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => performCheckAction(false)}
                disabled={locationLoading}
                className={cn(
                  "w-full py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs",
                  locationLoading
                    ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                    : "bg-stone-900 text-white hover:bg-stone-800 shadow-md shadow-stone-900/20 active:scale-[0.98]"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {locationLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <LogOut size={13} />
                    Fazer Check-out
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-1 text-[9px] text-stone-400">
              <MapPin size={9} />
              <span>Validado por GPS</span>
            </div>
          </div>

          </div>{/* end check-in/out grid */}

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

      {/* Present founders modal */}
      {showPresentModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          onClick={() => setShowPresentModal(false)}
        >
          <div
            className="bg-white rounded-xl p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                <Users size={14} className="text-primary" />
                No QDDO hoje ({presentFounders.length})
              </h3>
              <button
                onClick={() => setShowPresentModal(false)}
                className="p-1 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X size={16} className="text-stone-400" />
              </button>
            </div>

            {presentFounders.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">Ninguém fez check-in hoje ainda.</p>
            ) : (
              <ul className="space-y-1 overflow-y-auto">
                {presentFounders.map(f => (
                  <li
                    key={f._id || f.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-stone-50"
                  >
                    {f.photoURL ? (
                      <img src={f.photoURL} alt={f.name || 'Founder'} className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                        <UserIcon size={13} className="text-stone-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-900 truncate">{f.name || 'Founder'}</p>
                      {f.username && (
                        <p className="text-[10px] text-stone-400 truncate">@{f.username}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
