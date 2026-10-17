import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { FunctionsHttpError } from "@supabase/supabase-js";

const EMPTY_FORM = {
  id: null,
  title: "",
  description: "",
  genre: "Drama",
  releaseYear: "",
  duration: "",
  accessType: "free",
  price: "",
  isPublished: false,
  videoPath: null,
  posterPath: null,
  storedVideoBucket: null,
};

const BUCKETS = {
  freeVideos: "films-free",
  paidVideos: "films-paid",
  posters: "film-posters",
};

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

function formatDate(value) {
  if (!value) return "Unknown date";

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";

  const megabytes = bytes / 1024 / 1024;
  return megabytes >= 1
    ? `${megabytes.toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

function makeSafeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-");
}

function getPosterUrl(path, bucket = BUCKETS.posters) {
  if (!path) return null;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

function bucketForAccess(accessType) {
  return accessType === "free" ? BUCKETS.freeVideos : BUCKETS.paidVideos;
}

function getErrorMessage(error) {
  return error?.message || "An unexpected error occurred.";
}

async function createFilmPrice(filmId) {
  const { data, error } = await supabase.functions.invoke(
    "create-film-price",
    {
      body: { film_id: filmId },
    },
  );

  if (error) {
    let message = error.message || "Could not create Paddle price.";

    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        message = body?.error || message;
      } catch {
        // Keep the original error if the response is not JSON.
      }
    }

    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.priceId) {
    throw new Error("The function returned no Paddle price ID.");
  }

  return data.priceId;
}

export default function FilmStudioPage({ onBack }) {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasStudioAccess, setHasStudioAccess] = useState(false);
  const [films, setFilms] = useState([]);
  const [loadingFilms, setLoadingFilms] = useState(true);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [videoFile, setVideoFile] = useState(null);
  const [posterFile, setPosterFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const formRef = useRef(null);

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setVideoFile(null);
    setPosterFile(null);
    setMessage("");

    if (formRef.current) formRef.current.reset();
  }

  async function removeStorageFile(bucket, path) {
    if (!bucket || !path) return;

    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error(`Could not remove ${bucket}/${path}:`, error);
    }
  }

  async function uploadStorageFile(bucket, path, file) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) {
      throw new Error(`${bucket} upload failed: ${error.message}`);
    }
  }

  async function loadFilmStudio() {
    setCheckingAccess(true);
    setLoadingFilms(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setHasStudioAccess(false);
        setFilms([]);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin, is_owner")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const allowed =
        profile?.is_admin === true || profile?.is_owner === true;

      setHasStudioAccess(allowed);

      if (!allowed) {
        setFilms([]);
        return;
      }

      const { data, error } = await supabase
        .from("films")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setFilms(data || []);
    } catch (error) {
      console.error("Could not load Film Studio:", error);
      showMessage(
        `Could not load Film Studio: ${getErrorMessage(error)}`,
        "error"
      );
    } finally {
      setCheckingAccess(false);
      setLoadingFilms(false);
    }
  }

  useEffect(() => {
    loadFilmStudio();
  }, []);

  function handleVideoChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setVideoFile(null);
      return;
    }

    if (!file.type.startsWith("video/")) {
      event.target.value = "";
      setVideoFile(null);
      showMessage("Choose a valid video file.", "error");
      return;
    }

    setVideoFile(file);
    setMessage("");
  }

  function handlePosterChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setPosterFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      setPosterFile(null);
      showMessage("Choose a valid poster image.", "error");
      return;
    }

    setPosterFile(file);
    setMessage("");
  }

  function startEditing(film) {
    setForm({
      id: film.id,
      title: film.title || "",
      description: film.description || "",
      genre: film.genre || "Drama",
      releaseYear: film.release_year ? String(film.release_year) : "",
      duration: film.duration || "",
      accessType: film.access_type || "free",
      price:
        film.access_type === "rent" || film.access_type === "paid"
          ? ((Number(film.price_cents) || 0) / 100).toFixed(2)
          : "",
      isPublished: film.is_published !== false,
      videoPath: film.video_path || null,
      posterPath: film.poster_path || null,
      storedVideoBucket:
        film.video_bucket ||
        (film.access_type === "free"
          ? BUCKETS.freeVideos
          : BUCKETS.paidVideos),
    });

    setVideoFile(null);
    setPosterFile(null);
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveFilm(event) {
    event.preventDefault();
    setMessage("");

    if (!form.title.trim()) {
      showMessage("Enter a film title.", "error");
      return;
    }

    if (!form.videoPath && !videoFile) {
      showMessage("Choose a video file.", "error");
      return;
    }

    const isPaidFilmType =
      form.accessType === "paid" || form.accessType === "rent";

    if (
      isPaidFilmType &&
      (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0)
    ) {
      showMessage("Enter a valid price greater than $0.00.", "error");
      return;
    }

    setSaving(true);

    let uploadedVideoBucket = null;
    let uploadedVideoPath = null;
    let uploadedPosterPath = null;
    let databaseSaveCompleted = false;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Sign in to manage films.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin, is_owner")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_admin && !profile?.is_owner) {
        throw new Error("Only owners and admins can manage films.");
      }

      const targetVideoBucket = bucketForAccess(form.accessType);
      let videoPath = form.videoPath;
      let posterPath = form.posterPath;
      let videoBucket = form.storedVideoBucket || targetVideoBucket;

      if (videoFile) {
        const safeName = makeSafeFileName(videoFile.name);
        uploadedVideoPath = `videos/${crypto.randomUUID()}-${safeName}`;
        uploadedVideoBucket = targetVideoBucket;

        await uploadStorageFile(
          uploadedVideoBucket,
          uploadedVideoPath,
          videoFile
        );

        videoPath = uploadedVideoPath;
        videoBucket = uploadedVideoBucket;
      }

      if (posterFile) {
        const safeName = makeSafeFileName(posterFile.name);
        uploadedPosterPath = `posters/${crypto.randomUUID()}-${safeName}`;

        await uploadStorageFile(
          BUCKETS.posters,
          uploadedPosterPath,
          posterFile
        );

        posterPath = uploadedPosterPath;
      }

      const filmData = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        genre: form.genre,
        release_year: Number(form.releaseYear) || null,
        duration: form.duration.trim() || null,
        access_type: form.accessType,
        is_paid: isPaidFilmType,
        price_cents: isPaidFilmType
          ? Math.round(Number(form.price) * 100)
          : 0,
        video_path: videoPath,
        poster_path: posterPath,
        created_by: user.id,
        is_published: form.isPublished,
        updated_at: new Date().toISOString(),
      };

      let savedFilm;
      let saveError;

      const payloadWithBucket = {
        ...filmData,
        video_bucket: videoBucket,
      };

      if (form.id) {
        const result = await supabase
          .from("films")
          .update(payloadWithBucket)
          .eq("id", form.id)
          .select()
          .single();

        savedFilm = result.data;
        saveError = result.error;
      } else {
        const result = await supabase
          .from("films")
          .insert(payloadWithBucket)
          .select()
          .single();

        savedFilm = result.data;
        saveError = result.error;
      }

      if (saveError?.message?.includes("video_bucket")) {
        const retry = form.id
          ? await supabase
              .from("films")
              .update(filmData)
              .eq("id", form.id)
              .select()
              .single()
          : await supabase
              .from("films")
              .insert(filmData)
              .select()
              .single();

        savedFilm = retry.data;
        saveError = retry.error;
      }

      if (saveError) throw saveError;

      databaseSaveCompleted = true;
      console.log("FILM SAVE CHECK", {
        accessType: form.accessType,
        isPaidFilmType,
        filmId: savedFilm?.id,
        paddlePriceId: savedFilm?.paddle_price_id,
      });

      const oldVideoBucket =
        form.storedVideoBucket ||
        (form.accessType === "free"
          ? BUCKETS.freeVideos
          : BUCKETS.paidVideos);

      if (uploadedVideoPath && form.videoPath) {
        await removeStorageFile(oldVideoBucket, form.videoPath);
      }

      if (uploadedPosterPath && form.posterPath) {
        await removeStorageFile(BUCKETS.posters, form.posterPath);
      }

      let priceMessage = "";

      if (
        isPaidFilmType &&
        savedFilm?.id &&
        !savedFilm.paddle_price_id
      ) {
        showMessage("Creating Paddle checkout price…");

        try {
          const priceId = await createFilmPrice(savedFilm.id);

        if (priceId) {
          savedFilm = {
            ...savedFilm,
            paddle_price_id: priceId,
          };

          priceMessage = " Paddle checkout price was created automatically.";
        } else {
            priceMessage =
              " However, Paddle did not return a checkout price ID.";
          }
        } catch (priceError) {
          console.error("Could not create Paddle price:", priceError);

          priceMessage =
            ` However, Paddle price creation failed: ${
              priceError?.message || "Unknown error"
            }`;
        }
      }

      setFilms((current) =>
        form.id
          ? current.map((film) =>
              film.id === savedFilm.id ? savedFilm : film
            )
          : [savedFilm, ...current]
      );

      resetForm();

      showMessage(
        `${savedFilm.title} was saved successfully.${priceMessage}`,
        priceMessage.includes("failed") || priceMessage.includes("did not")
          ? "error"
          : "success"
      );
      resetForm();
    } catch (error) {
      console.error("Could not save film:", error);

      if (!databaseSaveCompleted) {
        if (uploadedVideoBucket && uploadedVideoPath) {
          await removeStorageFile(uploadedVideoBucket, uploadedVideoPath);
        }
        if (uploadedPosterPath) {
          await removeStorageFile(BUCKETS.posters, uploadedPosterPath);
        }
      }

      showMessage(
        `Could not save film: ${getErrorMessage(error)}`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(film) {
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("films")
        .update({
          is_published: !film.is_published,
          updated_at: new Date().toISOString(),
        })
        .eq("id", film.id)
        .select()
        .single();

      if (error) throw error;

      setFilms((current) =>
        current.map((item) => (item.id === data.id ? data : item))
      );

      showMessage(
        data.is_published
          ? `${data.title} is now published.`
          : `${data.title} is now unpublished.`,
        "success"
      );
    } catch (error) {
      showMessage(
        `Could not update film publication status: ${getErrorMessage(error)}`,
        "error"
      );
    }
  }

  async function deleteFilm(film) {
    const confirmed = window.confirm(
      `Delete "${film.title}"? This permanently removes the film record and its files.`
    );

    if (!confirmed) return;

    setDeletingId(film.id);
    setMessage("");

    try {
      const { error } = await supabase
        .from("films")
        .delete()
        .eq("id", film.id);

      if (error) throw error;

      const videoBucket =
        film.video_bucket ||
        (film.access_type === "free"
          ? BUCKETS.freeVideos
          : BUCKETS.paidVideos);

      await removeStorageFile(videoBucket, film.video_path);
      await removeStorageFile(BUCKETS.posters, film.poster_path);

      setFilms((current) =>
        current.filter((item) => item.id !== film.id)
      );

      if (form.id === film.id) resetForm();

      showMessage(`${film.title} was deleted.`, "success");
    } catch (error) {
      showMessage(
        `Could not delete film: ${getErrorMessage(error)}`,
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (checkingAccess) {
    return (
      <section className="section-page">
        <p className="media-status">Checking owner/admin permissions...</p>
      </section>
    );
  }

  if (!hasStudioAccess) {
    return (
      <section className="section-page">
        <div className="admin-no-access">
          <p className="eyebrow">RESTRICTED</p>
          <h1>Owner or admin access required</h1>
          <p>Only owners and administrators can open Film Studio.</p>
          <button type="button" onClick={onBack}>
            Return to admin dashboard
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section-page studio-page">
      <div className="studio-page-header">
        <div>
          <p className="eyebrow">ADMINISTRATION / FILM STUDIO</p>
          <h1>Film Studio</h1>
          <p>
            Upload, publish, edit and manage films, cartoons and dramas.
          </p>
        </div>

        <button className="studio-back-button" type="button" onClick={onBack}>
          ← Back to admin
        </button>
      </div>

      <section className="admin-upload-panel film-management-panel">
        <div className="admin-upload-header">
          <div>
            <p className="eyebrow">
              {form.id ? "EDIT FILM" : "ADD NEW FILM"}
            </p>
            <h2>
              {form.id ? `Editing: ${form.title}` : "Film information"}
            </h2>
            <p>
              Free videos upload to the public `films-free` bucket.
              Paid, rental, and subscription videos upload to the private
              `films-paid` bucket. Posters go to `film-posters`.
            </p>
          </div>

          <div className="admin-badge">Owner / admin</div>
        </div>

        <form
          ref={formRef}
          className="admin-upload-form"
          onSubmit={handleSaveFilm}
        >
          <div className="admin-form-section">
            <div className="admin-section-title">
              <span>01</span>
              <div>
                <h3>Film details</h3>
                <p>Information customers see in the media catalogue.</p>
              </div>
            </div>

            <div className="admin-form-grid">
              <label className="admin-field admin-field-wide">
                <span>
                  Film title <b>*</b>
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    updateForm("title", event.target.value)
                  }
                  placeholder="Example: The Last Horizon"
                  disabled={saving}
                  required
                />
              </label>

              <label className="admin-field">
                <span>Genre</span>
                <select
                  value={form.genre}
                  onChange={(event) =>
                    updateForm("genre", event.target.value)
                  }
                  disabled={saving}
                >
                  <option>Action</option>
                  <option>Adventure</option>
                  <option>Comedy</option>
                  <option>Crime</option>
                  <option>Documentary</option>
                  <option>Drama</option>
                  <option>Fantasy</option>
                  <option>Horror</option>
                  <option>Romance</option>
                  <option>Sci-Fi</option>
                  <option>Thriller</option>
                </select>
              </label>

              <label className="admin-field">
                <span>Release year</span>
                <input
                  type="number"
                  min="1888"
                  max="2100"
                  value={form.releaseYear}
                  onChange={(event) =>
                    updateForm("releaseYear", event.target.value)
                  }
                  placeholder="2026"
                  disabled={saving}
                />
              </label>

              <label className="admin-field">
                <span>Duration</span>
                <input
                  type="text"
                  value={form.duration}
                  onChange={(event) =>
                    updateForm("duration", event.target.value)
                  }
                  placeholder="2h 10m"
                  disabled={saving}
                />
              </label>

              <label className="admin-field">
                <span>Access type</span>
                <select
                  value={form.accessType}
                  onChange={(event) =>
                    updateForm("accessType", event.target.value)
                  }
                  disabled={saving}
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid — buy forever</option>
                  <option value="rent">Rental</option>
                  <option value="subscription">Subscription only</option>
                </select>
              </label>

              {(form.accessType === "paid" ||
                form.accessType === "rent") && (
                <label className="admin-field">
                  <span>
                    {form.accessType === "rent"
                      ? "Rental price in USD"
                      : "Purchase price in USD"}{" "}
                    <b>*</b>
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      updateForm("price", event.target.value)
                    }
                    placeholder="3.99"
                    disabled={saving}
                    required
                  />
                  <small>
                    A Paddle checkout price will be created automatically.
                  </small>
                </label>
              )}

              <label className="admin-field admin-field-wide">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  placeholder="Write a short description of the film..."
                  rows={5}
                  disabled={saving}
                />
              </label>
            </div>
          </div>

          <div className="admin-form-section">
            <div className="admin-section-title">
              <span>02</span>
              <div>
                <h3>Film files</h3>
                <p>Upload a video and optional poster.</p>
              </div>
            </div>

            <div className="admin-file-grid">
              <label className="admin-file-card admin-video-file">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoChange}
                  disabled={saving}
                  required={!form.videoPath}
                />
                <span className="admin-file-icon">▶</span>
                <strong>
                  {form.videoPath
                    ? "Replace video file"
                    : "Choose video file"}
                </strong>
                <small>MP4, WebM or MOV · Required</small>
                {videoFile && (
                  <span className="selected-file">
                    {videoFile.name}
                    <br />
                    {formatFileSize(videoFile.size)}
                  </span>
                )}
                {!videoFile && form.videoPath && (
                  <span className="selected-file">
                    Current video saved
                  </span>
                )}
              </label>

              <label className="admin-file-card">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePosterChange}
                  disabled={saving}
                />
                <span className="admin-file-icon">▧</span>
                <strong>
                  {form.posterPath
                    ? "Replace poster image"
                    : "Choose poster image"}
                </strong>
                <small>PNG, JPG or WebP · Optional</small>
                {posterFile && (
                  <span className="selected-file">
                    {posterFile.name}
                    <br />
                    {formatFileSize(posterFile.size)}
                  </span>
                )}
                {!posterFile && form.posterPath && (
                  <span className="selected-file">
                    Current poster saved
                  </span>
                )}
              </label>
            </div>
          </div>

          <div className="admin-form-section">
            <div className="admin-section-title">
              <span>03</span>
              <div>
                <h3>Visibility</h3>
                <p>Publish now or keep this film hidden as a draft.</p>
              </div>
            </div>

            <label className="publish-toggle">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(event) =>
                  updateForm("isPublished", event.target.checked)
                }
                disabled={saving}
              />
              <span className="publish-toggle-control" />
              <span>
                <strong>
                  {form.isPublished
                    ? "Publish this film"
                    : "Keep as draft"}
                </strong>
                <small>
                  {form.isPublished
                    ? "Customers can see this film in Media."
                    : "Only owners/admins can see this film in Film Studio."}
                </small>
              </span>
            </label>
          </div>

          <div className="admin-upload-footer">
            <p className="admin-required-note">
              <b>*</b> Required fields
            </p>

            <div className="game-form-actions">
              {form.id && (
                <button
                  className="game-reset-button"
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel edit
                </button>
              )}

              <button
                className="admin-upload-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving film..."
                  : form.id
                    ? "Save changes"
                    : form.isPublished
                      ? "Publish film"
                      : "Save draft"}
              </button>
            </div>
          </div>

          {message && (
            <p
              className={`admin-upload-message ${messageType}`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          )}
        </form>
      </section>

      <section className="game-manager-section film-manager-section">
        <div className="game-manager-heading">
          <div>
            <p className="eyebrow">FILM MANAGEMENT</p>
            <h2>My films</h2>
            <p>
              Manage drafts, published films, access types and media files.
            </p>
          </div>

          <button
            className="game-refresh-button"
            type="button"
            onClick={loadFilmStudio}
            disabled={loadingFilms}
          >
            {loadingFilms ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingFilms ? (
          <p className="media-status">Loading your films...</p>
        ) : films.length === 0 ? (
          <div className="game-manager-empty">
            <h3>No films uploaded yet</h3>
            <p>Add your first film above.</p>
          </div>
        ) : (
          <div className="game-manager-list">
            {films.map((film) => {
              const posterUrl = getPosterUrl(film.poster_path);

              return (
                <article
                  className="game-manager-card film-manager-card"
                  key={film.id}
                >
                  <div
                    className="game-manager-cover film-manager-cover"
                    style={
                      posterUrl
                        ? {
                            backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.25), rgba(15, 23, 42, 0.8)), url("${posterUrl}")`,
                          }
                        : undefined
                    }
                  >
                    {!posterUrl && <span>🎬</span>}
                    <span
                      className={
                        film.is_published
                          ? "game-status published"
                          : "game-status draft"
                      }
                    >
                      {film.is_published ? "Published" : "Draft"}
                    </span>
                  </div>

                  <div className="game-manager-info">
                    <div className="game-manager-title-row">
                      <div>
                        <h3>{film.title}</h3>
                        <p>
                          {film.genre || "Film"} ·{" "}
                          {film.release_year || "Unknown year"} ·{" "}
                          {film.duration || "Unknown duration"}
                        </p>
                      </div>

                      <strong>
                        {film.access_type === "rent" ||
                        film.access_type === "paid"
                          ? formatCurrency(film.price_cents)
                          : film.access_type === "subscription"
                            ? "Subscription"
                            : "Free"}
                      </strong>
                    </div>

                    <p className="game-manager-description">
                      {film.description || "No description added yet."}
                    </p>

                    <div className="game-manager-meta">
                      <span>
                        Access:{" "}
                        {film.access_type === "subscription"
                          ? "Subscription only"
                          : film.access_type === "rent"
                            ? "Rental"
                            : film.access_type === "paid"
                              ? "Paid"
                              : "Free"}
                      </span>
                      <span>Created: {formatDate(film.created_at)}</span>
                    </div>

                    <div className="game-manager-actions">
                      <button
                        className="game-edit-button"
                        type="button"
                        onClick={() => startEditing(film)}
                      >
                        Edit
                      </button>

                      <button
                        className={
                          film.is_published
                            ? "game-unpublish-button"
                            : "game-publish-button"
                        }
                        type="button"
                        onClick={() => togglePublished(film)}
                      >
                        {film.is_published ? "Unpublish" : "Publish"}
                      </button>

                      <button
                        className="game-delete-button"
                        type="button"
                        onClick={() => deleteFilm(film)}
                        disabled={deletingId === film.id}
                      >
                        {deletingId === film.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}