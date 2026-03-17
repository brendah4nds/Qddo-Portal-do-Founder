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
