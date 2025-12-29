import { useState, useEffect } from 'react';
import { getTeamsByRegion, type Region, type Team } from '../lib/supabase';
import './NewGame.css';

interface NewGameProps {
  onBack: () => void;
  onStartGame: (saveName: string, team: Team) => void;
}

const REGIONS: { value: Region; label: string; description: string }[] = [
  { value: 'EMEA', label: 'EMEA', description: 'Europe, Middle East & Africa' },
  { value: 'China', label: 'China', description: 'Chinese League' },
  { value: 'Pacific', label: 'Pacific', description: 'Asia-Pacific Region' },
  { value: 'Americas', label: 'Americas', description: 'North & South America' },
];

function NewGame({ onBack, onStartGame }: NewGameProps) {
  const [saveName, setSaveName] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<Region | ''>('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRegion) {
      setIsLoadingTeams(true);
      setSelectedTeamId('');
      setError(null);

      getTeamsByRegion(selectedRegion)
        .then((fetchedTeams) => {
          setTeams(fetchedTeams);
          setIsLoadingTeams(false);
        })
        .catch((err) => {
          console.error('Failed to load teams:', err);
          setError('Failed to load teams. Please try again.');
          setIsLoadingTeams(false);
        });
    } else {
      setTeams([]);
      setSelectedTeamId('');
    }
  }, [selectedRegion]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const canStartGame = saveName.trim() && selectedTeam;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canStartGame) {
      onStartGame(saveName.trim(), selectedTeam);
    }
  };

  return (
    <div className="new-game-container">
      <div className="new-game-content">
        <div className="new-game-header">
          <h1 className="new-game-title">CREATE NEW GAME</h1>
          <p className="new-game-subtitle">Begin your journey as a team manager</p>
        </div>

        <form className="new-game-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <label className="form-label" htmlFor="save-name">
              <span className="label-text">Save Name</span>
              <span className="label-hint">Give your save file a memorable name</span>
            </label>
            <input
              id="save-name"
              type="text"
              className="form-input"
              placeholder="My Championship Run"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="form-section">
            <label className="form-label" htmlFor="region">
              <span className="label-text">Select Region</span>
              <span className="label-hint">Choose which league you want to compete in</span>
            </label>
            <select
              id="region"
              className="form-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value as Region)}
            >
              <option value="">Choose a region...</option>
              {REGIONS.map((region) => (
                <option key={region.value} value={region.value}>
                  {region.label} — {region.description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-section">
            <label className="form-label" htmlFor="team">
              <span className="label-text">Select Team</span>
              <span className="label-hint">
                {selectedRegion
                  ? 'Pick the team you want to manage'
                  : 'Select a region first'}
              </span>
            </label>
            <select
              id="team"
              className="form-select"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(Number(e.target.value))}
              disabled={!selectedRegion || isLoadingTeams}
            >
              <option value="">
                {isLoadingTeams
                  ? 'Loading teams...'
                  : selectedRegion
                    ? 'Choose a team...'
                    : 'Select a region first'}
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.abbreviation ? `[${team.abbreviation}] ` : ''}
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="form-error">{error}</div>}

          {selectedTeam && (
            <div className="team-preview">
              <div className="team-preview-header">Selected Team</div>
              <div className="team-preview-content">
                {selectedTeam.logo_url && (
                  <img
                    src={selectedTeam.logo_url}
                    alt={`${selectedTeam.name} logo`}
                    className="team-logo"
                  />
                )}
                <div className="team-info">
                  <span className="team-name">{selectedTeam.name}</span>
                  <span className="team-region">{selectedTeam.region}</span>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Back
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canStartGame}>
              Start Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewGame;

