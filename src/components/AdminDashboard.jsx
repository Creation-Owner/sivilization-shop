function AdminDashboard({
  onOpenFilmStudio,
  onOpenGameStudio,
  onOpenSubscriptionPlans,
}) {
  return (
    <section className="admin-dashboard-page section-page">
      <h1>Admin Dashboard</h1>

      <div className="admin-cards-grid">
        <article className="admin-card">
          <h2>Film Studio</h2>
          <p>Upload and manage films, cartoons and dramas.</p>
          <button
            className="media-watch-button"
            type="button"
            onClick={onOpenFilmStudio}
          >
            Open Film Studio
          </button>
        </article>

        <article className="admin-card">
          <h2>Game Studio</h2>
          <p>Upload and manage games.</p>
          <button
            className="media-watch-button"
            type="button"
            onClick={onOpenGameStudio}
          >
            Open Game Studio
          </button>
        </article>

        <article className="admin-card">
          <h2>Subscription Plans</h2>
          <p>Manage subscription plans shown to users.</p>
          <button
            className="media-watch-button"
            type="button"
            onClick={onOpenSubscriptionPlans}
          >
            Manage plans
          </button>
        </article>
      </div>
    </section>
  );
}

export default AdminDashboard;