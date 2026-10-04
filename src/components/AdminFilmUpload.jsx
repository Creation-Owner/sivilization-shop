import { useState } from "react";
import { supabase } from "../supabaseClient";

function AdminFilmUpload() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("Drama");
  const [releaseYear, setReleaseYear] = useState("");
  const [duration, setDuration] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [posterFile, setPosterFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function formatFileSize(bytes) {
    if (!bytes) {
      return "0 KB";
    }

    const megabytes = bytes / 1024 / 1024;

    if (megabytes >= 1) {
      return `${megabytes.toFixed(1)} MB`;
    }

    return `${Math.ceil(bytes / 1024)} KB`;
  }

  function makeSafeFileName(fileName) {
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/-+/g, "-");
  }

  function handleVideoChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setVideoFile(null);
      return;
    }

    if (!file.type.startsWith("video/")) {
      showMessage("Please choose a valid video file.", "error");
      event.target.value = "";
      setVideoFile(null);
      return;
    }

    setVideoFile(file);
    showMessage("");
  }

  function handlePosterChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setPosterFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      showMessage("Please choose a valid poster image.", "error");
      event.target.value = "";
      setPosterFile(null);
      return;
    }

    setPosterFile(file);
    showMessage("");
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!title.trim()) {
      showMessage("Please enter a film title.", "error");
      return;
    }

    if (!videoFile) {
      showMessage("Please choose a video file.", "error");
      return;
    }

    setLoading(true);
    showMessage("Uploading your film...", "info");

    let videoPath = null;
    let posterPath = null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in as an administrator.");
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();

      if (profileError) {
        throw profileError;
      }

      if (!profile?.is_admin) {
        throw new Error("Only administrators can upload films.");
      }

      const fileId = crypto.randomUUID();
      const videoName = makeSafeFileName(videoFile.name);

      videoPath = `videos/${fileId}-${videoName}`;

      const { error: videoError } = await supabase.storage
        .from("films")
        .upload(videoPath, videoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: videoFile.type,
        });

      if (videoError) {
        throw videoError;
      }

      if (posterFile) {
        const posterId = crypto.randomUUID();
        const posterName = makeSafeFileName(posterFile.name);

        posterPath = `posters/${posterId}-${posterName}`;

        const { error: posterError } = await supabase.storage
          .from("films")
          .upload(posterPath, posterFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: posterFile.type,
          });

        if (posterError) {
          throw posterError;
        }
      }

      const { error: filmError } = await supabase
        .from("films")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          genre,
          release_year: Number(releaseYear) || null,
          duration: duration.trim() || null,
          rating: 0,
          video_path: videoPath,
          poster_path: posterPath,
          created_by: user.id,
        });

      if (filmError) {
        throw filmError;
      }

      setTitle("");
      setDescription("");
      setGenre("Drama");
      setReleaseYear("");
      setDuration("");
      setVideoFile(null);
      setPosterFile(null);

      event.target.reset();

      showMessage("Film uploaded successfully.", "success");
    } catch (error) {
      if (videoPath) {
        await supabase.storage
          .from("films")
          .remove([videoPath]);
      }

      if (posterPath) {
        await supabase.storage
          .from("films")
          .remove([posterPath]);
      }

      showMessage(error.message || "Upload failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-upload-panel">
      <div className="admin-upload-header">
        <div>
          <p className="eyebrow">ADMIN TOOLS</p>

          <h2>Upload a new film</h2>

          <p>
            Add the film information first, then choose the video file
            that users will watch.
          </p>
        </div>

        <div className="admin-badge">
          Admin only
        </div>
      </div>

      <form
        className="admin-upload-form"
        onSubmit={handleUpload}
      >
        <div className="admin-form-section">
          <div className="admin-section-title">
            <span>01</span>
            <div>
              <h3>Film information</h3>
              <p>Tell users what this film is about.</p>
            </div>
          </div>

          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">
              <span>
                Film title <b>*</b>
              </span>

              <input
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Example: The Last Horizon"
                disabled={loading}
                required
              />
            </label>

            <label className="admin-field">
              <span>Genre</span>

              <select
                value={genre}
                onChange={(event) =>
                  setGenre(event.target.value)
                }
                disabled={loading}
              >
                <option>Drama</option>
                <option>Action</option>
                <option>Comedy</option>
                <option>Crime</option>
                <option>Documentary</option>
                <option>Sci-Fi</option>
                <option>Thriller</option>
                <option>Romance</option>
              </select>
            </label>

            <label className="admin-field">
              <span>Release year</span>

              <input
                type="number"
                min="1888"
                max="2100"
                value={releaseYear}
                onChange={(event) =>
                  setReleaseYear(event.target.value)
                }
                placeholder="2026"
                disabled={loading}
              />
            </label>

            <label className="admin-field">
              <span>Duration</span>

              <input
                type="text"
                value={duration}
                onChange={(event) =>
                  setDuration(event.target.value)
                }
                placeholder="2h 10m"
                disabled={loading}
              />
            </label>

            <label className="admin-field admin-field-wide">
              <span>Description</span>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Write a short description of the film..."
                rows="5"
                disabled={loading}
              />
            </label>
          </div>
        </div>

        <div className="admin-form-section">
          <div className="admin-section-title">
            <span>02</span>
            <div>
              <h3>Film files</h3>
              <p>Choose the video and optional poster image.</p>
            </div>
          </div>

          <div className="admin-file-grid">
            <label className="admin-file-card admin-video-file">
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoChange}
                disabled={loading}
                required
              />

              <span className="admin-file-icon">▶</span>

              <strong>Choose video file</strong>

              <small>
                MP4, WebM or MOV
                <br />
                Required
              </small>

              {videoFile && (
                <span className="selected-file">
                  {videoFile.name}
                  <br />
                  {formatFileSize(videoFile.size)}
                </span>
              )}
            </label>

            <label className="admin-file-card">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePosterChange}
                disabled={loading}
              />

              <span className="admin-file-icon">▧</span>

              <strong>Choose poster image</strong>

              <small>
                PNG, JPG or WebP
                <br />
                Optional
              </small>

              {posterFile && (
                <span className="selected-file">
                  {posterFile.name}
                  <br />
                  {formatFileSize(posterFile.size)}
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="admin-upload-footer">
          <p className="admin-required-note">
            <b>*</b> Required fields
          </p>

          <button
            className="admin-upload-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Uploading film..." : "Upload film"}
          </button>
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
  );
}

export default AdminFilmUpload;