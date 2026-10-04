import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import AdminFilmUpload from "./AdminFilmUpload";

const sampleFilms = [
  {
    title: "The Last Horizon",
    genre: "Sci-Fi",
    year: "2026",
    duration: "2h 18m",
    rating: "8.7",
    color: "#172554",
    progress: 72,
    video_url:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
  {
    title: "Midnight Streets",
    genre: "Crime",
    year: "2025",
    duration: "1h 54m",
    rating: "8.2",
    color: "#3f1d2e",
    progress: 45,
    video_url:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  },
  {
    title: "Beyond the Valley",
    genre: "Adventure",
    year: "2025",
    duration: "2h 06m",
    rating: "8.5",
    color: "#14532d",
    progress: 0,
    video_url:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  },
  {
    title: "Silent Echoes",
    genre: "Mystery",
    year: "2024",
    duration: "1h 47m",
    rating: "7.9",
    color: "#422006",
    progress: 0,
  },
  {
    title: "The Blue Room",
    genre: "Drama",
    year: "2026",
    duration: "1h 51m",
    rating: "8.1",
    color: "#164e63",
    progress: 0,
  },
  {
    title: "After the Storm",
    genre: "Romance",
    year: "2025",
    duration: "1h 42m",
    rating: "7.8",
    color: "#831843",
    progress: 0,
  },
];

const categories = [
  "All films",
  "Trending",
  "New releases",
  "Action",
  "Drama",
  "Sci-Fi",
  "Documentary",
];

function getVideoUrl(videoPath) {
  if (!videoPath) {
    return null;
  }

  const { data } = supabase.storage
    .from("films")
    .getPublicUrl(videoPath);

  return data?.publicUrl || null;
}

function convertDatabaseFilm(film) {
  return {
    id: film.id,
    title: film.title,
    description: film.description || "",
    genre: film.genre || "Film",
    year: film.release_year
      ? String(film.release_year)
      : "Unknown",
    duration: film.duration || "Unknown",
    rating: film.rating || "0",
    color: "#172554",
    progress: 0,
    video_url: getVideoUrl(film.video_path),
    video_path: film.video_path,
    poster_path: film.poster_path,
  };
}

function FilmCard({ film, showProgress = false, onPlay }) {
  return (
    <article
      className="media-film-card"
      style={{ "--film-color": film.color }}
    >
      <div className="media-film-poster">
        <div className="media-film-top">
          <span>{film.genre}</span>

          <button
            className="media-save-button"
            type="button"
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

        <p>
          {film.genre} · {film.duration}
        </p>

        {showProgress && (
          <div className="media-progress-wrapper">
            <div className="media-progress-track">
              <div
                className="media-progress-value"
                style={{ width: `${film.progress}%` }}
              />
            </div>

            <span>{film.progress}% watched</span>
          </div>
        )}
      </div>
    </article>
  );
}

function MediaRow({
  title,
  subtitle,
  items,
  showProgress = false,
  onPlay,
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="media-row-section">
      <div className="media-row-heading">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>

        <button type="button">View all</button>
      </div>

      <div className="media-film-grid">
        {items.map((film) => (
          <FilmCard
            key={film.id || film.title}
            film={film}
            showProgress={showProgress}
            onPlay={onPlay}
          />
        ))}
      </div>
    </section>
  );
}

function MediaSection() {
  const [allFilms, setAllFilms] = useState(sampleFilms);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [selectedCategory, setSelectedCategory] =
    useState("All films");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingFilms, setLoadingFilms] = useState(true);
  const [filmsError, setFilmsError] = useState("");

  useEffect(() => {
    async function loadUserAndFilms() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
          console.error(
            "Could not check admin status:",
            profileError
          );
          setIsAdmin(false);
        } else {
          setIsAdmin(profile?.is_admin === true);
        }
      } else {
        setIsAdmin(false);
      }

      const { data: databaseFilms, error: filmsError } =
        await supabase
          .from("films")
          .select("*")
          .order("created_at", {
            ascending: false,
          });

      if (filmsError) {
        console.error("Could not load films:", filmsError);
        setFilmsError(filmsError.message);
        setLoadingFilms(false);
        return;
      }

      const convertedFilms = (databaseFilms || []).map(
        convertDatabaseFilm
      );

      setAllFilms([...convertedFilms, ...sampleFilms]);
      setLoadingFilms(false);
    }

    loadUserAndFilms();
  }, []);

  const filteredFilms =
    selectedCategory === "All films"
      ? allFilms
      : selectedCategory === "New releases"
        ? allFilms.filter((film) => film.year === "2026")
        : allFilms.filter(
            (film) => film.genre === selectedCategory
          );

  const continueWatching = filteredFilms.filter(
    (film) => Number(film.progress) > 0
  );

  const newReleases = filteredFilms.filter(
    (film) => film.year === "2026"
  );

  const recommended = filteredFilms.filter(
    (film) => Number(film.rating) >= 8.1
  );

  function handleWatchFeatured() {
    const featuredFilm = allFilms.find(
      (film) => film.title === "The Last Horizon"
    );

    if (featuredFilm) {
      setSelectedFilm(featuredFilm);
    }
  }

  return (
    <section className="media-page section-page">
      <div className="media-hero">
        <div className="media-hero-content">
          <p className="eyebrow">FEATURED FILM</p>

          <h1>The Last Horizon</h1>

          <div className="media-meta">
            <span>2026</span>
            <span>2h 18m</span>
            <span>★ 8.7</span>
            <span>Sci-Fi</span>
          </div>

          <p className="media-hero-description">
            Humanity has one final chance to reach a distant world
            before Earth becomes uninhabitable.
          </p>

          <div className="media-hero-actions">
            <button
              className="media-watch-button"
              type="button"
              onClick={handleWatchFeatured}
            >
              ▶ Watch now
            </button>

            <button
              className="media-list-button"
              type="button"
            >
              + Add to list
            </button>
          </div>
        </div>
      </div>

      <div className="media-categories">
        {categories.map((category) => (
          <button
            key={category}
            className={
              selectedCategory === category
                ? "selected"
                : ""
            }
            type="button"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {loadingFilms && (
        <p className="media-status">Loading uploaded films...</p>
      )}

      {filmsError && (
        <p className="media-status media-error">
          Database films could not be loaded: {filmsError}
        </p>
      )}

      <MediaRow
        title="Continue watching"
        subtitle="Pick up where you left off"
        items={continueWatching}
        showProgress
        onPlay={setSelectedFilm}
      />

      <MediaRow
        title="New releases"
        subtitle="Fresh stories worth watching"
        items={newReleases}
        onPlay={setSelectedFilm}
      />

      <MediaRow
        title="Recommended for you"
        subtitle="Based on your viewing history"
        items={recommended}
        onPlay={setSelectedFilm}
      />

      {isAdmin && <AdminFilmUpload />}

      {selectedFilm && (
        <div
          className="video-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedFilm(null);
            }
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
              <video
                className="media-video-player"
                src={selectedFilm.video_url}
                controls
                autoPlay
              />
            ) : (
              <p className="video-not-available">
                This film does not have a video uploaded yet.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default MediaSection;