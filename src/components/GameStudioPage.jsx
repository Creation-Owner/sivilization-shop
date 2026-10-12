import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const EMPTY_FORM = {
  id: null,
  title: "",
  description: "",
  genre: "Action",
  platform: "Windows",
  version: "1.0.0",
  accessType: "free",
  price: "",
  deliveryType: "upload",
  externalUrl: "",
  isPublished: false,
  gamePath: null,
  coverPath: null,
};

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

function formatDate(dateValue) {
  if (!dateValue) return "Unknown date";

  return new Date(dateValue).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";

  const megabytes = bytes / 1024 / 1024;

  if (megabytes >= 1) return `${megabytes.toFixed(1)} MB`;

  return `${Math.ceil(bytes / 1024)} KB`;
}

function makeSafeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-");
}

function getCoverUrl(path) {
  if (!path) return null;

  const { data } = supabase.storage.from("games").getPublicUrl(path);
  return data?.publicUrl || null;
}

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.context?.message ||
    "An unexpected error occurred."
  );
}

export default function GameStudioPage({ onBack }) {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasStudioAccess, setHasStudioAccess] = useState(false);
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [gameFile, setGameFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const formRef = useRef(null);

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  async function checkAccessAndLoadGames() {
    setCheckingAccess(true);
    setLoadingGames(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setHasStudioAccess(false);
        setGames([]);
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
        setGames([]);
        return;
      }

      const { data, error } = await supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setGames(data || []);
    } catch (error) {
      console.error("Could not load Game Studio:", error);
      showMessage(`Could not load Game Studio: ${getErrorMessage(error)}`, "error");
    } finally {
      setCheckingAccess(false);
      setLoadingGames(false);
    }
  }

  useEffect(() => {
    checkAccessAndLoadGames();
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setGameFile(null);
    setCoverFile(null);
    setMessage("");

    if (formRef.current) {
      formRef.current.reset();
    }
  }

  function handleGameFileChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setGameFile(null);
      return;
    }

    const name = file.name.toLowerCase();
    const allowed = name.endsWith(".zip") || name.endsWith(".apk");

    if (!allowed) {
      event.target.value = "";
      setGameFile(null);
      showMessage(
        "Choose a .zip file for Windows games or an .apk file for Android games.",
        "error",
      );
      return;
    }

    setGameFile(file);
    setMessage("");
  }

  function handleCoverFileChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setCoverFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      setCoverFile(null);
      showMessage("Choose a valid image file for the game cover.", "error");
      return;
    }

    setCoverFile(file);
    setMessage("");
  }

  function startEditing(game) {
    setForm({
      id: game.id,
      title: game.title || "",
      description: game.description || "",
      genre: game.genre || "Action",
      platform: game.platform || "Windows",
      version: game.version || "1.0.0",
      accessType: game.access_type || "free",
      price:
        game.access_type === "paid"
          ? ((Number(game.price_cents) || 0) / 100).toFixed(2)
          : "",
      deliveryType: game.delivery_type || "upload",
      externalUrl: game.external_url || "",
      isPublished: game.is_published === true,
      gamePath: game.game_path || null,
      coverPath: game.cover_path || null,
    });

    setGameFile(null);
    setCoverFile(null);
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadFile(path, file) {
    const { error } = await supabase.storage.from("games").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) throw error;
  }

  async function removeFile(path) {
    if (!path) return;

    const { error } = await supabase.storage.from("games").remove([path]);

    if (error) {
      console.error("Could not remove game file:", error);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");

    if (!form.title.trim()) {
      showMessage("Enter a game title.", "error");
      return;
    }

    if (
      form.accessType === "paid" &&
      (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0)
    ) {
      showMessage("Enter a valid price for a paid game.", "error");
      return;
    }

    if (form.deliveryType === "url" && !form.externalUrl.trim()) {
      showMessage("Enter the external game URL.", "error");
      return;
    }

    if (form.deliveryType === "upload" && !form.gamePath && !gameFile) {
      showMessage("Choose a game package file.", "error");
      return;
    }

    setSaving(true);

    let uploadedGamePath = null;
    let uploadedCoverPath = null;
    let saveCompleted = false;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Sign in to manage games.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin, is_owner")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_admin && !profile?.is_owner) {
        throw new Error("Only owners and admins can manage games.");
      }

      let gamePath =
        form.deliveryType === "upload" ? form.gamePath : null;
      let coverPath = form.coverPath || null;

      if (gameFile) {
        const extension = gameFile.name.split(".").pop()?.toLowerCase();
        const safeName = makeSafeFileName(gameFile.name);

        if (form.platform === "Windows" && extension !== "zip") {
          throw new Error("Windows games must be uploaded as a .zip package.");
        }

        if (form.platform === "Android" && extension !== "apk") {
          throw new Error("Android games must be uploaded as an .apk package.");
        }

        uploadedGamePath = `packages/${crypto.randomUUID()}-${safeName}`;
        await uploadFile(uploadedGamePath, gameFile);
        gamePath = uploadedGamePath;
      }

      if (coverFile) {
        const safeName = makeSafeFileName(coverFile.name);
        uploadedCoverPath = `covers/${crypto.randomUUID()}-${safeName}`;
        await uploadFile(uploadedCoverPath, coverFile);
        coverPath = uploadedCoverPath;
      }

      const payload = {
        ...(form.id ? { id: form.id } : {}),
        title: form.title.trim(),
        description: form.description.trim() || null,
        genre: form.genre,
        platform: form.platform,
        version: form.version.trim() || "1.0.0",
        access_type: form.accessType,
        price_cents:
          form.accessType === "paid"
            ? Math.round(Number(form.price) * 100)
            : 0,
        delivery_type: form.deliveryType,
        game_path: form.deliveryType === "upload" ? gamePath : null,
        cover_path: coverPath,
        external_url:
          form.deliveryType === "url" ? form.externalUrl.trim() : null,
        is_published: form.isPublished,
      };

      // Paid saves go through the server so Paddle API secrets stay private.
      // Free saves also use the Edge Function to keep owner/admin validation consistent.
      const { data, error } = await supabase.functions.invoke("save-game", {
        body: payload,
      });

      if (error) {
        let detail = "";
        try {
          detail = (await error.context?.json?.())?.error || "";
        } catch {
          // Function error body was not JSON.
        }
        throw new Error(detail || getErrorMessage(error));
      }

      if (data?.error) throw new Error(data.error);
      if (!data?.game) throw new Error("save-game did not return the saved game.");

      const savedGame = data.game;
      saveCompleted = true;

      if (uploadedGamePath && form.gamePath) {
        await removeFile(form.gamePath);
      }
      if (uploadedCoverPath && form.coverPath) {
        await removeFile(form.coverPath);
      }

      setGames((current) =>
        form.id
          ? current.map((item) => (item.id === savedGame.id ? savedGame : item))
          : [savedGame, ...current],
      );

      showMessage(
        form.accessType === "paid"
          ? `${savedGame.title} saved. Paddle price ID: ${savedGame.paddle_price_id || data.paddle_price_id || "missing"}`
          : `${savedGame.title} saved successfully.`,
        "success",
      );

      resetForm();
    } catch (error) {
      console.error("Could not save game:", error);

      // Preserve newly uploaded files if the DB save completed.
      if (!saveCompleted) {
        if (uploadedGamePath) await removeFile(uploadedGamePath);
        if (uploadedCoverPath) await removeFile(uploadedCoverPath);
      }

      showMessage(`Could not save game: ${getErrorMessage(error)}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(game) {
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("games")
        .update({
          is_published: !game.is_published,
          updated_at: new Date().toISOString(),
        })
        .eq("id", game.id)
        .select()
        .single();

      if (error) throw error;

      setGames((current) =>
        current.map((item) => (item.id === data.id ? data : item)),
      );

      showMessage(
        data.is_published
          ? `${data.title} is now published.`
          : `${data.title} is now unpublished.`,
        "success",
      );
    } catch (error) {
      showMessage(
        `Could not update publication status: ${getErrorMessage(error)}`,
        "error",
      );
    }
  }

  async function deleteGame(game) {
    const confirmed = window.confirm(
      `Delete "${game.title}"? This permanently removes its database record and uploaded files.`,
    );

    if (!confirmed) return;

    setDeletingId(game.id);
    setMessage("");

    try {
      const { error } = await supabase.from("games").delete().eq("id", game.id);
      if (error) throw error;

      await removeFile(game.game_path);
      await removeFile(game.cover_path);

      setGames((current) => current.filter((item) => item.id !== game.id));

      if (form.id === game.id) resetForm();

      showMessage(`${game.title} was deleted.`, "success");
    } catch (error) {
      showMessage(`Could not delete game: ${getErrorMessage(error)}`, "error");
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
          <p>Only the owner or an administrator can manage Game Studio.</p>
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
          <p className="eyebrow">ADMINISTRATION / GAME STUDIO</p>
          <h1>Game Studio</h1>
          <p>
            Upload, publish, and manage games. Paid games create a Paddle
            product and one-time price when saved.
          </p>
        </div>

        <button className="studio-back-button" type="button" onClick={onBack}>
          ← Back to admin
        </button>
      </div>

      <section className="admin-upload-panel game-upload-panel">
        <div className="admin-upload-header">
          <div>
            <p className="eyebrow">
              {form.id ? "EDIT GAME" : "ADD NEW GAME"}
            </p>
            <h2>{form.id ? `Editing: ${form.title}` : "Game information"}</h2>
            <p>
              Upload a Windows ZIP package, Android APK, or use an external URL.
            </p>
          </div>
          <div className="admin-badge">Owner / admin</div>
        </div>

        <form
          ref={formRef}
          className="admin-upload-form"
          onSubmit={handleSave}
        >
          <div className="admin-form-section">
            <div className="admin-section-title">
              <span>01</span>
              <div>
                <h3>Game details</h3>
                <p>Information customers see in the Games catalogue.</p>
              </div>
            </div>

            <div className="admin-form-grid">
              <label className="admin-field admin-field-wide">
                <span>Game title <b>*</b></span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Example: Galactic Explorer"
                  disabled={saving}
                  required
                />
              </label>

              <label className="admin-field">
                <span>Genre</span>
                <select
                  value={form.genre}
                  onChange={(event) => updateForm("genre", event.target.value)}
                  disabled={saving}
                >
                  <option>Action</option>
                  <option>Adventure</option>
                  <option>Arcade</option>
                  <option>Casual</option>
                  <option>Puzzle</option>
                  <option>Racing</option>
                  <option>RPG</option>
                  <option>Simulation</option>
                  <option>Sports</option>
                  <option>Strategy</option>
                </select>
              </label>

              <label className="admin-field">
                <span>Platform</span>
                <select
                  value={form.platform}
                  onChange={(event) => updateForm("platform", event.target.value)}
                  disabled={saving}
                >
                  <option>Windows</option>
                  <option>Android</option>
                  <option>Web</option>
                  <option>macOS</option>
                  <option>Linux</option>
                </select>
              </label>

              <label className="admin-field">
                <span>Version</span>
                <input
                  type="text"
                  value={form.version}
                  onChange={(event) => updateForm("version", event.target.value)}
                  placeholder="1.0.0"
                  disabled={saving}
                />
              </label>

              <label className="admin-field">
                <span>Access type</span>
                <select
                  value={form.accessType}
                  onChange={(event) => updateForm("accessType", event.target.value)}
                  disabled={saving}
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </label>

              {form.accessType === "paid" && (
                <label className="admin-field">
                  <span>Price in USD <b>*</b></span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.price}
                    onChange={(event) => updateForm("price", event.target.value)}
                    placeholder="9.99"
                    disabled={saving}
                    required
                  />
                  <small>Paddle product and one-time price are created on save.</small>
                </label>
              )}

              <label className="admin-field admin-field-wide">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Write a short description of the game..."
                  rows="5"
                  disabled={saving}
                />
              </label>
            </div>
          </div>

          <div className="admin-form-section">
            <div className="admin-section-title">
              <span>02</span>
              <div>
                <h3>Game delivery</h3>
                <p>Upload a Windows ZIP/Android APK or use an external URL.</p>
              </div>
            </div>

            <div className="game-delivery-tabs">
              <button
                className={form.deliveryType === "upload" ? "selected" : ""}
                type="button"
                onClick={() => updateForm("deliveryType", "upload")}
                disabled={saving}
              >
                Upload package
              </button>
              <button
                className={form.deliveryType === "url" ? "selected" : ""}
                type="button"
                onClick={() => updateForm("deliveryType", "url")}
                disabled={saving}
              >
                External URL
              </button>
            </div>

            {form.deliveryType === "upload" ? (
              <div className="admin-file-grid">
                <label className="admin-file-card game-package-file">
                  <input
                    type="file"
                    accept=".zip,.apk,application/zip,application/vnd.android.package-archive"
                    onChange={handleGameFileChange}
                    disabled={saving}
                    required={!form.gamePath}
                  />
                  <span className="admin-file-icon">🎮</span>
                  <strong>
                    {form.gamePath ? "Replace game package" : "Choose game package"}
                  </strong>
                  <small>
                    Windows: .zip
                    <br />
                    Android: .apk
                  </small>
                  {gameFile && (
                    <span className="selected-file">
                      {gameFile.name}
                      <br />
                      {formatFileSize(gameFile.size)}
                    </span>
                  )}
                  {!gameFile && form.gamePath && (
                    <span className="selected-file">
                      Current package saved
                      <br />
                      Upload another file to replace it
                    </span>
                  )}
                </label>

                <div className="game-package-note">
                  <h3>Private package storage</h3>
                  <p>
                    Uploaded packages stay in the private games bucket.
                    Download links are issued only after access is verified.
                  </p>
                </div>
              </div>
            ) : (
              <label className="admin-field admin-field-wide">
                <span>External game URL <b>*</b></span>
                <input
                  type="url"
                  value={form.externalUrl}
                  onChange={(event) => updateForm("externalUrl", event.target.value)}
                  placeholder="https://example.com/your-game"
                  disabled={saving}
                  required
                />
                <small className="admin-field-help">
                  Use this for web games or trusted store pages. External URLs
                  are opened directly by the browser.
                </small>
              </label>
            )}
          </div>

          <div className="admin-form-section">
            <div className="admin-section-title">
              <span>03</span>
              <div>
                <h3>Game cover</h3>
                <p>Upload a cover image for the Games catalogue.</p>
              </div>
            </div>

            <div className="admin-file-grid">
              <label className="admin-file-card">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCoverFileChange}
                  disabled={saving}
                />
                <span className="admin-file-icon">▧</span>
                <strong>
                  {form.coverPath ? "Replace cover image" : "Choose cover image"}
                </strong>
                <small>PNG, JPG or WebP · Optional</small>
                {coverFile && (
                  <span className="selected-file">
                    {coverFile.name}
                    <br />
                    {formatFileSize(coverFile.size)}
                  </span>
                )}
                {!coverFile && form.coverPath && (
                  <span className="selected-file">Current cover saved</span>
                )}
              </label>
            </div>
          </div>

          <div className="admin-form-section">
            <div className="admin-section-title">
              <span>04</span>
              <div>
                <h3>Visibility</h3>
                <p>Publish now or keep the game hidden as a draft.</p>
              </div>
            </div>

            <label className="publish-toggle">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(event) => updateForm("isPublished", event.target.checked)}
                disabled={saving}
              />
              <span className="publish-toggle-control" />
              <span>
                <strong>
                  {form.isPublished ? "Publish this game" : "Keep as draft"}
                </strong>
                <small>
                  {form.isPublished
                    ? "Customers can see this game in the Games page."
                    : "Only owners/admins can see this game in Game Studio."}
                </small>
              </span>
            </label>
          </div>

          <div className="admin-upload-footer">
            <p className="admin-required-note"><b>*</b> Required fields</p>
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
              <button className="admin-upload-button" type="submit" disabled={saving}>
                {saving
                  ? "Saving game..."
                  : form.id
                    ? "Save changes"
                    : form.isPublished
                      ? "Publish game"
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

      <section className="game-manager-section">
        <div className="game-manager-heading">
          <div>
            <p className="eyebrow">GAME MANAGEMENT</p>
            <h2>My games</h2>
            <p>Manage drafts and published games from one place.</p>
          </div>
          <button
            className="game-refresh-button"
            type="button"
            onClick={checkAccessAndLoadGames}
            disabled={loadingGames}
          >
            {loadingGames ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingGames ? (
          <p className="media-status">Loading your games...</p>
        ) : games.length === 0 ? (
          <div className="game-manager-empty">
            <h3>No games added yet</h3>
            <p>Add your first game above.</p>
          </div>
        ) : (
          <div className="game-manager-list">
            {games.map((game) => {
              const coverUrl = getCoverUrl(game.cover_path);

              return (
                <article className="game-manager-card" key={game.id}>
                  <div
                    className="game-manager-cover"
                    style={
                      coverUrl
                        ? {
                            backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.25), rgba(15, 23, 42, 0.76)), url("${coverUrl}")`,
                          }
                        : undefined
                    }
                  >
                    {!coverUrl && <span>🎮</span>}
                    <span
                      className={
                        game.is_published
                          ? "game-status published"
                          : "game-status draft"
                      }
                    >
                      {game.is_published ? "Published" : "Draft"}
                    </span>
                  </div>

                  <div className="game-manager-info">
                    <div className="game-manager-title-row">
                      <div>
                        <h3>{game.title}</h3>
                        <p>
                          {game.platform} · {game.genre || "Game"} · Version{" "}
                          {game.version}
                        </p>
                      </div>
                      <strong>
                        {game.access_type === "paid"
                          ? formatCurrency(game.price_cents)
                          : "Free"}
                      </strong>
                    </div>

                    {game.access_type === "paid" && (
                      <p className="game-manager-meta">
                        Paddle: {game.paddle_price_id || "Price not created yet"}
                      </p>
                    )}

                    <p className="game-manager-description">
                      {game.description || "No description added yet."}
                    </p>

                    <div className="game-manager-meta">
                      <span>
                        Delivery: {game.delivery_type === "upload" ? "Package upload" : "External URL"}
                      </span>
                      <span>Created: {formatDate(game.created_at)}</span>
                    </div>

                    <div className="game-manager-actions">
                      <button
                        className="game-edit-button"
                        type="button"
                        onClick={() => startEditing(game)}
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        className={
                          game.is_published
                            ? "game-unpublish-button"
                            : "game-publish-button"
                        }
                        type="button"
                        onClick={() => togglePublished(game)}
                        disabled={saving}
                      >
                        {game.is_published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        className="game-delete-button"
                        type="button"
                        onClick={() => deleteGame(game)}
                        disabled={deletingId === game.id || saving}
                      >
                        {deletingId === game.id ? "Deleting..." : "Delete"}
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