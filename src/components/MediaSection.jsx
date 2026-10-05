import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import AdminFilmUpload from "./AdminFilmUpload";
import "../App.css";

const categories = [
  "All films",
  "Trending",
  "New releases",
  "Action",
  "Drama",
  "Sci-Fi",
  "Documentary",
];

function filmKey(film) {
  return String(film.id || film.title);
}

function getVideoUrl(videoPath) {
  if (!videoPath) return null;

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
    access_type: film.access_type || "free",
    price_cents: film.price_cents || 0,
    video_url: getVideoUrl(film.video_path),
    video_path: film.video_path,
    poster_path: film.poster_path,
  };
}

function FilmCard({
  film,
  showProgress = false,
  onPlay,
  onToggleSaved,
  onRent,
  onSubscribe,
  isSaved = false,
  hasAccess = false,
}) {
  const isFree = film.access_type === "free";
  const isRent = film.access_type === "rent";
  const isSub = film.access_type === "subscription";

  const needsAction = !hasAccess && (isRent || isSub);

  return (
    <article
      className="media-film-card"
      style={{ "--film-color": film.color }}
    >
      <div className="media-film-poster">
        <div className="media-film-top">
          <span>{film.genre}</span>

          <div className="access-badge">
            {isFree && <span className="badge-free">Free</span>}
            {isRent && (
              <span className="badge-rent">
                Rent ${((film.price_cents || 0) / 100).toFixed(2)}
              </span>
            )}
            {isSub && <span className="badge-sub">Subscriber</span>}
          </div>

          <button
            className={`media-save-button ${isSaved ? "saved" : ""}`}
            type="button"
            onClick={() => onToggleSaved?.(film)}
            aria-label={
              isSaved
                ? `Remove ${film.title} from My List`
                : `Save ${film.title} to My List`
            }
          >
            {isSaved ? "♥" : "♡"}
          </button>
        </div>

        {needsAction ? (
          <div className="access-action-overlay">
            {isRent && (
              <button
                className="access-action-button rent"
                type="button"
                onClick={() => onRent?.(film)}
              >
                Rent ${((film.price_cents || 0) / 100).toFixed(2)}
              </button>
            )}
            {isSub && (
              <button
                className="access-action-button subscribe"
                type="button"
                onClick={() => onSubscribe?.(film)}
              >
                Subscribe
              </button>
            )}
          </div>
        ) : (
          <button
            className="media-play-button"
            type="button"
            onClick={() => onPlay(film)}
            aria-label={`Play ${film.title}`}
          >
            ▶
          </button>
        )}

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
  onToggleSaved,
  onRent,
  onSubscribe,
  savedFilmKeys,
  userHasAccessMap,
}) {
  if (items.length === 0) return null;

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
            key={filmKey(film)}
            film={film}
            showProgress={showProgress}
            onPlay={onPlay}
            onToggleSaved={onToggleSaved}
            onRent={onRent}
            onSubscribe={onSubscribe}
            isSaved={savedFilmKeys.has(filmKey(film))}
            hasAccess={!!userHasAccessMap[filmKey(film)]}
          />
        ))}
      </div>
    </section>
  );
}

