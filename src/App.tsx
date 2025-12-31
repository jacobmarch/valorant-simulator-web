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
type GameTab = 'roster' | 'season';

interface GameState {
  id: string;
  saveName: string;
  teamId: number;
  teamName: string;
  teamRegion: string;
  teamAbbreviation?: string;
  teamLogoUrl?: string;
}

const GAME_TABS: { id: GameTab; label: string; icon: string }[] = [
  { id: 'roster', label: 'View Roster', icon: '👥' },
  { id: 'season', label: 'Season View', icon: '📅' },
];

function App() {
  const [currentView, setCurrentView] = useState<GameView>('landing');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeTab, setActiveTab] = useState<GameTab>('roster');
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
          {/* Sidebar */}
          <aside className="game-sidebar">
            <div className="sidebar-header">
              <div className="sidebar-team">
                {gameState.teamLogoUrl ? (
                  <img
                    src={gameState.teamLogoUrl}
                    alt={`${gameState.teamName} logo`}
                    className="sidebar-team-logo"
                  />
                ) : (
                  <div className="sidebar-team-logo-placeholder">
                    {gameState.teamAbbreviation || gameState.teamName.charAt(0)}
                  </div>
                )}
                <div className="sidebar-team-info">
                  <span className="sidebar-team-name">
                    {gameState.teamAbbreviation || gameState.teamName}
                  </span>
                  <span className="sidebar-save-name">{gameState.saveName}</span>
                </div>
              </div>
            </div>

            <nav className="sidebar-nav">
              {GAME_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="sidebar-nav-icon">{tab.icon}</span>
                  <span className="sidebar-nav-label">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="sidebar-footer">
              <button className="sidebar-exit-btn" onClick={handleBack}>
                Exit to Menu
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="game-main">
            <header className="game-main-header">
              <h1 className="game-main-title">
                {GAME_TABS.find((t) => t.id === activeTab)?.label}
              </h1>
            </header>

            <div className="game-main-content">
              {activeTab === 'roster' && (
                <div className="placeholder-content">
                  <div className="placeholder-icon">👥</div>
                  <h2>View Roster</h2>
                  <p>Manage your team's players, view stats, and make roster changes.</p>
                  <span className="placeholder-badge">Coming Soon</span>
                </div>
              )}

              {activeTab === 'season' && (
                <div className="placeholder-content">
                  <div className="placeholder-icon">📅</div>
                  <h2>Season View</h2>
                  <p>View your upcoming matches, league standings, and season schedule.</p>
                  <span className="placeholder-badge">Coming Soon</span>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {showAuthModal && (
        <AuthModal onClose={handleAuthClose} onSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}

export default App;
