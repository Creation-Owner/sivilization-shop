import { useState } from "react";

export default function GamesSection() {
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Action", "Adventure", "Strategy", "RPG"];

  const games = [
    {
      title: "Cyber Odyssey",
      genre: "Action",
      rating: 4.8,
      price: 59.99,
      color: "#7c3aed",
    },
    {
      title: "Mystic Realms",
      genre: "Adventure",
      rating: 4.6,
      price: 49.99,
      color: "#db2777",
    },
    {
      title: "Empire Builder",
      genre: "Strategy",
      rating: 4.7,
      price: 39.99,
      color: "#059669",
    },
    {
      title: "Dragon's Quest",
      genre: "RPG",
      rating: 4.9,
      price: 54.99,
      color: "#dc2626",
    },
  ];

  const filteredGames =
    activeCategory === "All"
      ? games
      : games.filter((g) => g.genre === activeCategory);

  return (
    <div className="media-page">
      {/* Hero - Media style */}
      <section className="media-hero">
        <div className="media-hero-content">
          <h1>Games</h1>
          <p className="media-hero-description">
            Discover immersive worlds and epic adventures. From action-packed shooters to deep strategy games.
          </p>
          <div className="media-meta">
            <span>2026</span>
            <span>🎮 Gaming</span>
            <span>★ 4.7</span>
          </div>
          <div className="media-hero-actions">
            <button className="media-watch-button">Explore</button>
            <button className="media-list-button">Top Rated</button>
          </div>
        </div>
      </section>

      {/* Categories - Media style */}
      <div className="media-categories">
        {categories.map((cat) => (
          <button
            key={cat}
            className={activeCategory === cat ? "selected" : ""}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Games Grid - Media style cards */}
      <section className="media-row-section">
        <div className="media-row-heading">
          <h2>{activeCategory} Games</h2>
          <button>View All</button>
        </div>

        <div className="media-film-grid">
          {filteredGames.map((game, idx) => (
            <div key={idx} className="media-film-card">
              <div
                className="media-film-poster"
                style={{ "--film-color": game.color }}
              >
                <div className="media-film-top">
                  <span>{game.genre}</span>
                  <button className="media-save-button">♥</button>
                </div>
                <div className="media-film-bottom">
                  <span>★ {game.rating}</span>
                </div>
                <button className="media-play-button">▶</button>
              </div>
              <div className="media-film-body">
                <h3>{game.title}</h3>
                <p>${game.price}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
