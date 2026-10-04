import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("upload");
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("Action");
  const [releaseYear, setReleaseYear] = useState("");
  const [duration, setDuration] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [posterFile, setPosterFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchFilms();
  }, []);

  async function fetchFilms() {
    setLoading(true);
    const { data, error } = await supabase.from("films").select("*").order("created_at", { ascending: false });
    if (error) console.error("Error fetching films:", error);
    else setFilms(data || []);
    setLoading(false);
  }

  function formatFileSize(bytes) {
    if (!bytes) return "0 KB";
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!title.trim() || !videoFile) {
      setMessage("⚠️ Title and video file are required!");
      return;
    }

    setUploading(true);
    setMessage("⏳ Uploading...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload video
      const videoExt = videoFile.name.split(".").pop();
      const videoPath = `videos/${Date.now()}-${Math.random().toString(36).substring(7)}.${videoExt}`;

      const { error: videoError } = await supabase.storage
        .from("films")
        .upload(videoPath, videoFile, { cacheControl: "3600", upsert: false });

      if (videoError) throw videoError;

      // Upload poster (optional)
      let posterPath = null;
      if (posterFile) {
        const posterExt = posterFile.name.split(".").pop();
        posterPath = `posters/${Date.now()}-${Math.random().toString(36).substring(7)}.${posterExt}`;

        const { error: posterError } = await supabase.storage
          .from("films")
          .upload(posterPath, posterFile, { cacheControl: "3600", upsert: false });

        if (posterError) throw posterError;
      }

      // Get public URLs
      const { data: videoData } = supabase.storage.from("films").getPublicUrl(videoPath);
      const videoUrl = videoData.publicUrl;

      let posterUrl = null;
      if (posterPath) {
        const { data: posterData } = supabase.storage.from("films").getPublicUrl(posterPath);
        posterUrl = posterData.publicUrl;
      }

      // Insert film record
      const { error: insertError } = await supabase.from("films").insert({
        title: title.trim(),
        description: description.trim() || null,
        genre,
        release_year: releaseYear ? parseInt(releaseYear) : null,
        duration: duration.trim() || null,
        rating: 0,
        video_url: videoUrl,
        poster_url: posterUrl,
        video_path: videoPath,
        poster_path: posterPath,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      setMessage("✅ Film uploaded successfully!");
      setTitle("");
      setDescription("");
      setGenre("Action");
      setReleaseYear("");
      setDuration("");
      setVideoFile(null);
      setPosterFile(null);
      fetchFilms();
    } catch (error) {
      console.error("Upload error:", error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(filmId, videoPath, posterPath) {
    if (!confirm("Are you sure you want to delete this film?")) return;

    try {
      // Delete from storage
      if (videoPath) await supabase.storage.from("films").remove([videoPath]);
      if (posterPath) await supabase.storage.from("films").remove([posterPath]);

      // Delete from database
      const { error } = await supabase.from("films").delete().eq("id", filmId);
      if (error) throw error;

      setMessage("✅ Film deleted successfully!");
      fetchFilms();
    } catch (error) {
      setMessage(`❌ Error deleting: ${error.message}`);
    }
  }

  return (
    <section className="section-page" style={{ maxWidth: "1200px" }}>
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ color: "white", marginBottom: "10px" }}>👑 Admin Dashboard</h1>
        <p style={{ color: "#94a3b8" }}>Manage your films, videos, and content</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "30px", borderBottom: "1px solid #334155", paddingBottom: "10px" }}>
        <button
          onClick={() => setActiveTab("upload")}
          style={{
            padding: "10px 20px",
            background: activeTab === "upload" ? "#2563eb" : "transparent",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          📤 Upload Film
        </button>
        <button
          onClick={() => setActiveTab("manage")}
          style={{
            padding: "10px 20px",
            background: activeTab === "manage" ? "#2563eb" : "transparent",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          📋 Manage Films
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <div style={{ background: "#101c2e", padding: "30px", borderRadius: "16px", border: "1px solid #1e293b" }}>
          <h2 style={{ color: "white", marginBottom: "20px" }}>Upload New Film</h2>

          <form onSubmit={handleUpload} style={{ display: "grid", gap: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", color: "#e2e8f0", marginBottom: "8px", fontWeight: "bold" }}>Film Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter film title"
                  required
                  style={{ width: "100%", padding: "12px", background: "#0b1628", border: "1px solid #334155", borderRadius: "8px", color: "white", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", color: "#e2e8f0", marginBottom: "8px", fontWeight: "bold" }}>Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  style={{ width: "100%", padding: "12px", background: "#0b1628", border: "1px solid #334155", borderRadius: "8px", color: "white", outline: "none" }}
                >
                  <option>Action</option>
                  <option>Adventure</option>
                  <option>Comedy</option>
                  <option>Crime</option>
                  <option>Documentary</option>
                  <option>Drama</option>
                  <option>Fantasy</option>
                  <option>Horror</option>
                  <option>Mystery</option>
                  <option>Romance</option>
                  <option>Sci-Fi</option>
                  <option>Thriller</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", color: "#e2e8f0", marginBottom: "8px", fontWeight: "bold" }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a description of the film..."
                rows="4"
                style={{ width: "100%", padding: "12px", background: "#0b1628", border: "1px solid #334155", borderRadius: "8px", color: "white", outline: "none", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", color: "#e2e8f0", marginBottom: "8px", fontWeight: "bold" }}>Release Year</label>
                <input
                  type="number"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                  placeholder="2024"
                  min="1900"
                  max="2100"
                  style={{ width: "100%", padding: "12px", background: "#0b1628", border: "1px solid #334155", borderRadius: "8px", color: "white", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", color: "#e2e8f0", marginBottom: "8px", fontWeight: "bold" }}>Duration</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="2h 15m"
                  style={{ width: "100%", padding: "12px", background: "#0b1628", border: "1px solid #334155", borderRadius: "8px", color: "white", outline: "none" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", color: "#e2e8f0", marginBottom: "8px", fontWeight: "bold" }}>Video File *</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0])}
                  required
                  style={{ width: "100%", padding: "12px", background: "#0b1628", border: "1px solid #334155", borderRadius: "8px", color: "white" }}
                />
                {videoFile && <p style={{ color: "#94a3b8", marginTop: "8px" }}>📁 {videoFile.name} ({formatFileSize(videoFile.size)})</p>}
              </div>

              <div>
                <label style={{ display: "block", color: "#e2e8f0", marginBottom: "8px", fontWeight: "bold" }}>Poster Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPosterFile(e.target.files?.[0])}
                  style={{ width: "100%", padding: "12px", background: "#0b1628", border: "1px solid #334155", borderRadius: "8px", color: "white" }}
                />
                {posterFile && <p style={{ color: "#94a3b8", marginTop: "8px" }}>🖼️ {posterFile.name} ({formatFileSize(posterFile.size)})</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              style={{
                padding: "14px 24px",
                background: uploading ? "#64748b" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: uploading ? "not-allowed" : "pointer",
                marginTop: "10px",
              }}
            >
              {uploading ? "⏳ Uploading..." : "🚀 Upload Film"}
            </button>

            {message && (
              <p style={{
                padding: "12px",
                background: message.includes("✅") ? "rgba(34,197,94,0.1)" : message.includes("⚠️") ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                color: message.includes("✅") ? "#86efac" : message.includes("⚠️") ? "#fcd34d" : "#fca5a5",
                borderRadius: "8px",
                margin: "10px 0 0",
              }}>
                {message}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Manage Films Tab */}
      {activeTab === "manage" && (
        <div style={{ background: "#101c2e", padding: "30px", borderRadius: "16px", border: "1px solid #1e293b" }}>
          <h2 style={{ color: "white", marginBottom: "20px" }}>Manage Films ({films.length})</h2>

          {loading ? (
            <p style={{ color: "#94a3b8" }}>Loading films...</p>
          ) : films.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No films uploaded yet. Upload your first film!</p>
          ) : (
            <div style={{ display: "grid", gap: "15px" }}>
              {films.map((film) => (
                <div
                  key={film.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "20px",
                    alignItems: "center",
                    padding: "15px",
                    background: "#0b1628",
                    borderRadius: "10px",
                    border: "1px solid #1e293b",
                  }}
                >
                  {film.poster_url ? (
                    <img src={film.poster_url} alt={film.title} style={{ width: "80px", height: "120px", objectFit: "cover", borderRadius: "8px" }} />
                  ) : (
                    <div style={{ width: "80px", height: "120px", background: "#1e3a5f", borderRadius: "8px", display: "grid", placeItems: "center", color: "#64748b" }}>No Poster</div>
                  )}

                  <div>
                    <h3 style={{ color: "white", margin: "0 0 5px" }}>{film.title}</h3>
                    <p style={{ color: "#94a3b8", margin: "0 0 5px", fontSize: "14px" }}>
                      {film.genre} • {film.release_year || "N/A"} • {film.duration || "N/A"}
                    </p>
                    {film.description && <p style={{ color: "#cbd5e1", margin: 0, fontSize: "13px" }}>{film.description}</p>}
                    <p style={{ color: "#64748b", margin: "5px 0 0", fontSize: "12px" }}>
                      📹 {film.video_url ? "Video uploaded" : "No video"} • 📅 {new Date(film.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(film.id, film.video_path, film.poster_path)}
                    style={{
                      padding: "8px 16px",
                      background: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {message && (
            <p style={{
              padding: "12px",
              background: message.includes("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: message.includes("✅") ? "#86efac" : "#fca5a5",
              borderRadius: "8px",
              margin: "20px 0 0",
            }}>
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;