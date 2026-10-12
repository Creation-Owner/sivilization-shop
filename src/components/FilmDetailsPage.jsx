import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { buyItem } from "../paddle";

function formatCurrency(cents) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

function FilmDetailsPage({
  film,
  allFilms = [],
  email,
  onBack,
  onOpenFilm,
  onNavigateToSubscriptions,
}) {
  const videoRef = useRef(null);

  const [videoUrl, setVideoUrl] = useState("");
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState("");

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [postingComment, setPostingComment] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [hasPurchase, setHasPurchase] = useState(false);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [buyingFilm, setBuyingFilm] = useState(false);

  const accessType = String(film.access_type || "free").toLowerCase();
  const isSample =
    film.is_sample === true ||
    String(film.id || "").startsWith("sample-");
  const isSubscriptionFilm = accessType === "subscription";
  const isPaidFilm =
    accessType === "paid" ||
    accessType === "rent" ||
    isSubscriptionFilm;

  const relatedFilms = useMemo(
    () =>
      allFilms
        .filter(
          (item) =>
            item.id !== film.id &&
            item.genre?.toLowerCase() === film.genre?.toLowerCase(),
        )
        .slice(0, 4),
    [allFilms, film.id, film.genre],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!cancelled) setCurrentUserId(user?.id || "");
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadComments() {
      setLoadingComments(true);
      setMessage("");

      if (isSample) {
        setComments([]);
        setLoadingComments(false);
        return;
      }

      const { data, error } = await supabase
        .from("film_comments")
        .select("id, film_id, user_id, comment_text, created_at")
        .eq("film_id", film.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setMessage(error.message || "Comments could not be loaded.");
        setComments([]);
      } else {
        setComments(data || []);
      }

      setLoadingComments(false);
    }

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [film.id, isSample]);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      setCheckingAccess(true);
      setHasAccess(false);
      setHasPurchase(false);
      setHasSubscription(false);
      setIsPrivileged(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setCheckingAccess(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, is_owner")
        .eq("id", user.id)
        .maybeSingle();

      const privileged =
        profile?.is_admin === true || profile?.is_owner === true;

      let purchaseValid = false;
      let subscriptionValid = false;

      if (!isSample) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select("id, purchase_type, expires_at")
          .eq("user_id", user.id)
          .eq("film_id", film.id)
          .in("purchase_type", ["rent", "buy"])
          .order("created_at", { ascending: false })
          .limit(10);

        purchaseValid = (purchases || []).some((purchase) => {
          if (purchase.purchase_type === "buy") return true;
          return (
            purchase.purchase_type === "rent" &&
            (!purchase.expires_at ||
              new Date(purchase.expires_at) > new Date())
          );
        });

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .or("ends_at.is.null,ends_at.gt.now()")
          .limit(1)
          .maybeSingle();

        subscriptionValid = Boolean(sub);
      }

      if (cancelled) return;

      setIsPrivileged(privileged);
      setHasPurchase(purchaseValid);
      setHasSubscription(subscriptionValid);

      const allowed =
        !isPaidFilm ||
        privileged ||
        (isSubscriptionFilm && subscriptionValid) ||
        ((accessType === "paid" || accessType === "rent") &&
          purchaseValid);

      setHasAccess(allowed);
      setCheckingAccess(false);
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [film.id, isSample, accessType, isPaidFilm, isSubscriptionFilm]);

  async function requestVideoUrl() {
    setVideoError("");
    setVideoUrl("");

    if (!film.id) {
      setVideoError("This film has no database ID.");
      return;
    }

    if (isSample) {
      if (film.video_url) {
        setVideoUrl(film.video_url);
      } else {
        setVideoError("This sample film has no video URL.");
      }
      return;
    }

    if (isPaidFilm && !hasAccess) {
      setVideoError("You do not currently have access to this film.");
      return;
    }

    setLoadingVideo(true);

    try {
      if (!film.video_path && film.video_url && !isPaidFilm) {
        setVideoUrl(film.video_url);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "get-film-stream",
        {
          body: { film_id: film.id },
        },
      );

      if (error) throw error;

      if (!data?.url) {
        throw new Error(data?.error || "The function returned no video URL.");
      }

      setVideoUrl(data.url);
    } catch (error) {
      console.error("Playback request failed:", error);
      setVideoError(error.message || "Could not authorize playback.");
    } finally {
      setLoadingVideo(false);
    }
  }

  async function handleBuyFilm() {
    setMessage("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setMessage("Please sign in before purchasing a film.");
      return;
    }

    if (!film.paddle_price_id) {
      setMessage("This film does not have a Paddle price configured yet.");
      return;
    }

    setBuyingFilm(true);

    try {
      await buyItem({
        priceId: film.paddle_price_id,
        customData: {
          user_id: user.id,
          product_id: film.id,
          product_type: "film",
        },
      });

      setMessage("Paddle checkout opened. Complete payment to unlock playback.");
    } catch (err) {
      console.error("Buy film failed:", err);
      setMessage(err?.message || "Could not open Paddle checkout.");
    } finally {
      setBuyingFilm(false);
    }
  }

  async function saveWatchProgress() {
    const video = videoRef.current;

    if (isSample || !film.id || !video?.duration) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const durationSeconds = Math.floor(video.duration);
    const secondsWatched = Math.floor(video.currentTime);

    const { error } = await supabase.from("watch_progress").upsert(
      {
        user_id: user.id,
        film_id: film.id,
        seconds_watched: secondsWatched,
        duration_seconds: durationSeconds,
        completed:
          durationSeconds > 0 &&
          secondsWatched >= durationSeconds * 0.95,
      },
      { onConflict: "user_id,film_id" },
    );

    if (error) console.error("Could not save watch progress:", error);
  }

  async function submitComment(event) {
    event.preventDefault();

    const text = commentText.trim();

    if (!currentUserId) {
      setMessage("Sign in to post a comment.");
      return;
    }

    if (isSample) {
      setMessage("Comments are available on uploaded films.");
      return;
    }

    if (!text) {
      setMessage("Write a comment first.");
      return;
    }

    setPostingComment(true);
    setMessage("");

    const { data, error } = await supabase
      .from("film_comments")
      .insert({
        film_id: film.id,
        user_id: currentUserId,
        comment_text: text,
      })
      .select("id, film_id, user_id, comment_text, created_at")
      .single();

    if (error) {
      setMessage(error.message || "Your comment could not be posted.");
    } else {
      setComments((current) => [data, ...current]);
      setCommentText("");
    }

    setPostingComment(false);
  }

  async function deleteComment(commentId) {
    if (!window.confirm("Delete this comment? This cannot be undone.")) {
      return;
    }

    const { error } = await supabase
      .from("film_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", currentUserId);

    if (error) {
      setMessage(error.message || "Comment could not be deleted.");
      return;
    }

    setComments((current) =>
      current.filter((comment) => comment.id !== commentId),
    );
  }

  function renderAccessMessage() {
    if (checkingAccess) {
      return <p className="media-status">Checking watch access…</p>;
    }

    if (hasAccess) {
      return null;
    }

    if (isSubscriptionFilm) {
      return (
        <div className="film-paywall">
          <h2>Subscription required</h2>
          <p>Choose an active membership to watch this film.</p>
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

    return (
      <div className="film-paywall">
        <h2>Purchase required</h2>
        <p>Purchase this film to unlock full playback.</p>
        <button
          className="media-watch-button"
          type="button"
          onClick={handleBuyFilm}
          disabled={buyingFilm || !film.paddle_price_id}
        >
          {buyingFilm
            ? "Opening checkout…"
            : film.paddle_price_id
              ? `Buy film (${formatCurrency(film.price_cents)})`
              : "Payment not configured"}
        </button>
      </div>
    );
  }

  return (
    <section className="film-details-page section-page">
      <button className="back-button" type="button" onClick={onBack}>
        ← Back to films
      </button>

      <div className="film-details-layout">
        <div className="film-details-main">
          <div className="film-player-panel">
            {checkingAccess ? (
              <div className="film-video-empty">
                <h2>Checking access…</h2>
              </div>
            ) : isPaidFilm && !hasAccess ? (
              renderAccessMessage()
            ) : videoUrl ? (
              <video
                key={videoUrl}
                ref={videoRef}
                className="film-details-video"
                src={videoUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
                onPause={saveWatchProgress}
                onEnded={saveWatchProgress}
                onError={() =>
                  setVideoError(
                    "The video URL was returned, but the browser could not play it. Check that the file is in the selected bucket and encoded in a browser-supported format.",
                  )
                }
              />
            ) : (
              <div className="film-video-empty">
                <span aria-hidden="true">
                  {isPrivileged || hasAccess ? "▶" : "🔒"}
                </span>

                <h2>
                  {loadingVideo
                    ? "Preparing video…"
                    : videoError
                      ? "Video could not be opened"
                      : "Ready to watch?"}
                </h2>

                {videoError && (
                  <p className="media-access-message" role="alert">
                    {videoError}
                  </p>
                )}

                {!videoError && !loadingVideo && (
                  <p>Press play to request the film video.</p>
                )}

                {!loadingVideo && (
                  <button
                    className="media-watch-button"
                    type="button"
                    onClick={requestVideoUrl}
                    disabled={!hasAccess}
                  >
                    {videoError ? "Try again" : "Play film"}
                  </button>
                )}
              </div>
            )}
          </div>

          <section className="film-info-panel">
            <p className="eyebrow">FILM DETAILS</p>
            <h1>{film.title}</h1>

            <div className="film-details-meta">
              <span>{film.year || "Unknown year"}</span>
              <span>{film.duration || "Unknown duration"}</span>
              <span>{film.genre || "Film"}</span>
              <span>★ {film.rating || "0"}</span>
              <span>
                {accessType === "subscription"
                  ? "Subscription"
                  : accessType === "paid" || accessType === "rent"
                    ? "Paid"
                    : "Free"}
              </span>
            </div>

            <p className="film-description">
              {film.description || "No description has been added yet."}
            </p>

            {message && (
              <p className="comment-message" role="status">
                {message}
              </p>
            )}
          </section>
        </div>

        <aside className="film-info-panel film-access-panel">
          <p className="eyebrow">WATCH ACCESS</p>

          {checkingAccess ? (
            <p>Checking access…</p>
          ) : hasAccess ? (
            <>
              <h2>Available to watch</h2>
              <p>
                {accessType === "free"
                  ? "This film is free."
                  : "Your account has access to this film."}
              </p>

              {!videoUrl && (
                <button
                  className="media-watch-button"
                  type="button"
                  onClick={requestVideoUrl}
                  disabled={loadingVideo}
                >
                  {loadingVideo ? "Preparing…" : "Play film"}
                </button>
              )}
            </>
          ) : (
            <>
              <h2>
                {isSubscriptionFilm
                  ? "Membership required"
                  : "Purchase required"}
              </h2>
              <p>
                {isSubscriptionFilm
                  ? "Subscribe to unlock this film."
                  : "Purchase this film to unlock playback."}
              </p>

              {isSubscriptionFilm ? (
                <button
                  className="media-watch-button"
                  type="button"
                  onClick={onNavigateToSubscriptions}
                >
                  View subscription plans
                </button>
              ) : (
                <button
                  className="media-watch-button"
                  type="button"
                  onClick={handleBuyFilm}
                  disabled={buyingFilm || !film.paddle_price_id}
                >
                  {buyingFilm
                    ? "Opening checkout…"
                    : film.paddle_price_id
                      ? `Buy for ${formatCurrency(film.price_cents)}`
                      : "Price not configured"}
                </button>
              )}
            </>
          )}
        </aside>
      </div>

      <section className="related-films-section">
        <div className="details-section-heading">
          <div>
            <p className="eyebrow">KEEP EXPLORING</p>
            <h2>Related films</h2>
          </div>
        </div>

        {relatedFilms.length === 0 ? (
          <p className="media-status">No related films yet.</p>
        ) : (
          <div className="related-films-grid">
            {relatedFilms.map((item) => (
              <button
                className="related-film-card"
                type="button"
                key={item.id}
                onClick={() => onOpenFilm(item)}
              >
                <div
                  className="related-film-art"
                  style={
                    item.poster_url
                      ? {
                          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.82)), url("${item.poster_url}")`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }
                      : {
                          "--related-film-color": item.color || "#172554",
                        }
                  }
                >
                  <span>{item.genre}</span>
                  <strong>★ {item.rating}</strong>
                </div>

                <div className="related-film-body">
                  <h3>{item.title}</h3>
                  <p>
                    {item.year} · {item.duration}
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

        {isSample ? (
          <p className="media-status">
            Comments are available on uploaded films.
          </p>
        ) : (
          <>
            {currentUserId ? (
              <form className="comment-form" onSubmit={submitComment}>
                <textarea
                  value={commentText}
                  onChange={(event) =>
                    setCommentText(event.target.value.slice(0, 1000))
                  }
                  maxLength={1000}
                  rows={4}
                  placeholder={`Share your thoughts about ${film.title}...`}
                  disabled={postingComment}
                />

                <div className="comment-form-footer">
                  <span>{commentText.length}/1000</span>

                  <button
                    className="media-watch-button"
                    type="submit"
                    disabled={postingComment || !commentText.trim()}
                  >
                    {postingComment ? "Posting…" : "Post comment"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="media-status">
                Sign in to comment. Existing comments are visible below.
              </p>
            )}

            {loadingComments ? (
              <p className="media-status">Loading comments…</p>
            ) : comments.length === 0 ? (
              <div className="comments-empty">
                <h3>Be the first to comment</h3>
                <p>Start the discussion about this film.</p>
              </div>
            ) : (
              <div className="comments-list">
                {comments.map((comment) => (
                  <article className="comment-card" key={comment.id}>
                    <div className="comment-avatar" aria-hidden="true">
                      {comment.user_id === currentUserId ? "Y" : "S"}
                    </div>

                    <div className="comment-content">
                      <div className="comment-header">
                        <strong>
                          {comment.user_id === currentUserId
                            ? "You"
                            : "Sivilization member"}
                        </strong>

                        <time dateTime={comment.created_at}>
                          {new Date(comment.created_at).toLocaleString()}
                        </time>
                      </div>

                      <p>{comment.comment_text}</p>
                    </div>

                    {comment.user_id === currentUserId && (\
                      <button
                        className="comment-delete-button"
                        type="button"
                        onClick={() => deleteComment(comment.id)}
                      >
                        Delete
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </section>
  );
}

export default FilmDetailsPage;
