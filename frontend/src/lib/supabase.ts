import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Election = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'open' | 'closed';
  created_at: string;
};

export type Candidate = {
  id: string;
  election_id: string;
  name: string;
  description: string;
  photo_url: string;
  created_at: string;
};

export type Vote = {
  id: string;
  election_id: string;
  student_id: string;
  candidate_id: string;
  created_at: string;
};

export type Student = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
};