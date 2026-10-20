import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const CATEGORIES = [
  "All games",
  "Action",
  "Adventure",
  "Arcade",
  "Casual",
  "Puzzle",
  "Racing",
  "RPG",
  "Simulation",
  "Sports",
  "Strategy",
];

function formatPrice(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

function getCoverUrl(path) {
  if (!path) return null;

  return (
    supabase.storage
      .from("games")
      .getPublicUrl(path)
      .data?.publicUrl || null
  );
}

export default function GamesSection() {
  const [games, setGames] = useState([]);
  const [category, setCategory] = useState("All games");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [privileged, setPrivileged] = useState(false);

  async function loadGames() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      let isAdmin = false;

      if (user) {
        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("is_admin,is_owner")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        isAdmin =
          profile?.is_admin === true ||
          profile?.is_owner === true;
      }

      setPrivileged(isAdmin);

      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("is_published", true)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      setGames(data || []);
    } catch (error) {
      setMessage(
        error.message || "Could not load games.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGames();
  }, []);

  const filteredGames = useMemo(
    () =>
      category === "All games"
        ? games
        : games.filter(
            (game) => game.genre === category,
          ),
    [games, category],
  );

  async function handleDownload(game) {
    if (busyId) return;

    const paid =
      game.access_type === "paid" ||
      game.is_paid === true;

    if (paid && !privileged) {
      setMessage(
        "Paid-game checkout and customer downloads are temporarily disabled while purchase verification is fixed.",
      );

      return;
    }

    if (game.delivery_type === "url") {
      try {
        const url = new URL(game.external_url);

        if (
          !["http:", "https:"].includes(url.protocol)
        ) {
          throw new Error("Unsupported URL");
        }

        window.open(
          url.href,
          "_blank",
          "noopener,noreferrer",
        );
      } catch {
        setMessage(
          "This game has an invalid external URL.",
        );
      }

      return;
    }

    setBusyId(game.id);
    setMessage("");

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "get-game-download",
          {
            body: {
              game_id: game.id,
            },
          },
        );

      if (error) {
        const detail =
          typeof error.context?.json === "function"
            ? await error.context.json().catch(() => null)
            : null;

        throw new Error(
          detail?.error || error.message,
        );
      }

      if (!data?.url || data.error) {
        throw new Error(
          data?.error || "No download URL returned.",
        );
      }

      window.location.assign(data.url);
    } catch (error) {
      setMessage(
        error.message || "Could not prepare download.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="section-page games-page">
      <div className="games-hero">
        <div>
          <p className="eyebrow">
            DIGITAL ENTERTAINMENT
          </p>

          <h1>
            {games[0]?.title ||
              "Explore the games collection"}
          </h1>

          <p>
            {games[0]?.description ||
              "Download published games from the collection."}
          </p>
        </div>
      </div>

      <div className="section-title-row">
        <h2>All games</h2>

        <span>
          {filteredGames.length} games
        </span>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map((item) => (
          <button
            type="button"
            key={item}
            className={
              item === category ? "selected" : ""
            }
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <p>
        Paid-game checkout and customer downloads are
        temporarily disabled while purchase verification
        is fixed. Free-game package downloads require sign-in.
      </p>

      {loading && <p>Loading games...</p>}

      {message && (
        <p
          className="media-status media-error"
          role="alert"
        >
          {message}
        </p>
      )}

      {!loading && !filteredGames.length && (
        <p>No published games found.</p>
      )}

      <div className="game-grid">
        {filteredGames.map((game) => {
          const cover = getCoverUrl(game.cover_path);

          const paid =
            game.access_type === "paid" ||
            game.is_paid === true;

          return (
            <article
              className="game-card database-game-card"
              key={game.id}
              style={{
                "--game-color": "#0f766e",
              }}
            >
              <div
                className="game-cover"
                style={
                  cover
                    ? {
                        backgroundImage: `url("${cover}")`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <div className="game-cover-overlay">
                  <span>
                    {game.genre || "Game"}
                  </span>

                  <span>
                    {game.platform}
                  </span>
                </div>
              </div>

              <div className="game-card-body">
                <h3>{game.title}</h3>

                <p>
                  {game.platform} - Version{" "}
                  {game.version}
                </p>

                <p className="game-description">
                  {game.description}
                </p>

                <div className="game-card-footer">
                  <strong>
                    {paid
                      ? formatPrice(game.price_cents)
                      : "Free"}
                  </strong>

                  <button
                    type="button"
                    disabled={
                      Boolean(busyId) ||
                      (paid && !privileged)
                    }
                    onClick={() =>
                      handleDownload(game)
                    }
                  >
                    {busyId === game.id
                      ? "Preparing..."
                      : paid && !privileged
                        ? "Paid access pending"
                        : game.delivery_type === "url"
                          ? "Play now"
                          : paid && privileged
                            ? "Test download (admin)"
                            : "Download"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className="game-refresh-button"
        disabled={loading || Boolean(busyId)}
        onClick={loadGames}
      >
        Refresh games
      </button>
    </section>
  );
}