const libraryItems = [
  { title: "Midnight Horizon", type: "Film", progress: 68, color: "#312e81" },
  { title: "Starfall Online", type: "Game", progress: 42, color: "#166534" },
  { title: "Broken Promises", type: "Drama", progress: 24, color: "#9f1239" },
];

function LibrarySection() {
  return (
    <section className="section-page">
      <div className="library-header">
        <div>
          <p className="eyebrow">YOUR COLLECTION</p>
          <h1>My Library</h1>
          <p>Continue watching, playing and exploring your saved content.</p>
        </div>
        <div className="library-stat">
          <strong>{libraryItems.length}</strong>
          <span>Saved items</span>
        </div>
      </div>
      <div className="library-tabs">
        <button className="selected">Continue watching</button>
        <button>My films</button>
        <button>My games</button>
        <button>Saved items</button>
      </div>
      <div className="library-section-heading">
        <h2>Continue watching</h2>
        <button>View all</button>
      </div>
      <div className="library-grid">
        {libraryItems.map((item) => (
          <article className="library-card" key={item.title} style={{ "--library-color": item.color }}>
            <div className="library-art">
              <span>{item.type}</span>
              <button type="button" onClick={() => alert(`▶️ Playing ${item.title}...`)}>▶</button>
            </div>
            <div className="library-card-body">
              <div className="library-card-heading">
                <h3>{item.title}</h3>
                <span>{item.progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-value" style={{ width: `${item.progress}%` }} />
              </div>
              <p>Continue where you left off</p>
            </div>
          </article>
        ))}
      </div>
      <div className="empty-library">
        <div className="empty-icon">+</div>
        <h2>Build your collection</h2>
        <p>Save films, games and products to find them here whenever you return.</p>
        <button type="button" onClick={() => alert("📚 Explore content feature coming soon!")}>Explore content</button>
      </div>
    </section>
  );
}

export default LibrarySection;