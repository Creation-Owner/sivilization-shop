function ProfileSection({ email, isAdmin, handleLogout }) {
  return (
    <section className="section-page">
      <div className="profile-layout">
        <div className="profile-avatar">S</div>

        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Your profile</h1>
          <p>{email}</p>
          <p>{isAdmin ? "Administrator account" : "Customer account"}</p>
        </div>
      </div>

      <div className="profile-settings">
        <button>Account settings</button>
        <button>Order history</button>
        <button>Payment methods</button>

        <button className="danger-button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </section>
  );
}

export default ProfileSection;