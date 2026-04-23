import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Send, MessageCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Comment } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ChallengeComments({ challengeId, user }: { challengeId: string; user: User | null }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!challengeId) return;

    const q = query(
      collection(db, 'comments'),
      where('challengeId', '==', challengeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      const sortedComments = commentsData.sort((a, b) => 
        (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      );
      setComments(sortedComments);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `comments/${challengeId}`));

    return unsubscribe;
  }, [challengeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    try {
      await addDoc(collection(db, 'comments'), {
        challengeId,
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        userPhoto: user.photoURL,
        text: newComment,
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="text-center py-4 text-stone-300 text-xs">Carregando comentários...</div>;

  return (
    <div className="mt-8 pt-8 border-t border-stone-100 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle size={18} className="text-stone-400" />
        <h4 className="font-sans text-lg">Comentários ({comments.length})</h4>
      </div>

      <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-200">
        {comments.length === 0 ? (
          <p className="text-stone-400 text-sm py-4">Nenhum comentário ainda. Seja o primeiro a ajudar!</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                <img src={comment.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userName}`} alt="" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 bg-stone-50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-stone-900">{comment.userName}</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold text-stone-300">
                    {comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : '...'}
                  </span>
                </div>
                <p className="text-sm text-stone-600 leading-relaxed">{comment.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 pt-4">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
          <img src={user?.photoURL || ''} alt="" referrerPolicy="no-referrer" />
        </div>
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Escreva um comentário ou sugestão..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className="w-full pl-6 pr-14 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
          />
          <button 
            type="submit"
            disabled={!newComment.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center hover:bg-stone-800 transition-all disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
