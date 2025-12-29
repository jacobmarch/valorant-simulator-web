import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Region = 'EMEA' | 'China' | 'Pacific' | 'Americas';

export interface Team {
  id: number;
  name: string;
  region: Region;
  abbreviation?: string;
  logo_url?: string;
}

export async function getTeamsByRegion(region: Region): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('region', region)
    .order('name');

  if (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }

  return data || [];
}

