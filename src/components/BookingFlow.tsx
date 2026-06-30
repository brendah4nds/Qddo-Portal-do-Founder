import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import { ImageCropModal } from './ImageCropModal';
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
  Download,
  Plus,
  Image as ImageIcon,
  X,
  Settings,
  Trash2
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { Room, Booking, BookingStatus } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isBlockedDay } from '../utils/holidays';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_BUSINESS_HOURS = Array.from({ length: 21 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

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
  onStepChange,
  isAdmin,
  onRoomUpdate
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
  isAdmin?: boolean;
  onRoomUpdate?: (roomId: string, updates: Partial<Room>) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [showAllBookings, setShowAllBookings] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState<{
    roomName: string;
    date: Date;
    times: string[];
  } | null>(null);
  const [openDropdownRoomId, setOpenDropdownRoomId] = useState<string | null>(null);
  const [editPhotoRoomId, setEditPhotoRoomId] = useState<string | null>(null);
  const [editPhotoLoading, setEditPhotoLoading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingImageFileName, setPendingImageFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsNewHour, setSettingsNewHour] = useState('');
  const [settingsConfirmModal, setSettingsConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', onConfirm: () => {} });

  const handleSettingsAddHour = async () => {
    if (!settingsNewHour.match(/^\d{2}:\d{2}$/)) return;
    const updated = [...businessHours, settingsNewHour].sort();
    await api.put('/api/settings/global', { businessHours: updated });
    setSettingsNewHour('');
  };

  const handleSettingsRemoveHour = async (hour: string) => {
    const updated = businessHours.filter(h => h !== hour);
    await api.put('/api/settings/global', { businessHours: updated });
  };

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

  useEffect(() => {
    if (!openDropdownRoomId) return;
    const handler = () => setOpenDropdownRoomId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openDropdownRoomId]);

  const handleRoomImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      alert('Apenas imagens são permitidas.');
      return;
    }
    setPendingImageFileName(file.name);
    setCropImageSrc(URL.createObjectURL(file));
  };

  const handleRoomCropConfirm = async (blob: Blob) => {
    setCropImageSrc(null);
    if (!editPhotoRoomId) return;
    setEditPhotoLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, pendingImageFileName || 'room-cover.jpg');
      const { data } = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await onRoomUpdate?.(editPhotoRoomId, { imageUrl: data.url });
      setEditPhotoRoomId(null);
    } catch {
      alert('Erro ao enviar imagem.');
    } finally {
      setEditPhotoLoading(false);
    }
  };

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

      setBookingConfirmation({
        roomName,
        date: selectedDate,
        times: [...selectedTimes],
      });
      setStatus('success');
      setFormData({ name: '', email: '' });
      setSelectedTimes([]);
      setStep(1);
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  if (status === 'success' && bookingConfirmation) {
    const { roomName, date, times } = bookingConfirmation;
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
    <>
    <div className="max-w-4xl mx-auto relative">
      {/* Settings button — admin only */}
      {isAdmin && (
        <button
          onClick={() => setShowSettingsModal(true)}
          className="absolute top-0 right-0 p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all z-10"
          title="Configurações de Agendamento"
        >
          <Settings size={20} />
        </button>
      )}

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
                <div key={room.id} className="relative">
                  <button
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      window.history.pushState({}, '', `/sala/${room.id}`);
                      setStep(2);
                    }}
                    className="w-full rounded-xl border border-stone-100 bg-white text-left transition-all hover:border-stone-400 hover:shadow-xl hover:-translate-y-1 group overflow-hidden flex flex-row sm:flex-col"
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

                  {isAdmin && (
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownRoomId(openDropdownRoomId === room.id ? null : room.id);
                        }}
                        className="w-7 h-7 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-500 hover:text-stone-900 hover:border-stone-400 transition-all"
                        title="Opções da sala"
                      >
                        <Plus size={14} />
                      </button>
                      {openDropdownRoomId === room.id && (
                        <div
                          className="absolute top-9 right-0 bg-white border border-stone-100 rounded-xl shadow-xl py-1 min-w-[160px] z-20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setEditPhotoRoomId(room.id);
                              setOpenDropdownRoomId(null);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-3 rounded-xl"
                          >
                            <ImageIcon size={15} className="text-stone-400" />
                            Editar foto
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                  <div className="bg-white rounded-xl border border-stone-100 shadow-sm divide-y divide-stone-100 overflow-hidden">
                    {visible.map(booking => {
                      const room = rooms.find(r => r.id === booking.roomId);
                      return (
                        <div key={booking.id} className="flex items-center gap-4 p-4">
                          <div className="w-10 h-10 rounded-lg bg-stone-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {room?.imageUrl ? (
                              <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                            ) : (
                              <CalendarIcon size={18} className="text-stone-300" />
                            )}
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
            
            <div className="bg-white rounded-xl p-8 border border-stone-100 shadow-sm">
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

            <div className="bg-white rounded-xl p-8 border border-stone-100 shadow-sm">
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

    {editPhotoRoomId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-sans text-h3">Editar Foto da Sala</h3>
            <button
              onClick={() => setEditPhotoRoomId(null)}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            >
              <X size={18} className="text-stone-500" />
            </button>
          </div>

          {(() => {
            const room = rooms.find(r => r.id === editPhotoRoomId);
            return room?.imageUrl ? (
              <img src={room.imageUrl} alt="Foto atual" className="w-full h-40 object-cover rounded-xl border border-stone-100 mb-4" />
            ) : (
              <div className="w-full h-40 rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center mb-4">
                <ImageIcon size={32} className="text-stone-300" />
              </div>
            );
          })()}

          <label className={cn(
            "flex items-center justify-center gap-3 w-full py-4 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50 transition-all",
            editPhotoLoading && "opacity-50 cursor-not-allowed"
          )}>
            <ImageIcon size={20} className="text-stone-400" />
            <span className="text-sm font-medium text-stone-500">
              {editPhotoLoading ? 'Enviando...' : 'Selecionar imagem'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleRoomImageSelect}
              disabled={editPhotoLoading}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setEditPhotoRoomId(null)}
            className="w-full mt-4 py-3 rounded-lg border border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    )}

    {cropImageSrc && (
      <ImageCropModal
        imageSrc={cropImageSrc}
        onConfirm={handleRoomCropConfirm}
        onClose={() => {
          URL.revokeObjectURL(cropImageSrc);
          setCropImageSrc(null);
        }}
        aspect={16 / 10}
        title="Ajustar foto da sala"
      />
    )}

    {/* Settings Modal */}
    {showSettingsModal && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => setShowSettingsModal(false)}
      >
        <div
          className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-8 py-6 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
                <Settings size={20} className="text-stone-600" />
              </div>
              <h3 className="text-lg font-sans text-stone-900">Configurações de Agendamento</h3>
            </div>
            <button
              onClick={() => setShowSettingsModal(false)}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-8 space-y-8">
            {/* Business Hours */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-sans text-base text-stone-900">Horários Disponíveis</h4>
                <button
                  onClick={() => {
                    setSettingsConfirmModal({
                      isOpen: true,
                      title: 'Restaurar Horários',
                      message: 'Deseja restaurar os horários para o padrão de 30 minutos? Suas configurações personalizadas serão perdidas.',
                      confirmText: 'Restaurar',
                      onConfirm: async () => {
                        await api.put('/api/settings/global', { businessHours: DEFAULT_BUSINESS_HOURS });
                        setSettingsConfirmModal(prev => ({ ...prev, isOpen: false }));
                      }
                    });
                  }}
                  className="text-overline bg-primary text-white px-3 py-1.5 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                >
                  Restaurar Padrão (30 min)
                </button>
              </div>
              <p className="text-stone-500 text-sm mb-6">Edite os horários que estarão disponíveis para agendamento em todas as salas.</p>

              <div className="flex flex-wrap gap-3 mb-6">
                {businessHours.map(hour => (
                  <div key={hour} className="flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-full text-sm font-medium">
                    {hour}
                    <button onClick={() => handleSettingsRemoveHour(hour)} className="text-stone-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 max-w-xs">
                <input
                  type="text"
                  placeholder="HH:mm"
                  value={settingsNewHour}
                  onChange={e => setSettingsNewHour(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSettingsAddHour()}
                  className="flex-1 px-4 py-3 bg-stone-50 border border-stone-100 rounded-md focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleSettingsAddHour}
                  className="bg-primary text-white px-6 py-3 rounded-md hover:bg-primary/90 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* Booking Links */}
            <div>
              <h4 className="font-sans text-base text-stone-900 mb-2">Links de Agendamento</h4>
              <p className="text-stone-500 text-sm mb-4">Compartilhe estes links para que os usuários acessem diretamente o agendamento de cada sala.</p>
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
                        onClick={() => { navigator.clipboard.writeText(link); alert('Link copiado!'); }}
                        className="text-xs bg-white border border-stone-100 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors font-bold shrink-0 ml-4"
                      >
                        Copiar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    <ConfirmationModal
      isOpen={settingsConfirmModal.isOpen}
      title={settingsConfirmModal.title}
      message={settingsConfirmModal.message}
      confirmText={settingsConfirmModal.confirmText}
      variant="primary"
      onConfirm={settingsConfirmModal.onConfirm}
      onClose={() => setSettingsConfirmModal(prev => ({ ...prev, isOpen: false }))}
    />
    </>
  );
}
