import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const sampleFilms = [
  { id: "sample-last-horizon", title: "The Last Horizon", genre: "Sci-Fi", year: "2026", duration: "2h 18m", rating: "8.7", color: "#172554", progress: 72, description: "Humanity has one final chance to reach a distant world before Earth becomes uninhabitable.", video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" },
  { id: "sample-midnight-streets", title: "Midnight Streets", genre: "Crime", year: "2025", duration: "1h 54m", rating: "8.2", color: "#3f1d2e", progress: 45, description: "A detective follows a dangerous trail through a city that never sleeps.", video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" },
  { id: "sample-beyond-valley", title: "Beyond the Valley", genre: "Adventure", year: "2025", duration: "2h 06m", rating: "8.5", color: "#14532d", progress: 0, description: "A team of explorers discovers an untouched valley filled with mystery.", video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" },
];

const categories = ["All films", "My uploads", "New releases", "Action", "Drama", "Sci-Fi", "Documentary"];
const colors = ["#2563eb", "#7c3aed", "#0f766e", "#be123c", "#b45309", "#166534"];

function convertFilm(film, index) {
  return {
    id: film.id,
    title: film.title,
    description: film.description || "No description has been added for this film yet.",
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

function FilmCard({ film, onWatch }) {
  return (
    <article className="media-film-card" style={{ "--film-color": film.color }}>
      <button
        className="media-film-poster"
        type="button"
        onClick={() => onWatch(film)}
        aria-label={`Open ${film.title}`}
        style={film.poster_url ? {
          backgroundImage: `linear-gradient(0deg, rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.04)), url(${film.poster_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : undefined}
      >
        <span className="media-film-top"><span>{film.genre}</span><span className="media-save-button" aria-hidden="true">♡</span></span>
        <span className="media-card-play" aria-hidden="true">▶</span>
        <span className="media-film-bottom"><span>★ {film.rating}</span><span>{film.year}</span></span>
      </button>
      <div className="media-film-body"><h3>{film.title}</h3><p>{film.genre} · {film.duration}</p></div>
    </article>
  );
}

function MediaRow({ title, subtitle, items, onWatch }) {
  if (!items.length) return null;
  return (
    <section className="media-row-section">
      <div className="media-row-heading"><div><p className="eyebrow">{subtitle}</p><h2>{title}</h2></div></div>
      <div className="media-film-grid">{items.map((film) => <FilmCard key={film.id} film={film} onWatch={onWatch} />)}</div>
    </section>
  );
}

function WatchPage({ film, onBack }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState("");

  async function playVideo() {
    if (!videoRef.current || !film.video_url) return;
    try {
      await videoRef.current.play();
      setIsPlaying(true);
    } catch {
      setVideoError("The video could not start. Please use the player controls to try again.");
    }
  }

  function togglePlayback() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) playVideo();
    else videoRef.current.pause();
  }

  return (
    <section className="watch-page section-page">
      <button className="watch-back-button" type="button" onClick={onBack}>← Back to Media</button>
      <div className="watch-layout">
        <div className="watch-player-shell">
          {film.video_url ? <>
            <video ref={videoRef} className="watch-video" src={film.video_url} controls playsInline onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onError={() => setVideoError("This video could not be loaded. Check the uploaded file and storage policy.")} onClick={togglePlayback} />
            {!isPlaying && !videoError && <button className="watch-play-overlay" type="button" onClick={playVideo}><span>▶</span><small>Click to play</small></button>}
          </> : <div className="watch-unavailable">This film does not have a video file yet.</div>}
        </div>
        {videoError && <p className="watch-error">{videoError}</p>}
        <div className="watch-details">
          <p className="eyebrow">NOW WATCHING</p>
          <h1>{film.title}</h1>
          <div className="media-meta"><span>{film.year}</span><span>{film.duration}</span><span>★ {film.rating}</span><span>{film.genre}</span></div>
          <p>{film.description}</p>
          <button className="watch-play-button" type="button" onClick={playVideo} disabled={!film.video_url}>▶ Play film</button>
        </div>
      </div>
    </section>
  );
}

function MediaSection() {
  const [uploadedFilms, setUploadedFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [watchingFilm, setWatchingFilm] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All films");

  useEffect(() => {
    async function loadFilms() {
      setLoading(true);
      const { data, error: filmsError } = await supabase.from("films").select("*").order("created_at", { ascending: false });
      if (filmsError) setError(filmsError.message);
      else { setUploadedFilms((data || []).map(convertFilm)); setError(""); }
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

  if (watchingFilm) return <WatchPage film={watchingFilm} onBack={() => setWatchingFilm(null)} />;

  const visibleUploads = filteredFilms.filter((film) => film.isUploaded);
  const continueWatching = filteredFilms.filter((film) => Number(film.progress) > 0);
  const recommended = filteredFilms.filter((film) => Number(film.rating) >= 8.1 || film.isUploaded);
  const featured = uploadedFilms[0] || sampleFilms[0];

  return (
    <section className="media-page section-page">
      <div className="media-hero"><div className="media-hero-content"><p className="eyebrow">FEATURED FILM</p><h1>{featured.title}</h1><div className="media-meta"><span>{featured.year}</span><span>{featured.duration}</span><span>★ {featured.rating}</span><span>{featured.genre}</span></div><p className="media-hero-description">{featured.description}</p><div className="media-hero-actions"><button className="media-watch-button" type="button" onClick={() => setWatchingFilm(featured)}>▶ Watch now</button><button className="media-list-button" type="button" onClick={() => alert("Added to your list.")}>+ Add to list</button></div></div></div>
      <div className="media-categories">{categories.map((category) => <button key={category} className={selectedCategory === category ? "selected" : ""} type="button" onClick={() => setSelectedCategory(category)}>{category}</button>)}</div>
      {loading && <p className="media-status">Loading uploaded films…</p>}
      {error && <p className="media-status media-error">Could not load uploaded films: {error}</p>}
      {!loading && visibleUploads.length > 0 && <MediaRow title="Your uploaded films" subtitle="Added through your Admin Dashboard" items={visibleUploads} onWatch={setWatchingFilm} />}
      <MediaRow title="Continue watching" subtitle="Pick up where you left off" items={continueWatching} onWatch={setWatchingFilm} />
      <MediaRow title="Recommended for you" subtitle="Discover films selected for you" items={recommended} onWatch={setWatchingFilm} />
    </section>
  );
}

export default MediaSection;