import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { buyItem } from "../paddle";

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

  const { data } = supabase.storage.from("games").getPublicUrl(path);
  return data?.publicUrl || null;
}

function GameCard({
  game,
  isPurchased,
  busy,
  onBuy,
  onPlay,
}) {
  const isPaid = game.access_type === "paid";
  const coverUrl = getCoverUrl(game.cover_path);

  const coverStyle = {
    "--game-color": "#0f766e",
    ...(coverUrl
      ? {
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.78)), url("${coverUrl}")`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }
      : {}),
  };

  return (
    <article
      className="game-card database-game-card"
      style={coverStyle}
    >
      <div className="game-cover">
        <div className="game-cover-overlay">
          <span className="game-genre">{game.genre || "Game"}</span>
          <span className="game-platform">{game.platform || "Platform"}</span>
        </div>

        {!coverUrl && (
          <div className="game-cover-placeholder" aria-hidden="true">
            🎮
          </div>
        )}
      </div>

      <div className="game-card-body">
        <h3>{game.title}</h3>

        <p>
          {game.platform || "Game"} · Version {game.version || "1.0.0"}
        </p>

        {game.description && (
          <p className="game-description">{game.description}</p>
        )}

        <div className="game-card-footer">
          <strong>
            {isPaid
              ? isPurchased
                ? "Purchased"
                : formatPrice(game.price_cents)
              : "Free"}
          </strong>

          {isPaid && !isPurchased ? (
            <button
              type="button"
              onClick={() => onBuy(game)}
              disabled={busy}
            >
              {busy ? "Opening..." : "Buy now"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPlay(game)}
              disabled={busy}
            >
              {busy
                ? "Preparing..."
                : game.delivery_type === "url"
                  ? "Play now"
                  : "Download"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function GamesSection() {
  const [games, setGames] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All games");
  const [purchasedGameIds, setPurchasedGameIds] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamesError, setGamesError] = useState("");
  const [busyGameId, setBusyGameId] = useState(null);

  async function loadGamesAndPurchases() {
    setLoadingGames(true);
    setGamesError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (user) {
        const { data: purchases, error: purchasesError } = await supabase
          .from("product_purchases")
          .select("product_id")
          .eq("user_id", user.id);

        if (purchasesError) {
          console.error("Could not load game purchases:", purchasesError);
          throw purchasesError;
        }

        setPurchasedGameIds(
          [...new Set((purchases || []).map((purchase) => purchase.product_id))],
        );
      } else {
        setPurchasedGameIds([]);
      }

      const { data: databaseGames, error: gamesError } = await supabase
        .from("games")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (gamesError) throw gamesError;

      setGames(databaseGames || []);
    } catch (error) {
      console.error("Could not load games:", error);
      setGamesError(error?.message || "Could not load games.");
    } finally {
      setLoadingGames(false);
    }
  }

  useEffect(() => {
    loadGamesAndPurchases();
  }, []);

  const filteredGames = useMemo(() => {
    if (selectedCategory === "All games") return games;
    return games.filter((game) => game.genre === selectedCategory);
  }, [games, selectedCategory]);

  const featuredGame = games[0] || null;

  async function handleBuyGame(game) {
    if (!game.paddle_price_id) {
      window.alert(
        "This game has no Paddle price yet. Edit and save it in Game Studio to create one.",
      );
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      window.alert(error.message || "Could not check your sign-in.");
      return;
    }

    if (!user) {
      window.alert("Please sign in before buying a game.");
      return;
    }

    setBusyGameId(game.id);

    try {
      await buyItem({
        priceId: game.paddle_price_id,
        customData: {
          user_id: user.id,
          product_id: game.id,
          product_type: "game",
        },
      });
    } catch (checkoutError) {
      console.error("Could not start Paddle checkout:", checkoutError);
      window.alert(
        checkoutError?.message || "Could not open checkout. Please try again.",
      );
    } finally {
      setBusyGameId(null);
    }
  }

  async function handlePlayGame(game) {
    const isPurchased = purchasedGameIds.includes(game.id);

    if (game.access_type === "paid" && !isPurchased) {
      window.alert("Purchase this game before downloading it.");
      return;
    }

    if (game.delivery_type === "url") {
      if (!game.external_url) {
        window.alert("This game does not have an external URL.");
        return;
      }

      window.open(game.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    setBusyGameId(game.id);

    try {
      const { data, error } = await supabase.functions.invoke(
        "get-game-download",
        { body: { game_id: game.id } },
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No download URL was returned.");

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      console.error("Could not prepare game download:", downloadError);
      window.alert(
        downloadError?.message || "Could not prepare this game download.",
      );
    } finally {
      setBusyGameId(null);
    }
  }

  async function handleFeaturedGame() {
    if (!featuredGame) return;

    if (
      featuredGame.access_type === "paid" &&
      !purchasedGameIds.includes(featuredGame.id)
    ) {
      await handleBuyGame(featuredGame);
      return;
    }

    await handlePlayGame(featuredGame);
  }

  return (
    <section className="section-page games-page">
      <div className="games-hero">
        <div>
          <p className="eyebrow">DIGITAL ENTERTAINMENT</p>

          <h1>{featuredGame?.title || "Play something unforgettable."}</h1>

          <p>
            {featuredGame?.description ||
              "Upload your first game from Game Studio to begin your collection."}
          </p>

          {featuredGame && (
            <button
              className="primary-action"
              type="button"
              onClick={handleFeaturedGame}
              disabled={busyGameId === featuredGame.id}
            >
              {featuredGame.access_type === "paid" &&
              !purchasedGameIds.includes(featuredGame.id)
                ? `Buy for ${formatPrice(featuredGame.price_cents)}`
                : featuredGame.delivery_type === "url"
                  ? "Play now"
                  : "Download"}
            </button>
          )}
        </div>
      </div>

      <div className="section-title-row">
        <div>
          <p className="eyebrow">EXPLORE THE COLLECTION</p>
          <h2>All games</h2>
        </div>

        <span className="games-count">
          {filteredGames.length} game{filteredGames.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={selectedCategory === category ? "selected" : ""}
            type="button"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {loadingGames && (
        <p className="media-status">Loading uploaded games...</p>
      )}

      {gamesError && (
        <p className="media-status media-error">
          Database games could not be loaded: {gamesError}
        </p>
      )}

      {!loadingGames && !gamesError && filteredGames.length === 0 && (
        <div className="games-empty">
          <div className="games-empty-icon">🎮</div>
          <h2>No games found</h2>
          <p>No published games were found in this category.</p>
        </div>
      )}

      <div className="game-grid">
        {filteredGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            isPurchased={purchasedGameIds.includes(game.id)}
            busy={busyGameId === game.id}
            onBuy={handleBuyGame}
            onPlay={handlePlayGame}
          />
        ))}
      </div>

      <button
        className="game-refresh-button"
        type="button"
        onClick={loadGamesAndPurchases}
        disabled={loadingGames}
      >
        {loadingGames ? "Refreshing..." : "Refresh games and purchases"}
      </button>
    </section>
  );
}