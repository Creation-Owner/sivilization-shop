import { useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import MediaSection from "./components/MediaSection";
import GamesSection from "./components/GamesSection";
import ShopSection from "./components/ShopSection";
import LibrarySection from "./components/LibrarySection";
import ProfileSection from "./components/ProfileSection";



function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState("Media");
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  async function handleSignup() {
    if (!email || !password) {
      setMessage("Enter your email and password first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Account created. Check your email to confirm it.");
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (!email || !password) {
      setMessage("Enter your email and password first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    setIsLoggedIn(true);
    setIsAdmin(profile?.is_admin === true);
    setLoading(false);
    setMessage("");
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setIsLoggedIn(false);
    setIsAdmin(false);
    setEmail("");
    setPassword("");
    setMessage("");
    setActiveSection("Media");
  }

  

  if (!isLoggedIn) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="logo">S</div>

          <h1>Welcome to Sivilization Shop</h1>

          <p className="subtitle">
            Log in to continue shopping.
          </p>

          <form onSubmit={handleLogin}>
            <label htmlFor="email">Email address</label>

            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Please wait..." : "Log in"}
            </button>
          </form>

          <button className="forgot-button" type="button">
            Forgot password?
          </button>

          <p className="signup-text">
            Do not have an account?{" "}
            <button
              className="signup-button"
              type="button"
              onClick={handleSignup}
              disabled={loading}
            >
              Create account
            </button>
          </p>

          {message && <p className="auth-message">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="site-page">
      <header className="topbar">
        <div className="brand">
          <div className="small-logo">S</div>
          <span>Sivilization Shop</span>
        </div>

        <nav className="main-nav">
          <button
            className={activeSection === "Media" ? "active" : ""}
            onClick={() => setActiveSection("Media")}
          >
            Films, Cartoons & Dramas
          </button>

          <button
            className={activeSection === "Games" ? "active" : ""}
            onClick={() => setActiveSection("Games")}
          >
            Games
          </button>

          <button
            className={activeSection === "Shop" ? "active" : ""}
            onClick={() => setActiveSection("Shop")}
          >
            Shop
          </button>

          <button
            className={activeSection === "Library" ? "active" : ""}
            onClick={() => setActiveSection("Library")}
          >
            Library
          </button>
        </nav>

        <div className="top-actions">
          <input
            className="search-input"
            type="search"
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="profile-menu">
            <button
              className="profile-button"
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
            >
              Profile
              <span className="profile-arrow">
                {profileOpen ? "▲" : "▼"}
              </span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("Profile");
                    setProfileOpen(false);
                  }}
                >
                  View profile
                </button>

                <button
                  className="dropdown-logout"
                  type="button"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

          {activeSection === "Media" && <MediaSection />}

          {activeSection === "Games" && <GamesSection />}

          {activeSection === "Shop" && <ShopSection />}

          {activeSection === "Library" && <LibrarySection />}

          {activeSection === "Profile" && (
            <ProfileSection
              email={email}
              isAdmin={isAdmin}
              handleLogout={handleLogout}
            />
          )}

    

      

      
    </main>
  );
}

export default App;