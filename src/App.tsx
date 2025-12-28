import { useState } from 'react';
import './App.css';
import Landing from './components/Landing';
import './styles/global.css';

type GameView = 'landing' | 'new-game' | 'load-game';

function App() {
  const [currentView, setCurrentView] = useState<GameView>('landing');

  const handleNewGame = () => {
    setCurrentView('new-game');
  };

  const handleLoadGame = () => {
    setCurrentView('load-game');
  };

  const handleBack = () => {
    setCurrentView('landing');
  };

  return (
    <div className="app-container">
      {currentView === 'landing' && (
        <Landing onNewGame={handleNewGame} onLoadGame={handleLoadGame} />
      )}
      {currentView === 'new-game' && (
        <div className="view-container">
          <h1>Create New Game</h1>
          <p>New Game view - Coming soon</p>
          <button className="btn btn-secondary" onClick={handleBack}>
            Back to Menu
          </button>
        </div>
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
    </div>
  );
}

export default App;