function MediaSection() {
  const [allFilms, setAllFilms] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [selectedCategory, setSelectedCategory] =
    useState("All films");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingFilms, setLoadingFilms] = useState(true);
  const [filmsError, setFilmsError] = useState("");
  const [savedFilmKeys, setSavedFilmKeys] = useState(() => new Set());
  const [watchProgressByFilm, setWatchProgressByFilm] = useState({});
  const [watchProgressError, setWatchProgressError] = useState("");
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [rentedFilmKeys, setRentedFilmKeys] = useState(() => new Set());
  const [userHasAccessMap, setUserHasAccessMap] = useState({});

  const videoPlayerRef = useRef(null);

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

        // Load active subscription
        const { data: subs, error: subsError } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .gte("ends_at", new Date().toISOString())
          .order("ends_at", { ascending: false })
          .limit(1);

        if (!subsError && subs && subs.length > 0) {
          setActiveSubscription(subs[0]);
        } else {
          setActiveSubscription(null);
        }

        // Load rentals
        const { data: rentals, error: rentalsError } = await supabase
          .from("rentals")
          .select("film_id")
          .eq("user_id", user.id);

        if (!rentalsError) {
          setRentedFilmKeys(
            new Set((rentals || []).map((r) => String(r.film_id)))
          );
        }
      } else {
        setIsAdmin(false);
        setActiveSubscription(null);
        setRentedFilmKeys(new Set());
      }

      const { data: databaseFilms, error: loadError } =
        await supabase
          .from("films")
          .select("*")
          .order("created_at", { ascending: false });

      if (loadError) {
        console.error("Could not load films:", loadError);
        setFilmsError(loadError.message);
        setLoadingFilms(false);
        return;
      }

      const convertedFilms = (databaseFilms || []).map(
        convertDatabaseFilm
      );

      setAllFilms(convertedFilms);
      setLoadingFilms(false);

      // Load subscription plans
      const { data: plans, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_cents", { ascending: true });

      if (!plansError && plans) {
        setSubscriptionPlans(plans);
      }

      // Load watch progress for uploaded films
      const { data: progressRows, error: progressError } = await supabase
        .from("watch_progress")
        .select("film_id, seconds_watched, duration_seconds, completed")
        .eq("user_id", user?.id);

      if (progressError) {
        console.error("Could not load watch progress:", progressError);
        setWatchProgressError(
          "Your watch progress could not be loaded. Please refresh and try again."
        );
      } else {
        setWatchProgressByFilm(
          Object.fromEntries(
            (progressRows || []).map((row) => [
              String(row.film_id),
              {
                secondsWatched: Number(row.seconds_watched) || 0,
                durationSeconds: Number(row.duration_seconds) || 0,
                completed: row.completed === true,
              },
            ])
          )
        );
      }
    }

    loadUserAndFilms();
  }, []);

  // Build access map whenever films/subscription/rentals change
  useEffect(() => {
    const map = {};
    const now = new Date();

    allFilms.forEach((film) => {
      const key = filmKey(film);
      if (film.access_type === "free") {
        map[key] = true;
      } else if (film.access_type === "rent") {
        map[key] = rentedFilmKeys.has(key);
      } else if (film.access_type === "subscription") {
        map[key] =
          !!activeSubscription &&
          new Date(activeSubscription.ends_at) >= now;
      }
    });

    setUserHasAccessMap(map);
  }, [allFilms, activeSubscription, rentedFilmKeys]);

  const filteredFilms =
    selectedCategory === "All films"
      ? allFilms
      : selectedCategory === "New releases"
        ? allFilms.filter((film) => film.year === "2026")
        : selectedCategory === "Trending"
          ? allFilms.filter(
              (film) => Number(film.rating) >= 8.1
            )
          : allFilms.filter(
              (film) => film.genre === selectedCategory
            );

  // Enrich uploaded films with persisted progress
  const filmsWithProgress = filteredFilms.map((film) => {
    if (!film.id) return film;
    const prog = watchProgressByFilm[String(film.id)];
    if (!prog) return film;
    const percent =
      prog.durationSeconds > 0
        ? Math.min(
            100,
            Math.round((prog.secondsWatched / prog.durationSeconds) * 100)
          )
        : 0;
    return { ...film, progress: percent };
  });

  const continueWatching = filmsWithProgress.filter(
    (film) => Number(film.progress) > 0
  );

  const newReleases = filmsWithProgress.filter(
    (film) => film.year === "2026"
  );

  const recommended = filmsWithProgress.filter(
    (film) => Number(film.rating) >= 8.1
  );

  const savedFilms = useMemo(
    () =>
      allFilms.filter((film) =>
        savedFilmKeys.has(filmKey(film))
      ),
    [allFilms, savedFilmKeys]
  );

  const sameGenreFilms = selectedFilm
    ? allFilms.filter(
        (film) =>
          film.genre === selectedFilm.genre &&
          filmKey(film) !== filmKey(selectedFilm)
      )
    : [];

  function toggleSavedFilm(film) {
    const key = filmKey(film);

    setSavedFilmKeys((previousKeys) => {
      const nextKeys = new Set(previousKeys);

      if (nextKeys.has(key)) {
        nextKeys.delete(key);
      } else {
        nextKeys.add(key);
      }

      return nextKeys;
    });
  }

  async function handleRentFilm(film) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be signed in to rent a film.");
      return;
    }

    const ok = confirm(
      `Rent "${film.title}" for $${((film.price_cents || 0) / 100).toFixed(2)}? (Mock checkout – no real charge)`
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("rentals")
        .insert({
          user_id: user.id,
          film_id: film.id,
          // optional: set expires_at if you want time-limited rentals
        });

      if (error) throw error;

      setRentedFilmKeys((prev) => new Set(prev).add(filmKey(film)));
      alert("Rental successful – you can now watch this film.");
    } catch (err) {
      console.error(err);
      alert("Rental failed. Please try again.");
    }
  }

  async function handleSubscribeForFilm(film) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be signed in to subscribe.");
      return;
    }

    const plan = subscriptionPlans[0];
    if (!plan) {
      alert("No subscription plans available.");
      return;
    }

    const ok = confirm(
      `Subscribe to ${plan.name} for $${((plan.price_cents || 0) / 100).toFixed(2)}? (Mock checkout – no real charge)`
    );
    if (!ok) return;

    try {
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + plan.duration_days);

      const { error } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          started_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
          is_active: true,
        });

      if (error) throw error;

      setActiveSubscription({
        user_id: user.id,
        plan_id: plan.id,
        started_at: new Date().toISOString(),
        ends_at: endsAt.toISOString(),
        is_active: true,
      });

      alert("Subscription activated – you can now watch subscriber-only films.");
    } catch (err) {
      console.error(err);
      alert("Subscription failed. Please try again.");
    }
  }

  async function handleChooseSubscription(plan) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be signed in to subscribe.");
      return;
    }

    const ok = confirm(
      `Subscribe to ${plan.name} for $${((plan.price_cents || 0) / 100).toFixed(2)}? (Mock checkout – no real charge)`
    );
    if (!ok) return;

    try {
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + plan.duration_days);

      const { error } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          started_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
          is_active: true,
        });

      if (error) throw error;

      setActiveSubscription({
        user_id: user.id,
        plan_id: plan.id,
        started_at: new Date().toISOString(),
        ends_at: endsAt.toISOString(),
        is_active: true,
      });

      alert("Subscription activated – you can now watch subscriber-only films.");
    } catch (err) {
      console.error(err);
      alert("Subscription failed. Please try again.");
    }
  }

  function handleWatchFeatured() {
    const featuredFilm = allFilms[0];
    if (featuredFilm) {
      setSelectedFilm(featuredFilm);
    }
  }

  function handleAddFeaturedToList() {
    const featuredFilm = allFilms[0];
    if (featuredFilm) {
      setSavedFilmKeys((previousKeys) => {
        const nextKeys = new Set(previousKeys);
        nextKeys.add(filmKey(featuredFilm));
        return nextKeys;
      });
    }
  }

  async function upsertWatchProgress(film, currentTime, duration) {
    if (!film.id || !duration) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const secondsWatched = Math.max(0, Math.floor(currentTime));
    const durationSeconds = Math.max(0, Math.floor(duration));
    const completed = durationSeconds > 0 && secondsWatched >= durationSeconds * 0.95;

    await supabase
      .from("watch_progress")
      .upsert(
        {
          user_id: user.id,
          film_id: film.id,
          seconds_watched: secondsWatched,
          duration_seconds: durationSeconds,
          completed,
        },
        { onConflict: "user_id,film_id" }
      );

    setWatchProgressByFilm((prev) => ({
      ...prev,
      [String(film.id)]: {
        secondsWatched,
        durationSeconds,
        completed,
      },
    }));
  }

  function closeVideoModal() {
    const player = videoPlayerRef.current;
    if (player && selectedFilm?.id) {
      upsertWatchProgress(selectedFilm, player.currentTime, player.duration);
    }
    player?.pause();
    setSelectedFilm(null);
  }

  function handleVideoPlayerClick() {
    const player = videoPlayerRef.current;
    if (!player) return;

    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  }

  function handleSelectRecommendation(film) {
    const player = videoPlayerRef.current;
    if (player && selectedFilm?.id) {
      upsertWatchProgress(selectedFilm, player.currentTime, player.duration);
    }
    player?.pause();
    setSelectedFilm(film);
  }

  return (
    <section className="media-page section-page">
      {/* Subscriptions Section */}
      {subscriptionPlans.length > 0 && (
        <section className="subscriptions-section">
          <div className="subscriptions-header">
            <p className="eyebrow">SUBSCRIPTIONS</p>
            <h2>Choose your plan</h2>
            <p>Unlock subscriber‑only films and enjoy unlimited watching.</p>
          </div>

          <div className="subscriptions-grid">
            {subscriptionPlans.map((plan) => (
              <div key={plan.id} className="subscription-card">
                <h3>{plan.name}</h3>
                {plan.description && (
                  <p className="subscription-description">{plan.description}</p>
                )}
                <div className="subscription-price">
                  ${((plan.price_cents || 0) / 100).toFixed(2)}
                  <span className="subscription-period">
                    / {plan.duration_days >= 365
                      ? `${plan.duration_days / 365} year${plan.duration_days / 365 > 1 ? "s" : ""}`
                      : `${plan.duration_days} day${plan.duration_days > 1 ? "s" : ""}`}
                  </span>
                </div>
                <button
                  className="subscription-choose-button"
                  type="button"
                  onClick={() => handleChooseSubscription(plan)}
                >
                  Choose {plan.name}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="media-hero">
        <div className="media-hero-content">
          <p className="eyebrow">FEATURED FILM</p>
          <h1>{allFilms[0]?.title || "No films yet"}</h1>

          {allFilms[0] && (
            <>
              <div className="media-meta">
                <span>{allFilms[0].year}</span>
                <span>{allFilms[0].duration}</span>
                <span>★ {allFilms[0].rating}</span>
                <span>{allFilms[0].genre}</span>
              </div>

              <p className="media-hero-description">
                {allFilms[0].description || "No description available."}
              </p>

              <div className="media-hero-actions">
                {userHasAccessMap[filmKey(allFilms[0])] ? (
                  <button
                    className="media-watch-button"
                    type="button"
                    onClick={handleWatchFeatured}
                  >
                    ▶ Watch now
                  </button>
                ) : allFilms[0].access_type === "rent" ? (
                  <button
                    className="media-watch-button"
                    type="button"
                    onClick={() => handleRentFilm(allFilms[0])}
                  >
                    Rent ${((allFilms[0].price_cents || 0) / 100).toFixed(2)}
                  </button>
                ) : (
                  <button
                    className="media-watch-button"
                    type="button"
                    onClick={() => handleSubscribeForFilm(allFilms[0])}
                  >
                    Subscribe
                  </button>
                )}

                <button
                  className="media-list-button"
                  type="button"
                  onClick={handleAddFeaturedToList}
                >
                  + Add to list
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="media-categories">
        {categories.map((category) => (
          <button
            key={category}
            className={
              selectedCategory === category ? "selected" : ""
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

      {watchProgressError && (
        <p className="media-status media-error">
          {watchProgressError}
        </p>
      )}

      <MediaRow
        title="Continue watching"
        subtitle="Pick up where you left off"
        items={continueWatching}
        showProgress
        onPlay={setSelectedFilm}
        onToggleSaved={toggleSavedFilm}
        onRent={handleRentFilm}
        onSubscribe={handleSubscribeForFilm}
        savedFilmKeys={savedFilmKeys}
        userHasAccessMap={userHasAccessMap}
      />

      <MediaRow
        title="New releases"
        subtitle="Fresh stories worth watching"
        items={newReleases}
        onPlay={setSelectedFilm}
        onToggleSaved={toggleSavedFilm}
        onRent={handleRentFilm}
        onSubscribe={handleSubscribeForFilm}
        savedFilmKeys={savedFilmKeys}
        userHasAccessMap={userHasAccessMap}
      />

      <MediaRow
        title="Recommended for you"
        subtitle="Based on your viewing history"
        items={recommended}
        onPlay={setSelectedFilm}
        onToggleSaved={toggleSavedFilm}
        onRent={handleRentFilm}
        onSubscribe={handleSubscribeForFilm}
        savedFilmKeys={savedFilmKeys}
        userHasAccessMap={userHasAccessMap}
      />

      <MediaRow
        title="My List"
        subtitle="Saved for later"
        items={savedFilms}
        onPlay={setSelectedFilm}
        onToggleSaved={toggleSavedFilm}
        onRent={handleRentFilm}
        onSubscribe={handleSubscribeForFilm}
        savedFilmKeys={savedFilmKeys}
        userHasAccessMap={userHasAccessMap}
      />

      {isAdmin && <AdminFilmUpload />}

      {selectedFilm && (
        <div
          className="video-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeVideoModal();
            }
          }}
        >
          <div className="video-modal-content">
            <button
              className="video-modal-close"
              type="button"
              onClick={closeVideoModal}
              aria-label="Close video player"
            >
              ×
            </button>

            <h2>{selectedFilm.title}</h2>

            {!userHasAccessMap[filmKey(selectedFilm)] ? (
              <div className="access-required-panel">
                <p className="access-required-message">
                  {selectedFilm.access_type === "rent"
                    ? `This film requires a rental payment of $${((selectedFilm.price_cents || 0) / 100).toFixed(2)}.`
                    : "This film is for subscribers only."}
                </p>
                <div className="access-required-actions">
                  {selectedFilm.access_type === "rent" ? (
                    <button
                      className="media-watch-button"
                      type="button"
                      onClick={() => handleRentFilm(selectedFilm)}
                    >
                      Rent ${((selectedFilm.price_cents || 0) / 100).toFixed(2)}
                    </button>
                  ) : (
                    <button
                      className="media-watch-button"
                      type="button"
                      onClick={() => handleSubscribeForFilm(selectedFilm)}
                    >
                      Subscribe
                    </button>
                  )}
                </div>
              </div>
            ) : selectedFilm.video_url ? (
              <>
                <video
                  ref={videoPlayerRef}
                  className="media-video-player"
                  src={selectedFilm.video_url}
                  controls
                  autoPlay
                  onClick={handleVideoPlayerClick}
                  style={{ cursor: "pointer" }}
                  onTimeUpdate={(e) => {
                    if (selectedFilm?.id && e.target.duration) {
                      if (
                        !e.target.dataset.lastSave ||
                        Date.now() - Number(e.target.dataset.lastSave) > 5000
                      ) {
                        upsertWatchProgress(
                          selectedFilm,
                          e.target.currentTime,
                          e.target.duration
                        );
                        e.target.dataset.lastSave = String(Date.now());
                      }
                    }
                  }}
                />

                <p className="video-hint">
                  Click the video screen to play or pause.
                </p>
              </>
            ) : (
              <p className="video-not-available">
                This film does not have a video uploaded yet.
              </p>
            )}

            {sameGenreFilms.length > 0 && (
              <section className="video-recommendations">
                <div className="media-row-heading">
                  <div>
                    <p className="eyebrow">KEEP WATCHING</p>
                    <h3>More {selectedFilm.genre} films</h3>
                  </div>
                </div>

                <div className="media-film-grid video-recommendation-grid">
                  {sameGenreFilms.map((film) => (
                    <FilmCard
                      key={filmKey(film)}
                      film={film}
                      onPlay={handleSelectRecommendation}
                      onToggleSaved={toggleSavedFilm}
                      onRent={handleRentFilm}
                      onSubscribe={handleSubscribeForFilm}
                      isSaved={savedFilmKeys.has(filmKey(film))}
                      hasAccess={!!userHasAccessMap[filmKey(film)]}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default MediaSection;
