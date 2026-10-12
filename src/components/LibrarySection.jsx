import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function getPosterUrl(film) {
  if (film.poster_url) return film.poster_url;
  if (!film.poster_path) return "";

  const { data } = supabase.storage
    .from("film-posters")
    .getPublicUrl(film.poster_path);

  return data?.publicUrl || "";
}

export default function LibrarySection({ search = "" }) {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadLibrary() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!alive) return;

      if (authError || !user) {
        setError("Please sign in again to view your library.");
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("saved_films")
        .select(`
          created_at,
          films (
            id,
            title,
            description,
            genre,
            release_year,
            duration,
            poster_url,
            poster_path,
            access_type
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (queryError) {
        setError(queryError.message);
        setFilms([]);
      } else {
        setFilms(
          (data || [])
            .filter((row) => row.films)
            .map((row) => ({
              ...row.films,
              saved_at: row.created_at,
            }))
        );
      }

      setLoading(false);
    }

    loadLibrary().catch((loadError) => {
      if (alive) {
        setError(loadError?.message || "Could not load your library.");
        setLoading(false);
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  const filteredFilms = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return films;

    return films.filter((film) =>
      [film.title, film.description, film.genre, film.release_year]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [films, search]);

  async function removeSavedFilm(filmId) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setNotice("Your session expired. Please sign in again.");
      return;
    }

    const { error: deleteError } = await supabase
      .from("saved_films")
      .delete()
      .eq("user_id", user.id)
      .eq("film_id", filmId);

    if (deleteError) {
      setNotice(deleteError.message);
      return;
    }

    setFilms((current) => current.filter((film) => film.id !== filmId));
    setNotice("Removed from your saved films.");
  }

  return (
    <section className="content-section">
      <header className="section-heading">
        <p className="eyebrow">Your collection</p>
        <h1>My library</h1>
        <p>
          Your saved films appear here. Saving a title does not grant paid
          access.
        </p>
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {loading && (
        <p className="status-line" role="status">
          Loading your library…
        </p>
      )}

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && filteredFilms.length === 0 && (
        <div className="empty-state">
          <h2>
            {search.trim() ? "No matching saved films" : "No saved films yet"}
          </h2>
          <p>
            {search.trim()
              ? "Try another search."
              : "Save a film from the Media section to add it here."}
          </p>
        </div>
      )}

      <div className="catalog-grid">
        {filteredFilms.map((film) => {
          const poster = getPosterUrl(film);

          return (
            <article className="catalog-card" key={film.id}>
              <div className="catalog-art">
                {poster ? (
                  <img
                    src={poster}
                    alt={`${film.title} poster`}
                    loading="lazy"
                  />
                ) : (
                  <span aria-hidden="true">🎬</span>
                )}
              </div>

              <div className="catalog-card-body">
                <div className="card-meta">
                  <span>{film.genre || "Film"}</span>
                  <span>{film.release_year || "Year unknown"}</span>
                </div>

                <h2>{film.title}</h2>
                <p>{film.description || "A Sivilization title."}</p>

                <span className="access-label">
                  {film.access_type === "free"
                    ? "Free title"
                    : "Access not included"}
                </span>

                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => removeSavedFilm(film.id)}
                >
                  Remove saved title
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}