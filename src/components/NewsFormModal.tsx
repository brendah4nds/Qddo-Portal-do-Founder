import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { Newspaper, Paperclip, XCircle, FileText, X } from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EMPTY_NEWS = {
  title: '',
  content: '',
  category: 'aviso' as 'aviso' | 'info' | 'evento' | 'noticia' | 'regras' | 'comunicacao',
  eventDate: '',
  startTime: '',
  endTime: '',
  imageUrl: '',
  attachmentUrl: '',
  attachmentName: '',
  attachmentType: ''
};

export function NewsFormModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const [news, setNews] = useState({ ...EMPTY_NEWS });
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingImageFileName, setPendingImageFileName] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) contentRef.current.innerHTML = '';
  }, []);

  const applyFormat = (command: string) => {
    contentRef.current?.focus();
    document.execCommand(command, false, undefined);
    if (contentRef.current) {
      setNews(prev => ({ ...prev, content: contentRef.current?.innerHTML ?? '' }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) { alert('Apenas imagens são permitidas.'); return; }
    setPendingImageFileName(file.name);
    setCropImageSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropImageSrc(null);
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, pendingImageFileName || 'cover.jpg');
      const { data } = await api.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNews(prev => ({ ...prev, imageUrl: data.url }));
    } catch {
      alert('Erro ao enviar imagem.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPDF = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPDF && !isImage) { alert('Apenas arquivos PDF e Imagens são permitidos.'); return; }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNews(prev => ({ ...prev, attachmentUrl: data.url, attachmentName: file.name, attachmentType: isPDF ? 'pdf' : 'png' }));
    } catch {
      alert('Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!news.title || !news.content) return;
    try {
      await api.post('/api/news', { ...news, eventDate: news.eventDate || null });
      onSuccess?.();
      onClose();
    } catch {
      alert('Erro ao publicar notícia.');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-stone-100 shrink-0">
            <h3 className="text-h2 font-sans">Nova Notícia</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable form */}
          <div className="overflow-y-auto flex-1">
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Título</label>
                  <input
                    required
                    type="text"
                    value={news.title}
                    onChange={e => setNews({ ...news, title: e.target.value })}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Categoria</label>
                  <select
                    value={news.category}
                    onChange={e => setNews({ ...news, category: e.target.value as any })}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                  >
                    <option value="aviso">Aviso</option>
                    <option value="info">Info</option>
                    <option value="evento">Evento</option>
                    <option value="noticia">Notícia</option>
                    <option value="regras">Regras</option>
                    <option value="comunicacao">Comunicação</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Data</label>
                  <input
                    type="date"
                    value={news.eventDate}
                    onChange={e => setNews({ ...news, eventDate: e.target.value })}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Início</label>
                  <input
                    type="time"
                    value={news.startTime}
                    onChange={e => setNews({ ...news, startTime: e.target.value })}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Término</label>
                  <input
                    type="time"
                    value={news.endTime}
                    onChange={e => setNews({ ...news, endTime: e.target.value })}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-lg focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Conteúdo</label>
                <div className="border border-stone-100 rounded-lg overflow-hidden focus-within:border-primary transition-all">
                  <div className="flex items-center gap-1 px-3 py-2 bg-stone-100 border-b border-stone-100">
                    <button
                      type="button"
                      onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); applyFormat('bold'); }}
                      className="w-7 h-7 flex items-center justify-center rounded font-bold text-sm text-stone-600 hover:bg-stone-200 transition-colors"
                      title="Negrito"
                    >B</button>
                    <button
                      type="button"
                      onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); applyFormat('italic'); }}
                      className="w-7 h-7 flex items-center justify-center rounded italic text-sm text-stone-600 hover:bg-stone-200 transition-colors"
                      title="Itálico"
                    >I</button>
                    <button
                      type="button"
                      onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); applyFormat('underline'); }}
                      className="w-7 h-7 flex items-center justify-center rounded underline text-sm text-stone-600 hover:bg-stone-200 transition-colors"
                      title="Sublinhado"
                    >U</button>
                  </div>
                  <div
                    ref={contentRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => {
                      const html = contentRef.current?.innerHTML ?? '';
                      setNews(prev => ({ ...prev, content: html }));
                    }}
                    className="w-full px-6 py-4 bg-stone-50 min-h-[100px] focus:outline-none text-sm leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400"
                    data-placeholder="Digite o conteúdo aqui..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Imagem de Capa</label>
                <div className="flex items-center gap-4">
                  <label className={cn(
                    "flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-stone-50 border border-dashed border-stone-200 rounded-lg cursor-pointer hover:bg-stone-100 transition-all",
                    isUploadingImage && "opacity-50 cursor-not-allowed"
                  )}>
                    <Newspaper size={20} className="text-stone-400" />
                    <span className="text-sm font-medium text-stone-500">
                      {isUploadingImage ? 'Enviando...' : news.imageUrl ? 'Alterar imagem' : 'Selecionar imagem'}
                    </span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploadingImage} className="hidden" />
                  </label>
                  {news.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setNews({ ...news, imageUrl: '' })}
                      className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400 hover:text-stone-700"
                    >
                      <XCircle size={18} />
                    </button>
                  )}
                </div>
                {news.imageUrl && (
                  <img src={news.imageUrl} alt="preview" className="w-full h-32 object-cover rounded-lg border border-stone-100 mt-1" />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-overline uppercase tracking-wider font-bold text-stone-400 ml-1">Anexo (PDF ou Imagem)</label>
                <div className="flex items-center gap-4">
                  <label className={cn(
                    "flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-stone-50 border border-dashed border-stone-200 rounded-lg cursor-pointer hover:bg-stone-100 transition-all",
                    isUploading && "opacity-50 cursor-not-allowed"
                  )}>
                    <Paperclip size={20} className="text-stone-400" />
                    <span className="text-sm font-medium text-stone-500">
                      {isUploading ? 'Enviando...' : news.attachmentName ? 'Alterar arquivo' : 'Selecionar arquivo'}
                    </span>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isUploading} className="hidden" />
                  </label>
                  {news.attachmentUrl && (
                    <div className="flex items-center gap-2 p-4 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                      {news.attachmentType === 'pdf' ? <FileText size={20} /> : <Newspaper size={20} />}
                      <div className="flex flex-col">
                        <span className="text-overline uppercase font-bold tracking-widest leading-none">Anexo Pronto</span>
                        <span className="text-xs font-medium truncate max-w-[150px]">{news.attachmentName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNews(prev => ({ ...prev, attachmentUrl: '', attachmentName: '', attachmentType: '' }))}
                        className="p-1 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 border border-stone-100 text-stone-600 py-4 rounded-lg font-bold hover:bg-stone-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading || isUploadingImage}
                  className="flex-1 bg-primary text-white py-4 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onConfirm={handleCropConfirm}
          onClose={() => {
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
          }}
          aspect={16 / 9}
          title="Ajustar imagem de capa"
        />
      )}
    </>
  );
}
