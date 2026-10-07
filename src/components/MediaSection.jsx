import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import AdminFilmUpload from "./AdminFilmUpload";

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
    video_url:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    access_type: "free",
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
    video_url:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    access_type: "free",
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
    video_url:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    access_type: "free",
  },
  {
    id: "sample-silent-echoes",
    title: "Silent Echoes",
    genre: "Mystery",
    year: "2024",
    duration: "1h 47m",
    rating: "7.9",
    color: "#422006",
    progress: 0,
    access_type: "free",
  },
  {
    id: "sample-blue-room",
    title: "The Blue Room",
    genre: "Drama",
    year: "2026",
    duration: "1h 51m",
    rating: "8.1",
    color: "#164e63",
    progress: 0,
    access_type: "free",
  },
  {
    id: "sample-after-storm",
    title: "After the Storm",
    genre: "Romance",
    year: "2025",
    duration: "1h 42m",
    rating: "7.8",
    color: "#831843",
    progress: 0,
    access_type: "free",
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

function getStorageUrl(path) {
  if (!path) {
    return null;
  }

  const { data } = supabase.storage
    .from("films")
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

function convertDatabaseFilm(film) {
  return {
    id: film.id,
    title: film.title || "Untitled film",
    description: film.description || "",
    genre: film.genre || "Film",
    year: film.release_year
      ? String(film.release_year)
      : "Unknown",
    duration: film.duration || "Unknown",
    rating: String(film.rating ?? "0"),
    color: "#172554",
    progress: 0,
    video_url: getStorageUrl(film.video_path),
    video_path: film.video_path || null,
    poster_path: film.poster_path || null,
    poster_url: getStorageUrl(film.poster_path),
    access_type: film.access_type || "free",
    price_cents: Number(film.price_cents) || 0,
    is_published: film.is_published === true,
    created_at: film.created_at || null,
  };
}

function getAccessLabel(film) {
  if (film.access_type === "rent") {
    return "RENT";
  }

  if (film.access_type === "subscription") {
    return "SUB";
  }

  return "FREE";
}

function getPosterStyle(film) {
  if (film.poster_url) {
    return {
      backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.82)), url("${film.poster_url}")`,
      backgroundPosition: "center",
      backgroundSize: "cover",
    };
  }

  return {
    "--film-color": film.color || "#172554",
  };
}

function FilmCard({ film, onOpenFilm, showProgress = false }) {
  return (
    <article
      className="media-film-card clickable-film-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpenFilm(film)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenFilm(film);
        }
      }}
    >
      <div className="media-film-poster" style={getPosterStyle(film)}>
        <div className="media-film-top">
          <span>{film.genre}</span>
          <span className="media-access-badge">
            {getAccessLabel(film)}
          </span>
        </div>

        <div className="media-play-button media-play-icon" aria-hidden="true">
          ▶
        </div>

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

        {film.access_type === "rent" && (
          <strong>
            ${(film.price_cents / 100).toFixed(2)} rental
          </strong>
        )}

        {film.access_type === "subscription" && (
          <strong>Subscription only</strong>
        )}

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
  onOpenFilm,
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
            onOpenFilm={onOpenFilm}
          />
        ))}
      </div>
    </section>
  );
}

function MediaSection({ onOpenFilm }) {
  const [databaseFilms, setDatabaseFilms] = useState([]);
  const [selectedCategory, setSelectedCategory] =
    useState("All films");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingFilms, setLoadingFilms] = useState(true);
  const [filmsError, setFilmsError] = useState("");

  useEffect(() => {
    async function loadUserAndFilms() {
      setLoadingFilms(true);
      setFilmsError("");

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
            profileError,
          );
          setIsAdmin(false);
        } else {
          setIsAdmin(profile?.is_admin === true);
        }
      } else {
        setIsAdmin(false);
      }

      const { data, error } = await supabase
        .from("films")
        .select("*")
        .eq("is_published", true)
        .order("created_at", {
          ascending: false,
        });

      console.log("Published films query:", {
        data,
        error,
      });

      if (error) {
        console.error("Could not load published films:", error);
        setFilmsError(error.message);
        setDatabaseFilms([]);
        setLoadingFilms(false);
        return;
      }

      const convertedFilms = (data || []).map(
        convertDatabaseFilm,
      );

      setDatabaseFilms(convertedFilms);
      setLoadingFilms(false);
    }

    loadUserAndFilms();
  }, []);

  const allFilms = [...databaseFilms, ...sampleFilms];

  const filteredFilms =
    selectedCategory === "All films"
      ? allFilms
      : selectedCategory === "New releases"
        ? allFilms
        : allFilms.filter(
            (film) => film.genre === selectedCategory,
          );

  const filteredDatabaseFilms =
    selectedCategory === "All films"
      ? databaseFilms
      : selectedCategory === "New releases"
        ? databaseFilms
        : databaseFilms.filter(
            (film) => film.genre === selectedCategory,
          );

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const newReleases = filteredFilms.filter((film) => {
    if (!film.created_at) {
      return film.year === "2026";
    }

    return new Date(film.created_at) >= fourteenDaysAgo;
  });

  const continueWatching = filteredFilms.filter(
    (film) => Number(film.progress) > 0,
  );

  const recommended = filteredFilms.filter(
    (film) => Number(film.rating) >= 8.1,
  );

  function handleOpenFilm(film) {
    onOpenFilm(film, allFilms);
  }

  function handleWatchFeatured() {
    const featuredFilm = allFilms.find(
      (film) => film.title === "The Last Horizon",
    );

    if (featuredFilm) {
      handleOpenFilm(featuredFilm);
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
        <p className="media-status">
          Loading published films...
        </p>
      )}

      {!loadingFilms && !filmsError && (
        <p className="media-status">
          Published uploads found: {databaseFilms.length}
        </p>
      )}

      {filmsError && (
        <p className="media-status media-error">
          Supabase could not load published films: {filmsError}
        </p>
      )}

      {!loadingFilms &&
        !filmsError &&
        databaseFilms.length === 0 && (
          <p className="media-status">
            No published uploads were returned by Supabase yet.
          </p>
        )}

      <MediaRow
        title="Published uploads"
        subtitle="Films added from Film Studio"
        items={filteredDatabaseFilms}
        onOpenFilm={handleOpenFilm}
      />

      <MediaRow
        title="Continue watching"
        subtitle="Pick up where you left off"
        items={continueWatching}
        showProgress
        onOpenFilm={handleOpenFilm}
      />

      <MediaRow
        title="New releases"
        subtitle="Fresh stories worth watching"
        items={newReleases}
        onOpenFilm={handleOpenFilm}
      />

      <MediaRow
        title="Recommended for you"
        subtitle="Based on your viewing history"
        items={recommended}
        onOpenFilm={handleOpenFilm}
      />

      {isAdmin && <AdminFilmUpload />}
    </section>
  );
}

export default MediaSection;