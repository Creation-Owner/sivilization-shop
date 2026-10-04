function ProfileSection({ email, isAdmin, handleLogout }) {
  return (
    <section className="section-page">
      <div className="profile-layout">
        <div className="profile-avatar">S</div>
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Your profile</h1>
          <p style={{ color: "#e2e8f0", margin: "4px 0" }}>{email}</p>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>{isAdmin ? "👑 Administrator account" : "👤 Customer account"}</p>
        </div>
      </div>

      <div className="profile-settings">
        {isAdmin && (
          <button 
            type="button" 
            onClick={() => {
              // Dispatch custom event to open admin dashboard
              window.dispatchEvent(new CustomEvent('open-admin-dashboard'));
            }}
            style={{
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              border: "1px solid #3b82f6",
              color: "white",
              fontWeight: "bold",
            }}
          >
            👑 Admin Dashboard
          </button>
        )}
        <button type="button" onClick={() => alert("⚙️ Account settings coming soon!")}>⚙️ Account settings</button>
        <button type="button" onClick={() => alert("📦 Order history coming soon!")}>📦 Order history</button>
        <button type="button" onClick={() => alert("💳 Payment methods coming soon!")}>💳 Payment methods</button>
        <button className="danger-button" type="button" onClick={handleLogout}>🚪 Log out</button>
      </div>
    </section>
  );
}

export default ProfileSection;