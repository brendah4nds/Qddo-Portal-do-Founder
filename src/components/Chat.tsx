import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, Users, MessageSquare, Search, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';
import { ChatMessage, Founder } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Chat({ user }: { user: any | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [founders, setFounders] = useState<Founder[]>([]);
  const [activeChat, setActiveChat] = useState<'public' | string>('public');
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load founders list once
  useEffect(() => {
    if (!user) return;
    api.get('/api/founders')
      .then(r => {
        const list = r.data
          .map((f: any) => ({ ...f, id: f._id || f.id }))
          .filter((f: any) => f.id !== user._id);
        setFounders(list);
      })
      .catch(console.error);

    const socket = getSocket();
    const onNew = (f: any) => {
      const norm = { ...f, id: f._id || f.id };
      if (norm.id !== user._id) setFounders(prev => [...prev, norm]);
    };
    const onUpdate = (f: any) => {
      const norm = { ...f, id: f._id || f.id };
      setFounders(prev => prev.map(x => x.id === norm.id ? norm : x));
    };
    const onDelete = ({ id }: any) => setFounders(prev => prev.filter(x => x.id !== id));
    socket.on('founder:new', onNew);
    socket.on('founder:update', onUpdate);
    socket.on('founder:delete', onDelete);
    return () => {
      socket.off('founder:new', onNew);
      socket.off('founder:update', onUpdate);
      socket.off('founder:delete', onDelete);
    };
  }, [user]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!user) return;

    const chatId = activeChat === 'public'
      ? 'public'
      : [user._id, activeChat].sort().join('_');

    api.get('/api/messages', { params: { chatId } })
      .then(r => {
        const msgs = r.data
          .map((m: any) => ({ ...m, id: m._id || m.id }))
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(msgs);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .catch(console.error);

    const socket = getSocket();
    const onMessage = (msg: any) => {
      const norm = { ...msg, id: msg._id || msg.id };
      if (norm.chatId === chatId) {
        setMessages(prev => [...prev, norm]);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };
    socket.on('message:new', onMessage);
    return () => { socket.off('message:new', onMessage); };
  }, [user, activeChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    const chatId = activeChat === 'public'
      ? 'public'
      : [user._id, activeChat].sort().join('_');

    try {
      await api.post('/api/messages/send', {
        chatId,
        text: newMessage,
        receiverId: activeChat !== 'public' ? activeChat : null,
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectChat = (chatId: 'public' | string) => {
    setActiveChat(chatId);
    setShowSidebar(false);
  };

  const filteredFounders = founders.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeFounder = founders.find(f => f.id === activeChat);

  return (
    <div className="flex h-full bg-white rounded-lg md:rounded-xl border border-stone-200 overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Sidebar: User List */}
      <div className={cn(
        "border-r border-stone-100 flex-col bg-stone-50/50 transition-all duration-300",
        showSidebar
          ? "flex w-full md:w-80 md:min-w-[320px]"
          : "hidden md:flex md:w-80 md:min-w-[320px]"
      )}>
        <div className="p-5 border-b border-stone-100">
          <h2 className="text-h2 font-sans mb-4">Bate-papo</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
            <input
              type="text"
              placeholder="Buscar founder..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button
            onClick={() => handleSelectChat('public')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
              activeChat === 'public' ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-stone-100 text-stone-600"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-md flex items-center justify-center",
              activeChat === 'public' ? "bg-white/20" : "bg-stone-200"
            )}>
              <Users size={20} />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Chat Público</p>
              <p className={cn("text-overline uppercase tracking-widest", activeChat === 'public' ? "text-white/60" : "text-stone-400")}>Todos os Founders</p>
            </div>
          </button>

          <div className="pt-4 pb-2 px-2">
            <p className="text-overline uppercase tracking-widest font-bold text-stone-400">Conversas Diretas</p>
          </div>

          {filteredFounders.map(founder => (
            <button
              key={founder.id}
              onClick={() => handleSelectChat(founder.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
                activeChat === founder.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-stone-100 text-stone-600"
              )}
            >
              <div className="w-10 h-10 rounded-md overflow-hidden bg-stone-200">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${founder.username}`} alt="" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="font-bold text-sm truncate">{founder.name}</p>
                <p className={cn("text-overline truncate", activeChat === founder.id ? "text-white/60" : "text-stone-400")}>@{founder.username?.replace(/^@/, '')}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-col bg-white",
        showSidebar ? "hidden md:flex md:flex-1" : "flex flex-1"
      )}>
        {/* Chat Header */}
        <div className="p-4 md:p-6 border-b border-stone-100 flex items-center gap-3">
          <button
            className="md:hidden p-2 -ml-1 rounded-md hover:bg-stone-100 transition-colors text-stone-600"
            onClick={() => setShowSidebar(true)}
            aria-label="Voltar para contatos"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-md md:rounded-lg bg-stone-900 flex items-center justify-center text-white shrink-0">
              {activeChat === 'public' ? <Users size={20} /> : <UserIcon size={20} />}
            </div>
            <div className="min-w-0">
              <h3 className="font-sans text-lg md:text-h3 truncate">
                {activeChat === 'public' ? 'Chat Público' : activeFounder?.name}
              </h3>
              <p className="text-overline uppercase tracking-widest font-bold text-stone-400 truncate">
                {activeChat === 'public' ? 'Interaja com toda a comunidade' : `Conversa particular com ${activeFounder?.username}`}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-300 space-y-4">
              <MessageSquare size={48} />
              <p className="font-sans text-lg">Nenhuma mensagem por aqui ainda...</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?._id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-[85%] md:max-w-[75%]",
                    isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                    <img src={msg.senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} alt="" referrerPolicy="no-referrer" />
                  </div>
                  <div className={cn(
                    "space-y-1 flex flex-col",
                    isMe ? "items-end" : "items-start"
                  )}>
                    {!isMe && <p className="text-overline font-bold text-stone-400 ml-1">{msg.senderName}</p>}
                    <div className={cn(
                      "px-4 py-3 md:px-6 rounded-xl text-sm",
                      isMe ? "bg-primary text-white rounded-tr-none" : "bg-stone-100 text-stone-800 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                    <p className="text-overline text-stone-300 font-bold uppercase tracking-widest">
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 md:p-6 border-t border-stone-100">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 px-4 md:px-6 py-3 md:py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-primary text-white w-12 h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
