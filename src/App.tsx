/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import axios from 'axios';
import { 
  startOfToday,
  startOfDay,
  startOfWeek,
  subHours,
  subDays,
  isWithinInterval,
  format,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LogOut,
  Calendar,
  Users,
  Building2,
  Lock,
  Globe,
  CheckSquare,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Bell,
  Newspaper,
  ArrowRight,
  LayoutGrid,
  ShieldCheck,
  AlertTriangle,
  Trophy,
  CalendarDays,
  Clock,
  X,
  Plus,
  Paperclip,
  ExternalLink,
  FileText,
  Menu,
  UserPlus,
  Send,
  Pencil,
  Trash2,
  Check,
  Settings,
  TrendingUp,
  Award,
  Crown,
  Cake,
  EyeOff,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { auth } from './firebase';
import { api, API_BASE } from './api';
import { getSocket, disconnectSocket } from './socket';
import { Room, Booking, BookingStatus, Challenge } from './types';
import { BookingFlow } from './components/BookingFlow';
import { AdminPanel } from './components/AdminPanel';
import { FounderPortal } from './components/FounderPortal';
import { LandingPage } from './components/LandingPage';
import { RegistrationFlow } from './components/RegistrationFlow';
import { Chat } from './components/Chat';
import { TermsModal } from './components/TermsModal';
import { AdminDashboard } from './components/AdminDashboard';
import { NewsFormModal } from './components/NewsFormModal';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "bbrendaribeiroc@gmail.com";

const QDDO_LOCATION = { lat: -15.789209930873332, lng: -47.90071054840695, radius: 300 };

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const QCOIN_SECTIONS = [
  { id: 'pontuacao', title: 'Sistema de pontuação', icon: Trophy },
  { id: 'estagios', title: 'Estágios e Thresholds de Progressão', icon: TrendingUp },
  { id: 'ranking', title: 'Ranking Geral', icon: Crown },
  { id: 'premiacoes', title: 'Premiações', icon: Award },
  { id: 'consequencias', title: 'Consequências', icon: AlertTriangle },
] as const;

const DEFAULT_BUSINESS_HOURS = Array.from({ length: 21 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const AdminTableEditor = ({ sectionId, cols, colWidths, rows, setCols, setColWidths, setRows, resizingRef, savingQcoinSection, qcoinTableSaveStatus, qcoinTableSaveError, onSave }: any) => (
  <div className="mt-3 bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="bg-stone-900 border-b border-stone-800">
            {cols.map((col: string, ci: number) => (
              <th key={ci} className="relative px-3 py-2.5 select-none group/col" style={{ width: colWidths[ci] }}>
                <input type="text" value={col} onChange={e => setCols((p: string[]) => p.map((c: string, i: number) => i === ci ? e.target.value : c))}
                  className="w-full px-1 bg-transparent border border-transparent rounded text-overline uppercase tracking-widest font-bold text-stone-400 hover:border-stone-700 focus:border-stone-500 focus:outline-none focus:bg-stone-800" />
                <button onClick={() => { setCols((p: string[]) => p.filter((_: string, i: number) => i !== ci)); setColWidths((p: number[]) => p.filter((_: number, i: number) => i !== ci)); setRows((p: string[][]) => p.map((r: string[]) => r.filter((_: string, i: number) => i !== ci))); }}
                  className="absolute top-0.5 left-0.5 w-3.5 h-3.5 flex items-center justify-center rounded bg-red-500 text-white opacity-0 group-hover/col:opacity-100 transition-opacity" title="Excluir coluna"><X size={7} /></button>
                <div onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); resizingRef.current = { colIdx: ci, startX: e.clientX, startWidth: colWidths[ci] }; }}
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize flex items-center justify-center group/r">
                  <div className="w-px h-3 bg-stone-600 group-hover/r:bg-stone-400 rounded-full" />
                </div>
              </th>
            ))}
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row: string[], ri: number) => (
            <tr key={ri} className="border-b border-stone-100 hover:bg-stone-50/50">
              {row.map((cell: string, ci: number) => (
                <td key={ci} className="px-2 py-0.5 align-top">
                  <textarea value={cell} rows={1}
                    ref={(el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                    onChange={e => setRows((p: string[][]) => p.map((r: string[], i: number) => i === ri ? r.map((c: string, j: number) => j === ci ? e.target.value : c) : r))}
                    onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                    className="w-full bg-transparent border border-transparent rounded px-2 py-1 text-xs text-stone-700 resize-none overflow-hidden hover:border-stone-200 focus:border-stone-400 focus:outline-none focus:bg-white"
                    placeholder="—" />
                </td>
              ))}
              <td style={{ width: 28 }} className="px-1 py-0.5 align-middle">
                <button onClick={() => setRows((p: string[][]) => p.filter((_: string[], i: number) => i !== ri))}
                  className="w-5 h-5 flex items-center justify-center rounded text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={10} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="px-4 py-2.5 border-t border-stone-100 flex items-center justify-between">
      <div className="flex gap-2">
        <button onClick={() => setRows((p: string[][]) => [...p, new Array(cols.length).fill('')])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-all"><Plus size={11} /> Linha</button>
        <button onClick={() => { setCols((p: string[]) => [...p, 'Nova coluna']); setColWidths((p: number[]) => [...p, 120]); setRows((p: string[][]) => p.map((r: string[]) => [...r, ''])); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-all"><Plus size={11} /> Coluna</button>
      </div>
      <button onClick={() => onSave(sectionId)} disabled={savingQcoinSection}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest text-white transition-all disabled:opacity-50 ${qcoinTableSaveStatus === 'success' ? 'bg-green-600' : qcoinTableSaveStatus === 'error' ? 'bg-red-600' : 'bg-stone-900 hover:bg-primary/80'}`}>
        <Check size={11} />{savingQcoinSection ? 'Salvando...' : qcoinTableSaveStatus === 'success' ? 'Salva' : qcoinTableSaveStatus === 'error' ? 'Erro' : 'Salvar tabela'}
      </button>
    </div>
    {qcoinTableSaveStatus === 'error' && qcoinTableSaveError && (
      <p className="px-4 pb-2 text-xs text-red-500 break-all">Detalhe: {qcoinTableSaveError}</p>
    )}
  </div>
);

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [activeGeneralCategory, setActiveGeneralCategory] = useState<string | null>(null);
  const [selectedNewsItem, setSelectedNewsItem] = useState<any | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleData, setEditingRuleData] = useState<{ title: string; content: string }>({ title: '', content: '' });
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [showAddRegra, setShowAddRegra] = useState(false);
  const [newRegraTitle, setNewRegraTitle] = useState('');
  const [newRegraContent, setNewRegraContent] = useState('');
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set());

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [businessHours, setBusinessHours] = useState<string[]>(DEFAULT_BUSINESS_HOURS);
  const [hiddenMenuItems, setHiddenMenuItems] = useState<string[]>([]);
  const [hiddenNewsIds, setHiddenNewsIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'booking' | 'admin' | 'portal' | 'chat' | 'general' | 'news' | 'qcoin' | 'regras' | 'dashboard'>('general');
  const [activeSubTab, setActiveSubTab] = useState<string>('general');
  const [adminInitialTab, setAdminInitialTab] = useState<'founders' | 'challenges' | 'news' | 'indicacoes'>('founders');
  const [adminInitialEditNewsItem, setAdminInitialEditNewsItem] = useState<any>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [view, activeSubTab]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (estagiosResizingRef.current) {
        const { colIdx, startX, startWidth } = estagiosResizingRef.current;
        const newWidth = Math.max(50, startWidth + (e.clientX - startX));
        setEstagiosColWidths((prev: number[]) => prev.map((w: number, i: number) => i === colIdx ? newWidth : w));
      }
      if (rankingResizingRef.current) {
        const { colIdx, startX, startWidth } = rankingResizingRef.current;
        const newWidth = Math.max(50, startWidth + (e.clientX - startX));
        setRankingColWidths((prev: number[]) => prev.map((w: number, i: number) => i === colIdx ? newWidth : w));
      }
      if (premiacoesResizingRef.current) {
        const { colIdx, startX, startWidth } = premiacoesResizingRef.current;
        const newWidth = Math.max(50, startWidth + (e.clientX - startX));
        setPremiacoesColWidths((prev: number[]) => prev.map((w: number, i: number) => i === colIdx ? newWidth : w));
      }
      if (consequenciasResizingRef.current) {
        const { colIdx, startX, startWidth } = consequenciasResizingRef.current;
        const newWidth = Math.max(50, startWidth + (e.clientX - startX));
        setConsequenciasColWidths((prev: number[]) => prev.map((w: number, i: number) => i === colIdx ? newWidth : w));
      }
      if (pontuacaoResizingRef.current) {
        const { colIdx, startX, startWidth } = pontuacaoResizingRef.current;
        const newWidth = Math.max(50, startWidth + (e.clientX - startX));
        setPontuacaoColWidths((prev: number[]) => prev.map((w: number, i: number) => i === colIdx ? newWidth : w));
      }
    };
    const onMouseUp = () => {
      estagiosResizingRef.current = null;
      rankingResizingRef.current = null;
      premiacoesResizingRef.current = null;
      consequenciasResizingRef.current = null;
      pontuacaoResizingRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [expandedTopics, setExpandedTopics] = useState<string[]>(['agendamento', 'portal']);
  const [isRegistering, setIsRegistering] = useState(false);
  const [founderData, setFounderData] = useState<any>(null);
  const [checkingFounder, setCheckingFounder] = useState(true);
  const [allFounders, setAllFounders] = useState<any[]>([]);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [userCheckins, setUserCheckins] = useState<any[]>([]);
  const [allCheckins, setAllCheckins] = useState<any[]>([]);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [showIndicarFounderModal, setShowIndicarFounderModal] = useState(false);
  const [showSolicitarQcoinModal, setShowSolicitarQcoinModal] = useState(false);
  const [qcoinRequests, setQcoinRequests] = useState<any[]>([]);
  const [solicitarAcao, setSolicitarAcao] = useState('');
  const [solicitarObservacao, setSolicitarObservacao] = useState('');
  const [solicitarParaFounder, setSolicitarParaFounder] = useState<any>(null);
  const [solicitarFounderSearch, setSolicitarFounderSearch] = useState('');
  const [solicitarSubmitting, setSolicitarSubmitting] = useState(false);
  const [solicitarSuccess, setSolicitarSuccess] = useState(false);
  const [solicitarSuccessRequerFounder, setSolicitarSuccessRequerFounder] = useState(false);
  const [showMyQcoinRequests, setShowMyQcoinRequests] = useState(false);
  const [showQcoinApprovalQueue, setShowQcoinApprovalQueue] = useState(false);
  const [confirmingQcoinRequestId, setConfirmingQcoinRequestId] = useState<string | null>(null);
  const [reviewingQcoinRequestId, setReviewingQcoinRequestId] = useState<string | null>(null);
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);
  const [eventCheckinLoading, setEventCheckinLoading] = useState(false);
  const [eventCheckinError, setEventCheckinError] = useState<string | null>(null);
  const [eventCheckinTime, setEventCheckinTime] = useState<string | null>(null);
  const eventCheckinInFlight = useRef(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileBirthDay, setProfileBirthDay] = useState('');
  const [profileBirthMonth, setProfileBirthMonth] = useState('');
  const [profileBirthYear, setProfileBirthYear] = useState('');
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [settingsSocialLinkedin, setSettingsSocialLinkedin] = useState('');
  const [settingsSocialInstagram, setSettingsSocialInstagram] = useState('');
  const [settingsSocialSite, setSettingsSocialSite] = useState('');
  const [socialSaving, setSocialSaving] = useState(false);
  const [selectedFounderDetail, setSelectedFounderDetail] = useState<any | null>(null);
  const [qcoinViewingFounderId, setQcoinViewingFounderId] = useState<string | null>(null);
  const [qcoinSections, setQcoinSections] = useState<any[]>([]);
  const [expandedQcoinCard, setExpandedQcoinCard] = useState<string | null>(null);
  const [editingQcoinSection, setEditingQcoinSection] = useState<string | null>(null);
  const [qcoinEditContent, setQcoinEditContent] = useState('');
  const [savingQcoinSection, setSavingQcoinSection] = useState(false);
  const [qcoinTableSaveStatus, setQcoinTableSaveStatus] = useState<'success' | 'error' | null>(null);
  const [qcoinTableSaveError, setQcoinTableSaveError] = useState<string>('');
  const [estagiosCols, setEstagiosCols] = useState(['Estágio', 'Threshold', 'Benefícios', 'Requisitos', 'Status']);
  const [estagiosColWidths, setEstagiosColWidths] = useState([130, 80, 200, 200, 200]);
  const estagiosResizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const [estagiosRows, setEstagiosRows] = useState<string[][]>([
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ]);
  const [rankingCols, setRankingCols] = useState(['Posição', 'Founder', 'Empresa', 'QCoins', 'Variação']);
  const [rankingColWidths, setRankingColWidths] = useState([80, 150, 150, 100, 100]);
  const rankingResizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const [rankingRows, setRankingRows] = useState<string[][]>([
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ]);
  const [premiacoesCols, setPremiacoesCols] = useState(['Prêmio', 'Descrição', 'Requisito', 'Frequência', 'Status']);
  const [premiacoesColWidths, setPremiacoesColWidths] = useState([130, 200, 150, 100, 100]);
  const premiacoesResizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const [premiacoesRows, setPremiacoesRows] = useState<string[][]>([
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ]);
  const [consequenciasCols, setConsequenciasCols] = useState(['Comportamento', 'Consequência', 'Severidade', 'Reversível', 'Observações']);
  const [consequenciasColWidths, setConsequenciasColWidths] = useState([150, 180, 100, 90, 180]);
  const consequenciasResizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const [consequenciasRows, setConsequenciasRows] = useState<string[][]>([
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ]);
  const [pontuacaoCols, setPontuacaoCols] = useState(['Ação', 'Pontuação', 'Tipo', 'Requer Founder']);
  const [pontuacaoColWidths, setPontuacaoColWidths] = useState([320, 100, 110, 110]);
  const pontuacaoResizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const [pontuacaoRows, setPontuacaoRows] = useState<string[][]>([
    ['Check-in diário', '10', 'Automático', ''],
    ['Evento interno QDDO', '20', 'Automático', ''],
    ['Streak 5 dias consecutivos (seg a sex)', '30 (bônus)', 'Automático', ''],
    ['Resolução de desafio aberto de outro founder', '50', 'Manual', 'Sim'],
    ['Indicação founder com fit para o hub', '50', 'Automático', ''],
    ['Aprovação de founder indicado por você', '100', 'Automático', ''],
    ['Mentoria espontânea (mín. 30 min)', '50', 'Manual', ''],
    ['Contribuição técnica ao app/site/infra QDDO', '80', 'Manual', 'Sim'],
    ['Realização do Desafio Mensal', '100', 'Manual', ''],
    ['Avançar estágio', '250', 'Manual', ''],
    ['Crescimento de faturamento MoM', '50', 'Manual', ''],
    ['Completar desafio de Mantenedor', '150', 'Manual', ''],
    ['Participar de hackathon corporativo', '100', 'Manual', ''],
    ['Vencer hackathon', '300 (bônus)', 'Manual', ''],
    ['Relatório mensal para mantenedor de sala', '80', 'Manual', ''],
    ['Convidado no podcast QDDO', '80', 'Manual', ''],
    ['Pitch no Demo Day', '100', 'Manual', ''],
  ]);

  const [indicarNome, setIndicarNome] = useState('');
  const [indicarEmpresa, setIndicarEmpresa] = useState('');
  const [indicarArea, setIndicarArea] = useState('');
  const [indicarContato, setIndicarContato] = useState('');
  const [indicarSubmitting, setIndicarSubmitting] = useState(false);
  const [indicarSuccess, setIndicarSuccess] = useState(false);
  const [indicarError, setIndicarError] = useState('');
  const [showIndicarMantenedorModal, setShowIndicarMantenedorModal] = useState(false);
  const [indicarMantenedorNome, setIndicarMantenedorNome] = useState('');
  const [indicarMantenedorEspaco, setIndicarMantenedorEspaco] = useState('');
  const [indicarMantenedorArea, setIndicarMantenedorArea] = useState('');
  const [indicarMantenedorContato, setIndicarMantenedorContato] = useState('');
  const [indicarMantenedorSubmitting, setIndicarMantenedorSubmitting] = useState(false);
  const [indicarMantenedorSuccess, setIndicarMantenedorSuccess] = useState(false);
  const [indicarMantenedorError, setIndicarMantenedorError] = useState('');
  const [showEmailCopy, setShowEmailCopy] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (emailRef.current && !emailRef.current.contains(e.target as Node)) {
        setShowEmailCopy(false);
        setEmailCopied(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAcceptTerms = async () => {
    if (!user) return;
    try {
      await api.put(`/api/founders/${user._id}`, { termsAccepted: true, termsAcceptedAt: new Date().toISOString() });
      setIsTermsModalOpen(false);
    } catch (error) {
      console.error("Error accepting terms:", error);
    }
  };

  const toDate = (v: any): Date | null => {
    if (!v) return null;
    if (v?.seconds) return new Date(v.seconds * 1000);
    if (v?.toDate) return v.toDate();
    // YYYY-MM-DD strings are parsed as UTC by new Date() — treat as local midnight instead
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const getEventDayLabel = (eventDate: any): string => {
    const d = toDate(eventDate) || new Date();
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate()) {
      return 'AMANHÃ';
    }
    return format(d, 'EEEE', { locale: ptBR });
  };

  // Dark mode effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Auto-refresh currentDate every minute so events past today are filtered out automatically
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(prev => {
        const now = new Date();
        return now.toDateString() !== prev.toDateString() ? now : prev;
      });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load social links from founderData
  useEffect(() => {
    if (founderData) {
      setSettingsSocialLinkedin(founderData.socialLinkedin || '');
      setSettingsSocialInstagram(founderData.socialInstagram || '');
      setSettingsSocialSite(founderData.socialSite || '');
    }
  }, [founderData]);

  const openSettingsModal = () => {
    setProfileMenuOpen(false);
    setShowSettingsModal(true);
  };

  const openSocialModal = () => {
    setProfileMenuOpen(false);
    setShowSocialModal(true);
  };

  const handleSaveSocial = async () => {
    if (!user) return;
    setSocialSaving(true);
    try {
      await api.put(`/api/founders/${user._id}`, {
        socialLinkedin: settingsSocialLinkedin.trim(),
        socialInstagram: settingsSocialInstagram.trim(),
        socialSite: settingsSocialSite.trim(),
      });
      setShowSocialModal(false);
    } catch (err) {
      console.error('Erro ao salvar redes sociais:', err);
    } finally {
      setSocialSaving(false);
    }
  };

  const openProfileModal = () => {
    setProfileName(founderData?.name || user?.displayName || '');
    setProfileUsername((founderData?.username || '').replace(/^@/, ''));
    setProfileBirthDay(founderData?.birthDay || '');
    setProfileBirthMonth(founderData?.birthMonth || '');
    setProfileBirthYear(founderData?.birthYear || '');
    setProfileSaveError('');
    setProfileMenuOpen(false);
    setShowProfileModal(true);
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setProfilePhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.put(`/api/founders/${user._id}`, { photoURL: data.url });
      setUser((u: any) => ({ ...u, photoURL: data.url }));
      setFounderData((f: any) => ({ ...f, photoURL: data.url }));
    } catch (err) {
      console.error('Erro ao atualizar foto:', err);
    } finally {
      setProfilePhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!profileUsername.trim()) {
      setProfileSaveError('O username não pode ser vazio.');
      return;
    }
    setProfileSaving(true);
    setProfileSaveError('');
    try {
      await api.put(`/api/founders/${user._id}`, {
        name: profileName.trim(),
        username: profileUsername.trim().toLowerCase().replace(/\s+/g, '').replace(/@/g, ''),
        birthDay: profileBirthDay,
        birthMonth: profileBirthMonth,
        birthYear: profileBirthYear,
      });
      setShowProfileModal(false);
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setProfileSaveError('Não foi possível salvar. Tente novamente.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleIndicarFounderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indicarNome.trim() || !indicarEmpresa.trim() || !indicarArea.trim() || !indicarContato.trim()) return;
    setIndicarSubmitting(true);
    setIndicarError('');
    try {
      await api.post('/api/indicacoes', {
        tipo: 'founder',
        nomeIndicado: indicarNome.trim(),
        empresa: indicarEmpresa.trim(),
        area: indicarArea.trim(),
        contato: indicarContato.trim(),
        indicadoPorEmail: user?.email || null,
        criadoEm: new Date().toISOString(),
      });
      setIndicarSuccess(true);
      setIndicarNome('');
      setIndicarEmpresa('');
      setIndicarArea('');
      setIndicarContato('');
    } catch (error: any) {
      console.error('Erro ao enviar indicação:', error);
      if (error?.response?.status === 401) {
        setIndicarError('Sua sessão expirou. Faça login novamente e tente enviar a indicação de novo.');
      } else {
        setIndicarError(error?.response?.data?.error || 'Não foi possível enviar a indicação. Tente novamente.');
      }
    } finally {
      setIndicarSubmitting(false);
    }
  };

  const handleIndicarMantenedorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indicarMantenedorNome.trim() || !indicarMantenedorEspaco.trim() || !indicarMantenedorArea.trim() || !indicarMantenedorContato.trim()) return;
    setIndicarMantenedorSubmitting(true);
    setIndicarMantenedorError('');
    try {
      await api.post('/api/indicacoes', {
        tipo: 'mantenedor',
        nomeIndicado: indicarMantenedorNome.trim(),
        empresa: indicarMantenedorEspaco.trim(),
        area: indicarMantenedorArea.trim(),
        contato: indicarMantenedorContato.trim(),
        indicadoPorEmail: user?.email || null,
        criadoEm: new Date().toISOString(),
      });
      setIndicarMantenedorSuccess(true);
      setIndicarMantenedorNome('');
      setIndicarMantenedorEspaco('');
      setIndicarMantenedorArea('');
      setIndicarMantenedorContato('');
    } catch (error: any) {
      console.error('Erro ao enviar indicação de mantenedor:', error);
      if (error?.response?.status === 401) {
        setIndicarMantenedorError('Sua sessão expirou. Faça login novamente e tente enviar a indicação de novo.');
      } else {
        setIndicarMantenedorError(error?.response?.data?.error || 'Não foi possível enviar a indicação. Tente novamente.');
      }
    } finally {
      setIndicarMantenedorSubmitting(false);
    }
  };

  const handleSolicitarQcoinSubmit = async (e: React.FormEvent, acaoOptions: Array<{ title: string; pts: string; requerFounder?: boolean }>) => {
    e.preventDefault();
    if (!solicitarAcao || !solicitarObservacao.trim()) return;
    const acao = acaoOptions.find(a => a.title === solicitarAcao);
    if (!acao) return;
    if (acao.requerFounder && !solicitarParaFounder) return;
    setSolicitarSubmitting(true);
    try {
      const { data } = await api.post('/api/qcoin-requests', {
        acao: acao.title,
        pontos: parseInt(acao.pts) || 0,
        observacao: solicitarObservacao.trim(),
        ...(acao.requerFounder && solicitarParaFounder ? { paraFounderId: solicitarParaFounder.id } : {}),
      });
      setQcoinRequests((prev: any[]) => [{ ...data, id: data._id || data.id }, ...prev]);
      setSolicitarSuccessRequerFounder(!!acao.requerFounder);
      setSolicitarSuccess(true);
      setSolicitarAcao('');
      setSolicitarObservacao('');
      setSolicitarParaFounder(null);
      setSolicitarFounderSearch('');
    } catch (error) {
      console.error('Erro ao enviar solicitação de QCoins:', error);
    } finally {
      setSolicitarSubmitting(false);
    }
  };

  const handleConfirmarQcoinRequest = async (id: string, action: 'confirmar' | 'recusar') => {
    setConfirmingQcoinRequestId(id);
    try {
      const { data } = await api.put(`/api/qcoin-requests/${id}/confirm`, { action });
      setQcoinRequests((prev: any[]) => prev.map((x: any) => x.id === id ? { ...data, id: data._id || data.id } : x));
    } catch (error) {
      console.error('Erro ao confirmar solicitação de QCoins:', error);
    } finally {
      setConfirmingQcoinRequestId(null);
    }
  };

  const handleReviewQcoinRequest = async (id: string, status: 'aprovada' | 'rejeitada') => {
    if (status === 'rejeitada' && !window.confirm('Tem certeza que deseja rejeitar esta solicitação de QCoins?')) return;
    setReviewingQcoinRequestId(id);
    try {
      const { data } = await api.put(`/api/qcoin-requests/${id}`, { status });
      setQcoinRequests((prev: any[]) => prev.map((x: any) => x.id === id ? { ...data, id: data._id || data.id } : x));
    } catch (error) {
      console.error('Erro ao revisar solicitação de QCoins:', error);
    } finally {
      setReviewingQcoinRequestId(null);
    }
  };

  const toggleTopic = (topic: string) => {
    setExpandedTopics(prev => 
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  // URL → state mapping
  const applyPath = (path: string) => {
    const agendamentoRoomMatch = path.match(/^\/agendamento\/([^\/]+)/);
    if (agendamentoRoomMatch) {
      setView('booking'); setActiveSubTab('escolha-sala');
      setSelectedRoomId(agendamentoRoomMatch[1]);
      return;
    }

    const qcoinMatch = path.match(/^\/qcoin\/(.+)$/);
    if (qcoinMatch) {
      setView('qcoin'); setActiveSubTab('qcoin');
      setExpandedQcoinCard(qcoinMatch[1]);
      return;
    }

    const routes: Record<string, () => void> = {
      '/agendamento':       () => { setView('booking'); setActiveSubTab('escolha-sala'); },
      '/checkin':           () => { setView('portal');  setActiveSubTab('checkin'); },
      '/empresa':           () => { setView('portal');  setActiveSubTab('empresa'); },
      '/desafios':          () => { setView('portal');  setActiveSubTab('desafios-publicos'); },
      '/desafios/privados': () => { setView('portal');  setActiveSubTab('desafios-privados'); },
      '/noticias':          () => { setView('news');    setActiveSubTab('news'); },
      '/qcoin':             () => { setView('qcoin');   setActiveSubTab('qcoin'); setExpandedQcoinCard(null); },
      '/bate-papo':         () => { setView('chat');    setActiveSubTab('bate-papo'); },
      '/regras':            () => { setView('regras');  setActiveSubTab('regras'); },
      '/admin':             () => { setView('admin'); },
      '/dashboard':         () => { setView('dashboard'); },
    };
    (routes[path] ?? (() => { setView('general'); setActiveSubTab('general'); }))();
  };

  // URL handling — initial load + browser back/forward
  useEffect(() => {
    applyPath(window.location.pathname);
    const onPop = () => applyPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Auth listener — Google sign-in → exchange Firebase token for JWT
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setFounderData(null);
        setCheckingFounder(false);
        localStorage.removeItem('jwt');
        disconnectSocket();
        setLoading(false);
        return;
      }
      try {
        const idToken = await firebaseUser.getIdToken();
        const { data } = await axios.post(`${API_BASE}/api/auth/google`, { idToken });
        localStorage.setItem('jwt', data.token);
        const apiUser = {
          ...data.user,
          uid: data.user._firebaseId || firebaseUser.uid,
          email: data.user.email || firebaseUser.email,
          displayName: data.user.name || firebaseUser.displayName,
          photoURL: data.user.photoURL || firebaseUser.photoURL,
        };
        setUser(apiUser);
        setFounderData(apiUser);
        getSocket(data.token);
      } catch (err) {
        console.error('Auth exchange failed:', err);
        setUser(null);
      }
      setCheckingFounder(false);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync founder data from API whenever user changes
  useEffect(() => {
    if (!user?._id) return;
    api.get(`/api/founders/${user._id}`)
      .then(r => { setFounderData(r.data); setUser((u: any) => ({ ...u, ...r.data, uid: u.uid })); })
      .catch(() => {});
  }, [user?._id]);

  // Load initial data via REST API + keep updated via Socket.io
  useEffect(() => {
    if (!user) return;

    const parseRows = (raw: any): string[][] => {
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
      if (Array.isArray(raw) && raw.every(r => Array.isArray(r))) return raw;
      if (Array.isArray(raw)) {
        return raw.map((row: any) => {
          if (Array.isArray(row)) return row;
          const keys = Object.keys(row);
          if (keys.every(k => /^col\d+$/.test(k)))
            return keys.sort((a, b) => Number(a.replace('col', '')) - Number(b.replace('col', ''))).map(k => String(row[k] ?? ''));
          const estagiosOrder = ['estagio', 'threshold', 'beneficios', 'requisitos', 'status'];
          if (keys.some(k => estagiosOrder.includes(k))) return estagiosOrder.map(k => String(row[k] ?? ''));
          return Object.values(row).map(String);
        });
      }
      return [];
    };
    const hydrateQcoinTables = (data: any) => {
      const hydrate = (sectionId: string, s: any) => {
        if (!s) return;
        if (sectionId === 'pontuacao') {
          let cols: string[] = s.tableCols || pontuacaoCols;
          let rows: string[][] = s.tableRows ? parseRows(s.tableRows) : pontuacaoRows;
          let colWidths: number[] = s.tableColWidths || pontuacaoColWidths;
          // Migração estrutural: tabelas salvas antes das colunas Tipo/Requer Founder existirem
          // ganham essas colunas de volta (vazias), sem perder o que o admin já cadastrou.
          ['Tipo', 'Requer Founder'].forEach((colName) => {
            if (!cols.some((c: string) => c.trim().toLowerCase() === colName.toLowerCase())) {
              cols = [...cols, colName];
              colWidths = [...colWidths, 110];
              rows = rows.map((r: string[]) => [...r, '']);
            }
          });
          setPontuacaoCols(cols);
          setPontuacaoRows(rows);
          setPontuacaoColWidths(colWidths);
        } else if (sectionId === 'estagios') {
          if (s.tableRows) setEstagiosRows(parseRows(s.tableRows));
          if (s.tableCols) setEstagiosCols(s.tableCols);
          if (s.tableColWidths) setEstagiosColWidths(s.tableColWidths);
        } else if (sectionId === 'ranking') {
          if (s.tableRows) setRankingRows(parseRows(s.tableRows));
          if (s.tableCols) setRankingCols(s.tableCols);
          if (s.tableColWidths) setRankingColWidths(s.tableColWidths);
        } else if (sectionId === 'premiacoes') {
          if (s.tableRows) setPremiacoesRows(parseRows(s.tableRows));
          if (s.tableCols) setPremiacoesCols(s.tableCols);
          if (s.tableColWidths) setPremiacoesColWidths(s.tableColWidths);
        } else if (sectionId === 'consequencias') {
          if (s.tableRows) setConsequenciasRows(parseRows(s.tableRows));
          if (s.tableCols) setConsequenciasCols(s.tableCols);
          if (s.tableColWidths) setConsequenciasColWidths(s.tableColWidths);
        }
      };
      for (const id of ['pontuacao', 'estagios', 'ranking', 'premiacoes', 'consequencias']) hydrate(id, data[id]);
    };

    // Initial load
    Promise.all([
      api.get('/api/rooms').catch(() => ({ data: [] })),
      api.get('/api/bookings').catch(() => ({ data: [] })),
      api.get('/api/settings/global').catch(() => ({ data: null })),
      api.get('/api/founders').catch(() => ({ data: [] })),
      api.get('/api/challenges').catch(() => ({ data: [] })),
      api.get('/api/news').catch(() => ({ data: [] })),
      api.get('/api/qcoin-sections').catch(() => ({ data: {} })),
      api.get('/api/settings/qcoin_tables').catch(() => ({ data: null })),
      api.get('/api/checkins').catch(() => ({ data: [] })),
      api.get('/api/qcoin-requests').catch(() => ({ data: [] })),
    ]).then(([rooms, bookings, settings, founders, challenges, news, qcoinSections, qcoinTables, checkins, qcoinRequestsRes]) => {
      setRooms(rooms.data.map((r: any) => ({ ...r, id: r._id || r.id })));
      setBookings(bookings.data.map((b: any) => ({ ...b, id: b._id || b.id })));
      if (settings.data?.businessHours) setBusinessHours(settings.data.businessHours);
      if (settings.data?.hiddenMenuItems) setHiddenMenuItems(settings.data.hiddenMenuItems);
      if (settings.data?.hiddenNewsIds) setHiddenNewsIds(settings.data.hiddenNewsIds);
      setAllFounders(founders.data.map((f: any) => ({ ...f, id: f._id || f.id })));
      setAllChallenges(challenges.data.map((c: any) => ({ ...c, id: c._id || c.id })));
      setNewsItems(news.data.map((n: any) => ({ ...n, id: n._id || n.id })));
      if (qcoinSections.data) {
        const sections = Object.entries(qcoinSections.data).map(([id, d]: [string, any]) => ({ id, ...d }));
        setQcoinSections(sections);
      }
      if (qcoinTables.data) hydrateQcoinTables(qcoinTables.data);
      setQcoinRequests(qcoinRequestsRes.data.map((r: any) => ({ ...r, id: r._id || r.id })));
      const checkinsData = checkins.data.map((c: any) => ({ ...c, id: c._id || c.id }));
      setAllCheckins(checkinsData);
      setUserCheckins(checkinsData.filter((c: any) => c.userId === user._id || c.userId === user.uid));
    });

    // Socket.io real-time updates
    const socket = getSocket();
    socket.on('founder:new',    (f: any) => setAllFounders(prev => [{ ...f, id: f._id }, ...prev.filter(x => x.id !== f._id)]));
    socket.on('founder:update', (f: any) => {
      const updated = { ...f, id: f._id || f.id };
      setAllFounders(prev => prev.map(x => {
        if (x.id !== updated.id) return x;
        // Preserve company.logoURL if the backend event doesn't include it (strict schema)
        if (x.company?.logoURL && !updated.company?.logoURL) {
          updated.company = { ...updated.company, logoURL: x.company.logoURL };
        }
        return updated;
      }));
      if (user._id && updated.id === user._id) { setFounderData(updated); setUser((u: any) => ({ ...u, ...updated, uid: u.uid })); }
    });
    socket.on('founder:delete', ({ id }: any) => setAllFounders(prev => prev.filter(x => x.id !== id)));
    socket.on('challenge:new',    (c: any) => setAllChallenges(prev => [{ ...c, id: c._id }, ...prev]));
    socket.on('challenge:update', (c: any) => setAllChallenges(prev => prev.map(x => x.id === (c._id || c.id) ? { ...c, id: c._id || c.id } : x)));
    socket.on('challenge:delete', ({ id }: any) => setAllChallenges(prev => prev.filter(x => x.id !== id)));
    socket.on('news:new',    (n: any) => setNewsItems(prev => [{ ...n, id: n._id }, ...prev]));
    socket.on('news:update', (n: any) => setNewsItems(prev => prev.map(x => x.id === (n._id || n.id) ? { ...n, id: n._id || n.id } : x)));
    socket.on('news:delete', ({ id }: any) => setNewsItems(prev => prev.filter(x => x.id !== id)));
    socket.on('booking:new',    (b: any) => setBookings(prev => [{ ...b, id: b._id }, ...prev]));
    socket.on('booking:delete', ({ id }: any) => setBookings(prev => prev.filter(x => x.id !== id)));
    socket.on('checkin:new',    (c: any) => {
      const ci = { ...c, id: c._id };
      setAllCheckins(prev => [ci, ...prev]);
      if (ci.userId === user._id || ci.userId === user.uid) setUserCheckins(prev => [ci, ...prev]);
    });
    socket.on('checkin:update', (c: any) => {
      const ci = { ...c, id: c._id || c.id };
      setAllCheckins(prev => prev.map(x => x.id === ci.id ? ci : x));
      if (ci.userId === user._id || ci.userId === user.uid) setUserCheckins(prev => prev.map(x => x.id === ci.id ? ci : x));
    });
    socket.on('qcoin-request:new',    (r: any) => setQcoinRequests((prev: any[]) => [{ ...r, id: r._id || r.id }, ...prev.filter((x: any) => x.id !== (r._id || r.id))]));
    socket.on('qcoin-request:update', (r: any) => setQcoinRequests((prev: any[]) => prev.map((x: any) => x.id === (r._id || r.id) ? { ...r, id: r._id || r.id } : x)));
    socket.on('settings:update', ({ key, data }: any) => {
      if (key === 'global' && data?.businessHours) setBusinessHours(data.businessHours);
      if (key === 'global' && data?.hiddenMenuItems !== undefined) setHiddenMenuItems(data.hiddenMenuItems || []);
      if (key === 'global' && data?.hiddenNewsIds !== undefined) setHiddenNewsIds(data.hiddenNewsIds || []);
      if (key === 'qcoin_tables' && data) hydrateQcoinTables(data);
    });
    socket.on('qcoin_sections:update', ({ id, data }: any) => {
      setQcoinSections(prev => {
        const filtered = prev.filter((s: any) => s.id !== id);
        return [...filtered, { id, ...data }];
      });
    });

    return () => {
      socket.off('founder:new'); socket.off('founder:update'); socket.off('founder:delete');
      socket.off('challenge:new'); socket.off('challenge:update'); socket.off('challenge:delete');
      socket.off('news:new'); socket.off('news:update'); socket.off('news:delete');
      socket.off('booking:new'); socket.off('booking:delete');
      socket.off('checkin:new'); socket.off('checkin:update');
      socket.off('qcoin-request:new'); socket.off('qcoin-request:update');
      socket.off('settings:update'); socket.off('qcoin_sections:update');
    };
  }, [user?._id]);

  const seedRooms = async () => {
    const initialRooms = [
      { name: 'Sala de Reunião 1', description: 'Sala individual' },
      { name: 'Sala de Reunião 2', description: 'Sala para 2 a 4 pessoas' },
      { name: 'Sala de Reunião 3', description: 'Sala de reunião para 6 a 8 pessoas' },
    ];
    for (const room of initialRooms) {
      await api.post('/api/rooms', room).catch(() => {});
    }
  };

  const handleRoomUpdate = async (roomId: string, updates: Partial<Room>) => {
    await api.put(`/api/rooms/${roomId}`, updates);
    setRooms((prev: Room[]) => prev.map((r: Room) => r.id === roomId ? { ...r, ...updates } : r));
  };

  const handleRoomCreate = async (data: { name: string; description?: string }) => {
    const res = await api.post('/api/rooms', data);
    const created = res.data;
    const newRoom: Room = { ...created, id: created._id || created.id };
    setRooms((prev: Room[]) => [...prev, newRoom]);
    return newRoom;
  };

  const handleEventCheckin = async (event: any) => {
    if (!user?._id || !founderData) return;
    // Synchronous guard — prevents concurrent calls even before React re-renders
    if (eventCheckinInFlight.current) return;
    const eventId = String(event.id || event._id);
    const already = (founderData.eventAttendance || []).map(String).includes(eventId);
    if (already) return;

    setEventCheckinError(null);

    // Time window: from startTime until 23:59 of the event day
    if (event.eventDate) {
      const now = new Date();
      const yy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const today = `${yy}-${mm}-${dd}`;
      if (today !== event.eventDate) {
        setEventCheckinError('Check-in disponível apenas no dia do evento.');
        return;
      }
      if (event.startTime) {
        const [h, m] = event.startTime.split(':').map(Number);
        const nowMins = now.getHours() * 60 + now.getMinutes();
        if (nowMins < h * 60 + m) {
          setEventCheckinError(`Check-in disponível a partir das ${event.startTime}.`);
          return;
        }
      }
    }

    // Geolocation validation
    if (!navigator.geolocation) {
      setEventCheckinError('Geolocalização não disponível neste dispositivo.');
      return;
    }

    eventCheckinInFlight.current = true;
    setEventCheckinLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const dist = calcDistance(position.coords.latitude, position.coords.longitude, QDDO_LOCATION.lat, QDDO_LOCATION.lng);
        if (dist > QDDO_LOCATION.radius) {
          setEventCheckinError(`Você precisa estar no QDDO para fazer check-in (${Math.round(dist)}m de distância).`);
          setEventCheckinLoading(false);
          eventCheckinInFlight.current = false;
          return;
        }
        try {
          // Atomic endpoint: server rejects duplicate with 409
          const { data } = await api.post(`/api/founders/${user._id}/event-checkin`, { eventId, points: 20 });
          const now = new Date();
          setEventCheckinTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
          setFounderData((prev: any) => ({
            ...prev,
            totalPoints: data.totalPoints,
            eventAttendance: (data.eventAttendance || []).map(String),
          }));
        } catch (err: any) {
          if (err?.response?.status === 409) {
            // Already registered — sync local state from server response
            const serverUser = err.response.data?.user;
            if (serverUser) {
              setFounderData((prev: any) => ({
                ...prev,
                totalPoints: serverUser.totalPoints,
                eventAttendance: (serverUser.eventAttendance || []).map(String),
              }));
            }
          } else {
            setEventCheckinError('Erro ao registrar presença. Tente novamente.');
          }
        } finally {
          setEventCheckinLoading(false);
          eventCheckinInFlight.current = false;
        }
      },
      (err) => {
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Permissão de localização negada. Ative o acesso e tente novamente.'
          : 'Não foi possível obter sua localização.';
        setEventCheckinError(msg);
        setEventCheckinLoading(false);
        eventCheckinInFlight.current = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleRegister = async () => {
    setIsRegistering(true);
    await handleLogin();
  };

  const handleLogout = () => { signOut(auth); disconnectSocket(); localStorage.removeItem('jwt'); };

  const handleSaveRule = async () => {
    if (!editingRuleId) return;
    await api.put(`/api/news/${editingRuleId}`, { title: editingRuleData.title, content: editingRuleData.content });
    setEditingRuleId(null);
  };

  const handleAddRegra = async () => {
    if (!newRegraTitle.trim()) return;
    await api.post('/api/news', { title: newRegraTitle.trim(), content: newRegraContent.trim(), category: 'regras' });
    setNewRegraTitle('');
    setNewRegraContent('');
    setShowAddRegra(false);
  };

  const handleDeleteRule = async (id: string) => {
    await api.delete(`/api/news/${id}`);
    setDeletingRuleId(null);
  };

  const handleSaveQcoinSection = async (sectionId: string) => {
    setSavingQcoinSection(true);
    try {
      await api.put(`/api/qcoin-sections/${sectionId}`, { content: qcoinEditContent, updatedAt: new Date().toISOString() });
      setEditingQcoinSection(null);
    } catch (error) {
      console.error('Error saving QCoin section:', error);
    } finally {
      setSavingQcoinSection(false);
    }
  };

  const handleSaveQcoinTable = async (sectionId: string) => {
    setSavingQcoinSection(true);
    setQcoinTableSaveStatus(null);
    try {
      let tableData: any = {};
      if (sectionId === 'pontuacao') tableData = { tableRows: JSON.stringify(pontuacaoRows), tableCols: pontuacaoCols, tableColWidths: pontuacaoColWidths };
      else if (sectionId === 'estagios') tableData = { tableRows: JSON.stringify(estagiosRows), tableCols: estagiosCols, tableColWidths: estagiosColWidths };
      else if (sectionId === 'ranking') tableData = { tableRows: JSON.stringify(rankingRows), tableCols: rankingCols, tableColWidths: rankingColWidths };
      else if (sectionId === 'premiacoes') tableData = { tableRows: JSON.stringify(premiacoesRows), tableCols: premiacoesCols, tableColWidths: premiacoesColWidths };
      else if (sectionId === 'consequencias') tableData = { tableRows: JSON.stringify(consequenciasRows), tableCols: consequenciasCols, tableColWidths: consequenciasColWidths };

      const existing = await api.get('/api/settings/qcoin_tables').then(r => r.data || {}).catch(() => ({}));
      await api.put('/api/settings/qcoin_tables', { ...existing, [sectionId]: tableData });
      setQcoinTableSaveStatus('success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error saving QCoin table:', msg);
      setQcoinTableSaveError(msg);
      setQcoinTableSaveStatus('error');
    } finally {
      setSavingQcoinSection(false);
      setTimeout(() => { setQcoinTableSaveStatus(null); setQcoinTableSaveError(''); }, 3000);
    }
  };

  const toggleHideMenuItem = async (key: string) => {
    const updated = hiddenMenuItems.includes(key)
      ? hiddenMenuItems.filter((k: string) => k !== key)
      : [...hiddenMenuItems, key];
    setHiddenMenuItems(updated);
    await api.put('/api/settings/global', { hiddenMenuItems: updated });
  };

  const isAdmin = user?.email === ADMIN_EMAIL || user?.role === 'admin' || founderData?.role === 'admin';
  const isMasterAdmin = user?.email === ADMIN_EMAIL;

  const toggleAvisoFromNews = async (avisoId: string) => {
    const isHidden = hiddenNewsIds.includes(avisoId);
    const updated = isHidden
      ? hiddenNewsIds.filter(id => id !== avisoId)
      : [...hiddenNewsIds, avisoId];
    setHiddenNewsIds(updated);
    try {
      await api.put('/api/settings/global', { hiddenNewsIds: updated });
    } catch {
      setHiddenNewsIds(hiddenNewsIds);
    }
  };

  if (loading || (user && checkingFounder)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="animate-pulse text-stone-500 text-h3">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} onRegister={handleRegister} />;
  }

  if (!founderData && !isAdmin) {
    return <RegistrationFlow user={user} onComplete={() => {
      setView('general');
      setActiveSubTab('general');
    }} />;
  }

  return (
    <div className="h-[100svh] overflow-hidden bg-[#F5F5F0] text-stone-900 font-sans selection:bg-stone-200 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-md text-stone-500 hover:bg-stone-100 transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => {
                window.history.pushState({}, '', '/');
                setView('general');
                setActiveSubTab('general');
                setSelectedRoomId(null);
              }}
            >
            <div className="relative w-10 h-10 bg-black rounded-lg flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
              <div className="w-6 h-6 border-[3px] border-white rounded-full"></div>
              <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF4500] rounded-full shadow-[0_0_8px_rgba(255,69,0,0.4)]"></div>
            </div>
            <h1 className="font-sans font-black text-h2 tracking-tighter">qddo</h1>
          </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button 
                onClick={() => setView(view === 'admin' ? 'booking' : 'admin')}
                className="text-xs uppercase tracking-widest font-semibold text-stone-500 hover:text-stone-900 transition-colors"
              >
                {view === 'admin' ? 'Sair do Admin' : 'Painel Admin'}
              </button>
            )}
            
            {user && (
              <div ref={profileMenuRef} className="relative pl-4 border-l border-stone-200">
                <button
                  onClick={() => setProfileMenuOpen((prev: boolean) => !prev)}
                  className="flex items-center gap-2 rounded-full focus:outline-none"
                >
                  <img
                    src={user.photoURL || ''}
                    alt=""
                    className="w-8 h-8 rounded-full border border-stone-100 hover:ring-2 hover:ring-stone-400 transition-all cursor-pointer"
                    referrerPolicy="no-referrer"
                  />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-stone-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-stone-100">
                      <p className="text-sm font-semibold text-stone-900 truncate">{user.displayName || 'Founder'}</p>
                      <p className="text-xs text-stone-400 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={openProfileModal}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <Users size={15} />
                      Meu Perfil
                    </button>
                    <button
                      onClick={openSocialModal}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <Globe size={15} />
                      Social
                    </button>
                    <button
                      onClick={openSettingsModal}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <Settings size={15} />
                      Configurações
                    </button>
                    <button
                      onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={15} />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "absolute md:relative z-50 flex flex-col bg-white border-r border-stone-200 h-full overflow-y-auto transition-all duration-300 ease-in-out w-72 shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:-ml-72"
        )}>
          <div className="p-6 space-y-8">
            {/* Geral Section */}
            {!hiddenMenuItems.includes('geral') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/'); setView('general'); setActiveSubTab('general'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'general' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'general' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <LayoutGrid size={18} />
                    </div>
                    <span className={`text-lg transition-colors ${view === 'general' ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>Geral</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('geral')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Agendamento Section */}
            {!hiddenMenuItems.includes('agendamento') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/agendamento'); setView('booking'); setActiveSubTab('escolha-sala'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'booking' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'booking' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <Calendar size={18} />
                    </div>
                    <span className={`text-lg transition-colors ${view === 'booking' ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>Agendamento</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('agendamento')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Check-in Section */}
            {!hiddenMenuItems.includes('checkin') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/checkin'); setView('portal'); setActiveSubTab('checkin'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'portal' && activeSubTab === 'checkin' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'portal' && activeSubTab === 'checkin' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <CheckSquare size={18} />
                    </div>
                    <span className={`text-lg transition-colors ${view === 'portal' && activeSubTab === 'checkin' ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>Check-in</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('checkin')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Empresa Section */}
            {!hiddenMenuItems.includes('empresa') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/empresa'); setView('portal'); setActiveSubTab('empresa'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'portal' && activeSubTab === 'empresa' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'portal' && activeSubTab === 'empresa' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <Building2 size={18} />
                    </div>
                    <span className={`text-lg transition-colors ${view === 'portal' && activeSubTab === 'empresa' ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>Empresa</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('empresa')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Desafios Section */}
            {!hiddenMenuItems.includes('desafios') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/desafios'); setView('portal'); setActiveSubTab('desafios-publicos'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'portal' && (activeSubTab === 'desafios-publicos' || activeSubTab === 'desafios-privados') ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'portal' && (activeSubTab === 'desafios-publicos' || activeSubTab === 'desafios-privados') ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <Globe size={18} />
                    </div>
                    <span className={`text-lg transition-colors ${view === 'portal' && (activeSubTab === 'desafios-publicos' || activeSubTab === 'desafios-privados') ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>Desafios</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('desafios')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Notícias Section */}
            {!hiddenMenuItems.includes('noticias') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/noticias'); setView('news'); setActiveSubTab('news'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'news' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'news' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <Newspaper size={18} />
                    </div>
                    <span className={`text-lg transition-colors ${view === 'news' ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>Notícias</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('noticias')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* QCoin Section */}
            {!hiddenMenuItems.includes('qcoin') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/qcoin'); setView('qcoin'); setActiveSubTab('qcoin'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'qcoin' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'qcoin' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <Trophy size={18} />
                    </div>
                    <span className={`text-lg transition-colors ${view === 'qcoin' ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>QCoin</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('qcoin')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Bate-papo Section */}
            {!hiddenMenuItems.includes('bate-papo') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/bate-papo'); setView('chat'); setActiveSubTab('bate-papo'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'chat' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'chat' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <MessageSquare size={18} />
                    </div>
                    <span className={`text-lg ${view === 'chat' ? 'text-white font-semibold' : 'text-stone-900'}`}>Bate-papo</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('bate-papo')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Dashboard — admin only */}
            {isAdmin && (
              <div>
                <button
                  onClick={() => { window.history.pushState({}, '', '/dashboard'); setView('dashboard'); }}
                  className={`flex items-center gap-3 w-full text-left group transition-all p-2 rounded-md ${
                    view === 'dashboard' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === 'dashboard' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                  }`}>
                    <LayoutDashboard size={18} />
                  </div>
                  <span className={`text-lg transition-colors ${view === 'dashboard' ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>Dashboard</span>
                </button>
              </div>
            )}

            {/* Regras Section */}
            {!hiddenMenuItems.includes('regras') && (
              <div className="group/item">
                <div className="flex items-center">
                  <button
                    onClick={() => { window.history.pushState({}, '', '/regras'); setView('regras'); setActiveSubTab('regras'); }}
                    className={`flex items-center gap-3 flex-1 text-left group transition-all p-2 rounded-md ${
                      view === 'regras' ? 'bg-primary text-white shadow-lg shadow-primary/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      view === 'regras' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white'
                    }`}>
                      <ShieldCheck size={18} />
                    </div>
                    <span className={`text-lg transition-colors ${view === 'regras' ? 'text-white font-semibold' : 'text-stone-900 group-hover:text-primary'}`}>Regras</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleHideMenuItem('regras')}
                      title="Ocultar do menu"
                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md ml-1 shrink-0"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto">
            <div className="px-6 pt-6 pb-3">
              <p className="text-overline uppercase tracking-widest font-bold text-stone-400 mb-3">Redes Sociais</p>
              <div className="flex flex-col gap-2">
                <a
                  href="https://www.instagram.com/qddo.central/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-900 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  </div>
                  <span className="font-medium">@qddo.central</span>
                </a>
                <a
                  href="https://tiktok.com/@qddo.central.hub"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-900 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.22 8.22 0 0 0 4.83 1.56V6.78a4.85 4.85 0 0 1-1.06-.09z"/></svg>
                  </div>
                  <span className="font-medium">@qddo.central.hub</span>
                </a>
              </div>
            </div>
            <div className="px-6 pb-3">
              <p className="text-overline uppercase tracking-widest font-bold text-stone-400 mb-2">Contato</p>
              <div ref={emailRef} className="relative flex items-center gap-2 text-xs text-stone-500 group">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors bg-stone-100 text-stone-600 group-hover:bg-primary group-hover:text-white flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <button
                  onClick={() => setShowEmailCopy(prev => !prev)}
                  className="font-medium hover:text-stone-700 transition-colors cursor-pointer text-left"
                >
                  qddocentral.hub@h4ndslab.com
                </button>
                {showEmailCopy && (
                  <div className="absolute bottom-6 left-0 bg-white border border-stone-100 rounded-lg shadow-lg py-1 z-50 min-w-max">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('qddocentral.hub@h4ndslab.com');
                        setEmailCopied(true);
                        setTimeout(() => {
                          setEmailCopied(false);
                          setShowEmailCopy(false);
                        }, 1500);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 w-full text-left transition-colors"
                    >
                      {emailCopied ? (
                        <>
                          <Check size={12} className="text-green-500" />
                          <span className="text-green-600">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          Copiar e-mail
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 w-full min-w-0 ${view === 'chat' ? 'overflow-hidden p-2 md:p-4' : 'overflow-y-auto overflow-x-hidden p-4 md:p-6'}`}>
          <div className={view === 'chat' ? 'h-full' : 'max-w-[1600px] mx-auto'}>
            {view === 'admin' ? (
              <AdminPanel
                user={user}
                onLogin={handleLogin}
                rooms={rooms}
                bookings={bookings}
                businessHours={businessHours}
                isAdmin={isAdmin}
                isMasterAdmin={isMasterAdmin}
                founders={allFounders}
                initialTab={adminInitialTab}
                initialEditNewsItem={adminInitialEditNewsItem}
                onEditNewsConsumed={() => setAdminInitialEditNewsItem(null)}
                hiddenMenuItems={hiddenMenuItems}
                onRestoreMenuItem={toggleHideMenuItem}
                qcoinActions={pontuacaoRows}
              />
            ) : view === 'portal' ? (
              <FounderPortal
                user={user}
                activeSubTab={activeSubTab}
                setActiveSubTab={(tab: string) => {
                  const urlMap: Record<string, string> = {
                    'desafios-publicos': '/desafios',
                    'desafios-privados': '/desafios/privados',
                  };
                  if (urlMap[tab]) window.history.pushState({}, '', urlMap[tab]);
                  setActiveSubTab(tab);
                }}
                isAdmin={isAdmin}
                isMasterAdmin={isMasterAdmin}
                founders={allFounders}
              />
            ) : view === 'chat' ? (
              <Chat user={user} />
            ) : view === 'news' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {newsItems
                    .filter(item => {
                      if (item.category === 'evento') return true;
                      if (item.category === 'aviso') {
                        if (hiddenNewsIds.includes(item.id)) return false;
                        const date = toDate(item.createdAt);
                        if (!date) return true;
                        return date >= startOfWeek(new Date(), { weekStartsOn: 0 });
                      }
                      return false;
                    })
                    .sort((a, b) => {
                      const secA = toDate(a.createdAt)?.getTime() ?? 0;
                      const secB = toDate(b.createdAt)?.getTime() ?? 0;
                      return secB - secA;
                    })
                    .map((item, i) => {
                      const isAviso = item.category === 'aviso';
                      return (
                        <div key={item.id || i} className="bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col">
                          {/* Image area */}
                          <div className="w-full h-32 bg-stone-100 overflow-hidden flex-shrink-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {isAviso
                                  ? <AlertTriangle size={28} className="text-stone-200" />
                                  : <CalendarDays size={28} className="text-stone-200" />
                                }
                              </div>
                            )}
                          </div>

                          <div className="p-4 flex flex-col flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {isAviso ? (
                                <span className="text-overline uppercase tracking-widest font-bold bg-rose-50 px-2 py-0.5 rounded-full text-rose-500 flex items-center gap-1">
                                  <AlertTriangle size={9} />
                                  Aviso
                                </span>
                              ) : (
                                <span className="text-overline uppercase tracking-widest font-bold bg-stone-100 px-2 py-0.5 rounded-full text-stone-500">Evento</span>
                              )}
                              <span className="text-overline uppercase tracking-widest font-bold text-stone-400">
                                {isAviso
                                  ? (toDate(item.createdAt)?.toLocaleDateString('pt-BR') || '')
                                  : (toDate(item.eventDate)?.toLocaleDateString('pt-BR') || toDate(item.createdAt)?.toLocaleDateString('pt-BR') || '')}
                              </span>
                            </div>

                            {!isAviso && (item.startTime || item.endTime) && (
                              <span className="text-overline uppercase tracking-widest font-bold text-primary flex items-center gap-1.5 mb-2">
                                <Clock size={10} />
                                {item.startTime || '--:--'}{item.endTime && ` – ${item.endTime}`}
                              </span>
                            )}

                            <h3 className="text-sm font-sans font-bold mb-1 group-hover:text-stone-600 transition-colors line-clamp-2 uppercase tracking-tight">{item.title}</h3>
                            <p className="text-stone-500 text-xs leading-relaxed line-clamp-3 flex-1" dangerouslySetInnerHTML={{ __html: item.content }} />

                            <div className="mt-3 pt-3 border-t border-stone-50 flex items-center justify-between gap-2">
                              <button
                                onClick={() => setSelectedNewsItem(item)}
                                className="text-overline font-bold uppercase tracking-widest text-stone-900 flex items-center gap-1.5 group-hover:gap-2 transition-all"
                              >
                                {isAviso ? 'Ver aviso' : 'Detalhes'} <ArrowRight size={12} />
                              </button>
                              {item.attachmentUrl && (
                                <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-stone-50 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all">
                                  <Paperclip size={13} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {newsItems.filter(item => {
                    if (item.category === 'evento') return true;
                    if (item.category === 'aviso') {
                      if (hiddenNewsIds.includes(item.id)) return false;
                      const date = toDate(item.createdAt);
                      if (!date) return true;
                      return date >= startOfWeek(new Date(), { weekStartsOn: 0 });
                    }
                    return false;
                  }).length === 0 && (
                    <div className="col-span-4 text-center py-20 bg-white rounded-xl border border-dashed border-stone-200">
                      <p className="text-stone-400">Nenhum aviso ou evento publicado no momento.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : view === 'qcoin' ? (
              (() => {
                const _now = new Date();
                const _monthLabel = format(_now, 'MMMM yyyy', { locale: ptBR });
                const _ym = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`;
                const _myId = user?._id || user?.uid;

                const _ranking = [...allFounders]
                  .map((f: any) => ({
                    id: f.id || f._id,
                    name: f.name || 'Founder',
                    username: (f.username || '').replace(/^@/, ''),
                    photoURL: f.photoURL || null,
                    coins: f.monthlyPoints?.[_ym] ?? f.monthlyPoints?.get?.(_ym) ?? 0,
                    totalPoints: f.totalPoints || 0,
                  }))
                  .sort((a: any, b: any) => b.coins - a.coins);

                // founderData.id pode conter lixo de migração do Firestore (o antigo doc ID, == firebase UID) — _id do Mongo é sempre confiável
                const _myFounderId = founderData?._id || founderData?.id || _myId;
                const _myIdx = _ranking.findIndex((f: any) => f.id === _myFounderId);
                const _myRank = _myIdx + 1;
                const _me = _myIdx >= 0 ? _ranking[_myIdx] : { id: _myFounderId, name: founderData?.name || user?.name || user?.displayName || 'Você', username: founderData?.username || '', photoURL: founderData?.photoURL || null, coins: 0, totalPoints: founderData?.totalPoints || 0 };

                // Admin pode selecionar outro founder na lista de ranking para inspecionar seus dados
                const _viewingOther = isAdmin && !!qcoinViewingFounderId && qcoinViewingFounderId !== _myFounderId;
                const _viewIdx = _viewingOther ? _ranking.findIndex((f: any) => f.id === qcoinViewingFounderId) : _myIdx;
                const _viewRank = _viewIdx + 1;
                const _view = _viewingOther && _viewIdx >= 0 ? _ranking[_viewIdx] : _me;
                const _heroName = _viewingOther ? _view.name : (founderData?.name || user?.displayName || 'Você');

                const _totalPoints: number = _viewingOther
                  ? (_view.coins ?? 0)
                  : (founderData?.monthlyPoints?.[_ym] ?? founderData?.monthlyPoints?.get?.(_ym) ?? _me.coins ?? 0);
                // Pula empates: encontra o primeiro acima com coins > a pontuação de quem está sendo exibido
                const _above = (() => {
                  if (_viewIdx <= 0) return null;
                  for (let i = _viewIdx - 1; i >= 0; i--) {
                    if (_ranking[i].coins > (_view.coins ?? 0)) return _ranking[i];
                  }
                  return null;
                })();
                const _aboveRank = _above ? _ranking.findIndex((r: any) => r.id === _above.id) + 1 : 0;
                const _coinsToNext = _above ? Math.max(0, _above.coins - (_view.coins ?? 0)) : 0;

                const _thrIdx = estagiosCols.findIndex((c: string) => /thr/i.test(c.trim()));
                const _stagesRaw: any[] = estagiosRows
                  .filter((r: string[]) => r[0]?.trim())
                  .map((r: string[], i: number) => ({
                    name: (r[0] || '').split(/\s*->\s*|\s*→\s*/)[0].trim() || `Estágio ${i+1}`,
                    fullName: (r[0] || '').trim(),
                    thr: _thrIdx >= 0 ? (parseInt(r[_thrIdx]) || 0) : [0, 50, 120, 220, 400][i] ?? i * 80,
                    row: r,
                  }));
                const _stages: any[] = _stagesRaw.length >= 2 ? _stagesRaw : [
                  { name: 'Cinza', fullName: 'Cinza', thr: 0, row: [] },
                  { name: 'Bronze', fullName: 'Bronze', thr: 50, row: [] },
                  { name: 'Prata', fullName: 'Prata', thr: 120, row: [] },
                  { name: 'Ouro', fullName: 'Ouro', thr: 220, row: [] },
                  { name: 'Diamante', fullName: 'Diamante', thr: 400, row: [] },
                ];
                const _curIdx = _stages.reduce((b: number, s: any, i: number) => _totalPoints >= s.thr ? i : b, 0);
                const _curStage = _stages[_curIdx];
                const _nxtStage = _stages[_curIdx + 1];
                const _stagePct = _nxtStage
                  ? Math.min(100, Math.round(((_totalPoints - _curStage.thr) / Math.max(1, _nxtStage.thr - _curStage.thr)) * 100))
                  : 100;
                const _stageDelta = _nxtStage ? Math.max(0, _nxtStage.thr - _totalPoints) : 0;

                const _tipoIdx = pontuacaoCols.findIndex((c: string) => c.trim().toLowerCase() === 'tipo');
                const _requerFounderIdx = pontuacaoCols.findIndex((c: string) => c.trim().toLowerCase().includes('requer'));
                const _actions = pontuacaoRows.filter((r: string[]) => r[0]?.trim()).map((r: string[]) => ({
                  title: r[0]?.trim() || '',
                  pts: r[1]?.trim() || '',
                  tipo: (_tipoIdx >= 0 ? r[_tipoIdx]?.trim() : '') || 'Manual',
                  requerFounder: _requerFounderIdx >= 0 && /^sim$/i.test(r[_requerFounderIdx]?.trim() || ''),
                }));
                const _manualActions = _actions.filter((a: any) => a.tipo.toLowerCase() !== 'automático' && a.tipo.toLowerCase() !== 'automatico');
                // Muitas contas migradas do Firestore não têm e-mail salvo no Mongo — casa por ID primeiro, e-mail como fallback
                const _myQcoinRequests = qcoinRequests.filter((r: any) => r.founderId === _myFounderId || r.founderEmail === user?.email).sort((a: any, b: any) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
                const _pendingConfirmations = qcoinRequests.filter((r: any) => (r.paraFounderId === _myFounderId || r.paraFounderEmail === user?.email) && r.status === 'aguardando_confirmacao');
                const _pendingApprovalQueue = qcoinRequests.filter((r: any) => r.status === 'pendente').sort((a: any, b: any) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
                const _premios = premiacoesRows.filter((r: string[]) => r[0]?.trim()).map((r: string[]) => ({ name: r[0]?.trim() || '', desc: r[1]?.trim() || '', cost: r[2]?.trim() || r[1]?.trim() || '' }));

                const _displayRows: Array<{item: any; rIdx: number; sep?: boolean}> =
                  _ranking.map((item: any, rIdx: number) => ({ item, rIdx }));

                const _toMs = (t: any): number => {
                  if (!t) return 0;
                  if (typeof t === 'number') return t;
                  if (t?.toDate) return t.toDate().getTime();
                  if (t?.seconds) return t.seconds * 1000;
                  return new Date(t).getTime() || 0;
                };
                // userCheckins pode estar vazio por race condition (filtrado antes de user._id ser atualizado)
                // fallback: usa allCheckins filtrado pelo founderData._id que é confiável
                const _fId = founderData?._id || founderData?.id;
                const _myCheckins = (() => {
                  if (userCheckins.length > 0) return userCheckins;
                  if (!_fId) return [];
                  return allCheckins.filter((c: any) =>
                    c.userId === _fId || c.userId === user?._id || c.userId === user?.uid
                  );
                })();
                // Quando um admin está inspecionando outro founder, os check-ins vêm de allCheckins (não há fallback userCheckins para terceiros)
                const _targetCheckins = _viewingOther
                  ? allCheckins.filter((c: any) => c.userId === qcoinViewingFounderId)
                  : _myCheckins;

                const _recentCheckins = [..._targetCheckins]
                  .sort((a: any, b: any) => _toMs(b.checkinTime || b.date) - _toMs(a.checkinTime || a.date))
                  .slice(0, 4);

                const _weekStart = new Date(_now);
                const _dayOfWeek = _weekStart.getDay();
                _weekStart.setDate(_weekStart.getDate() - (_dayOfWeek === 0 ? 6 : _dayOfWeek - 1));
                _weekStart.setHours(0, 0, 0, 0);
                const _monthStart = new Date(_now.getFullYear(), _now.getMonth(), 1);
                const _monthCheckins = _targetCheckins.filter((c: any) => _toMs(c.checkinTime || c.date) >= _monthStart.getTime());
                const _weekCheckins = _monthCheckins.filter((c: any) => _toMs(c.checkinTime || c.date) >= _weekStart.getTime());
                const _weekPtsFromField = _weekCheckins.reduce((s: number, c: any) => s + Number(c.points || c.pts || 0), 0);
                // Se check-ins não têm campo points, apura proporcionalmente ao total mensal
                const _weekPoints = _weekPtsFromField > 0
                  ? _weekPtsFromField
                  : (_weekCheckins.length > 0 && _monthCheckins.length > 0)
                    ? Math.round(_totalPoints * (_weekCheckins.length / _monthCheckins.length))
                    : 0;

                const _suggestedAction = _actions.find((a: any) => { const n = parseInt(a.pts); return !isNaN(n) && n >= _coinsToNext; }) || _actions[0];

                return (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">

                    {/* ── AGUARDANDO SUA CONFIRMAÇÃO ── */}
                    {_pendingConfirmations.length > 0 && (
                      <div className="bg-terracota-50 border border-terracota-200 rounded-xl p-5 flex flex-col gap-3 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={18} className="text-primary" />
                          <h4 className="font-bold text-terracota-900">
                            {_pendingConfirmations.length === 1 ? 'Você tem 1 solicitação aguardando sua confirmação' : `Você tem ${_pendingConfirmations.length} solicitações aguardando sua confirmação`}
                          </h4>
                        </div>
                        {_pendingConfirmations.map((r: any) => (
                          <div key={r.id} className="bg-white rounded-lg border border-terracota-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-stone-900">
                                <span className="font-bold">{r.founderNome}</span> diz ter ajudado você em: <span className="font-semibold">{r.acao}</span>
                              </p>
                              <p className="text-xs text-stone-400 mt-0.5">"{r.observacao}"</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                disabled={confirmingQcoinRequestId === r.id}
                                onClick={() => handleConfirmarQcoinRequest(r.id, 'confirmar')}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-all font-bold text-xs disabled:opacity-60"
                              >
                                <Check size={14} />Confirmar
                              </button>
                              <button
                                disabled={confirmingQcoinRequestId === r.id}
                                onClick={() => handleConfirmarQcoinRequest(r.id, 'recusar')}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-md transition-all font-bold text-xs disabled:opacity-60"
                              >
                                <X size={14} />Recusar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── VISUALIZANDO OUTRO FOUNDER (admin) ── */}
                    {_viewingOther && (
                      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 min-w-0">
                          <Eye size={14} className="text-primary shrink-0" />
                          <span className="text-sm font-semibold text-primary truncate">Visualizando dados de {_view.name}</span>
                        </div>
                        <button
                          onClick={() => setQcoinViewingFounderId(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all shrink-0"
                        >
                          <X size={12} />Voltar para meus dados
                        </button>
                      </div>
                    )}

                    {/* ── 1. HERO ── */}
                    <div className="bg-white rounded-2xl border border-stone-100 px-5 pt-4 pb-5 space-y-4">
                      {/* Linha 1: título + mês */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Trophy size={11} className="text-stone-400" />
                          <span className="text-overline font-bold uppercase tracking-widest text-stone-400">QCoins</span>
                        </div>
                        <span className="text-overline font-semibold text-stone-400 capitalize">{_monthLabel}</span>
                      </div>
                      {/* Linha 2: nome + saldo + semana + rank */}
                      <div>
                        <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap">
                          <span className="text-sm font-semibold text-stone-500 self-center">{_heroName}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-stone-900 tabular-nums leading-none">{_totalPoints.toLocaleString('pt-BR')}</span>
                            <span className="text-sm font-medium text-stone-400">QCoins</span>
                          </div>
                          {_weekPoints > 0 && (
                            <span className="text-sm font-semibold text-emerald-600 self-center">+{_weekPoints.toLocaleString('pt-BR')} esta semana</span>
                          )}
                          {_viewRank > 0 && (
                            <span className="text-sm font-semibold text-stone-400 self-center">#{_viewRank} no ranking</span>
                          )}
                        </div>
                        {/* Linha 3: rival */}
                        {_above && _coinsToNext > 0 && (
                          <p className="text-sm text-stone-400 mt-2">
                            {_viewingOther ? _view.name : 'Você'} está a{' '}
                            <span className="font-bold text-primary">{_coinsToNext.toLocaleString('pt-BR')} moedas</span>
                            {' '}de ultrapassar{' '}
                            <span className="font-semibold text-stone-700">{_above.name}</span>
                            <span className="text-stone-300"> (#{_aboveRank})</span>
                          </p>
                        )}
                      </div>
                      {/* Linha 4: barra de estágio */}
                      {_nxtStage ? (
                        <div className="pt-3 border-t border-stone-100">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-stone-500 shrink-0">{_curStage?.name}</span>
                            <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.max(0, _stagePct)}%` }} />
                            </div>
                            <span className="text-xs text-stone-500 shrink-0 tabular-nums">{Math.max(0, _stagePct)}% → {_nxtStage.name}</span>
                            <span className="text-xs text-stone-400 shrink-0 hidden sm:inline">(faltam {_stageDelta} moedas)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-stone-100">
                          <p className="text-xs font-semibold text-primary">{_curStage?.name} — estágio máximo atingido</p>
                        </div>
                      )}
                    </div>

                    {/* ── 2. RANKING + SIDEBAR ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                      {/* Ranking — 2 colunas */}
                      <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-100 overflow-hidden">
                        <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-2">
                            <Crown size={15} className="text-primary" />
                            <span className="text-sm font-semibold text-stone-900">Ranking Geral</span>
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-stone-400 capitalize">{_monthLabel}</span>
                        </div>
                        <div className="overflow-y-auto max-h-[460px]">
                          {_ranking.length === 0 ? (
                            <p className="text-sm text-stone-400 text-center py-10">Nenhum founder cadastrado.</p>
                          ) : (
                            _displayRows.map(({ item, rIdx, sep }, di) => {
                              if (sep) return (
                                <div key={`sep-${di}`} className="py-1.5 text-center text-xs text-stone-300 select-none border-b border-stone-50">···</div>
                              );
                              const isMe = item?.id === _myId;
                              const isSelected = _viewingOther && item?.id === qcoinViewingFounderId;
                              const medal = rIdx === 0 ? '🥇' : rIdx === 1 ? '🥈' : rIdx === 2 ? '🥉' : null;
                              return (
                                <div key={item?.id || di}
                                  onClick={isAdmin && !isMe ? () => setQcoinViewingFounderId(item?.id) : undefined}
                                  className={cn(
                                    "flex items-center gap-3 px-5 py-2.5 border-b border-stone-50 transition-colors",
                                    isAdmin && !isMe ? "cursor-pointer" : "",
                                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : isMe ? "bg-terracota-100/20 border-l-2 border-l-primary" : "hover:bg-primary/5"
                                  )}>
                                  <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                                    rIdx === 0 ? "bg-amber-100 text-amber-700" :
                                    rIdx === 1 ? "bg-stone-200 text-stone-500" :
                                    rIdx === 2 ? "bg-orange-100 text-orange-600" :
                                    "bg-stone-50 text-stone-400"
                                  )}>
                                    {medal || rIdx + 1}
                                  </div>
                                  {item?.photoURL ? (
                                    <img src={item.photoURL} alt={item.name} referrerPolicy="no-referrer"
                                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-stone-100"
                                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden'); }} />
                                  ) : null}
                                  <div className={cn("w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center shrink-0", item?.photoURL ? "hidden" : "")}>
                                    <Users size={12} className="text-stone-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className={cn("text-sm font-semibold truncate", isMe || isSelected ? "text-primary" : "text-stone-900")}>{item?.name}</p>
                                      {isMe && <span className="text-xs text-primary/60 shrink-0 font-normal">você</span>}
                                      {isSelected && <span className="text-xs text-primary/60 shrink-0 font-normal">visualizando</span>}
                                    </div>
                                    <p className="text-xs text-stone-400 truncate">@{item?.username}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className={cn("text-sm font-black tabular-nums", isMe || isSelected ? "text-primary" : "text-stone-900")}>{(item?.coins ?? 0).toLocaleString('pt-BR')}</span>
                                    <span className="text-xs text-stone-400 ml-1">Q</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Sidebar — 1 coluna */}
                      <div className="flex flex-col gap-4">

                        {/* Próximo Objetivo */}
                        <div className="bg-white rounded-2xl border border-stone-100 p-5">
                          <div className="flex items-center gap-1.5 mb-4">
                            <TrendingUp size={11} className="text-stone-400" />
                            <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Próximo Objetivo</span>
                          </div>
                          {_viewRank === 1 ? (
                            <div>
                              <p className="text-sm font-semibold text-stone-900">{_viewingOther ? `${_view.name} lidera` : 'Você lidera'} o ranking 🏆</p>
                              <p className="text-xs text-stone-400 mt-1 leading-relaxed">Continue acumulando para manter a primeira posição.</p>
                            </div>
                          ) : _above && _coinsToNext > 0 ? (
                            <div>
                              <p className="text-3xl font-black text-stone-900 tabular-nums">{_coinsToNext}</p>
                              <p className="text-xs text-stone-500 mt-0.5">moedas para ultrapassar</p>
                              <p className="text-sm font-semibold text-stone-800 mt-1.5">{_above.name}<span className="text-stone-400 font-normal ml-2">#{_aboveRank}</span></p>
                              {_suggestedAction && (
                                <div className="mt-4 pt-3 border-t border-stone-100">
                                  <p className="text-xs text-stone-400 mb-1">Sugestão de ação</p>
                                  <p className="text-sm font-semibold text-stone-800">{_suggestedAction.title}</p>
                                  <p className="text-xs font-bold text-primary mt-0.5">+{_suggestedAction.pts} moedas</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-stone-400 leading-relaxed">Continue acumulando moedas para avançar no ranking.</p>
                          )}
                          {_nxtStage && (
                            <div className="mt-4 pt-3 border-t border-stone-100">
                              <p className="text-xs text-stone-400 mb-1">Próximo estágio</p>
                              <p className="text-sm font-semibold text-stone-800">{_nxtStage.name}</p>
                              <p className="text-xs text-stone-400 mt-0.5">{_stageDelta} moedas restantes</p>
                            </div>
                          )}
                        </div>

                        {/* Atividade Recente */}
                        <div className="bg-white rounded-2xl border border-stone-100 p-5">
                          <div className="flex items-center gap-1.5 mb-4">
                            <Clock size={11} className="text-stone-400" />
                            <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Atividade Recente</span>
                          </div>
                          {_recentCheckins.length > 0 ? (
                            <div className="space-y-3">
                              {_recentCheckins.map((c: any) => {
                                const d = (() => { const t = c.checkinTime || c.date; if (!t) return new Date(0); if (typeof t === 'number') return new Date(t); if (t?.toDate) return t.toDate(); if (t?.seconds) return new Date(t.seconds * 1000); return new Date(t); })();
                                const today = new Date();
                                const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
                                const label = diffDays === 0 ? 'Hoje' : diffDays === 1 ? 'Ontem' : `${diffDays} dias atrás`;
                                return (
                                  <div key={c.id} className="flex items-start gap-2.5">
                                    <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                      <Check size={9} className="text-emerald-600" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-stone-400">{label}</p>
                                      <p className="text-xs font-medium text-stone-700">Check-in no QDDO</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400 leading-relaxed">Nenhuma atividade recente registrada.</p>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* ── 3. COMO GANHAR QCOINS ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Award size={12} className="text-stone-400" />
                          <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Como ganhar QCoins</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {_manualActions.length > 0 && (
                            <button onClick={() => { setSolicitarSuccess(false); setSolicitarAcao(''); setSolicitarObservacao(''); setSolicitarParaFounder(null); setSolicitarFounderSearch(''); setShowSolicitarQcoinModal(true); }}
                              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                              <Plus size={13} />Solicitar QCoins
                            </button>
                          )}
                          {isAdmin ? (
                            <button onClick={() => setShowQcoinApprovalQueue(true)}
                              className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-900 transition-colors">
                              Solicitações para aprovação
                              {_pendingApprovalQueue.length > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-black">{_pendingApprovalQueue.length}</span>
                              )}
                            </button>
                          ) : _myQcoinRequests.length > 0 && (
                            <button onClick={() => setShowMyQcoinRequests(true)}
                              className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-900 transition-colors">
                              Minhas Solicitações
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => setEditingQcoinSection(editingQcoinSection === 'pontuacao' ? null : 'pontuacao')}
                              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-900 transition-colors">
                              <Pencil size={11} />{editingQcoinSection === 'pontuacao' ? 'Fechar editor' : 'Editar dados'}
                            </button>
                          )}
                        </div>
                      </div>
                      {_actions.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                          {_actions.map((action: any, idx: number) => (
                            <div key={idx} className="bg-white rounded-xl border border-stone-100 p-4 flex flex-col justify-between hover:bg-primary/5 hover:border-primary/20 transition-colors">
                              <p className="text-sm font-semibold text-stone-900 leading-snug mb-3">{action.title}</p>
                              <div className="flex items-end justify-between">
                                <div>
                                  <span className="text-xl font-black text-primary tabular-nums">+{action.pts}</span>
                                  <span className="text-xs text-stone-400 ml-1">moedas</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-400">{isAdmin ? 'Clique em "Editar dados" para adicionar ações.' : 'Nenhuma ação cadastrada ainda.'}</p>
                      )}
                      {isAdmin && editingQcoinSection === 'pontuacao' && (
                        <AdminTableEditor sectionId="pontuacao" cols={pontuacaoCols} colWidths={pontuacaoColWidths} rows={pontuacaoRows}
                          setCols={setPontuacaoCols} setColWidths={setPontuacaoColWidths} setRows={setPontuacaoRows} resizingRef={pontuacaoResizingRef}
                          savingQcoinSection={savingQcoinSection} qcoinTableSaveStatus={qcoinTableSaveStatus} qcoinTableSaveError={qcoinTableSaveError} onSave={handleSaveQcoinTable} />
                      )}
                    </div>

                    {!isAdmin && showMyQcoinRequests && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowMyQcoinRequests(false)}>
                        <div className="bg-white rounded-xl w-full max-w-lg p-8 relative shadow-2xl max-h-[85vh] flex flex-col" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <button onClick={() => setShowMyQcoinRequests(false)} className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors">
                            <X size={20} />
                          </button>
                          <div className="flex items-center gap-3 mb-6 shrink-0">
                            <div className="bg-stone-900 p-3 rounded-lg">
                              <FileText size={22} className="text-white" />
                            </div>
                            <h2 className="text-h2 font-sans text-stone-900">Minhas Solicitações</h2>
                          </div>
                          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                            {_myQcoinRequests.length === 0 ? (
                              <p className="text-sm text-stone-400 text-center py-10">Você ainda não enviou nenhuma solicitação de QCoins.</p>
                            ) : (
                              _myQcoinRequests.map((r: any) => (
                                <div key={r.id} className="flex items-center justify-between bg-stone-50 rounded-lg border border-stone-100 px-4 py-2.5">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-sm font-medium text-stone-900 truncate">{r.acao}</span>
                                    <span className="text-xs text-primary font-bold shrink-0">+{r.pontos}</span>
                                  </div>
                                  <span className={cn(
                                    "shrink-0 ml-3 px-2.5 py-1 rounded-full text-overline font-bold uppercase tracking-widest",
                                    r.status === 'aprovada' ? "bg-emerald-100 text-emerald-600"
                                      : r.status === 'rejeitada' ? "bg-red-100 text-red-500"
                                      : r.status === 'aguardando_confirmacao' ? "bg-stone-100 text-stone-500"
                                      : "bg-terracota-100 text-primary"
                                  )}>
                                    {r.status === 'aprovada' ? 'Aprovada' : r.status === 'rejeitada' ? 'Rejeitada' : r.status === 'aguardando_confirmacao' ? `Aguardando ${r.paraFounderNome || 'confirmação'}` : 'Pendente'}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {isAdmin && showQcoinApprovalQueue && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowQcoinApprovalQueue(false)}>
                        <div className="bg-white rounded-xl w-full max-w-lg p-8 relative shadow-2xl max-h-[85vh] flex flex-col" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <button onClick={() => setShowQcoinApprovalQueue(false)} className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors">
                            <X size={20} />
                          </button>
                          <div className="flex items-center gap-3 mb-6 shrink-0">
                            <div className="bg-stone-900 p-3 rounded-lg">
                              <CheckSquare size={22} className="text-white" />
                            </div>
                            <h2 className="text-h2 font-sans text-stone-900">Solicitações para aprovação</h2>
                          </div>
                          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                            {_pendingApprovalQueue.length === 0 ? (
                              <p className="text-sm text-stone-400 text-center py-10">Nenhuma solicitação pendente no momento.</p>
                            ) : (
                              _pendingApprovalQueue.map((r: any) => (
                                <div key={r.id} className="bg-stone-50 rounded-lg border border-stone-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm text-stone-900">
                                      <span className="font-bold">{r.founderNome}</span> · <span className="font-semibold">{r.acao}</span>
                                      <span className="text-xs text-primary font-bold ml-2">+{r.pontos}</span>
                                    </p>
                                    {r.observacao && <p className="text-xs text-stone-400 mt-0.5">"{r.observacao}"</p>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      disabled={reviewingQcoinRequestId === r.id}
                                      onClick={() => handleReviewQcoinRequest(r.id, 'aprovada')}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-all font-bold text-xs disabled:opacity-60"
                                    >
                                      <CheckCircle2 size={14} />Aprovar
                                    </button>
                                    <button
                                      disabled={reviewingQcoinRequestId === r.id}
                                      onClick={() => handleReviewQcoinRequest(r.id, 'rejeitada')}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-md transition-all font-bold text-xs disabled:opacity-60"
                                    >
                                      <X size={14} />Rejeitar
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 4. PROGRESSÃO + PREMIAÇÕES ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                      {/* Progressão — 3 colunas */}
                      <div className="lg:col-span-3 bg-white rounded-2xl border border-stone-100 p-5">
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={12} className="text-stone-400" />
                            <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Progressão de Estágios</span>
                          </div>
                          {isAdmin && (
                            <button onClick={() => setEditingQcoinSection(editingQcoinSection === 'estagios' ? null : 'estagios')}
                              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-900 transition-colors">
                              <Pencil size={11} />{editingQcoinSection === 'estagios' ? 'Fechar' : 'Editar dados'}
                            </button>
                          )}
                        </div>

                        {/* Roadmap */}
                        <div className="flex items-start">
                          {_stages.map((stage: any, idx: number) => {
                            const isActive = idx === _curIdx;
                            const isPast = idx < _curIdx;
                            const isExpanded = expandedQcoinCard === stage.name;
                            return (
                              <div key={idx} className="flex items-center flex-1 min-w-0">
                                <div className="flex flex-col items-center min-w-0">
                                  <button
                                    onClick={() => setExpandedQcoinCard(isExpanded ? null : stage.name)}
                                    className={cn(
                                      "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all shrink-0",
                                      isActive ? "border-primary bg-primary text-white shadow-sm shadow-primary/20" :
                                      isPast ? "border-stone-300 bg-stone-200 text-stone-500" :
                                      "border-stone-200 bg-white text-stone-300 hover:border-stone-300"
                                    )}
                                    title={stage.fullName}
                                  >
                                    {isPast ? '✓' : idx + 1}
                                  </button>
                                  <span className={cn(
                                    "text-xs mt-1.5 font-medium text-center truncate max-w-[60px]",
                                    isActive ? "text-primary" : isPast ? "text-stone-500" : "text-stone-300"
                                  )}>{stage.name}</span>
                                  {isActive && <span className="text-overline text-primary/60 uppercase tracking-widest font-bold mt-0.5" style={{ fontSize: '9px' }}>atual</span>}
                                </div>
                                {idx < _stages.length - 1 && (
                                  <div className={cn("flex-1 h-0.5 mx-1 mb-6", isPast ? "bg-stone-300" : "bg-stone-100")} />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Stage detail (expandido ao clicar) */}
                        {expandedQcoinCard && (() => {
                          const stage = _stages.find((s: any) => s.name === expandedQcoinCard);
                          if (!stage) return null;
                          const hasDetail = stage.row && stage.row.some((c: string) => c?.trim());
                          return (
                            <div className="mt-4 pt-4 border-t border-stone-100 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{stage.fullName || stage.name}</p>
                                <button onClick={() => setExpandedQcoinCard(null)} className="text-stone-300 hover:text-stone-600 transition-colors"><X size={13} /></button>
                              </div>
                              {hasDetail ? (
                                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                  {estagiosCols.slice(1).map((col: string, ci: number) => {
                                    const val = stage.row[ci + 1]?.trim();
                                    if (!val) return null;
                                    return (
                                      <div key={ci}>
                                        <p className="text-xs text-stone-400 mb-0.5">{col}</p>
                                        <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{val}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-stone-400">Detalhes deste estágio não cadastrados ainda.</p>
                              )}
                            </div>
                          );
                        })()}

                        {isAdmin && editingQcoinSection === 'estagios' && (
                          <AdminTableEditor sectionId="estagios" cols={estagiosCols} colWidths={estagiosColWidths} rows={estagiosRows}
                            setCols={setEstagiosCols} setColWidths={setEstagiosColWidths} setRows={setEstagiosRows} resizingRef={estagiosResizingRef}
                            savingQcoinSection={savingQcoinSection} qcoinTableSaveStatus={qcoinTableSaveStatus} qcoinTableSaveError={qcoinTableSaveError} onSave={handleSaveQcoinTable} />
                        )}
                      </div>

                      {/* Premiações — 2 colunas */}
                      <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Trophy size={12} className="text-stone-400" />
                            <span className="text-overline font-bold uppercase tracking-widest text-stone-400">Premiações</span>
                          </div>
                          {isAdmin && (
                            <button onClick={() => setEditingQcoinSection(editingQcoinSection === 'premiacoes' ? null : 'premiacoes')}
                              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-900 transition-colors">
                              <Pencil size={11} />{editingQcoinSection === 'premiacoes' ? 'Fechar' : 'Editar dados'}
                            </button>
                          )}
                        </div>
                        {_premios.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                            {_premios.map((p: any, idx: number) => (
                              <div key={idx} className="border border-stone-100 rounded-lg p-3 hover:border-stone-200 transition-colors">
                                <p className="text-sm font-semibold text-stone-900 leading-snug">{p.name}</p>
                                {p.desc && p.desc !== p.cost && <p className="text-xs text-stone-400 mt-0.5 leading-relaxed line-clamp-2">{p.desc}</p>}
                                {p.cost && <p className="text-xs font-bold text-primary mt-2">{p.cost} moedas</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400">{isAdmin ? 'Clique em "Editar dados" para cadastrar premiações.' : 'Premiações em breve.'}</p>
                        )}
                        {isAdmin && editingQcoinSection === 'premiacoes' && (
                          <AdminTableEditor sectionId="premiacoes" cols={premiacoesCols} colWidths={premiacoesColWidths} rows={premiacoesRows}
                            setCols={setPremiacoesCols} setColWidths={setPremiacoesColWidths} setRows={setPremiacoesRows} resizingRef={premiacoesResizingRef}
                            savingQcoinSection={savingQcoinSection} qcoinTableSaveStatus={qcoinTableSaveStatus} qcoinTableSaveError={qcoinTableSaveError} onSave={handleSaveQcoinTable} />
                        )}
                      </div>

                    </div>

                    {/* ── 5. CONSEQUÊNCIAS POR INATIVIDADE ── */}
                    <div>
                      <button
                        onClick={() => setEditingQcoinSection(editingQcoinSection === 'guide_consequencias' ? null : 'guide_consequencias')}
                        className="w-full flex items-center justify-between mb-3 group"
                      >
                        <div className="flex items-center gap-2">
                          <CheckSquare size={12} className="text-stone-400 group-hover:text-primary/70 transition-colors" />
                          <span className="text-overline font-bold uppercase tracking-widest text-stone-400 group-hover:text-primary transition-colors">Consequências por Inatividade</span>
                        </div>
                        <ChevronDown size={14} className={cn("text-stone-400 group-hover:text-primary/70 transition-transform duration-200 shrink-0", editingQcoinSection === 'guide_consequencias' && "rotate-180")} />
                      </button>
                      {editingQcoinSection === 'guide_consequencias' && (
                        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden animate-in fade-in duration-200">
                          <div className="overflow-x-auto max-h-72">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-stone-900 sticky top-0">
                                  {consequenciasCols.map((col: string, ci: number) => (
                                    <th key={ci} className="px-4 py-2.5 font-bold uppercase tracking-widest text-stone-400 whitespace-nowrap">{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {consequenciasRows.filter((row: string[]) => row.some((c: string) => c?.trim())).map((row: string[], ri: number) => (
                                  <tr key={ri} className="border-b border-stone-50 hover:bg-stone-50/50">
                                    {row.map((cell: string, ci: number) => (
                                      <td key={ci} className="px-4 py-2 text-stone-700 text-xs whitespace-pre-wrap align-top">{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="mt-3">
                          <button onClick={() => setEditingQcoinSection(editingQcoinSection === 'consequencias' ? null : 'consequencias')}
                            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-900 transition-colors">
                            <Pencil size={11} />{editingQcoinSection === 'consequencias' ? 'Fechar editor de consequências' : 'Editar consequências'}
                          </button>
                          {editingQcoinSection === 'consequencias' && (
                            <AdminTableEditor sectionId="consequencias" cols={consequenciasCols} colWidths={consequenciasColWidths} rows={consequenciasRows}
                              setCols={setConsequenciasCols} setColWidths={setConsequenciasColWidths} setRows={setConsequenciasRows} resizingRef={consequenciasResizingRef}
                              savingQcoinSection={savingQcoinSection} qcoinTableSaveStatus={qcoinTableSaveStatus} qcoinTableSaveError={qcoinTableSaveError} onSave={handleSaveQcoinTable} />
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()
            ) : view === 'regras' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8 flex items-start justify-between">
                  <div>
                    <h2 className="text-h1 font-sans text-stone-900">Regras</h2>
                    <p className="text-stone-500 text-sm leading-relaxed max-w-xl mt-2">O QDDO é uma comunidade de founders comprometidos em construir algo maior. Este espaço existe para que você cresça, conecte e realize — mas isso só funciona se todos cuidarmos dele juntos. As regras abaixo não são burocracias, são combinados para garantir que o QDDO continue sendo o lugar que você quer voltar todo dia.</p>
                  </div>
                  {isAdmin && !showAddRegra && (
                    <button
                      onClick={() => setShowAddRegra(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-all"
                    >
                      <Plus size={16} />
                      Adicionar
                    </button>
                  )}
                </div>

                {isAdmin && showAddRegra && (
                  <div className="bg-white rounded-xl p-10 border border-stone-100 shadow-sm mb-8">
                    <h4 className="text-lg font-sans text-stone-900 mb-6">Nova seção de Regras</h4>
                    <div className="space-y-4">
                      <input
                        value={newRegraTitle}
                        onChange={e => setNewRegraTitle(e.target.value)}
                        placeholder="Título da seção (ex: Uso do Espaço)"
                        className="w-full px-4 py-3 border border-stone-100 rounded-lg text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                      />
                      <textarea
                        rows={6}
                        value={newRegraContent}
                        onChange={e => setNewRegraContent(e.target.value)}
                        placeholder={"Cada linha vira um tópico:\nAcesso ao espaço: descrição aqui\nAmbientes compartilhados: descrição aqui"}
                        className="w-full px-4 py-3 border border-stone-100 rounded-lg text-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition resize-none"
                      />
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => { setShowAddRegra(false); setNewRegraTitle(''); setNewRegraContent(''); }}
                          className="px-5 py-2.5 text-sm font-bold text-stone-500 hover:text-stone-900 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleAddRegra}
                          disabled={!newRegraTitle.trim()}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/80 disabled:opacity-40 transition"
                        >
                          <Check size={15} />
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(() => {
                    const RULE_ICONS = [ShieldCheck, Globe, Users, AlertTriangle, Trophy, CalendarDays, MessageSquare, Award];
                    return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {newsItems.filter(item => item.category === 'regras').length > 0 ? (
                    newsItems
                      .filter(item => item.category === 'regras')
                      .sort((a, b) => (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0))
                      .map((item, index) => {
                        const RuleIcon = RULE_ICONS[index % RULE_ICONS.length];
                        return (
                        <div key={item.id} className="bg-white rounded-xl p-5 border border-stone-100 shadow-sm hover:shadow-xl transition-all flex flex-col">
                          {editingRuleId === item.id ? (
                            <div className="space-y-3">
                              <input
                                value={editingRuleData.title}
                                onChange={e => setEditingRuleData(d => ({ ...d, title: e.target.value }))}
                                className="w-full px-3 py-2 border border-stone-100 rounded-md text-stone-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                              />
                              <textarea
                                rows={5}
                                value={editingRuleData.content}
                                onChange={e => setEditingRuleData(d => ({ ...d, content: e.target.value }))}
                                className="w-full px-3 py-2 border border-stone-100 rounded-md text-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition resize-none"
                                placeholder="Cada linha vira um tópico da lista"
                              />
                              <div className="flex gap-3 justify-end">
                                <button
                                  onClick={() => setEditingRuleId(null)}
                                  className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-900 transition"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleSaveRule}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-md hover:bg-primary/80 transition"
                                >
                                  <Check size={14} />
                                  Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-9 h-9 rounded-lg bg-terracota-50 flex items-center justify-center shrink-0">
                                  <RuleIcon size={16} className="text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-sans font-bold text-stone-900 truncate">{item.title}</h3>
                                </div>
                                {isAdmin && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => { setEditingRuleId(item.id); setEditingRuleData({ title: item.title, content: item.content }); setDeletingRuleId(null); }}
                                      className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
                                      title="Editar"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    {deletingRuleId === item.id ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-red-500 font-bold">Confirmar?</span>
                                        <button onClick={() => handleDeleteRule(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition font-bold text-xs">Sim</button>
                                        <button onClick={() => setDeletingRuleId(null)} className="p-1.5 text-stone-400 hover:bg-stone-200 rounded-lg transition font-bold text-xs">Não</button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setDeletingRuleId(item.id); setEditingRuleId(null); }}
                                        className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                        title="Excluir"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {(() => {
                                const lines = (item.content || '').split('\n').filter(line => line.trim());
                                const isExpanded = expandedRuleIds.has(item.id);
                                // Estima linhas visuais: ~48 chars por linha em text-sm nesta largura de card
                                const totalVisualLines = lines.reduce((sum: number, l: string) => {
                                  const clean = l.trim().replace(/^[•\-*]\s*/, '');
                                  return sum + Math.ceil((clean.length || 1) / 48);
                                }, 0);
                                const hasMore = totalVisualLines > 9;
                                return (
                                  <>
                                    <div className={`relative ${!isExpanded && hasMore ? 'overflow-hidden max-h-[196px]' : ''}`}>
                                      <ul className="space-y-1.5">
                                        {lines.map((line: string, i: number) => (
                                          <li key={i} className="flex items-start gap-2 text-stone-600 text-sm leading-snug">
                                            <span className="mt-0.5 text-primary/40 shrink-0">•</span>
                                            <span>{line.trim().replace(/^[•\-*]\s*/, '')}</span>
                                          </li>
                                        ))}
                                      </ul>
                                      {!isExpanded && hasMore && (
                                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                                      )}
                                    </div>
                                    {hasMore && (
                                      <button
                                        onClick={() => setExpandedRuleIds(prev => {
                                          const next = new Set(prev);
                                          isExpanded ? next.delete(item.id) : next.add(item.id);
                                          return next;
                                        })}
                                        className="mt-2 text-xs font-bold text-primary hover:text-primary/70 transition-colors flex items-center gap-1"
                                      >
                                        {isExpanded ? 'Ver menos' : 'Ver mais'}
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          )}
                        </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-stone-200">
                      <p className="text-stone-400">Nenhuma regra cadastrada ainda.</p>
                      {isAdmin && !showAddRegra && (
                        <button
                          onClick={() => setShowAddRegra(true)}
                          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition"
                        >
                          <Plus size={16} />
                          Adicionar primeira regra
                        </button>
                      )}
                    </div>
                  )}
                </div>
                  );
                })()}

                {/* Rodapé da página de Regras */}
                <div className="mt-8 text-center px-4">
                  <p className="text-stone-400 text-xs leading-snug max-w-xl mx-auto">
                    Essas regras existem para proteger a comunidade e garantir que o QDDO continue sendo um lugar produtivo, respeitoso e inspirador. Vamos construir juntos.
                  </p>
                  <p className="mt-2 text-stone-300 text-xs font-semibold tracking-wide uppercase">
                    Gestão QDDO Central Hub
                  </p>
                </div>
              </div>
            ) : view === 'dashboard' && isAdmin ? (
              <AdminDashboard
                founders={allFounders}
                checkins={allCheckins}
                challenges={allChallenges}
              />
            ) : view === 'general' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Pendência Banner */}
                {founderData && !founderData.termsAccepted && (
                  <div className="mb-8 bg-terracota-50 border border-terracota-200 rounded-xl p-6 flex items-center justify-between group animate-in slide-in-from-top-4 duration-500 cursor-pointer" onClick={() => setIsTermsModalOpen(true)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-terracota-100 rounded-lg flex items-center justify-center text-primary">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-terracota-900">Você está com uma pendência</h4>
                        <p className="text-primary text-sm">
                          Para continuar utilizando o portal, você precisa aceitar os nossos termos de uso e autorizações.
                          <span className="ml-1 font-bold underline hover:text-terracota-900 transition-colors">
                            Clique aqui para resolver
                          </span>
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="text-primary/80 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}

                {/* News Box */}
                <div className="mb-6 bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
                  <div className="bg-stone-900 px-8 py-4 flex items-center gap-3">
                    <Bell size={20} className="text-white" />
                    <h3 className="text-white font-sans text-h3">News</h3>
                  </div>
                  <div className="px-3 py-5 space-y-4">
                    {/* Filtered News Items */}
                    {(() => {
                      const now = new Date();
                      const last24h = subHours(now, 24);
                      const last72h = subDays(now, 3);

                      const todayStart = startOfDay(currentDate);
                      const relevantEvents = newsItems
                        .filter(item => item.category === 'evento')
                        .filter(item => {
                          if (!item.eventDate) return false;
                          const eventDate = toDate(item.eventDate) || new Date();
                          return eventDate >= todayStart;
                        })
                        .sort((a, b) => {
                          const dateA = toDate(a.eventDate) || new Date();
                          const dateB = toDate(b.eventDate) || new Date();
                          return dateA.getTime() - dateB.getTime();
                        });

                      const publicChallenges = allChallenges
                        .filter(c => c.type === 'public' && c.status === 'open')
                        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
                        .slice(0, 3);

                      const currentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                      const currentMonthStart = startOfMonth(now);
                      const currentMonthEnd = endOfMonth(now);
                      const currentMonthCheckins = userCheckins.filter(c => {
                        const d = toDate(c.checkinTime) || new Date();
                        return isWithinInterval(d, { start: currentMonthStart, end: currentMonthEnd });
                      }).length;
                      const userScore = founderData?.monthlyPoints?.[currentYM]
                        ?? (founderData?.monthlyPoints as any)?.get?.(currentYM)
                        ?? 0;

                      // Ranking Top 5 — current month points only
                      const fullRanking = allFounders
                        .map((f: any) => ({
                          userId: f.id,
                          score: (f.monthlyPoints?.[currentYM] ?? f.monthlyPoints?.get?.(currentYM) ?? 0),
                          name: f.name || 'Founder',
                          username: f.username || f.id?.slice(0, 6),
                          photoURL: f.photoURL || null,
                        }))
                        .sort((a: any, b: any) => b.score - a.score);

                      const ranking = fullRanking.slice(0, 5);
                      const userRankPosition = fullRanking.findIndex((r: any) => r.userId === (founderData?._id || founderData?.id)) + 1;

                      const today = new Date();
                      const sunday = new Date(today);
                      sunday.setDate(today.getDate() - today.getDay()); // recua até o domingo
                      const weekDates = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(sunday);
                        d.setDate(sunday.getDate() + i);
                        return { day: String(d.getDate()).padStart(2, '0'), month: String(d.getMonth() + 1).padStart(2, '0') };
                      });
                      const saturday = weekDates[6];
                      const birthdayFounders = allFounders.filter(f =>
                        f.birthDay && f.birthMonth &&
                        weekDates.some(wd => wd.day === f.birthDay && wd.month === f.birthMonth)
                      );

                      return (
                        <div className="flex flex-col gap-4">
                        <div className="flex flex-col lg:flex-row gap-4">
                          {/* Part 1: Eventos & Desafios (66%) */}
                          <div className="lg:w-[66%] flex flex-col gap-4">
                            {/* Aniversariantes do Dia */}
                            {birthdayFounders.length > 0 && (
                              <div className="bg-white rounded-xl px-3 py-4 border border-amber-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                  <Cake className="text-amber-500 shrink-0" size={18} />
                                  <h4 className="text-sm font-sans font-semibold text-stone-900">Aniversariantes da Semana</h4>
                                  <span className="ml-auto text-overline font-bold uppercase tracking-widest text-amber-400">
                                    {(() => {
                                      const sat = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 6);
                                      const monthName = sat.toLocaleDateString('pt-BR', { month: 'long' });
                                      if (sunday.getMonth() === sat.getMonth()) {
                                        return `${String(sunday.getDate()).padStart(2, '0')} a ${String(sat.getDate()).padStart(2, '0')} de ${monthName}`;
                                      }
                                      const sundayMonth = sunday.toLocaleDateString('pt-BR', { month: 'long' });
                                      return `${String(sunday.getDate()).padStart(2, '0')} de ${sundayMonth} a ${String(sat.getDate()).padStart(2, '0')} de ${monthName}`;
                                    })()}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  {birthdayFounders.map(founder => (
                                    <div key={founder.id} className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                                      {founder.photoURL ? (
                                        <img src={founder.photoURL} alt={founder.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                                          <span className="text-amber-700 text-xs font-bold">{(founder.name || 'F')[0].toUpperCase()}</span>
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-sm font-bold text-stone-800 leading-tight">{founder.name || 'Founder'}</p>
                                        <p className="text-overline font-bold text-amber-500 uppercase tracking-widest">
                                          {founder.birthDay}/{founder.birthMonth}
                                          {founder.birthDay === String(today.getDate()).padStart(2, '0') && founder.birthMonth === String(today.getMonth() + 1).padStart(2, '0') && ' · Hoje!'}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Avisos */}
                            {newsItems
                              .filter(item => {
                                if (item.category !== 'aviso') return false;
                                const date = toDate(item.createdAt);
                                if (!date) return true;
                                return date >= startOfWeek(new Date(), { weekStartsOn: 0 });
                              })
                              .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
                              .map((aviso, idx) => {
                                const isHiddenFromNews = hiddenNewsIds.includes(aviso.id);
                                return (
                                <div
                                  key={aviso.id || idx}
                                  onClick={() => setSelectedNewsItem(aviso)}
                                  className={cn("bg-white rounded-xl px-3 py-4 border shadow-sm hover:shadow-md transition-all group cursor-pointer", isHiddenFromNews ? "border-stone-100 opacity-60" : "border-stone-100")}
                                >
                                  <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="text-primary shrink-0" size={18} />
                                    <h4 className="text-sm font-sans font-semibold text-stone-900">Aviso</h4>
                                    {isAdmin && isHiddenFromNews && (
                                      <span className="text-overline font-bold uppercase tracking-widest text-stone-300 text-xs">Oculto da News</span>
                                    )}
                                    <span className="ml-auto text-overline font-bold uppercase tracking-widest text-stone-400">
                                      {toDate(aviso.createdAt)?.toLocaleDateString('pt-BR') || ''}
                                    </span>
                                    {isAdmin && (
                                      <button
                                        onClick={e => { e.stopPropagation(); toggleAvisoFromNews(aviso.id); }}
                                        title={isHiddenFromNews ? 'Mostrar na página News' : 'Remover da página News'}
                                        className={cn(
                                          "w-6 h-6 rounded-md flex items-center justify-center transition-colors flex-shrink-0",
                                          isHiddenFromNews
                                            ? "text-stone-300 hover:text-emerald-500 hover:bg-emerald-50"
                                            : "text-stone-400 hover:text-red-500 hover:bg-red-50"
                                        )}
                                      >
                                        {isHiddenFromNews ? <Eye size={14} /> : <EyeOff size={14} />}
                                      </button>
                                    )}
                                  </div>
                                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-100 group-hover:border-stone-300 transition-all">
                                    <h5 className="font-bold text-stone-900 text-sm mb-1 group-hover:text-primary transition-colors">{aviso.title}</h5>
                                    <p className="text-stone-500 text-xs line-clamp-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: aviso.content }} />
                                    {aviso.attachmentUrl && (
                                      <a
                                        href={aviso.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className="mt-2 inline-flex items-center gap-1.5 text-overline font-bold text-stone-500 hover:text-stone-700 transition-colors"
                                      >
                                        <Paperclip size={11} />
                                        {aviso.attachmentName || 'Ver Anexo'}
                                      </a>
                                    )}
                                  </div>
                                </div>
                                );
                              })
                            }
                            {/* Eventos da Semana */}
                            <div className="bg-white rounded-xl px-3 py-4 border border-stone-100 shadow-sm flex flex-col">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-base font-sans text-stone-900 flex items-center gap-2">
                                  <CalendarDays className="text-primary" size={18} />
                                  Próximos Eventos
                                </h4>
                                <span className="text-overline font-bold uppercase tracking-widest text-stone-400">
                                  {relevantEvents.length > 0 ? `${relevantEvents.length} evento${relevantEvents.length > 1 ? 's' : ''}` : ''}
                                </span>
                              </div>
                              
                              <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                {relevantEvents.length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center text-center p-5 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                                    <p className="text-stone-400 text-xs">Nenhum evento programado para esta semana.</p>
                                  </div>
                                ) : (
                                  relevantEvents.map((event, idx) => (
                                    <div key={event.id || idx} className="p-3 bg-stone-50 rounded-lg border border-stone-100 hover:border-stone-300 hover:bg-white transition-all group cursor-pointer" onClick={() => setSelectedNewsItem(event)}>
                                      <div className="flex items-start justify-between gap-4">
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className={cn(
                                              "px-2 py-0.5 text-overline font-bold uppercase rounded-full",
                                              event.category === 'evento' ? "bg-terracota-100 text-primary" :
                                              event.category === 'aviso' ? "bg-rose-100 text-rose-700" :
                                              event.category === 'info' ? "bg-blue-100 text-blue-700" :
                                              "bg-stone-100 text-stone-700"
                                            )}>
                                              {getEventDayLabel(event.eventDate)}
                                            </span>
                                            {(event.startTime || event.endTime) && (
                                              <span className="text-stone-400 text-overline font-bold uppercase flex items-center gap-2">
                                                <Clock size={10} />
                                                <span>Início: {event.startTime || '--:--'}</span>
                                                {event.endTime && <span>Término: {event.endTime}</span>}
                                              </span>
                                            )}
                                          </div>
                                          <h5 className="font-bold text-stone-900 mb-1 group-hover:text-primary transition-colors">{event.title}</h5>
                                          <p className="text-stone-500 text-xs line-clamp-4" dangerouslySetInnerHTML={{ __html: event.content }} />
                                        </div>
                                        <div className="text-right shrink-0">
                                          <div className="text-h2 font-sans text-stone-300 group-hover:text-white/60 transition-colors">
                                            {format(toDate(event.eventDate) || new Date(), 'dd')}
                                          </div>
                                          <div className="text-overline font-bold uppercase text-stone-400">
                                            {format(toDate(event.eventDate) || new Date(), 'MMM', { locale: ptBR })}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                          </div>

                          {/* Part 2: Ranking & Score (33%) */}
                          <div className="lg:w-[33%] flex flex-col gap-4">
                            {/* Ranking Top 5 */}
                            <div className="bg-white rounded-xl px-3 py-4 border border-stone-100 shadow-sm flex flex-col">
                              <div className="flex items-center gap-2 mb-4">
                                <Trophy className="text-stone-900" size={16} />
                                <h4 className="text-sm font-sans text-stone-900">Ranking Top 5</h4>
                              </div>
                              <div className="space-y-2">
                                {ranking.map((item, idx) => (
                                  <div key={item.userId} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-2">
                                      <div className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center text-overline font-bold flex-shrink-0",
                                        idx === 0 ? "bg-terracota-100 text-primary" :
                                        idx === 1 ? "bg-stone-200 text-stone-600" :
                                        idx === 2 ? "bg-orange-100 text-orange-600" :
                                        "bg-stone-50 text-stone-400"
                                      )}>
                                        {idx + 1}
                                      </div>
                                      {item.photoURL ? (
                                        <img
                                          src={item.photoURL}
                                          alt={item.name}
                                          className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-stone-100"
                                        />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 border border-stone-100">
                                          <Users size={14} className="text-stone-400" />
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-xs font-bold text-stone-900 line-clamp-1">{item.name}</p>
                                        <p className="text-xs text-stone-400">@{item.username?.replace(/^@/, '')}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs font-black text-stone-900">{item.score}</span>
                                      <span className="text-overline text-stone-400 ml-1">pts</span>
                                    </div>
                                  </div>
                                ))}
                                {ranking.length === 0 && (
                                  <p className="text-stone-400 text-xs text-center py-4">Nenhum ponto este mês.</p>
                                )}
                              </div>
                            </div>

                            {/* User Score */}
                            <div className="bg-primary rounded-xl p-4 text-white shadow-xl shadow-primary/20 flex flex-col justify-center items-center text-center relative overflow-hidden">
                              <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                                <Trophy size={80} />
                              </div>
                              <span className="text-overline uppercase tracking-widest font-bold text-white/80 mb-1 relative z-10">Seu Score QDDO</span>
                              <div className="text-[3rem] font-black leading-none mb-0.5 relative z-10">{userScore}</div>
                              <span className="text-xs font-bold text-white/80 relative z-10">pontos acumulados</span>
                              {userRankPosition > 0 && (
                                <span className="text-overline text-white/60 relative z-10 mt-0.5">#{userRankPosition}º no ranking</span>
                              )}

                              <div className="mt-3 pt-3 border-t border-white/20 w-full relative z-10">
                                <div className="flex items-center justify-between text-overline font-bold uppercase tracking-widest text-white/80">
                                  <span>Check-ins</span>
                                  <span>{currentMonthCheckins}</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                                  <div
                                    className="h-full bg-white rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min((currentMonthCheckins / 20) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Desafios Públicos — largura total */}
                        <div className="bg-stone-900 rounded-xl p-4 text-white shadow-xl shadow-stone-900/20">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Trophy className="text-white/50" size={20} />
                              <h4 className="text-lg font-sans">Desafios Públicos</h4>
                            </div>
                            <button
                              onClick={() => { setView('portal'); setActiveSubTab('desafios-publicos'); }}
                              className="text-overline font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors flex items-center gap-1"
                            >
                              Ver todos <ArrowRight size={11} />
                            </button>
                          </div>

                          {publicChallenges.length === 0 ? (
                            <p className="text-white/50 text-sm text-center py-4">Nenhum desafio público aberto no momento.</p>
                          ) : (
                            <div className="flex flex-col lg:flex-row gap-3">
                              {/* Desafio em destaque */}
                              <div className="lg:flex-1 bg-white/10 rounded-lg p-4 flex flex-col gap-3">
                                <div>
                                  <p className="text-overline uppercase tracking-widest font-bold text-white/60 mb-1">
                                    Lançado por {allFounders.find(f => f.id === publicChallenges[0].founderId)?.name || 'Founder'}
                                  </p>
                                  <h5 className="text-base font-bold leading-tight mb-1">{publicChallenges[0].title}</h5>
                                  {publicChallenges[0].description && (
                                    <p className="text-white/60 text-xs line-clamp-2">"{publicChallenges[0].description}"</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => { setView('portal'); setActiveSubTab('desafios-publicos'); }}
                                  className="mt-auto w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-md text-overline font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                  Ajudar a resolver <ArrowRight size={12} />
                                </button>
                              </div>

                              {/* Outros desafios recentes */}
                              {publicChallenges.length > 1 && (
                                <div className="lg:w-72 flex flex-col gap-2">
                                  {publicChallenges.slice(1).map(ch => (
                                    <div key={ch.id} className="bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-colors cursor-pointer flex flex-col gap-0.5" onClick={() => { setView('portal'); setActiveSubTab('desafios-publicos'); }}>
                                      <p className="text-overline uppercase tracking-widest font-bold text-white/50">
                                        {allFounders.find(f => f.id === ch.founderId)?.name || 'Founder'}
                                      </p>
                                      <p className="text-sm font-bold text-white line-clamp-2">{ch.title}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 mt-4">
                  {/* Founders */}
                  <div
                    onClick={() => setActiveGeneralCategory('founders')}
                    className="bg-white p-4 lg:p-5 rounded-xl lg:rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 lg:w-10 lg:h-10 bg-stone-100 rounded-md flex items-center justify-center mb-3 lg:mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <Users size={18} />
                    </div>
                    <h3 className="text-base font-sans mb-1">Founders</h3>
                    <p className="text-stone-400 text-xs hidden sm:block">Conheça todos os founders cadastrados na nossa comunidade.</p>
                  </div>

                  {/* Avisos */}
                  <div
                    onClick={() => setActiveGeneralCategory('aviso')}
                    className="bg-white p-4 lg:p-5 rounded-xl lg:rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 lg:w-10 lg:h-10 bg-stone-100 rounded-md flex items-center justify-center mb-3 lg:mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <AlertTriangle size={18} />
                    </div>
                    <h3 className="text-base font-sans mb-1">Avisos</h3>
                    <p className="text-stone-400 text-xs hidden sm:block">Comunicados importantes e atualizações de última hora.</p>
                  </div>

                  {/* Eventos */}
                  <div
                    onClick={() => setActiveGeneralCategory('evento')}
                    className="bg-white p-4 lg:p-5 rounded-xl lg:rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 lg:w-10 lg:h-10 bg-stone-100 rounded-md flex items-center justify-center mb-3 lg:mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <CalendarDays size={18} />
                    </div>
                    <h3 className="text-base font-sans mb-1">Eventos</h3>
                    <p className="text-stone-400 text-xs hidden sm:block">Calendário de workshops, meetups e encontros.</p>
                  </div>

                  {/* Comunicação */}
                  <div
                    onClick={() => setActiveGeneralCategory('comunicacao')}
                    className="bg-white p-4 lg:p-5 rounded-xl lg:rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 lg:w-10 lg:h-10 bg-stone-100 rounded-md flex items-center justify-center mb-3 lg:mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <MessageSquare size={18} />
                    </div>
                    <h3 className="text-base font-sans mb-1">Assets dos Founders</h3>
                    <p className="text-stone-400 text-xs hidden sm:block">Canais oficiais de suporte e interação entre membros.</p>
                  </div>
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setShowIndicarFounderModal(true);
                      setIndicarSuccess(false);
                      setIndicarError('');
                      setIndicarNome('');
                      setIndicarEmpresa('');
                      setIndicarArea('');
                    }}
                    className="w-full bg-stone-900 text-white px-8 py-6 rounded-xl relative overflow-hidden hover:bg-stone-800 transition-all group"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-4">
                      <div className="bg-white/10 p-2.5 rounded-lg group-hover:bg-white/20 transition-all shrink-0">
                        <UserPlus size={22} className="text-white" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-h3 font-sans">Indicar um Founder</h2>
                        <p className="text-white/60 text-sm">Conhece alguém que deveria fazer parte da nossa comunidade?</p>
                      </div>
                      <ArrowRight size={20} className="text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                  </button>

                  <button
                    onClick={() => {
                      setShowIndicarMantenedorModal(true);
                      setIndicarMantenedorSuccess(false);
                      setIndicarMantenedorError('');
                      setIndicarMantenedorNome('');
                      setIndicarMantenedorEspaco('');
                      setIndicarMantenedorArea('');
                    }}
                    className="w-full bg-stone-900 text-white px-8 py-6 rounded-xl relative overflow-hidden hover:bg-stone-800 transition-all group"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-4">
                      <div className="bg-white/10 p-2.5 rounded-lg group-hover:bg-white/20 transition-all shrink-0">
                        <Building2 size={22} className="text-white" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-h3 font-sans">Indicar um Mantenedor</h2>
                        <p className="text-white/60 text-sm">Conhece um mantenedor para nosso QDDO?</p>
                      </div>
                      <ArrowRight size={20} className="text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                  </button>
                </div>
              </div>
            ) : (
              <BookingFlow
                rooms={rooms}
                bookings={bookings}
                businessHours={businessHours}
                selectedRoomId={selectedRoomId}
                setSelectedRoomId={setSelectedRoomId}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                status={bookingStatus}
                setStatus={setBookingStatus}
                activeSubTab={activeSubTab}
                onStepChange={(stepId) => {
                  const subTabs = ['escolha-sala', 'escolha-data', 'escolha-horario'];
                  setActiveSubTab(subTabs[stepId - 1]);
                }}
                isAdmin={isAdmin}
                onRoomUpdate={handleRoomUpdate}
                onRoomCreate={handleRoomCreate}
              />
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-stone-100 py-1 bg-white z-50">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 text-center">
          <p className="text-stone-300 text-caption leading-none">
            <span className="hidden md:inline">© 2026 Qddo - Gestão inteligente de espaços - Brenda Ribeiro</span>
            <span className="md:hidden">© 2026 Qddo</span>
          </p>
        </div>
      </footer>

      {activeGeneralCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary text-white rounded-lg flex items-center justify-center">
                  {activeGeneralCategory === 'founders' ? <Users size={24} /> :
                   activeGeneralCategory === 'regras' ? <ShieldCheck size={24} /> :
                   activeGeneralCategory === 'aviso' ? <AlertTriangle size={24} /> :
                   activeGeneralCategory === 'evento' ? <CalendarDays size={24} /> :
                   <MessageSquare size={24} />}
                </div>
                <div>
                  <h3 className="text-h2 font-sans text-stone-900 capitalize">{{
                    founders: 'Founders',
                    regras: 'Regras',
                    aviso: 'Avisos',
                    evento: 'Eventos',
                    comunicacao: 'Materiais de Apoio',
                  }[activeGeneralCategory] ?? activeGeneralCategory}</h3>
                  <p className="text-stone-400 text-xs uppercase tracking-widest font-bold">Portal Founder</p>
                </div>
              </div>
              <button
                onClick={() => setActiveGeneralCategory(null)}
                className="w-10 h-10 rounded-full hover:bg-stone-200 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
              {activeGeneralCategory === 'founders' ? (
                allFounders.length > 0 ? (
                  <div className="space-y-3">
                    {[...allFounders].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')).map(f => (
                      <div key={f.id} className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg border border-stone-100 hover:border-stone-300 transition-all">
                        <div className="w-11 h-11 bg-stone-200 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                          {f.photoURL ? (
                            <img src={f.photoURL} alt={f.name} className="w-full h-full object-cover" />
                          ) : (
                            <Users size={18} className="text-stone-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => setSelectedFounderDetail(f)}
                            className="font-bold text-stone-900 hover:text-stone-600 transition-colors text-left truncate block w-full"
                          >
                            {f.name}
                          </button>
                          {f.company?.name && (
                            <p className="text-xs text-stone-400 truncate">{f.company.name}</p>
                          )}
                        </div>
                        {(f.socialLinkedin || f.socialInstagram || f.socialSite) && (
                          <button
                            onClick={() => setSelectedFounderDetail(f)}
                            className="text-stone-300 hover:text-stone-900 transition-colors shrink-0"
                            title="Ver links sociais"
                          >
                            <ExternalLink size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-stone-400">Nenhum founder cadastrado ainda.</p>
                  </div>
                )
              ) : newsItems.filter(item => item.category === activeGeneralCategory).length > 0 ? (
                newsItems
                  .filter(item => item.category === activeGeneralCategory)
                  .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
                  .map(item => (
                    <div key={item.id} className="p-6 bg-stone-50 rounded-xl border border-stone-100">
                      {editingRuleId === item.id ? (
                        <div className="space-y-3">
                          <input
                            value={editingRuleData.title}
                            onChange={e => setEditingRuleData(d => ({ ...d, title: e.target.value }))}
                            className="w-full px-4 py-2 border border-stone-100 rounded-md text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                          />
                          <textarea
                            rows={4}
                            value={editingRuleData.content}
                            onChange={e => setEditingRuleData(d => ({ ...d, content: e.target.value }))}
                            className="w-full px-4 py-2 border border-stone-100 rounded-md text-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition resize-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingRuleId(null)}
                              className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-900 transition"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleSaveRule}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-md hover:bg-primary/80 transition"
                            >
                              <Check size={13} />
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-stone-900">{item.title}</h4>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <span className="text-overline text-stone-400 font-bold">
                                {toDate(item.createdAt)?.toLocaleDateString('pt-BR') || ''}
                              </span>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => { setEditingRuleId(item.id); setEditingRuleData({ title: item.title, content: item.content }); setDeletingRuleId(null); }}
                                    className="ml-2 p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-200 rounded-lg transition"
                                    title="Editar"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  {deletingRuleId === item.id ? (
                                    <div className="flex items-center gap-1 ml-1">
                                      <span className="text-overline text-red-500 font-bold">Confirmar?</span>
                                      <button
                                        onClick={() => handleDeleteRule(item.id)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition font-bold text-overline"
                                      >
                                        Sim
                                      </button>
                                      <button
                                        onClick={() => setDeletingRuleId(null)}
                                        className="p-1.5 text-stone-400 hover:bg-stone-200 rounded-lg transition font-bold text-overline"
                                      >
                                        Não
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => { setDeletingRuleId(item.id); setEditingRuleId(null); }}
                                      className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                      title="Excluir"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
                          {item.eventDate && (
                            <div className="mt-4 flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                                <CalendarDays size={14} />
                                <span>Data: {new Date(item.eventDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              </div>
                              {(item.startTime || item.endTime) && (
                                <div className="flex flex-wrap items-center gap-4 text-primary font-bold text-xs uppercase tracking-widest">
                                  <div className="flex items-center gap-2">
                                    <Clock size={14} />
                                    <span>Início: {item.startTime || '--:--'}</span>
                                  </div>
                                  {item.endTime && (
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} />
                                      <span>Término: {item.endTime}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {item.attachmentUrl && (
                                <a
                                  href={item.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-stone-900 font-bold text-xs hover:underline decoration-stone-900/30"
                                >
                                  <Paperclip size={14} />
                                  <span>Anexo: {item.attachmentName || 'Ver Arquivo'}</span>
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-stone-400">Nenhum conteúdo disponível nesta categoria.</p>
                </div>
              )}
            </div>
            {activeGeneralCategory !== 'founders' && isAdmin && (
              <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-center">
                <button
                  onClick={() => setShowAddNewsModal(true)}
                  className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                >
                  <Plus size={18} />
                  Adicionar Conteúdo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedNewsItem && (() => {
        const isAviso = selectedNewsItem.category === 'aviso';
        const date = isAviso
          ? (toDate(selectedNewsItem.createdAt)?.toLocaleDateString('pt-BR') || '')
          : (toDate(selectedNewsItem.eventDate)?.toLocaleDateString('pt-BR') || toDate(selectedNewsItem.createdAt)?.toLocaleDateString('pt-BR') || '');
        return (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => { setSelectedNewsItem(null); setEventCheckinError(null); setEventCheckinTime(null); }}
          >
            <div
              className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Image */}
              {selectedNewsItem.imageUrl && (
                <div className="w-full h-48 bg-stone-100 overflow-hidden flex-shrink-0">
                  <img src={selectedNewsItem.imageUrl} alt={selectedNewsItem.title} className="w-full h-full object-cover" />
                </div>
              )}

              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-stone-100 flex items-start justify-between gap-4 flex-shrink-0">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAviso ? (
                      <span className="text-overline uppercase tracking-widest font-bold bg-rose-50 px-2 py-0.5 rounded-full text-rose-500 flex items-center gap-1">
                        <AlertTriangle size={9} /> Aviso
                      </span>
                    ) : (
                      <span className="text-overline uppercase tracking-widest font-bold bg-stone-100 px-2 py-0.5 rounded-full text-stone-500">Evento</span>
                    )}
                    {date && <span className="text-overline uppercase tracking-widest font-bold text-stone-400">{date}</span>}
                  </div>
                  <h3 className="text-base font-sans font-bold text-stone-900 uppercase tracking-tight leading-snug">{selectedNewsItem.title}</h3>
                  {!isAviso && (selectedNewsItem.startTime || selectedNewsItem.endTime) && (
                    <span className="text-overline uppercase tracking-widest font-bold text-primary flex items-center gap-1.5">
                      <Clock size={10} />
                      {selectedNewsItem.startTime || '--:--'}{selectedNewsItem.endTime && ` – ${selectedNewsItem.endTime}`}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedNewsItem(null); setEventCheckinError(null); setEventCheckinTime(null); }}
                  className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors shrink-0 mt-0.5"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
                <div className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selectedNewsItem.content }} />

                {(selectedNewsItem.eventDate || selectedNewsItem.attachmentUrl) && (
                  <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-stone-100">
                    {selectedNewsItem.eventDate && (
                      <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                        <CalendarDays size={14} />
                        <span>Data: {toDate(selectedNewsItem.eventDate)?.toLocaleDateString('pt-BR') || ''}</span>
                      </div>
                    )}
                    {selectedNewsItem.startTime && (
                      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                        <Clock size={14} />
                        <span>Início: {selectedNewsItem.startTime}</span>
                      </div>
                    )}
                    {selectedNewsItem.endTime && (
                      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                        <Clock size={14} />
                        <span>Término: {selectedNewsItem.endTime}</span>
                      </div>
                    )}
                    {selectedNewsItem.attachmentUrl && (
                      <a
                        href={selectedNewsItem.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-stone-900 font-bold text-xs hover:underline decoration-stone-900/30"
                      >
                        <Paperclip size={14} />
                        <span>{selectedNewsItem.attachmentName || 'Ver Arquivo'}</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Event check-in footer */}
              {!isAviso && selectedNewsItem.category === 'evento' && founderData && (
                <div className="px-6 py-4 border-t border-stone-100 flex-shrink-0 space-y-2">
                  {(founderData.eventAttendance || []).map(String).includes(String(selectedNewsItem.id || selectedNewsItem._id)) ? (
                    <div className="flex flex-col items-center justify-center gap-1 w-full py-3 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} />
                        Presença confirmada · +20 pts
                      </div>
                      {eventCheckinTime && (
                        <span className="text-emerald-500 font-normal text-xs">Check-in às {eventCheckinTime}</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEventCheckinError(null); handleEventCheckin(selectedNewsItem); }}
                      disabled={eventCheckinLoading}
                      className="w-full py-3 rounded-lg bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} />
                      {eventCheckinLoading ? 'Verificando localização...' : 'Estive aqui · +20 pts'}
                    </button>
                  )}
                  {eventCheckinError && (
                    <p className="text-xs text-center text-red-500 font-medium">{eventCheckinError}</p>
                  )}
                </div>
              )}

              {/* Admin footer */}
              {isAdmin && (
                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      const item = selectedNewsItem;
                      setSelectedNewsItem(null);
                      setAdminInitialEditNewsItem(item);
                      setAdminInitialTab('news');
                      setView('admin');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-stone-600 bg-white border border-stone-100 rounded-lg hover:bg-stone-100 transition"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={() => {
                      setSelectedNewsItem(null);
                      setAdminInitialTab('news');
                      setView('admin');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition"
                  >
                    <Plus size={13} /> Adicionar Conteúdo
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {showAddNewsModal && (
        <NewsFormModal
          onClose={() => setShowAddNewsModal(false)}
        />
      )}

      {showIndicarFounderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowIndicarFounderModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-8 relative shadow-2xl" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <button
              onClick={() => setShowIndicarFounderModal(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-stone-900 p-3 rounded-lg">
                <UserPlus size={22} className="text-white" />
              </div>
              <h2 className="text-h2 font-sans text-stone-900">Indicar um Founder</h2>
            </div>

            {indicarSuccess ? (
              <div className="text-center py-8">
                <div className="bg-green-50 text-green-700 rounded-lg p-6 mb-4">
                  <p className="font-bold text-lg mb-1">Indicação enviada!</p>
                  <p className="text-sm text-green-600">Obrigado por fortalecer a nossa rede.</p>
                </div>
                <button
                  onClick={() => setShowIndicarFounderModal(false)}
                  className="bg-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-primary/80 transition-all"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleIndicarFounderSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Nome do Founder indicado
                  </label>
                  <input
                    type="text"
                    value={indicarNome}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarNome(e.target.value)}
                    placeholder="Ex: João Silva"
                    required
                    className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Empresa / Projeto
                  </label>
                  <input
                    type="text"
                    value={indicarEmpresa}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarEmpresa(e.target.value)}
                    placeholder="Ex: Startup XYZ"
                    required
                    className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Área de atuação do mercado
                  </label>
                  <input
                    type="text"
                    value={indicarArea}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarArea(e.target.value)}
                    placeholder="Ex: Fintech, Saúde, Educação..."
                    required
                    className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Contato
                  </label>
                  <input
                    type="tel"
                    value={indicarContato}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarContato(e.target.value)}
                    placeholder="( ) "
                    required
                    className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                {indicarError && (
                  <p className="text-red-500 text-xs text-center">{indicarError}</p>
                )}
                <button
                  type="submit"
                  disabled={indicarSubmitting}
                  className="mt-2 bg-primary text-white px-8 py-4 rounded-lg font-bold hover:bg-primary/80 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Send size={18} />
                  {indicarSubmitting ? 'Enviando...' : 'Enviar indicação'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {showIndicarMantenedorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowIndicarMantenedorModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-8 relative shadow-2xl" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <button
              onClick={() => setShowIndicarMantenedorModal(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-stone-900 p-3 rounded-lg">
                <Building2 size={22} className="text-white" />
              </div>
              <h2 className="text-h2 font-sans text-stone-900">Indicar um Mantenedor</h2>
            </div>

            {indicarMantenedorSuccess ? (
              <div className="text-center py-8">
                <div className="bg-green-50 text-green-700 rounded-lg p-6 mb-4">
                  <p className="font-bold text-lg mb-1">Indicação enviada!</p>
                  <p className="text-sm text-green-600">Obrigado por fortalecer a nossa rede.</p>
                </div>
                <button
                  onClick={() => setShowIndicarMantenedorModal(false)}
                  className="bg-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-primary/80 transition-all"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleIndicarMantenedorSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Nome do Mantenedor indicado
                  </label>
                  <input
                    type="text"
                    value={indicarMantenedorNome}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarMantenedorNome(e.target.value)}
                    placeholder="Ex: João Silva"
                    required
                    className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Espaço / Empresa
                  </label>
                  <input
                    type="text"
                    value={indicarMantenedorEspaco}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarMantenedorEspaco(e.target.value)}
                    placeholder="Ex: Espaço XYZ"
                    required
                    className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Área de atuação
                  </label>
                  <input
                    type="text"
                    value={indicarMantenedorArea}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarMantenedorArea(e.target.value)}
                    placeholder="Ex: Mentoria, Design, Jurídico..."
                    required
                    className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Contato
                  </label>
                  <input
                    type="tel"
                    value={indicarMantenedorContato}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicarMantenedorContato(e.target.value)}
                    placeholder="( ) "
                    required
                    className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                  />
                </div>
                {indicarMantenedorError && (
                  <p className="text-red-500 text-xs text-center">{indicarMantenedorError}</p>
                )}
                <button
                  type="submit"
                  disabled={indicarMantenedorSubmitting}
                  className="mt-2 bg-primary text-white px-8 py-4 rounded-lg font-bold hover:bg-primary/80 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Send size={18} />
                  {indicarMantenedorSubmitting ? 'Enviando...' : 'Enviar indicação'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {showSolicitarQcoinModal && (() => {
        const tipoIdx = pontuacaoCols.findIndex((c: string) => c.trim().toLowerCase() === 'tipo');
        const requerFounderIdx = pontuacaoCols.findIndex((c: string) => c.trim().toLowerCase().includes('requer'));
        const manualActions = pontuacaoRows
          .filter((r: string[]) => r[0]?.trim())
          .map((r: string[]) => ({
            title: r[0]?.trim() || '',
            pts: r[1]?.trim() || '',
            tipo: (tipoIdx >= 0 ? r[tipoIdx]?.trim() : '') || 'Manual',
            requerFounder: requerFounderIdx >= 0 && /^sim$/i.test(r[requerFounderIdx]?.trim() || ''),
          }))
          .filter((a: any) => a.tipo.toLowerCase() !== 'automático' && a.tipo.toLowerCase() !== 'automatico');
        const selectedAction = manualActions.find((a: any) => a.title === solicitarAcao);
        const founderMatches = selectedAction?.requerFounder && solicitarFounderSearch.trim().length > 0
          ? allFounders
              .filter((f: any) => (f.id || f._id) !== (founderData?._id || founderData?.id))
              .filter((f: any) => {
                const q = solicitarFounderSearch.trim().toLowerCase();
                return (f.name || '').toLowerCase().includes(q) || (f.username || '').replace(/^@/, '').toLowerCase().includes(q);
              })
              .slice(0, 6)
          : [];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowSolicitarQcoinModal(false)}>
            <div className="bg-white rounded-xl w-full max-w-md p-8 relative shadow-2xl" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <button
                onClick={() => setShowSolicitarQcoinModal(false)}
                className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-stone-900 p-3 rounded-lg">
                  <Award size={22} className="text-white" />
                </div>
                <h2 className="text-h2 font-sans text-stone-900">Solicitar QCoins</h2>
              </div>

              {solicitarSuccess ? (
                <div className="text-center py-8">
                  <div className="bg-green-50 text-green-700 rounded-lg p-6 mb-4">
                    <p className="font-bold text-lg mb-1">Solicitação enviada!</p>
                    <p className="text-sm text-green-600">
                      {solicitarSuccessRequerFounder
                        ? 'O founder marcado vai confirmar a ajuda antes dos pontos serem creditados.'
                        : 'Um admin vai revisar e aprovar em breve.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSolicitarQcoinModal(false)}
                    className="bg-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-primary/80 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={(e: React.FormEvent) => handleSolicitarQcoinSubmit(e, manualActions)} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                      Qual ação você realizou?
                    </label>
                    <select
                      value={solicitarAcao}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setSolicitarAcao(e.target.value); setSolicitarParaFounder(null); setSolicitarFounderSearch(''); }}
                      required
                      className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition appearance-none cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      {manualActions.map((a: any, idx: number) => (
                        <option key={idx} value={a.title}>{a.title} (+{a.pts})</option>
                      ))}
                    </select>
                  </div>
                  {selectedAction && (
                    <div className="bg-terracota-50 border border-terracota-100 rounded-lg px-4 py-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Pontuação</span>
                      <span className="text-lg font-black text-primary tabular-nums">+{selectedAction.pts} moedas</span>
                    </div>
                  )}
                  {selectedAction?.requerFounder && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                        Quem você ajudou?
                      </label>
                      {solicitarParaFounder ? (
                        <div className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded-lg px-4 py-3">
                          <span className="text-sm font-semibold text-stone-900">{solicitarParaFounder.name} <span className="text-stone-400 font-normal">@{(solicitarParaFounder.username || '').replace(/^@/, '')}</span></span>
                          <button type="button" onClick={() => setSolicitarParaFounder(null)} className="text-stone-400 hover:text-stone-700">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            value={solicitarFounderSearch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSolicitarFounderSearch(e.target.value)}
                            placeholder="Busque por nome ou @usuário..."
                            className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
                          />
                          {founderMatches.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-stone-100 rounded-lg shadow-lg overflow-hidden">
                              {founderMatches.map((f: any) => (
                                <button
                                  key={f.id || f._id}
                                  type="button"
                                  onClick={() => { setSolicitarParaFounder({ id: f.id || f._id, name: f.name, username: f.username }); setSolicitarFounderSearch(''); }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors flex items-center gap-2"
                                >
                                  <span className="text-sm font-semibold text-stone-900">{f.name}</span>
                                  <span className="text-xs text-stone-400">@{(f.username || '').replace(/^@/, '')}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                      Observação para o admin
                    </label>
                    <textarea
                      value={solicitarObservacao}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSolicitarObservacao(e.target.value)}
                      placeholder="Conte um pouco de contexto para o admin avaliar sua solicitação..."
                      required
                      rows={4}
                      className="w-full border border-stone-100 rounded-lg px-4 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 transition resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={solicitarSubmitting || !solicitarAcao || !solicitarObservacao.trim() || (!!selectedAction?.requerFounder && !solicitarParaFounder)}
                    className="mt-2 bg-primary text-white px-8 py-4 rounded-lg font-bold hover:bg-primary/80 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Send size={18} />
                    {solicitarSubmitting ? 'Enviando...' : 'Enviar solicitação'}
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* Profile Modal */}
      {showProfileModal && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-sm p-8 relative shadow-2xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-h3 font-black tracking-tight text-stone-900 mb-6">Meu Perfil</h2>

            {/* Foto de Perfil */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <img
                  src={user.photoURL || ''}
                  alt="Foto de perfil"
                  className="w-24 h-24 rounded-full border-2 border-stone-200 object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={profilePhotoUploading}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  {profilePhotoUploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Pencil size={18} className="text-white" />
                  )}
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-2">Clique na foto para alterar</p>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePhotoChange}
              />
            </div>

            {/* Nome, Username e Email */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">Nome</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileName(e.target.value)}
                  className="w-full text-sm text-stone-900 px-4 py-3 bg-stone-50 rounded-lg border border-transparent focus:border-stone-300 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">Username</label>
                <div className="flex items-center bg-stone-50 rounded-lg border border-transparent focus-within:border-stone-300 transition-colors px-4 py-3 gap-1">
                  <span className="text-stone-400 text-sm select-none">@</span>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileUsername(e.target.value.replace(/@/g, ''))}
                    className="flex-1 bg-transparent text-sm text-stone-900 focus:outline-none"
                    placeholder="seu.username"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">E-mail</label>
                <p className="text-sm text-stone-900 px-4 py-3 bg-stone-50 rounded-lg truncate">{user.email}</p>
              </div>
            </div>

            {/* Data de Aniversário */}
            <div className="mb-8">
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Data de Aniversário</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <select
                    value={profileBirthDay}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProfileBirthDay(e.target.value)}
                    className="w-full border border-stone-100 rounded-md px-2 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition bg-white"
                  >
                    <option value="">Dia</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={String(d).padStart(2, '0')}>{String(d).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={profileBirthMonth}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProfileBirthMonth(e.target.value)}
                    className="w-full border border-stone-100 rounded-md px-2 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition bg-white"
                  >
                    <option value="">Mês</option>
                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={profileBirthYear}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProfileBirthYear(e.target.value)}
                    className="w-full border border-stone-100 rounded-md px-2 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition bg-white"
                  >
                    <option value="">Ano</option>
                    {Array.from({ length: 60 }, (_, i) => new Date().getFullYear() - 18 - i).map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {profileSaveError && (
              <p className="text-red-500 text-xs text-center mb-3">{profileSaveError}</p>
            )}
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="w-full bg-primary text-white rounded-lg py-3 text-sm font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              {profileSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {showSettingsModal && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-sm p-8 relative shadow-2xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-h3 font-black tracking-tight text-stone-900 mb-6">Configurações</h2>

            {/* Modo Dark */}
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Tema</p>
              <div className="flex items-center justify-between px-4 py-3 bg-stone-50 rounded-lg">
                <span className="text-sm font-medium text-stone-700">Modo Dark</span>
                <button
                  onClick={() => setDarkMode((prev: boolean) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${darkMode ? 'bg-stone-900' : 'bg-stone-300'}`}
                  aria-label="Alternar modo dark"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${darkMode ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full bg-primary text-white rounded-lg py-3 text-sm font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showSocialModal && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowSocialModal(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-sm p-8 relative shadow-2xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSocialModal(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-h3 font-black tracking-tight text-stone-900 mb-6">Social</h2>

            <div className="space-y-4 mb-8">
              {/* LinkedIn */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                  LinkedIn
                </label>
                <input
                  type="url"
                  value={settingsSocialLinkedin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettingsSocialLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/seuperfil"
                  className="w-full border border-stone-100 rounded-md px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition bg-white placeholder:text-stone-300"
                />
                {settingsSocialLinkedin && (
                  <a href={settingsSocialLinkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-stone-400 hover:text-stone-700 mt-1 inline-flex items-center gap-1 transition-colors">
                    <ExternalLink size={11} /> Abrir perfil
                  </a>
                )}
              </div>

              {/* Instagram */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  Instagram
                </label>
                <input
                  type="url"
                  value={settingsSocialInstagram}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettingsSocialInstagram(e.target.value)}
                  placeholder="https://instagram.com/seuperfil"
                  className="w-full border border-stone-100 rounded-md px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition bg-white placeholder:text-stone-300"
                />
                {settingsSocialInstagram && (
                  <a href={settingsSocialInstagram} target="_blank" rel="noopener noreferrer" className="text-xs text-stone-400 hover:text-stone-700 mt-1 inline-flex items-center gap-1 transition-colors">
                    <ExternalLink size={11} /> Abrir perfil
                  </a>
                )}
              </div>

              {/* Site */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                  <Globe size={12} />
                  Site
                </label>
                <input
                  type="url"
                  value={settingsSocialSite}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettingsSocialSite(e.target.value)}
                  placeholder="https://seusite.com"
                  className="w-full border border-stone-100 rounded-md px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition bg-white placeholder:text-stone-300"
                />
                {settingsSocialSite && (
                  <a href={settingsSocialSite} target="_blank" rel="noopener noreferrer" className="text-xs text-stone-400 hover:text-stone-700 mt-1 inline-flex items-center gap-1 transition-colors">
                    <ExternalLink size={11} /> Abrir site
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveSocial}
              disabled={socialSaving}
              className="w-full bg-primary text-white rounded-lg py-3 text-sm font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              {socialSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Founder Detail Overlay */}
      {selectedFounderDetail && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedFounderDetail(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedFounderDetail(null)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Avatar + nome */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center mb-4 ring-4 ring-stone-100">
                {selectedFounderDetail.photoURL ? (
                  <img src={selectedFounderDetail.photoURL} alt={selectedFounderDetail.name} className="w-full h-full object-cover" />
                ) : (
                  <Users size={28} className="text-stone-400" />
                )}
              </div>
              <h3 className="text-h3 font-sans text-stone-900 leading-tight">{selectedFounderDetail.name}</h3>
              {selectedFounderDetail.username && (
                <p className="text-xs text-stone-400 font-bold mt-0.5">@{selectedFounderDetail.username?.replace(/^@/, '')}</p>
              )}
              {selectedFounderDetail.company?.name && (
                <p className="text-sm text-stone-500 mt-1">{selectedFounderDetail.company.name}</p>
              )}
              {selectedFounderDetail.bio && (
                <p className="text-xs text-stone-400 mt-3 leading-relaxed">{selectedFounderDetail.bio}</p>
              )}
            </div>

            {/* Links sociais */}
            <div className="space-y-3">
              {selectedFounderDetail.socialLinkedin && (
                <a
                  href={selectedFounderDetail.socialLinkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-3.5 bg-stone-50 border border-stone-100 rounded-lg hover:bg-stone-900 hover:border-stone-900 hover:text-white group transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-stone-500 group-hover:text-white shrink-0"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                  <span className="text-sm font-bold text-stone-700 group-hover:text-white truncate flex-1">LinkedIn</span>
                  <ExternalLink size={13} className="text-stone-300 group-hover:text-white shrink-0" />
                </a>
              )}
              {selectedFounderDetail.socialInstagram && (
                <a
                  href={selectedFounderDetail.socialInstagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-3.5 bg-stone-50 border border-stone-100 rounded-lg hover:bg-stone-900 hover:border-stone-900 hover:text-white group transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500 group-hover:text-white shrink-0"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  <span className="text-sm font-bold text-stone-700 group-hover:text-white truncate flex-1">Instagram</span>
                  <ExternalLink size={13} className="text-stone-300 group-hover:text-white shrink-0" />
                </a>
              )}
              {selectedFounderDetail.socialSite && (
                <a
                  href={selectedFounderDetail.socialSite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-3.5 bg-stone-50 border border-stone-100 rounded-lg hover:bg-stone-900 hover:border-stone-900 hover:text-white group transition-all"
                >
                  <Globe size={16} className="text-stone-500 group-hover:text-white shrink-0" />
                  <span className="text-sm font-bold text-stone-700 group-hover:text-white truncate flex-1">Site</span>
                  <ExternalLink size={13} className="text-stone-300 group-hover:text-white shrink-0" />
                </a>
              )}
              {!selectedFounderDetail.socialLinkedin && !selectedFounderDetail.socialInstagram && !selectedFounderDetail.socialSite && (
                <p className="text-center text-stone-400 text-sm py-4">Nenhum link social cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onAccept={handleAcceptTerms}
      />
    </div>
  );
}
