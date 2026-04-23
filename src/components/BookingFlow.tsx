import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
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
  DoorOpen as RoomIcon
} from 'lucide-react';
import { db } from '../firebase';
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
  const [formData, setFormData] = useState({ name: '', email: '' });

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
        
        return addDoc(collection(db, 'bookings'), {
          roomId: selectedRoomId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          startTime: time,
          endTime: format(end, 'HH:mm'),
          userName: formData.name,
          userEmail: formData.email,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(bookingPromises);
      
      setStatus('success');
      setFormData({ name: '', email: '' });
      setSelectedTimes([]);
      setStep(1);
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-white rounded-3xl shadow-sm border border-stone-100 p-12">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-h2 font-sans mb-2">Agendamento Confirmado!</h2>
        <p className="text-stone-500 mb-8">Sua reserva para a {selectedRoom?.name} foi realizada com sucesso.</p>
        <button 
          onClick={() => {
            setStatus('idle');
            setSelectedRoomId(null);
            setStep(1);
          }}
          className="w-full bg-stone-900 text-white py-4 rounded-xl font-semibold hover:bg-stone-800 transition-all"
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
                step >= s.id ? "bg-stone-900 text-white shadow-lg shadow-stone-200" : "bg-stone-100 text-stone-400"
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
                step > s.id ? "bg-stone-900" : "bg-stone-100"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-4">
        {/* Step 1: Room Selection */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-h1 font-sans mb-8 text-center">Qual sala você deseja reservar?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    window.history.pushState({}, '', `/sala/${room.id}`);
                    setStep(2);
                  }}
                  className="p-8 rounded-3xl border border-stone-200 bg-white text-left transition-all hover:border-stone-400 hover:shadow-xl hover:-translate-y-1 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <RoomIcon size={24} />
                  </div>
                  <h3 className="font-sans text-h3 leading-tight mb-2">{room.name}</h3>
                  <p className="text-sm text-stone-400">
                    {room.description}
                  </p>
                </button>
              ))}
            </div>
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
            
            <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
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
                          "aspect-square flex flex-col items-center justify-center rounded-2xl transition-all",
                          isSelected ? "bg-stone-900 text-white shadow-md" : "hover:bg-stone-50",
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

            <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
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
                        "py-4 rounded-2xl border text-sm font-bold transition-all flex flex-col items-center justify-center",
                        isSelected 
                          ? "bg-stone-900 border-stone-900 text-white shadow-lg" 
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
                      className="w-full pl-12 pr-4 py-5 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
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
                      className="w-full pl-12 pr-4 py-5 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={selectedTimes.length === 0 || status === 'loading'}
                  className="w-full bg-stone-900 text-white py-5 rounded-2xl font-bold hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-8 shadow-xl shadow-stone-900/20 text-lg"
                >
                  {status === 'loading' ? 'Processando...' : `Confirmar Reserva (${selectedTimes.length} ${selectedTimes.length === 1 ? 'horário' : 'horários'})`}
                </button>
              </form>

              {status === 'error' && (
                <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-medium">
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
