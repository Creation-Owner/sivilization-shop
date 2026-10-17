import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { buyItem } from "../paddle";
import AdminFilmUpload from "./AdminFilmUpload";

const categories = [
  "All films",
  "Trending",
  "New releases",
  "Action",
  "Adventure",
  "Anime",
  "Cartoon",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
];

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
    is_sample: true,
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
    is_sample: true,
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
    is_sample: true,
  },
];

function getPosterUrl(row) {
  if (row.poster_url) return row.poster_url;
  if (!row.poster_path) return null;

  const { data } = supabase.storage
    .from("films")
    .getPublicUrl(row.poster_path);

  return data?.publicUrl || null;
}

function convertDatabaseFilm(row) {
  const accessType =
    row.is_paid === true
      ? "paid"
      : String(row.access_type || "free").toLowerCase();

  return {
    id: row.id,
    title: row.title || "Untitled film",
    description: row.description || "",
    genre: row.genre || "Film",
    year: row.release_year ? String(row.release_year) : "Unknown",
    duration: row.duration || "Unknown",
    rating: String(row.rating ?? "0"),
    color: "#172554",
    progress: 0,
    video_path: row.video_path || null,
    video_url: row.video_url || null,
    poster_path: row.poster_path || null,
    poster_url: getPosterUrl(row),
    access_type: accessType,
    price_cents: Number(row.price_cents || 0),
    paddle_price_id: row.paddle_price_id || null,
    is_published: row.is_published === true,
    is_sample: false,
    created_at: row.created_at || null,
  };
}

function getAccessLabel(film) {
  if (film.access_type === "paid" || film.access_type === "rent") {
    return film.price_cents
      ? `$${(film.price_cents / 100).toFixed(2)}`
      : "PAID";
  }

  if (film.access_type === "subscription") return "SUB";
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

function FilmCard({ film, busy, onOpenFilm, onRent }) {
  const isRentable = film.access_type === "rent";

  return (
    <div
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
      aria-label={`Open ${film.title}`}
    >
      <div className="media-film-poster" style={getPosterStyle(film)}>
        <div className="media-film-top">
          <span>{film.genre}</span>
          <span className="media-access-badge">
            {getAccessLabel(film)}
          </span>
        </div>

        <span className="media-play-button media-play-icon" aria-hidden="true">
          ▶
        </span>

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

        {isRentable && (
          <button
            type="button"
            className="media-rent-button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onRent(film);
            }}
          >
            {busy
              ? "Opening checkout..."
              : `Rent for $${(film.price_cents / 100).toFixed(2)}`}
          </button>
        )}
      </div>
    </div>
  );
}

function MediaRow({
  title,
  subtitle,
  films,
  onOpenFilm,
  onRent,
  busyFilmId,
}) {
  if (!films.length) return null;

  return (
    <section className="media-row-section">
      <div className="media-row-heading">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="media-film-grid">
        {films.map((film) => (
          <FilmCard
            key={film.id}
            film={film}
            busy={busyFilmId === film.id}
            onOpenFilm={onOpenFilm}
            onRent={onRent}
          />
        ))}
      </div>
    </section>
  );
}

