import { useState } from "react";

export default function LibrarySection() {
  const [activeTab, setActiveTab] = useState("Continue Watching");
  const [stats, setStats] = useState({ movies: 24, series: 12, completed: 8 });

  const tabs = ["Continue Watching", "Movies", "Series", "Completed"];

  const items = [
    {
      title: "Inception",
      type: "Movie",
      progress: 65,
      color: "#3b82f6",
    },
    {
      title: "Breaking Bad",
      type: "Series",
      progress: 40,
      color: "#10b981",
    },
    {
      title: "Interstellar",
      type: "Movie",
      progress: 90,
      color: "#8b5cf6",
    },
  ];

  return (
    <div className="media-page">
      {/* Hero - Media style */}
      <section className="media-hero">
        <div className="media-hero-content">
          <h1>Library</h1>
          <p className="media-hero-description">
            Your personal collection of movies and series. Pick up where you left off.
          </p>
          <div className="media-meta">
            <span>{stats.movies} Movies</span>
            <span>{stats.series} Series</span>
            <span>✓ {stats.completed} Completed</span>
          </div>
          <div className="media-hero-actions">
            <button className="media-watch-button">Continue</button>
            <button className="media-list-button">My List</button>
          </div>
        </div>
      </section>

      {/* Tabs - Media style */}
      <div className="media-categories">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "selected" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Library Grid - Media style cards */}
      <section className="media-row-section">
        <div className="media-row-heading">
          <h2>{activeTab}</h2>
          <button>View All</button>
        </div>

        <div className="media-film-grid">
          {items.map((item, idx) => (
            <div key={idx} className="media-film-card">
              <div
                className="media-film-poster"
                style={{ "--film-color": item.color }}
              >
                <div className="media-film-top">
                  <span>{item.type}</span>
                  <button className="media-save-button">♥</button>
                </div>
                <div className="media-film-bottom">
                  <span>▶ Play</span>
                </div>
                <button className="media-play-button">▶</button>
              </div>
              <div className="media-film-body">
                <h3>{item.title}</h3>
                <div className="media-progress-wrapper">
                  <div className="media-progress-track">
                    <div
                      className="media-progress-value"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span>{item.progress}% watched</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
