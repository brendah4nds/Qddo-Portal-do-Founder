import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  where,
  limit
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Send, User as UserIcon, Users, MessageSquare, Search } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ChatMessage, Founder } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Chat({ user }: { user: User | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [founders, setFounders] = useState<Founder[]>([]);
  const [activeChat, setActiveChat] = useState<'public' | string>('public');
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch founders for user list
    const foundersUnsubscribe = onSnapshot(collection(db, 'founders'), (snapshot) => {
      const foundersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Founder));
      setFounders(foundersData.filter(f => f.id !== user.uid));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'founders'));

    // Fetch messages
    let messagesQuery;
    if (activeChat === 'public') {
      messagesQuery = query(
        collection(db, 'messages'),
        where('chatId', '==', 'public'),
        limit(100)
      );
    } else {
      const chatId = [user.uid, activeChat].sort().join('_');
      messagesQuery = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId),
        limit(100)
      );
    }

    const messagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      const sortedMsgs = msgs.sort((a, b) => 
        (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      );
      setMessages(sortedMsgs);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages'));

    return () => {
      foundersUnsubscribe();
      messagesUnsubscribe();
    };
  }, [user, activeChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    const msgData: any = {
      senderId: user.uid,
      senderName: user.displayName || 'Usuário',
      senderPhoto: user.photoURL,
      text: newMessage,
      createdAt: serverTimestamp(),
    };

    if (activeChat !== 'public') {
      msgData.receiverId = activeChat;
      msgData.chatId = [user.uid, activeChat].sort().join('_');
    } else {
      msgData.receiverId = null;
      msgData.chatId = 'public';
    }

    try {
      await addDoc(collection(db, 'messages'), msgData);
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  const filteredFounders = founders.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeFounder = founders.find(f => f.id === activeChat);

  return (
    <div className="flex h-[calc(100vh-200px)] bg-white rounded-[40px] border border-stone-200 overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar: User List */}
      <div className="w-80 border-r border-stone-100 flex flex-col bg-stone-50/50">
        <div className="p-6 border-b border-stone-100">
          <h2 className="text-2xl font-serif italic mb-4">Bate-papo</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
            <input 
              type="text" 
              placeholder="Buscar founder..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button 
            onClick={() => setActiveChat('public')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-2xl transition-all",
              activeChat === 'public' ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20" : "hover:bg-stone-100 text-stone-600"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              activeChat === 'public' ? "bg-white/20" : "bg-stone-200"
            )}>
              <Users size={20} />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Chat Público</p>
              <p className={cn("text-[10px] uppercase tracking-widest", activeChat === 'public' ? "text-white/60" : "text-stone-400")}>Todos os Founders</p>
            </div>
          </button>

          <div className="pt-4 pb-2 px-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Conversas Diretas</p>
          </div>

          {filteredFounders.map(founder => (
            <button 
              key={founder.id}
              onClick={() => setActiveChat(founder.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-2xl transition-all",
                activeChat === founder.id ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20" : "hover:bg-stone-100 text-stone-600"
              )}
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-200">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${founder.username}`} alt="" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="font-bold text-sm truncate">{founder.name}</p>
                <p className={cn("text-[10px] truncate", activeChat === founder.id ? "text-white/60" : "text-stone-400")}>{founder.username}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white">
              {activeChat === 'public' ? <Users size={24} /> : <UserIcon size={24} />}
            </div>
            <div>
              <h3 className="font-serif italic text-xl">
                {activeChat === 'public' ? 'Chat Público' : activeFounder?.name}
              </h3>
              <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
                {activeChat === 'public' ? 'Interaja com toda a comunidade' : `Conversa particular com ${activeFounder?.username}`}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-300 space-y-4">
              <MessageSquare size={48} />
              <p className="font-serif italic text-lg">Nenhuma mensagem por aqui ainda...</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === user?.uid;
              return (
                <div 
                  key={msg.id}
                  className={cn(
                    "flex gap-4 max-w-[80%]",
                    isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                    <img src={msg.senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} alt="" referrerPolicy="no-referrer" />
                  </div>
                  <div className={cn(
                    "space-y-1",
                    isMe ? "items-end" : "items-start"
                  )}>
                    {!isMe && <p className="text-[10px] font-bold text-stone-400 ml-1">{msg.senderName}</p>}
                    <div className={cn(
                      "px-6 py-3 rounded-3xl text-sm",
                      isMe ? "bg-stone-900 text-white rounded-tr-none" : "bg-stone-100 text-stone-800 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                    <p className="text-[8px] text-stone-300 font-bold uppercase tracking-widest">
                      {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>

        {/* Message Input */}
        <div className="p-6 border-t border-stone-100">
          <form onSubmit={handleSendMessage} className="flex gap-4">
            <input 
              type="text" 
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-stone-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/20 disabled:opacity-50 disabled:shadow-none"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
