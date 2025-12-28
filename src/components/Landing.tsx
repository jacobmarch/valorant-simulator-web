import './Landing.css';

interface LandingProps {
  onNewGame: () => void;
  onLoadGame: () => void;
}

function Landing({ onNewGame, onLoadGame }: LandingProps) {
  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1 className="landing-title">VALORANT ESPORTS SIMULATOR</h1>
        <p className="landing-subtitle">Manage your team to glory</p>

        <div className="button-group">
          <button className="btn btn-primary" onClick={onNewGame}>
            Create New Game
          </button>
          <button className="btn btn-primary" onClick={onLoadGame}>
            Load Game
          </button>
        </div>

        <div className="landing-footer">
          <p className="footer-text">Build your esports empire, one match at a time</p>
        </div>
      </div>
    </div>
  );
}

export default Landing;

