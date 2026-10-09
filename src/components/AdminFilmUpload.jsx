import { useState } from "react";
import { supabase } from "../supabaseClient";

const MAX_POSTER_BYTES = 10 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const ALLOWED_POSTER_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function safeFileName(fileName) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "upload";
}

function AdminFilmUpload({ onUploaded }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("Drama");
  const [releaseYear, setReleaseYear] = useState("");
  const [duration, setDuration] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [posterFile, setPosterFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [progress, setProgress] = useState(0);

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function handleVideoChange(event) {
    const file = event.target.files?.[0] || null;
    setVideoFile(null);
    if (!file) return;

    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      event.target.value = "";
      showMessage("Choose an MP4, WebM, or MOV video file.", "error");
      return;
    }

    setVideoFile(file);
    showMessage("");
  }

  function handlePosterChange(event) {
    const file = event.target.files?.[0] || null;
    setPosterFile(null);
    if (!file) return;

    if (!ALLOWED_POSTER_TYPES.has(file.type)) {
      event.target.value = "";
      showMessage("Choose a JPG, PNG, or WebP poster image.", "error");
      return;
    }

    if (file.size > MAX_POSTER_BYTES) {
      event.target.value = "";
      showMessage("Poster images must be 10 MB or smaller.", "error");
      return;
    }

    setPosterFile(file);
    showMessage("");
  }

  async function uploadFileResumable(file, path, onProgress) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.access_token) {
      throw new Error("Your session expired. Please log in again.");
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase URL or publishable/anon key is not configured.");
    }

    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const tus = await import("tus-js-client");
    const Upload = tus.Upload || tus.default?.Upload;
    if (!Upload) throw new Error("Could not load the resumable upload client.");

    return new Promise((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 6 * 1024 * 1024,
        headers: {
          apikey: supabaseKey,
          authorization: `Bearer ${session.access_token}`,
        },
        metadata: {
          bucketName: "films",
          objectName: path,
          contentType: file.type,
          cacheControl: "3600",
        },
        removeFingerprintOnSuccess: true,
        onError: reject,
        onProgress(bytesUploaded, bytesTotal) {
          onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
        },
        onSuccess() {
          resolve({ path });
        },
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      }).catch(reject);
    });
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!title.trim()) return showMessage("Enter a film title.", "error");
    if (!videoFile) return showMessage("Choose a video file.", "error");

    setLoading(true);
    setProgress(0);
    showMessage("Checking administrator access…", "info");

    let videoPath = null;
    let posterPath = null;
    let filmInserted = false;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Sign in with an administrator account.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (profile?.is_admin !== true) {
        throw new Error("Only administrators can upload films.");
      }

      const id = crypto.randomUUID();
      videoPath = `videos/${id}-${safeFileName(videoFile.name)}`;
      showMessage("Uploading video… 0%", "info");
      await uploadFileResumable(videoFile, videoPath, (value) => {
        setProgress(value);
        showMessage(`Uploading video… ${value}%`, "info");
      });

      if (posterFile) {
        posterPath = `posters/${id}-${safeFileName(posterFile.name)}`;
        showMessage("Uploading poster…", "info");
        await uploadFileResumable(posterFile, posterPath);
      }

      const { error: insertError } = await supabase.from("films").insert({
        title: title.trim(),
        description: description.trim() || null,
        genre,
        release_year: Number(releaseYear) || null,
        duration: duration.trim() || null,
        rating: 0,
        video_path: videoPath,
        poster_path: posterPath,
        created_by: user.id,
        access_type: "free",
        price_cents: 0,
        is_published: false,
      });
      if (insertError) throw insertError;
      filmInserted = true;

      setTitle("");
      setDescription("");
      setGenre("Drama");
      setReleaseYear("");
      setDuration("");
      setVideoFile(null);
      setPosterFile(null);
      event.currentTarget.reset();
      setProgress(100);
      showMessage("Upload complete. The film is saved as a draft; publish it after review.", "success");
      onUploaded?.();
    } catch (error) {
      console.error("Film upload failed:", error);
      if (!filmInserted) {
        const paths = [videoPath, posterPath].filter(Boolean);
        if (paths.length) {
          const { error: cleanupError } = await supabase.storage.from("films").remove(paths);
          if (cleanupError) console.error("Could not clean up uploaded files:", cleanupError);
        }
      }
      showMessage(error instanceof Error ? error.message : "Upload failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-upload-panel">
      <div className="admin-upload-header">
        <div>
          <p className="eyebrow">ADMIN TOOLS</p>
          <h2>Upload a free film</h2>
          <p>Free films are available to anyone. New uploads are saved as drafts until reviewed and published.</p>
        </div>
        <div className="admin-badge">Admin only</div>
      </div>

      <form className="admin-upload-form" onSubmit={handleUpload}>
        <div className="admin-form-section">
          <div className="admin-section-title">
            <span>01</span>
            <div><h3>Film information</h3><p>Provide details viewers will see.</p></div>
          </div>
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">
              <span>Film title <b>*</b></span>
              <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} disabled={loading} required />
            </label>
            <label className="admin-field">
              <span>Genre</span>
              <select value={genre} onChange={(event) => setGenre(event.target.value)} disabled={loading}>
                {['Action','Adventure','Anime','Cartoon','Comedy','Crime','Documentary','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Thriller'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span>Release year</span>
              <input type="number" min="1888" max="2100" value={releaseYear} onChange={(event) => setReleaseYear(event.target.value)} disabled={loading} />
            </label>
            <label className="admin-field">
              <span>Duration</span>
              <input type="text" value={duration} onChange={(event) => setDuration(event.target.value)} maxLength={40} placeholder="2h 10m" disabled={loading} />
            </label>
            <label className="admin-field admin-field-wide">
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows="5" disabled={loading} />
            </label>
          </div>
        </div>

        <div className="admin-form-section">
          <div className="admin-section-title">
            <span>02</span>
            <div><h3>Film files</h3><p>Use MP4, WebM, or MOV video. Large uploads can resume after connection interruptions.</p></div>
          </div>
          <div className="admin-file-grid">
            <label className="admin-file-card admin-video-file">
              <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoChange} disabled={loading} required />
              <span className="admin-file-icon">▶</span><strong>Choose video file</strong>
              <small>MP4, WebM or MOV<br />Required</small>
              {videoFile && <span className="selected-file">{videoFile.name}<br />{formatFileSize(videoFile.size)}</span>}
            </label>
            <label className="admin-file-card">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePosterChange} disabled={loading} />
              <span className="admin-file-icon">▧</span><strong>Choose poster image</strong>
              <small>PNG, JPG or WebP<br />Optional, max 10 MB</small>
              {posterFile && <span className="selected-file">{posterFile.name}<br />{formatFileSize(posterFile.size)}</span>}
            </label>
          </div>
          {loading && <p role="status">{message} {progress > 0 ? `${progress}%` : ''}</p>}
        </div>

        <div className="admin-upload-footer">
          <p className="admin-required-note"><b>*</b> Required fields</p>
          <button className="admin-upload-button" type="submit" disabled={loading}>
            {loading ? "Uploading…" : "Upload draft"}
          </button>
        </div>
        {message && <p className={`admin-upload-message ${messageType}`} role="status" aria-live="polite">{message}</p>}
      </form>
    </section>
  );
}

export default AdminFilmUpload;
