import { useState } from 'react';
import './App.css';
import Landing from './components/Landing';
import NewGame from './components/NewGame';
import { type Team } from './lib/supabase';
import './styles/global.css';

type GameView = 'landing' | 'new-game' | 'load-game' | 'game';

interface GameState {
  saveName: string;
  team: Team;
}

function App() {
  const [currentView, setCurrentView] = useState<GameView>('landing');
  const [, setGameState] = useState<GameState | null>(null);

  const handleNewGame = () => {
    setCurrentView('new-game');
  };

  const handleLoadGame = () => {
    setCurrentView('load-game');
  };

  const handleBack = () => {
    setCurrentView('landing');
  };

  const handleStartGame = (saveName: string, team: Team) => {
    setGameState({ saveName, team });
    setCurrentView('game');
    // TODO: Navigate to main game view
    console.log('Starting game:', { saveName, team });
  };

  return (
    <div className="app-container">
      {currentView === 'landing' && (
        <Landing onNewGame={handleNewGame} onLoadGame={handleLoadGame} />
      )}
      {currentView === 'new-game' && (
        <NewGame onBack={handleBack} onStartGame={handleStartGame} />
      )}
      {currentView === 'load-game' && (
        <div className="view-container">
          <h1>Load Game</h1>
          <p>Load Game view - Coming soon</p>
          <button className="btn btn-secondary" onClick={handleBack}>
            Back to Menu
          </button>
        </div>
      )}
      {currentView === 'game' && (
        <div className="view-container">
          <h1>Game Started!</h1>
          <p>Main game view - Coming soon</p>
          <button className="btn btn-secondary" onClick={handleBack}>
            Back to Menu
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
