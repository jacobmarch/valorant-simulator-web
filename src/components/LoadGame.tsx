import { useState, useEffect } from 'react';
import {
  getUserSavedGames,
  deleteSavedGame,
  type SavedGame,
} from '../lib/supabase';
import './LoadGame.css';

interface LoadGameProps {
  onBack: () => void;
  onLoadGame: (savedGame: SavedGame) => void;
}

function LoadGame({ onBack, onLoadGame }: LoadGameProps) {
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const games = await getUserSavedGames();
      setSavedGames(games);
    } catch (err) {
      console.error('Failed to load saved games:', err);
      setError('Failed to load saved games. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this save?')) {
      return;
    }

    setDeletingId(gameId);

    try {
      await deleteSavedGame(gameId);
      setSavedGames((prev) => prev.filter((g) => g.id !== gameId));
    } catch (err) {
      console.error('Failed to delete game:', err);
      setError('Failed to delete game. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="load-game-container">
      <div className="load-game-content">
        <div className="load-game-header">
          <h1 className="load-game-title">LOAD GAME</h1>
          <p className="load-game-subtitle">Continue your journey</p>
        </div>

        {isLoading && (
          <div className="load-game-loading">
            <div className="loading-spinner"></div>
            <p>Loading saved games...</p>
          </div>
        )}

        {error && <div className="load-game-error">{error}</div>}

        {!isLoading && !error && savedGames.length === 0 && (
          <div className="load-game-empty">
            <div className="empty-icon">📂</div>
            <h3>No Saved Games</h3>
            <p>You haven't created any games yet. Start a new game to begin!</p>
          </div>
        )}

        {!isLoading && savedGames.length > 0 && (
          <div className="saved-games-list">
            {savedGames.map((game) => (
              <div
                key={game.id}
                className="saved-game-card"
                onClick={() => onLoadGame(game)}
              >
                <div className="saved-game-team">
                  {game.team_logo_url ? (
                    <img
                      src={game.team_logo_url}
                      alt={`${game.team_name} logo`}
                      className="saved-game-logo"
                    />
                  ) : (
                    <div className="saved-game-logo-placeholder">
                      {game.team_abbreviation || game.team_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="saved-game-info">
                  <h3 className="saved-game-name">{game.save_name}</h3>
                  <div className="saved-game-details">
                    <span className="saved-game-team-name">
                      {game.team_abbreviation
                        ? `[${game.team_abbreviation}] `
                        : ''}
                      {game.team_name}
                    </span>
                    <span className="saved-game-separator">•</span>
                    <span className="saved-game-region">{game.team_region}</span>
                  </div>
                  <div className="saved-game-date">
                    Last played: {formatDate(game.updated_at)}
                  </div>
                </div>
                <div className="saved-game-actions">
                  <button
                    className="saved-game-delete"
                    onClick={(e) => handleDelete(game.id, e)}
                    disabled={deletingId === game.id}
                    aria-label="Delete save"
                  >
                    {deletingId === game.id ? '...' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="load-game-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoadGame;

