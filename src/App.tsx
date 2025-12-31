import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import './App.css';
import Landing from './components/Landing';
import NewGame from './components/NewGame';
import LoadGame from './components/LoadGame';
import AuthModal from './components/AuthModal';
import {
  type Team,
  type SavedGame,
  getCurrentUser,
  onAuthStateChange,
  signOut,
  createSavedGame,
} from './lib/supabase';
import './styles/global.css';

type GameView = 'landing' | 'new-game' | 'load-game' | 'game';

interface GameState {
  id: string;
  saveName: string;
  teamId: number;
  teamName: string;
  teamRegion: string;
  teamAbbreviation?: string;
  teamLogoUrl?: string;
}

function App() {
  const [currentView, setCurrentView] = useState<GameView>('landing');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'new-game' | 'load-game' | null>(null);

  useEffect(() => {
    // Check initial auth state
    getCurrentUser().then((user) => {
      setUser(user);
      setIsLoadingAuth(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleNewGame = () => {
    if (!user) {
      setPendingAction('new-game');
      setShowAuthModal(true);
    } else {
      setCurrentView('new-game');
    }
  };

  const handleLoadGame = () => {
    if (!user) {
      setPendingAction('load-game');
      setShowAuthModal(true);
    } else {
      setCurrentView('load-game');
    }
  };

  const handleBack = () => {
    setCurrentView('landing');
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    if (pendingAction) {
      setCurrentView(pendingAction);
      setPendingAction(null);
    }
  };

  const handleAuthClose = () => {
    setShowAuthModal(false);
    setPendingAction(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setCurrentView('landing');
      setGameState(null);
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  const handleStartGame = async (saveName: string, team: Team) => {
    try {
      // Save the game to Supabase
      const savedGame = await createSavedGame(saveName, team);

      setGameState({
        id: savedGame.id,
        saveName: savedGame.save_name,
        teamId: savedGame.team_id,
        teamName: savedGame.team_name,
        teamRegion: savedGame.team_region,
        teamAbbreviation: savedGame.team_abbreviation,
        teamLogoUrl: savedGame.team_logo_url,
      });
      setCurrentView('game');
    } catch (err) {
      console.error('Failed to create game:', err);
      alert('Failed to save game. Please try again.');
    }
  };

  const handleLoadSavedGame = (savedGame: SavedGame) => {
    setGameState({
      id: savedGame.id,
      saveName: savedGame.save_name,
      teamId: savedGame.team_id,
      teamName: savedGame.team_name,
      teamRegion: savedGame.team_region,
      teamAbbreviation: savedGame.team_abbreviation,
      teamLogoUrl: savedGame.team_logo_url,
    });
    setCurrentView('game');
  };

  if (isLoadingAuth) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {user && (
        <div className="user-bar">
          <span className="user-email">{user.email}</span>
          <button className="user-signout" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      )}

      {currentView === 'landing' && (
        <Landing onNewGame={handleNewGame} onLoadGame={handleLoadGame} />
      )}
      {currentView === 'new-game' && (
        <NewGame onBack={handleBack} onStartGame={handleStartGame} />
      )}
      {currentView === 'load-game' && (
        <LoadGame onBack={handleBack} onLoadGame={handleLoadSavedGame} />
      )}
      {currentView === 'game' && gameState && (
        <div className="game-view">
          <div className="game-header">
            <div className="game-info">
              {gameState.teamLogoUrl && (
                <img
                  src={gameState.teamLogoUrl}
                  alt={`${gameState.teamName} logo`}
                  className="game-team-logo"
                />
              )}
              <div className="game-details">
                <h1 className="game-save-name">{gameState.saveName}</h1>
                <p className="game-team-name">
                  {gameState.teamAbbreviation
                    ? `[${gameState.teamAbbreviation}] `
                    : ''}
                  {gameState.teamName} • {gameState.teamRegion}
                </p>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={handleBack}>
              Exit to Menu
            </button>
          </div>
          <div className="game-content">
            <p>Main game interface coming soon...</p>
          </div>
        </div>
      )}

      {showAuthModal && (
        <AuthModal onClose={handleAuthClose} onSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}

export default App;
