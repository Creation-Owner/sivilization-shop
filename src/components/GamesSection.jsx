import { useMemo, useState } from "react";

const categories = ["All", "Action", "Adventure", "Strategy", "RPG"];

const games = [
  {
    title: "Cyber Odyssey",
    genre: "Action",
    rating: 4.8,
    price: 59.99,
    players: "1.2M players",
    accent: "#7c3aed",
    accentSoft: "#312e81",
    tag: "Featured",
    description: "A high-speed journey through a neon world on the edge of collapse.",
  },
  {
    title: "Mystic Realms",
    genre: "Adventure",
    rating: 4.6,
    price: 49.99,
    players: "840K players",
    accent: "#db2777",
    accentSoft: "#831843",
    tag: "New release",
    description: "Explore ancient kingdoms, hidden ruins, and magical creatures.",
  },
  {
    title: "Empire Builder",
    genre: "Strategy",
    rating: 4.7,
    price: 39.99,
    players: "960K players",
    accent: "#059669",
    accentSoft: "#065f46",
    tag: "Top strategy",
    description: "Build a civilization, lead your people, and shape a lasting empire.",
  },
  {
    title: "Dragon's Quest",
    genre: "RPG",
    rating: 4.9,
    price: 54.99,
    players: "2.4M players",
    accent: "#dc2626",
    accentSoft: "#7f1d1d",
    tag: "Editor's pick",
    description: "Answer the call of dragons in a vast fantasy world made for heroes.",
  },
];

function GamesSection() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [savedGames, setSavedGames] = useState(() => new Set());
  const [notice, setNotice] = useState("");

  const filteredGames = useMemo(
    () =>
      activeCategory === "All"
        ? games
        : games.filter((game) => game.genre === activeCategory),
    [activeCategory]
  );

  function toggleSavedGame(title) {
    setSavedGames((previous) => {
      const next = new Set(previous);
      if (next.has(title)) {
        next.delete(title);
        setNotice(`${title} removed from your list.`);
      } else {
        next.add(title);
        setNotice(`${title} saved to your list.`);
      }
      return next;
    });
  }

  function handleBuyGame(game) {
    setNotice(`${game.title} was added to your checkout list for $${game.price.toFixed(2)}.`);
  }

  return (
    <section className="premium-page games-page section-page">
      <section className="premium-hero games-premium-hero">
        <div className="premium-hero-glow premium-hero-glow-one" />
        <div className="premium-hero-glow premium-hero-glow-two" />
        <div className="premium-hero-content">
          <p className="eyebrow">SIVILIZATION PLAY</p>
          <h1>Enter worlds worth remembering.</h1>
          <p className="premium-hero-description">
            Discover cinematic adventures, strategic challenges, and new worlds designed to keep you playing.
          </p>
          <div className="premium-hero-stats">
            <span>4 featured games</span>
            <span>Curated collection</span>
            <span>Instant digital access</span>
          </div>
          <div className="premium-hero-actions">
            <button className="premium-primary-button" type="button" onClick={() => document.getElementById("featured-games")?.scrollIntoView({ behavior: "smooth" })}>
              Explore games <span>→</span>
            </button>
            <button className="premium-secondary-button" type="button" onClick={() => setActiveCategory("All")}>
              View collection
            </button>
          </div>
        </div>
        <div className="games-hero-showcase" aria-hidden="true">
          <div className="games-orbit games-orbit-large" />
          <div className="games-orbit games-orbit-small" />
          <div className="games-hero-console">
            <span className="console-dot console-dot-red" />
            <span className="console-dot console-dot-yellow" />
            <span className="console-dot console-dot-green" />
            <div className="console-screen"><span>PLAY</span><strong>∞</strong></div>
          </div>
          <div className="games-hero-chip chip-one">Action</div>
          <div className="games-hero-chip chip-two">Adventure</div>
          <div className="games-hero-chip chip-three">RPG</div>
        </div>
      </section>

      <section className="premium-content-section" id="featured-games">
        <div className="premium-section-heading">
          <div>
            <p className="eyebrow">EXPLORE</p>
            <h2>Featured games</h2>
            <p>Find your next favorite adventure.</p>
          </div>
          <div className="premium-count">{filteredGames.length} {filteredGames.length === 1 ? "title" : "titles"}</div>
        </div>

        <div className="premium-filter-row" aria-label="Game categories">
          {categories.map((category) => (
            <button key={category} className={activeCategory === category ? "premium-filter active" : "premium-filter"} type="button" onClick={() => setActiveCategory(category)}>
              {category}
            </button>
          ))}
        </div>

        <div className="premium-game-grid">
          {filteredGames.map((game) => {
            const isSaved = savedGames.has(game.title);
            return (
              <article className="premium-game-card" key={game.title} style={{ "--game-accent": game.accent, "--game-accent-soft": game.accentSoft }}>
                <div className="premium-game-art">
                  <div className="premium-card-topline">
                    <span className="premium-card-tag">{game.tag}</span>
                    <button className={isSaved ? "premium-icon-button saved" : "premium-icon-button"} type="button" onClick={() => toggleSavedGame(game.title)} aria-label={isSaved ? `Remove ${game.title} from your list` : `Save ${game.title} to your list`}>{isSaved ? "♥" : "♡"}</button>
                  </div>
                  <div className="premium-game-symbol"><span>✦</span></div>
                  <div className="premium-card-bottomline"><span>{game.genre}</span><span>★ {game.rating}</span></div>
                </div>
                <div className="premium-game-body">
                  <div className="premium-game-title-row"><h3>{game.title}</h3><span className="premium-price">${game.price.toFixed(2)}</span></div>
                  <p className="premium-game-description">{game.description}</p>
                  <div className="premium-game-meta"><span>● {game.players}</span><span>Digital edition</span></div>
                  <button className="premium-card-action" type="button" onClick={() => handleBuyGame(game)}>Buy now <span>→</span></button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="premium-feature-strip">
        <div><span className="premium-feature-icon">⚡</span><div><strong>Instant access</strong><p>Start playing as soon as your purchase is complete.</p></div></div>
        <div><span className="premium-feature-icon">✦</span><div><strong>Curated catalog</strong><p>Quality games selected for every kind of player.</p></div></div>
        <div><span className="premium-feature-icon">⌁</span><div><strong>Your library</strong><p>Keep your purchased games connected to your account.</p></div></div>
      </section>

      {notice && <p className="premium-notice" role="status" aria-live="polite">{notice}</p>}
    </section>
  );
}

export default GamesSection;
