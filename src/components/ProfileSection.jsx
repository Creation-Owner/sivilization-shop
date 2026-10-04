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
        <button type="button" onClick={() => alert("⚙️ Account settings coming soon!")}>⚙️ Account settings</button>
        <button type="button" onClick={() => alert("📦 Order history coming soon!")}>📦 Order history</button>
        <button type="button" onClick={() => alert("💳 Payment methods coming soon!")}>💳 Payment methods</button>
        <button className="danger-button" type="button" onClick={handleLogout}>🚪 Log out</button>
      </div>
    </section>
  );
}

export default ProfileSection;