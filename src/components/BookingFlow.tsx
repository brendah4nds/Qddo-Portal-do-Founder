import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { 
  format, 
  addDays, 
  addMinutes,
  startOfDay, 
  isSameDay, 
  parse, 
  isBefore,
  startOfToday,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  isSameMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User as UserIcon,
  Mail,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DoorOpen as RoomIcon,
  Calendar as CalendarIcon,
  Clock,
  Download
} from 'lucide-react';
import { Room, Booking, BookingStatus } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isBlockedDay } from '../utils/holidays';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function BookingFlow({ 
  rooms, 
  bookings, 
  businessHours,
  selectedRoomId, 
  setSelectedRoomId,
  selectedDate,
  setSelectedDate,
  status,
  setStatus,
  activeSubTab,
  onStepChange
}: {
  rooms: Room[];
  bookings: Booking[];
  businessHours: string[];
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  status: BookingStatus;
  setStatus: (s: BookingStatus) => void;
  activeSubTab?: string;
  onStepChange?: (step: number) => void;
}) {
  const [step, setStep] = useState(1);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: '', email: '', linkGoogleCalendar: false });
  const [showAllBookings, setShowAllBookings] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState<{
    roomName: string;
    date: Date;
    times: string[];
    addToCalendar: boolean;
  } | null>(null);

  // Sync internal step with external activeSubTab
  useEffect(() => {
    if (activeSubTab) {
      const subTabs = ['escolha-sala', 'escolha-data', 'escolha-horario'];
      const newStep = subTabs.indexOf(activeSubTab) + 1;
      if (newStep > 0 && newStep !== step) {
        setStep(newStep);
      }
    }
  }, [activeSubTab]);

  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(step);
  }, [step]);

  // Reset step if room is unselected (e.g. via nav)
  useEffect(() => {
    if (!selectedRoomId) setStep(1);
    else if (step === 1) setStep(2);
  }, [selectedRoomId]);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  const buildGoogleCalendarUrl = (roomName: string, date: Date, sortedTimes: string[]) => {
    const startDate = parse(sortedTimes[0], 'HH:mm', date);
    const endDate = addMinutes(parse(sortedTimes[sortedTimes.length - 1], 'HH:mm', date), 30);
    const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Reserva - ${roomName}`,
      dates: `${fmt(startDate)}/${fmt(endDate)}`,
      details: `Reserva confirmada no Portal do Founder\nSala: ${roomName}\nHorário: ${sortedTimes[0]} – ${format(endDate, 'HH:mm')}`,
      location: 'Portal do Founder',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const downloadICS = (roomName: string, date: Date, sortedTimes: string[]) => {
    const startDate = parse(sortedTimes[0], 'HH:mm', date);
    const endDate = addMinutes(parse(sortedTimes[sortedTimes.length - 1], 'HH:mm', date), 30);
    const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Portal do Founder//Reserva de Sala//PT',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(startDate)}`,
      `DTEND:${fmt(endDate)}`,
      `SUMMARY:Reserva - ${roomName}`,
      `DESCRIPTION:Reserva confirmada no Portal do Founder\\nSala: ${roomName}\\nHorário: ${sortedTimes[0]} – ${format(endDate, 'HH:mm')}`,
      'LOCATION:Portal do Founder',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reserva-${roomName.toLowerCase().replace(/\s+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const roomBookings = useMemo(() => {
    return bookings.filter(b => b.roomId === selectedRoomId && b.date === format(selectedDate, 'yyyy-MM-dd'));
  }, [bookings, selectedRoomId, selectedDate]);

  const isSlotTaken = (time: string) => {
    return roomBookings.some(b => b.startTime === time);
  };

  const isSlotPast = (time: string) => {
    if (!isSameDay(selectedDate, startOfToday())) return false;
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    return isBefore(slotTime, now);
  };

  const toggleTime = (time: string) => {
    setSelectedTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time) 
        : [...prev, time].sort()
    );
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || selectedTimes.length === 0 || !formData.name || !formData.email) return;

    setStatus('loading');
    try {
      // Create a booking for each selected 30-min slot
      const bookingPromises = selectedTimes.map(time => {
        const start = parse(time, 'HH:mm', new Date());
        const end = addMinutes(start, 30);
        
        return api.post('/api/bookings', {
          roomId: selectedRoomId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          startTime: time,
          endTime: format(end, 'HH:mm'),
          userName: formData.name,
          userEmail: formData.email,
        });
      });

      await Promise.all(bookingPromises);

      const roomName = selectedRoom?.name || 'Sala';
      const sortedTimes = [...selectedTimes].sort();

      if (formData.linkGoogleCalendar) {
        const gcalUrl = buildGoogleCalendarUrl(roomName, selectedDate, sortedTimes);
        window.open(gcalUrl, '_blank', 'noopener,noreferrer');
      }

      setBookingConfirmation({
        roomName,
        date: selectedDate,
        times: [...selectedTimes],
        addToCalendar: formData.linkGoogleCalendar,
      });
      setStatus('success');
      setFormData({ name: '', email: '', linkGoogleCalendar: false });
      setSelectedTimes([]);
      setStep(1);
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  if (status === 'success' && bookingConfirmation) {
    const { roomName, date, times, addToCalendar } = bookingConfirmation;
    const sortedTimes = [...times].sort();
    const endTime = format(addMinutes(parse(sortedTimes[sortedTimes.length - 1], 'HH:mm', date), 30), 'HH:mm');

    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white rounded-xl shadow-sm border border-stone-100 p-12">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-h2 font-sans mb-2">Agendamento Confirmado!</h2>
        <p className="text-stone-500 mb-1">Sua reserva para a <strong>{roomName}</strong> foi realizada com sucesso.</p>
        <p className="text-stone-400 text-sm mb-8">
          {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} &bull; {sortedTimes[0]} – {endTime}
        </p>

        {addToCalendar && (
          <div className="space-y-3 mb-6">
            <a
              href={buildGoogleCalendarUrl(roomName, date, sortedTimes)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full bg-[#4285F4] text-white py-4 rounded-md font-semibold hover:bg-[#3b78e7] transition-all"
            >
              <CalendarIcon size={20} />
              Adicionar ao Google Agenda
            </a>
            <button
              onClick={() => downloadICS(roomName, date, sortedTimes)}
              className="flex items-center justify-center gap-3 w-full bg-stone-100 text-stone-700 py-4 rounded-md font-semibold hover:bg-stone-200 transition-all"
            >
              <Download size={20} />
              Baixar arquivo .ics (outros calendários)
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setStatus('idle');
            setSelectedRoomId(null);
            setStep(1);
            setBookingConfirmation(null);
          }}
          className="w-full bg-primary text-white py-4 rounded-md font-semibold hover:bg-primary/90 transition-all"
        >
          Fazer outro agendamento
        </button>
      </div>
    );
  }

  const steps = [
    { id: 1, title: 'Seleção da Sala' },
    { id: 2, title: 'Data / Calendário' },
    { id: 3, title: 'Horário e Dados' }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4 mb-12">
        {[
          { id: 1, label: 'Escolha a sala' },
          { id: 2, label: 'Escolha a data' },
          { id: 3, label: 'Escolha o horário' }
        ].map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                step >= s.id ? "bg-primary text-white shadow-lg shadow-primary/10" : "bg-stone-100 text-stone-400"
              )}>
                {s.id}
              </div>
              <span className={cn(
                "text-xs uppercase tracking-widest font-bold transition-all",
                step >= s.id ? "text-stone-900" : "text-stone-300"
              )}>
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <div className={cn(
                "w-8 h-[1px] transition-all",
                step > s.id ? "bg-primary" : "bg-stone-100"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-4">
        {/* Step 1: Room Selection */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-base sm:text-h1 font-sans mb-4 sm:mb-8 text-center">Qual sala você deseja reservar?</h2>
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-6">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    window.history.pushState({}, '', `/sala/${room.id}`);
                    setStep(2);
                  }}
                  className="rounded-xl border border-stone-200 bg-white text-left transition-all hover:border-stone-400 hover:shadow-xl hover:-translate-y-1 group overflow-hidden flex flex-row sm:flex-col"
                >
                  <div className="w-24 h-20 flex-shrink-0 sm:w-full sm:h-44 bg-stone-100 overflow-hidden">
                    {room.imageUrl ? (
                      <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <RoomIcon size={28} className="text-stone-300 sm:hidden" />
                        <RoomIcon size={40} className="text-stone-300 hidden sm:block" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-6 flex flex-col flex-1 justify-center">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg bg-stone-100 flex items-center justify-center mb-2 sm:mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <RoomIcon size={14} className="sm:hidden" />
                      <RoomIcon size={20} className="hidden sm:block" />
                    </div>
                    <h3 className="font-sans text-sm sm:text-h3 leading-tight mb-1 sm:mb-2">{room.name}</h3>
                    <p className="text-xs text-stone-400 line-clamp-2 sm:line-clamp-none">{room.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {(() => {
              const today = startOfToday();
              const thisMonthBookings = [...bookings]
                .filter(b => isSameMonth(parse(b.date, 'yyyy-MM-dd', new Date()), today))
                .sort((a, b) => {
                  const dtA = `${a.date} ${a.startTime}`;
                  const dtB = `${b.date} ${b.startTime}`;
                  return dtB.localeCompare(dtA);
                });

              if (thisMonthBookings.length === 0) return null;

              const LIMIT = 5;
              const visible = showAllBookings ? thisMonthBookings : thisMonthBookings.slice(0, LIMIT);
              const hasMore = thisMonthBookings.length > LIMIT;

              return (
                <div className="mt-10">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-4">Agendamentos do Mês</h3>
                  <div className="bg-white rounded-xl border border-stone-200 shadow-sm divide-y divide-stone-100 overflow-hidden">
                    {visible.map(booking => {
                      const room = rooms.find(r => r.id === booking.roomId);
                      return (
                        <div key={booking.id} className="flex items-center gap-4 p-4">
                          <div className="w-10 h-10 rounded-lg bg-stone-50 flex items-center justify-center flex-shrink-0">
                            <CalendarIcon size={18} className="text-stone-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-sm font-bold text-stone-800 truncate">{room?.name || 'Sala'}</p>
                            <p className="text-xs text-stone-400 truncate">
                              {format(parse(booking.date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-stone-400">{booking.userName}</p>
                          </div>
                          <div className="flex items-center gap-1 text-xs font-medium text-stone-500 flex-shrink-0">
                            <Clock size={12} className="text-stone-300" />
                            {booking.startTime} – {booking.endTime}
                          </div>
                        </div>
                      );
                    })}

                    {hasMore && (
                      <button
                        onClick={() => setShowAllBookings(prev => !prev)}
                        className="w-full py-3 text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors"
                      >
                        {showAllBookings ? 'Ver menos' : `Ver mais (${thisMonthBookings.length - LIMIT} restantes)`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Step 2: Date Selection */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => setStep(1)}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-h1 font-sans">Escolha a data para {selectedRoom?.name}</h2>
            </div>
            
            <div className="bg-white rounded-xl p-8 border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-sans text-h3">{format(selectedDate, "MMMM yyyy", { locale: ptBR })}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedDate(addMonths(selectedDate, -1))} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => setSelectedDate(addMonths(selectedDate, 1))} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-3">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                  <div key={d} className="text-center text-overline font-bold text-stone-300 py-2">{d}</div>
                ))}
                {(() => {
                  const mStart = startOfMonth(selectedDate);
                  const mEnd = endOfMonth(selectedDate);
                  const startDate = startOfWeek(mStart, { weekStartsOn: 0 });
                  const endDate = endOfWeek(mEnd, { weekStartsOn: 0 });
                  const days = eachDayOfInterval({ start: startDate, end: endDate });

                  return days.map((date) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const isPast = isBefore(date, startOfToday());
                    const isBlocked = isBlockedDay(date);
                    const currentMonth = isSameMonth(date, selectedDate);
                    const isDisabled = isPast || isBlocked || !currentMonth;
                    
                    return (
                      <button
                        key={date.toISOString()}
                        disabled={isDisabled}
                        onClick={() => {
                          setSelectedDate(date);
                          setStep(3);
                        }}
                        className={cn(
                          "aspect-square flex flex-col items-center justify-center rounded-lg transition-all",
                          isSelected ? "bg-primary text-white shadow-md" : "hover:bg-stone-50",
                          isDisabled ? "opacity-20 cursor-not-allowed" : "",
                          !currentMonth ? "invisible" : ""
                        )}
                      >
                        <span className="text-sm font-bold">{format(date, 'd')}</span>
                        {isBlocked && !isPast && currentMonth && <span className="text-overline uppercase font-bold text-stone-400">Bloqueado</span>}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Time & Form */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => setStep(2)}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <div>
                <h2 className="text-h1 font-sans">Finalize seu agendamento</h2>
                <p className="text-stone-500 text-sm">{selectedRoom?.name} • {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <label className="text-xs uppercase tracking-widest font-bold text-stone-400 block">Selecione os Horários</label>
                {selectedTimes.length > 0 && (
                  <button 
                    onClick={() => setSelectedTimes([])}
                    className="text-overline uppercase font-bold text-red-500 hover:text-red-700"
                  >
                    Limpar Seleção ({selectedTimes.length})
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-10">
                {businessHours.map(time => {
                  const taken = isSlotTaken(time);
                  const past = isSlotPast(time);
                  const disabled = taken || past;
                  const isSelected = selectedTimes.includes(time);
                  
                  return (
                    <button
                      key={time}
                      disabled={disabled}
                      onClick={() => toggleTime(time)}
                      className={cn(
                        "py-4 rounded-lg border text-sm font-bold transition-all flex flex-col items-center justify-center",
                        isSelected 
                          ? "bg-primary border-primary text-white shadow-lg" 
                          : disabled 
                            ? "bg-stone-50 border-stone-100 text-stone-300 cursor-not-allowed" 
                            : "border-stone-200 hover:border-stone-400"
                      )}
                    >
                      {time}
                      {past && !taken && <div className="text-overline uppercase opacity-50">Passado</div>}
                      {taken && <div className="text-overline uppercase opacity-50">Ocupado</div>}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleBooking} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
                    <input 
                      required
                      type="text" 
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-12 pr-4 py-5 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
                    <input
                      required
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-12 pr-4 py-5 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={formData.linkGoogleCalendar}
                    onChange={e => setFormData({ ...formData, linkGoogleCalendar: e.target.checked })}
                  />
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all pointer-events-none",
                    formData.linkGoogleCalendar
                      ? "bg-primary border-primary"
                      : "border-stone-200 bg-white group-hover:border-stone-400"
                  )}>
                    {formData.linkGoogleCalendar && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-stone-600">Deseja vincular ao Google Agenda?</span>
                </label>

                <button 
                  type="submit"
                  disabled={selectedTimes.length === 0 || status === 'loading'}
                  className="w-full bg-primary text-white py-5 rounded-lg font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-8 shadow-xl shadow-primary/20 text-lg"
                >
                  {status === 'loading' ? 'Processando...' : `Confirmar Reserva (${selectedTimes.length} ${selectedTimes.length === 1 ? 'horário' : 'horários'})`}
                </button>
              </form>

              {status === 'error' && (
                <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3 text-sm font-medium">
                  <AlertCircle size={20} />
                  <span>Ocorreu um erro. Verifique os dados e tente novamente.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
