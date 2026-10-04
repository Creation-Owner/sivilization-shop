import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const sampleFilms = [
  {
    id: "sample-last-horizon",
    title: "The Last Horizon",
    genre: "Sci-Fi",
    year: "2026",
    duration: "2h 18m",
    rating: "8.7",
    color: "#172554",
    progress: 72,
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
  {
    id: "sample-midnight-streets",
    title: "Midnight Streets",
    genre: "Crime",
    year: "2025",
    duration: "1h 54m",
    rating: "8.2",
    color: "#3f1d2e",
    progress: 45,
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  },
  {
    id: "sample-beyond-valley",
    title: "Beyond the Valley",
    genre: "Adventure",
    year: "2025",
    duration: "2h 06m",
    rating: "8.5",
    color: "#14532d",
    progress: 0,
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  },
];

const categories = ["All films", "My uploads", "New releases", "Action", "Drama", "Sci-Fi", "Documentary"];

const colors = ["#2563eb", "#7c3aed", "#0f766e", "#be123c", "#b45309", "#166534"];

function convertFilm(film, index) {
  return {
    id: film.id,
    title: film.title,
    description: film.description || "",
    genre: film.genre || "Film",
    year: film.release_year ? String(film.release_year) : "New",
    duration: film.duration || "Duration unavailable",
    rating: film.rating ? String(film.rating) : "New",
    color: colors[index % colors.length],
    progress: 0,
    video_url: film.video_url || null,
    poster_url: film.poster_url || null,
    isUploaded: true,
  };
}

function FilmCard({ film, showProgress = false, onPlay }) {
  return (
    <article className="media-film-card" style={{ "--film-color": film.color }}>
      <div
        className="media-film-poster"
        style={
          film.poster_url
            ? {
                backgroundImage: `linear-gradient(0deg, rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.04)), url(${film.poster_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="media-film-top">
          <span>{film.genre}</span>
          <button
            className="media-save-button"
            type="button"
            onClick={() => alert(`Saved ${film.title} to your list.`)}
            aria-label={`Save ${film.title}`}
          >
            ♡
          </button>
        </div>

        <button
          className="media-play-button"
          type="button"
          onClick={() => onPlay(film)}
          aria-label={`Play ${film.title}`}
        >
          ▶
        </button>

        <div className="media-film-bottom">
          <span>★ {film.rating}</span>
          <span>{film.year}</span>
        </div>
      </div>

      <div className="media-film-body">
        <h3>{film.title}</h3>
        <p>{film.genre} · {film.duration}</p>

        {showProgress && (
          <div className="media-progress-wrapper">
            <div className="media-progress-track">
              <div className="media-progress-value" style={{ width: `${film.progress}%` }} />
            </div>
            <span>{film.progress}% watched</span>
          </div>
        )}
      </div>
    </article>
  );
}

function MediaRow({ title, subtitle, items, showProgress = false, onPlay }) {
  if (items.length === 0) return null;

  return (
    <section className="media-row-section">
      <div className="media-row-heading">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          View all
        </button>
      </div>

      <div className="media-film-grid">
        {items.map((film) => (
          <FilmCard key={film.id} film={film} showProgress={showProgress} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
}

function MediaSection() {
  const [uploadedFilms, setUploadedFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All films");

  useEffect(() => {
    async function loadFilms() {
      setLoading(true);
      const { data, error: filmsError } = await supabase
        .from("films")
        .select("*")
        .order("created_at", { ascending: false });

      if (filmsError) {
        setError(filmsError.message);
        setUploadedFilms([]);
      } else {
        setUploadedFilms((data || []).map(convertFilm));
        setError("");
      }
      setLoading(false);
    }

    loadFilms();
  }, []);

  const allFilms = useMemo(() => [...uploadedFilms, ...sampleFilms], [uploadedFilms]);

  const filteredFilms = useMemo(() => {
    if (selectedCategory === "All films") return allFilms;
    if (selectedCategory === "My uploads") return uploadedFilms;
    if (selectedCategory === "New releases") return allFilms.filter((film) => film.year === "2026" || film.isUploaded);
    return allFilms.filter((film) => film.genre === selectedCategory);
  }, [allFilms, selectedCategory, uploadedFilms]);

  const continueWatching = filteredFilms.filter((film) => Number(film.progress) > 0);
  const uploadedInFilter = filteredFilms.filter((film) => film.isUploaded);
  const recommended = filteredFilms.filter((film) => Number(film.rating) >= 8.1 || film.isUploaded);

  function handleWatchFeatured() {
    setSelectedFilm(uploadedFilms[0] || sampleFilms[0]);
  }

  return (
    <section className="media-page section-page">
      <div className="media-hero">
        <div className="media-hero-content">
          <p className="eyebrow">FEATURED FILM</p>
          <h1>{uploadedFilms[0]?.title || "The Last Horizon"}</h1>
          <div className="media-meta">
            <span>{uploadedFilms[0]?.year || "2026"}</span>
            <span>{uploadedFilms[0]?.duration || "2h 18m"}</span>
            <span>★ {uploadedFilms[0]?.rating || "8.7"}</span>
            <span>{uploadedFilms[0]?.genre || "Sci-Fi"}</span>
          </div>
          <p className="media-hero-description">
            {uploadedFilms[0]?.description || "Humanity has one final chance to reach a distant world before Earth becomes uninhabitable."}
          </p>
          <div className="media-hero-actions">
            <button className="media-watch-button" type="button" onClick={handleWatchFeatured}>
              ▶ Watch now
            </button>
            <button className="media-list-button" type="button" onClick={() => alert("Added to your list.")}>
              + Add to list
            </button>
          </div>
        </div>
      </div>

      <div className="media-categories">
        {categories.map((category) => (
          <button
            key={category}
            className={selectedCategory === category ? "selected" : ""}
            type="button"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {loading && <p className="media-status">Loading uploaded films…</p>}
      {error && <p className="media-status media-error">Could not load uploaded films: {error}</p>}

      {!loading && uploadedInFilter.length > 0 && (
        <MediaRow
          title="Your uploaded films"
          subtitle="Added through your Admin Dashboard"
          items={uploadedInFilter}
          onPlay={setSelectedFilm}
        />
      )}

      <MediaRow
        title="Continue watching"
        subtitle="Pick up where you left off"
        items={continueWatching}
        showProgress
        onPlay={setSelectedFilm}
      />

      <MediaRow
        title="Recommended for you"
        subtitle="Discover films selected for you"
        items={recommended}
        onPlay={setSelectedFilm}
      />

      {selectedFilm && (
        <div
          className="video-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedFilm(null);
          }}
        >
          <div className="video-modal-content">
            <button
              className="video-modal-close"
              type="button"
              onClick={() => setSelectedFilm(null)}
              aria-label="Close video player"
            >
              ×
            </button>
            <h2>{selectedFilm.title}</h2>
            {selectedFilm.video_url ? (
              <video className="media-video-player" src={selectedFilm.video_url} controls autoPlay />
            ) : (
              <p className="video-not-available">This film does not have a video file yet.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default MediaSection;