import { User } from 'firebase/auth';

export interface Room {
  id: string;
  name: string;
  description?: string;
}

export interface Booking {
  id: string;
  roomId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  userName: string;
  userEmail: string;
  createdAt: any;
}

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error';

export interface Founder {
  id: string;
  name: string;
  username: string;
  instagram?: string;
  bio?: string;
  company?: {
    name: string;
    bio: string;
    cnpj?: string;
    tipo?: string;
  };
  registeredAt: any;
  role?: 'user' | 'admin';
}

export interface Challenge {
  id: string;
  founderId: string;
  title: string;
  description?: string;
  type: 'public' | 'private';
  status: 'open' | 'completed';
  helperName?: string;
  resolutionDescription?: string;
  createdAt: any;
  completedAt?: any;
}

export interface Comment {
  id: string;
  challengeId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  receiverId?: string; // If undefined, it's a public message
  text: string;
  createdAt: any;
}
