import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

function getVideoUrl(videoPath) {
  if (!videoPath) {
    return null;
  }

  const { data } = supabase.storage.from("films").getPublicUrl(videoPath);

  return data?.publicUrl || null;
}

function FilmDetailsPage({
  film,
  allFilms,
  email,
  onBack,
  onOpenFilm,
  onNavigateToSubscriptions,
}) {
  const videoRef = useRef(null);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [postingComment, setPostingComment] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  // Access / subscription / purchase state
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [hasFilmPurchase, setHasFilmPurchase] = useState(false);

  const videoUrl = film.video_url || getVideoUrl(film.video_path);

  const isSubscriptionFilm = film.access_type === "subscription";
  const isRentFilm = film.access_type === "rent";
  const isPaidFilm = isSubscriptionFilm || isRentFilm;

  const relatedFilms = useMemo(
    () =>
      allFilms
        .filter(
          (item) =>
            item.genre === film.genre &&
            String(item.id || item.title) !== String(film.id || film.title),
        )
        .slice(0, 4),
    [allFilms, film],
  );

  // Load comments
  useEffect(() => {
    async function loadComments() {
      setLoadingComments(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id || "");

      const { data, error } = await supabase
        .from("film_comments")
        .select("*")
        .eq("film_id", film.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message || "Comments could not be loaded.");
      } else {
        setComments(data || []);
      }

      setLoadingComments(false);
    }

    loadComments();
  }, [film.id]);

  // Check active subscription
  useEffect(() => {
    async function checkSubscription() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setHasActiveSubscription(false);
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, ends_at")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .maybeSingle();

      if (error || !data) {
        setHasActiveSubscription(false);
        return;
      }

      if (data.ends_at) {
        const endsAt = new Date(data.ends_at);
        const now = new Date();
        if (endsAt <= now) {
          setHasActiveSubscription(false);
          return;
        }
      }

      setHasActiveSubscription(true);
    }

    checkSubscription();
  }, [film.id]);

  // Check film purchase (rent/buy)
  useEffect(() => {
    async function checkPurchase() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !film.id) {
        setHasFilmPurchase(false);
        return;
      }

      const { data, error } = await supabase
        .from("purchases")
        .select("id, expires_at, purchase_type")
        .eq("user_id", user.id)
        .eq("film_id", film.id)
        .in("purchase_type", ["rent", "buy"])
        .maybeSingle();

      if (error || !data) {
        setHasFilmPurchase(false);
        return;
      }

      if (data.purchase_type === "buy") {
        setHasFilmPurchase(true);
        return;
      }

      // For rent, check expiry
      if (data.purchase_type === "rent" && data.expires_at) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        if (expiresAt > now) {
          setHasFilmPurchase(true);
        } else {
          setHasFilmPurchase(false);
        }
        return;
      }

      // Rent without expiry = treat as valid
      setHasFilmPurchase(true);
    }

    checkPurchase();
  }, [film.id]);

  // Decide if user has access
  useEffect(() => {
    async function checkAccess() {
      setCheckingAccess(true);
      setHasAccess(false);

      // Free films: always accessible
      if (!isPaidFilm) {
        setHasAccess(true);
        setCheckingAccess(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setHasAccess(false);
        setCheckingAccess(false);
        return;
      }

      // Subscription films
      if (isSubscriptionFilm) {
        if (hasActiveSubscription) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
        setCheckingAccess(false);
        return;
      }

      // Rent films
      if (isRentFilm) {
        if (hasFilmPurchase) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
        setCheckingAccess(false);
        return;
      }

      setHasAccess(false);
      setCheckingAccess(false);
    }

    checkAccess();
  }, [film.id, isPaidFilm, isSubscriptionFilm, isRentFilm, hasActiveSubscription, hasFilmPurchase]);

  async function saveWatchProgress() {
    const video = videoRef.current;

    if (!film.id || !video?.duration) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const secondsWatched = Math.max(0, Math.floor(video.currentTime));
    const durationSeconds = Math.max(0, Math.floor(video.duration));

    await supabase.from("watch_progress").upsert(
      {
        user_id: user.id,
        film_id: film.id,
        seconds_watched: secondsWatched,
        duration_seconds: durationSeconds,
        completed:
          durationSeconds > 0 && secondsWatched >= durationSeconds * 0.95,
      },
      {
        onConflict: "user_id,film_id",
      },
    );
  }

  async function handlePostComment(event) {
    event.preventDefault();

    const text = commentText.trim();

    if (!text) {
      setMessage("Write a comment before posting.");
      return;
    }

    setPostingComment(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please sign in to post a comment.");
      setPostingComment(false);
      return;
    }

    const { data, error } = await supabase
      .from("film_comments")
      .insert({
        film_id: film.id,
        user_id: user.id,
        comment_text: text,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message || "Your comment could not be posted.");
    } else {
      setComments((previousComments) => [data, ...previousComments]);
      setCommentText("");
    }

    setPostingComment(false);
  }

  async function handleDeleteComment(commentId) {
    const confirmed = window.confirm(
      "Delete this comment? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("film_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      setMessage(error.message || "Comment could not be deleted.");
      return;
    }

    setComments((previousComments) =>
      previousComments.filter((comment) => comment.id !== commentId),
    );
  }

  async function handleRentFilm() {
    // TODO: Replace with real payment flow.
    // For now, simulate a successful rental by inserting a purchase row.

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !film.id) {
      setMessage("You must be logged in to rent this film.");
      return;
    }

    // Simulate: 48-hour rental
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { error } = await supabase.from("purchases").insert({
      user_id: user.id,
      film_id: film.id,
      purchase_type: "rent",
      price_cents: film.price_cents || 0,
      purchased_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      setMessage(error.message || "Could not complete rental.");
      return;
    }

    // Grant access immediately
    setHasFilmPurchase(true);
    setHasAccess(true);
  }

  function renderPaywall() {
    if (checkingAccess) {
      return (
        <div className="film-paywall">
          <h2>Checking access…</h2>
          <p>Please wait.</p>
        </div>
      );
    }

    if (hasAccess) {
      return null;
    }

    if (isSubscriptionFilm) {
      return (
        <div className="film-paywall">
          <h2>This film requires a subscription</h2>
          <p>
            Subscribe to unlock this film and many others in our library.
          </p>
          <button
            className="media-watch-button"
            type="button"
            onClick={onNavigateToSubscriptions}
          >
            View subscription plans
          </button>
        </div>
      );
    }

    if (isRentFilm) {
      const price = (film.price_cents || 0) / 100;
      return (
        <div className="film-paywall">
          <h2>Rent this film</h2>
          <p>
            Watch this film for 48 hours after you start.
          </p>
          <p>
            Price: <strong>${price.toFixed(2)}</strong>
          </p>
          <button
            className="media-watch-button"
            type="button"
            onClick={handleRentFilm}
          >
            Rent now
          </button>
        </div>
      );
    }

    return (
      <div className="film-paywall">
        <h2>Access required</h2>
        <p>This film is not available for free.</p>
        <button
          className="media-watch-button"
          type="button"
          onClick={onNavigateToSubscriptions}
        >
          View plans
        </button>
      </div>
    );
  }

  return (
    <section className="film-details-page section-page">
      <button className="back-button" type="button" onClick={onBack}>
        ← Back to Media
      </button>

      <div className="film-details-layout">
        <div className="film-player-panel">
          {videoUrl ? (
            isPaidFilm && !hasAccess ? (
              renderPaywall()
            ) : (
              <video
                ref={videoRef}
                className="film-details-video"
                src={videoUrl}
                controls
                autoPlay
                onPause={saveWatchProgress}
                onEnded={saveWatchProgress}
                onTimeUpdate={(event) => {
                  const lastSave = Number(
                    event.currentTarget.dataset.lastSave || 0,
                  );

                  if (Date.now() - lastSave > 5000) {
                    saveWatchProgress();
                    event.currentTarget.dataset.lastSave = String(
                      Date.now(),
                    );
                  }
                }}
              />
            )
          ) : (
            <div className="film-video-empty">
              <span>▶</span>
              <h2>Video not available</h2>
              <p>This film does not have a video uploaded yet.</p>
            </div>
          )}
        </div>

        <aside className="film-info-panel">
          <p className="eyebrow">{film.genre || "Film"}</p>

          <h1>{film.title}</h1>

          <div className="film-details-meta">
            <span>{film.year || "Unknown year"}</span>
            <span>{film.duration || "Unknown duration"}</span>
            <span>★ {film.rating || "0"}</span>
          </div>

          <p className="film-description">
            {film.description ||
              "No description is available for this film."}
          </p>

          {isPaidFilm && !hasAccess && isRentFilm && (
            <button
              className="media-watch-button"
              type="button"
              onClick={handleRentFilm}
            >
              Rent for ${(film.price_cents || 0) / 100}
            </button>
          )}

          {isPaidFilm && !hasAccess && isSubscriptionFilm && (
            <button
              className="media-watch-button"
              type="button"
              onClick={onNavigateToSubscriptions}
            >
              View subscription plans
            </button>
          )}
        </aside>
      </div>

      <section className="related-films-section">
        <div className="details-section-heading">
          <div>
            <p className="eyebrow">MORE TO WATCH</p>
            <h2>Related films</h2>
          </div>
        </div>

        {relatedFilms.length === 0 ? (
          <p className="media-status">
            No related films are available yet.
          </p>
        ) : (
          <div className="related-films-grid">
            {relatedFilms.map((relatedFilm) => (
              <button
                className="related-film-card"
                key={relatedFilm.id || relatedFilm.title}
                type="button"
                onClick={() => onOpenFilm(relatedFilm)}
              >
                <div
                  className="related-film-art"
                  style={
                    relatedFilm.poster_url
                      ? {
                          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.82)), url("${relatedFilm.poster_url}")`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }
                      : {
                          "--related-film-color":
                            relatedFilm.color || "#172554",
                        }
                  }
                >
                  <span>{relatedFilm.genre}</span>
                  <strong>★ {relatedFilm.rating}</strong>
                </div>

                <div className="related-film-body">
                  <h3>{relatedFilm.title}</h3>
                  <p>
                    {relatedFilm.year} · {relatedFilm.duration}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="comments-section">
        <div className="details-section-heading">
          <div>
            <p className="eyebrow">DISCUSSION</p>
            <h2>Comments</h2>
          </div>

          <span className="comments-count">
            {comments.length}{" "}
            {comments.length === 1 ? "comment" : "comments"}
          </span>
        </div>

        <form className="comment-form" onSubmit={handlePostComment}>
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder={`Share your thoughts about ${film.title}...`}
            maxLength="1000"
            disabled={postingComment}
          />

          <div className="comment-form-footer">
            <span>{commentText.length}/1000</span>

            <button
              className="media-watch-button"
              type="submit"
              disabled={postingComment}
            >
              {postingComment ? "Posting..." : "Post comment"}
            </button>
          </div>
        </form>

        {message && <p className="comment-message">{message}</p>}

        {loadingComments ? (
          <p className="media-status">Loading comments...</p>
        ) : comments.length === 0 ? (
          <div className="comments-empty">
            <span>💬</span>
            <h3>No comments yet</h3>
            <p>Be the first person to start the conversation.</p>
          </div>
        ) : (
          <div className="comments-list">
            {comments.map((comment) => (
              <article className="comment-card" key={comment.id}>
                <div className="comment-avatar">
                  {(comment.user_id || "U").slice(0, 1).toUpperCase()}
                </div>

                <div className="comment-content">
                  <div className="comment-header">
                    <strong>
                      {comment.user_id === currentUserId
                        ? "You"
                        : "Sivilization member"}
                    </strong>

                    <time>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </time>
                  </div>

                  <p>{comment.comment_text}</p>
                </div>

                {comment.user_id === currentUserId && (
                  <button
                    className="comment-delete-button"
                    type="button"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    Delete
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default FilmDetailsPage;