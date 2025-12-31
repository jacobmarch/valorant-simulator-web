import { createClient, type User, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============ Types ============

export type Region = 'EMEA' | 'China' | 'Pacific' | 'Americas';

export interface Team {
  id: number;
  name: string;
  region: Region;
  abbreviation?: string;
  logo_url?: string;
}

export interface SavedGame {
  id: string;
  user_id: string;
  save_name: string;
  team_id: number;
  team_name: string;
  team_region: Region;
  team_abbreviation?: string;
  team_logo_url?: string;
  created_at: string;
  updated_at: string;
  game_data?: Record<string, unknown>;
}

// ============ Auth Functions ============

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

// ============ Teams Functions ============

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

export async function getTeamById(teamId: number): Promise<Team | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (error) {
    console.error('Error fetching team:', error);
    return null;
  }

  return data;
}

// ============ Saved Games Functions ============

export async function createSavedGame(
  saveName: string,
  team: Team
): Promise<SavedGame> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Must be logged in to save a game');
  }

  const { data, error } = await supabase
    .from('saved_games')
    .insert({
      user_id: user.id,
      save_name: saveName,
      team_id: team.id,
      team_name: team.name,
      team_region: team.region,
      team_abbreviation: team.abbreviation,
      team_logo_url: team.logo_url,
      game_data: {},
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating saved game:', error);
    throw error;
  }

  return data;
}

export async function getUserSavedGames(): Promise<SavedGame[]> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Must be logged in to view saved games');
  }

  const { data, error } = await supabase
    .from('saved_games')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved games:', error);
    throw error;
  }

  return data || [];
}

export async function loadSavedGame(gameId: string): Promise<SavedGame | null> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Must be logged in to load a game');
  }

  const { data, error } = await supabase
    .from('saved_games')
    .select('*')
    .eq('id', gameId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error loading saved game:', error);
    return null;
  }

  return data;
}

export async function deleteSavedGame(gameId: string): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Must be logged in to delete a game');
  }

  const { error } = await supabase
    .from('saved_games')
    .delete()
    .eq('id', gameId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting saved game:', error);
    throw error;
  }
}

export async function updateSavedGame(
  gameId: string,
  gameData: Record<string, unknown>
): Promise<SavedGame> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Must be logged in to update a game');
  }

  const { data, error } = await supabase
    .from('saved_games')
    .update({
      game_data: gameData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating saved game:', error);
    throw error;
  }

  return data;
}

