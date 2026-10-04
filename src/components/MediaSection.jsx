import { useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./App.css";

export default function MediaSection() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const categories = ["All", "Action", "Drama", "Comedy", "Sci-Fi"];

  const films = [
    {
      title: "Neon Nights",
      year: 2025,
      category: "Action",
      rating: 4.7,
      color: "#7c3aed",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    },
    {
      title: "The Last Horizon",
      year: 2024,
      category: "Drama",
      rating: 4.8,
      color: "#db2777",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    },
    {
      title: "Quantum Leap",
      year: 2026,
      category: "Sci-Fi",
      rating: 4.9,
      color: "#059669",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    },
    {
      title: "Laugh Out Loud",
      year: 2025,
      category: "Comedy",
      rating: 4.5,
      color: "#dc2626",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    },
  ];

  const filteredFilms = films.filter((film) => {
    const matchesCategory =
      activeCategory === "All" || film.category === activeCategory;
    const matchesSearch =
      search === "" ||
      film.title.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function openVideo(film) {
    setSelectedVideo(film);
    setIsPlaying(false);
  }

  function closeVideo() {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setSelectedVideo(null);
    setIsPlaying(false);
  }

  function handleVideoClick() {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  }

  return (
    <div className="media-page">
      <section className="media-hero">
        <div className="media-hero-content">
          <h1>Films, Cartoons & Dramas</h1>
          <p className="media-hero-description">Stream the latest movies and shows.</p>
          <div className="media-meta">
            <span>2026</span>
            <span>🎬 Cinema</span>
            <span>★ 4.7</span>
          </div>
          <div className="media-hero-actions">
            <button className="media-watch-button">Watch Now</button>
            <button className="media-list-button">My List</button>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
        <input
          className="search-input"
          type="search"
          placeholder="Search titles"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", background: "#101c2e", color: "#cbd5e1", outline: "none" }}
        />
      </div>

      <div className="media-categories">
        {categories.map((cat) => (
          <button key={cat} className={activeCategory === cat ? "selected" : ""} onClick={() => setActiveCategory(cat)}>{cat}</button>
        ))}
      </div>

      <section className="media-row-section">
        <div className="media-row-heading">
          <h2>{activeCategory} Films</h2>
          <button>View All</button>
        </div>
        <div className="media-film-grid">
          {filteredFilms.map((film, idx) => (
            <div key={idx} className="media-film-card">
              <div className="media-film-poster" style={{ "--film-color": film.color }}>
                <div className="media-film-top">
                  <span>{film.category}</span>
                  <button className="media-save-button">♥</button>
                </div>
                <div className="media-film-bottom">
                  <span>★ {film.rating}</span>
                </div>
                <button className="media-play-button" onClick={() => openVideo(film)}>▶</button>
              </div>
              <div className="media-film-body">
                <h3>{film.title}</h3>
                <p>{film.year}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {selectedVideo && (
        <div className="video-modal" onClick={closeVideo}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="video-modal-close" onClick={closeVideo}>✕</button>
            <h2>{selectedVideo.title}</h2>
            <video ref={videoRef} className="media-video-player" src={selectedVideo.videoUrl} controls onClick={handleVideoClick} />
          </div>
        </div>
      )}
    </div>
  );
}
