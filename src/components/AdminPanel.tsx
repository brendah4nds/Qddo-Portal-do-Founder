import React, { useState } from 'react';
import { 
  collection, 
  deleteDoc, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { 
  signOut,
  User
} from 'firebase/auth';
import { 
  Settings, 
  AlertCircle, 
  Trash2, 
  Plus
} from 'lucide-react';
import { db, auth } from '../firebase';
import { Room, Booking } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
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
  founders = []
}: { 
  user: User | null; 
  onLogin: () => void; 
  rooms: Room[]; 
  bookings: Booking[]; 
  businessHours: string[];
  isAdmin: boolean;
  founders?: any[];
}) {
  const [adminTab, setAdminTab] = useState<'bookings' | 'settings' | 'founders'>('bookings');
  const [newHour, setNewHour] = useState('');
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
        <h2 className="text-3xl font-serif italic mb-4">Área Administrativa</h2>
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
        <h2 className="text-2xl font-serif italic mb-2">Acesso Negado</h2>
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

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-serif italic mb-2">Painel de Controle</h2>
          <p className="text-stone-500">Gerencie todos os agendamentos e salas do sistema.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-6 py-3 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Total Reservas</span>
            <span className="text-2xl font-serif italic">{bookings.length}</span>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Salas Ativas</span>
            <span className="text-2xl font-serif italic">{rooms.length}</span>
          </div>
        </div>
      </header>

      <div className="flex gap-8 border-b border-stone-200">
        <button 
          onClick={() => setAdminTab('bookings')}
          className={cn(
            "pb-4 text-sm font-bold uppercase tracking-widest transition-all",
            adminTab === 'bookings' ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
          )}
        >
          Agendamentos
        </button>
        <button 
          onClick={() => setAdminTab('settings')}
          className={cn(
            "pb-4 text-sm font-bold uppercase tracking-widest transition-all",
            adminTab === 'settings' ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
          )}
        >
          Configurações
        </button>
        <button 
          onClick={() => setAdminTab('founders')}
          className={cn(
            "pb-4 text-sm font-bold uppercase tracking-widest transition-all",
            adminTab === 'founders' ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
          )}
        >
          Usuários
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
                        <div className="font-serif italic text-stone-700">{room?.name || 'Sala excluída'}</div>
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
                    <td colSpan={4} className="px-8 py-20 text-center text-stone-400 italic">Nenhum agendamento encontrado.</td>
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
                      <div className="font-serif italic text-stone-700">{founder.company?.name || 'N/A'}</div>
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
                          className="text-xs font-bold text-stone-900 hover:underline"
                        >
                          Tornar {founder.role === 'admin' ? 'User' : 'Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adminTab === 'settings' && (
        <section className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif italic text-lg">Horários Disponíveis</h4>
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

            <h4 className="font-serif italic text-lg mb-4">Links de Agendamento</h4>
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

      <ConfirmationModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        variant={modalConfig.variant}
      />
    </div>
  );
}
