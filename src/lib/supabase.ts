import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(url && anonKey);
export const supabase = hasSupabaseConfig ? createClient(url!, anonKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export type TripStage = 'new' | 'preparation' | 'checkin' | 'ready' | 'traveling' | 'completed';
export type Trip = {
  id: string; passenger_name: string; company: string | null; secretary: string | null;
  destination: string; country: string | null; departure_date: string; return_date: string;
  airline: string | null; notes: string | null; stage: TripStage; created_at: string;
};
export type Task = {
  id: string; trip_id: string | null; title: string; description: string | null;
  due_date: string | null; due_time: string | null; priority: 'low' | 'medium' | 'high';
  status: 'not_started' | 'pending' | 'in_progress' | 'completed' | 'overdue'; created_at: string;
};
export type TravelDocument = {
  id: string; trip_id: string | null; task_id: string | null; file_name: string;
  storage_path: string; category: string; description: string | null; created_at: string;
};
