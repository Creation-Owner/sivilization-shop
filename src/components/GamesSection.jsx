const games = [
  {
    title: "Starfall Online",
    genre: "Action RPG",
    price: "$29.99",
    color: "#312e81",
    rating: "4.8",
  },
  {
    title: "Racing Legends",
    genre: "Racing",
    price: "$19.99",
    color: "#9f1239",
    rating: "4.7",
  },
  {
    title: "Kingdom Builders",
    genre: "Strategy",
    price: "$24.99",
    color: "#166534",
    rating: "4.9",
  },
  {
    title: "Shadow Arena",
    genre: "Action",
    price: "$34.99",
    color: "#713f12",
    rating: "4.6",
  },
];

function GamesSection() {
  return (
    <section className="section-page">
      <div className="games-hero">
        <div>
          <p className="eyebrow">DIGITAL ENTERTAINMENT</p>

          <h1>Play something unforgettable.</h1>

          <p>
            Discover new games, popular releases and exclusive offers.
          </p>

          <button className="primary-action">
            Browse all games
          </button>
        </div>
      </div>

      <div className="section-title-row">
        <div>
          <p className="eyebrow">EXPLORE THE COLLECTION</p>
          <h2>Featured games</h2>
        </div>

        <button className="outline-action">
          View all
        </button>
      </div>

      <div className="category-tabs">
        <button className="selected">All games</button>
        <button>Action</button>
        <button>Racing</button>
        <button>Strategy</button>
        <button>Adventure</button>
      </div>

      <div className="game-grid">
        {games.map((game) => (
          <article
            className="game-card"
            key={game.title}
            style={{ "--game-color": game.color }}
          >
            <div className="game-cover">
              <span className="game-genre">{game.genre}</span>
              <span className="game-rating">★ {game.rating}</span>
            </div>

            <div className="game-card-body">
              <h3>{game.title}</h3>

              <p>{game.genre} game</p>

              <div className="game-card-footer">
                <strong>{game.price}</strong>
                <button>Buy now</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default GamesSection;