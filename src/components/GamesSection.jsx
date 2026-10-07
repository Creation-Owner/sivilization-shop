import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const categories = [
  "All games",
  "Action",
  "Adventure",
  "Arcade",
  "Puzzle",
  "Racing",
  "RPG",
  "Simulation",
  "Sports",
  "Strategy",
];

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

function getCoverUrl(path) {
  if (!path) {
    return null;
  }

  const { data } = supabase.storage.from("games").getPublicUrl(path);

  return data?.publicUrl || null;
}

function GamesSection() {
  const [games, setGames] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All games");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPublishedGames() {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Could not load games:", error);
        setMessage(error.message || "Could not load games.");
        setLoading(false);
        return;
      }

      setGames(data || []);
      setLoading(false);
    }

    loadPublishedGames();
  }, []);

  const filteredGames =
    selectedCategory === "All games"
      ? games
      : games.filter((game) => game.genre === selectedCategory);

  function handleGameButton(game) {
    if (game.access_type === "paid") {
      window.alert(
        "This is a paid game. Secure payments and downloads will be added after Stripe is connected.",
      );
      return;
    }

    if (game.delivery_type === "url" && game.external_url) {
      window.open(game.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    window.alert(
      "This game is stored privately. Secure downloads will be added later with the final payment and download system.",
    );
  }

  return (
    <section className="section-page games-page">
      <div className="games-hero">
        <div>
          <p className="eyebrow">DIGITAL ENTERTAINMENT</p>

          <h1>Play something unforgettable.</h1>

          <p>
            Discover games published by Sivilization. Free games can be opened
            or downloaded when available.
          </p>
        </div>
      </div>

      <div className="section-title-row">
        <div>
          <p className="eyebrow">EXPLORE THE COLLECTION</p>
          <h2>Games</h2>
        </div>

        <span className="games-count">
          {filteredGames.length} game
          {filteredGames.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="category-tabs">
        {categories.map((category) => (
          <button
            className={selectedCategory === category ? "selected" : ""}
            type="button"
            key={category}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {loading && <p className="media-status">Loading games...</p>}

      {message && (
        <p className="media-status media-error">
          Games could not be loaded: {message}
        </p>
      )}

      {!loading && !message && filteredGames.length === 0 && (
        <div className="games-empty">
          <div className="games-empty-icon">🎮</div>

          <h2>No published games yet</h2>

          <p>
            Published games from Game Studio will appear here automatically.
          </p>
        </div>
      )}

      <div className="game-grid">
        {filteredGames.map((game) => {
          const coverUrl = getCoverUrl(game.cover_path);

          return (
            <article
              className="game-card database-game-card"
              key={game.id}
              style={
                coverUrl
                  ? {
                      "--game-cover": `url("${coverUrl}")`,
                    }
                  : {
                      "--game-color": "#0f766e",
                    }
              }
            >
              <div className="game-cover">
                <div className="game-cover-overlay">
                  <span className="game-genre">{game.genre || "Game"}</span>

                  <span className="game-platform">{game.platform}</span>
                </div>

                {!coverUrl && (
                  <div className="game-cover-placeholder">🎮</div>
                )}
              </div>

              <div className="game-card-body">
                <h3>{game.title}</h3>

                <p>
                  {game.platform} · Version {game.version}
                </p>

                {game.description && (
                  <p className="game-description">{game.description}</p>
                )}

                <div className="game-card-footer">
                  <strong>
                    {game.access_type === "paid"
                      ? formatCurrency(game.price_cents)
                      : "Free"}
                  </strong>

                  <button
                    type="button"
                    onClick={() => handleGameButton(game)}
                  >
                    {game.access_type === "paid"
                      ? "Buy soon"
                      : game.delivery_type === "url"
                        ? "Play now"
                        : "Download soon"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default GamesSection;