export default function MediaSection({
  search = "",
  onOpenFilm,
  onOpenSubscriptions,
}) {
  const [databaseFilms, setDatabaseFilms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All films");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingFilms, setLoadingFilms] = useState(true);
  const [filmsError, setFilmsError] = useState("");
  const [busyFilmId, setBusyFilmId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFilms() {
      setLoadingFilms(true);
      setFilmsError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("is_admin, is_owner")
            .eq("id", user.id)
            .maybeSingle();

          if (profileError) throw profileError;

          if (!cancelled) {
            setIsAdmin(
              profile?.is_admin === true || profile?.is_owner === true,
            );
          }
        } else if (!cancelled) {
          setIsAdmin(false);
        }

        const { data, error } = await supabase
          .from("films")
          .select("*")
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!cancelled) {
          setDatabaseFilms((data || []).map(convertDatabaseFilm));
        }
      } catch (error) {
        console.error("Could not load published films:", error);

        if (!cancelled) {
          setFilmsError(error.message || "Could not load films.");
          setDatabaseFilms([]);
        }
      } finally {
        if (!cancelled) setLoadingFilms(false);
      }
    }

    loadFilms();

    return () => {
      cancelled = true;
    };
  }, []);

  const allFilms = useMemo(
    () => [...databaseFilms, ...sampleFilms],
    [databaseFilms],
  );

  const visibleFilms = useMemo(() => {
    let result = allFilms;

    if (
      selectedCategory !== "All films" &&
      selectedCategory !== "Trending" &&
      selectedCategory !== "New releases"
    ) {
      result = result.filter(
        (film) =>
          film.genre.toLowerCase() === selectedCategory.toLowerCase(),
      );
    }

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter((film) =>
        `${film.title} ${film.genre} ${film.description}`
          .toLowerCase()
          .includes(query),
      );
    }

    return result;
  }, [allFilms, selectedCategory, search]);

  const visibleDatabaseFilms = useMemo(
    () => visibleFilms.filter((film) => !film.is_sample),
    [visibleFilms],
  );

  const newReleases = visibleFilms.filter((film) => {
    if (!film.created_at) return film.year === "2026";

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    return new Date(film.created_at) >= cutoff;
  });

  const recommended = visibleFilms.filter(
    (film) => Number(film.rating) >= 8.1,
  );

  async function handleRentFilm(film) {
    if (film.access_type !== "rent") return;

    if (!film.paddle_price_id) {
      window.alert(
        "This film does not have a rental price yet. Save it again in Film Studio to create one automatically.",
      );
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      window.alert(error.message || "Could not check your sign-in.");
      return;
    }

    if (!user) {
      window.alert("Please sign in before renting a film.");
      return;
    }

    setBusyFilmId(film.id);

    try {
      await buyItem({
        priceId: film.paddle_price_id,
        customData: {
          user_id: user.id,
          film_id: film.id,
          payment_type: "film",
          access_type: "rent",
        },
      });
    } catch (checkoutError) {
      console.error("Could not start film rental checkout:", checkoutError);
      window.alert(
        checkoutError?.message ||
          "Could not open checkout. Please try again.",
      );
    } finally {
      setBusyFilmId(null);
    }
  }

  function handleOpenFilm(film) {
    if (typeof onOpenFilm !== "function") {
      console.error(
        "MediaSection requires an onOpenFilm callback from App.jsx.",
      );
      return;
    }

    onOpenFilm(film, allFilms);
  }

  return (
    <section className="media-page section-page">
      <header className="media-hero">
        <div className="media-hero-content">
          <p className="eyebrow">SIVILIZATION CINEMA</p>
          <h1>Films, cartoons & dramas</h1>
          <p className="media-hero-description">
            Open a film to see its details, authorized playback, related films,
            and comments.
          </p>
        </div>
      </header>

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

      {loadingFilms && (
        <p className="media-status">Loading published films…</p>
      )}

      {filmsError && (
        <p className="media-status media-error">
          Could not load films: {filmsError}
        </p>
      )}

      {!loadingFilms && !filmsError && databaseFilms.length === 0 && (
        <p className="media-status">No published films found.</p>
      )}

      <MediaRow
        title="Published uploads"
        subtitle="Films from Film Studio"
        films={visibleDatabaseFilms}
        onOpenFilm={handleOpenFilm}
        onRent={handleRentFilm}
        busyFilmId={busyFilmId}
      />

      <MediaRow
        title="New releases"
        subtitle="Recently published"
        films={newReleases}
        onOpenFilm={handleOpenFilm}
        onRent={handleRentFilm}
        busyFilmId={busyFilmId}
      />

      <MediaRow
        title="Recommended"
        subtitle="Popular with viewers"
        films={recommended}
        onOpenFilm={handleOpenFilm}
        onRent={handleRentFilm}
        busyFilmId={busyFilmId}
      />

      <MediaRow
        title="All films"
        subtitle="Explore the catalogue"
        films={visibleFilms}
        onOpenFilm={handleOpenFilm}
        onRent={handleRentFilm}
        busyFilmId={busyFilmId}
      />

      {isAdmin && (
        <AdminFilmUpload
          onUploaded={() => {
            window.location.reload();
          }}
        />
      )}
    </section>
  );
}