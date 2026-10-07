import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import MediaSection from "./components/MediaSection";
import GamesSection from "./components/GamesSection";
import ShopSection from "./components/ShopSection";
import LibrarySection from "./components/LibrarySection";
import ProfileSection from "./components/ProfileSection";
import AdminDashboard from "./components/AdminDashboard";
import FilmStudioPage from "./components/FilmStudioPage";
import GameStudioPage from "./components/GameStudioPage";
import FilmDetailsPage from "./components/FilmDetailsPage";
import SubscriptionsSection from "./components/SubscriptionsSection";
import AdminSubscriptionPlans from "./components/AdminSubscriptionPlans";


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
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [allMediaFilms, setAllMediaFilms] = useState([]);

  async function loadUserState(user) {
    if (!user) {
      setIsLoggedIn(false);
      setIsAdmin(false);
      setEmail("");
      return;
    }

    setIsLoggedIn(true);
    setEmail(user.email || "");

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Could not load profile:", error);
    }

    setIsAdmin(profile?.is_admin === true);
  }

  useEffect(() => {
    async function restoreSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await loadUserState(session?.user || null);
    }

    restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserState(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignup() {
    if (!email || !password) {
      setMessage("Enter your email and password first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.session && data.user) {
      await loadUserState(data.user);
      return;
    }

    setMessage(
      "Account created. Check your email to confirm your account before logging in.",
    );
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

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadUserState(data.user);
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setPassword("");
    setMessage("");
    setProfileOpen(false);
    setSelectedFilm(null);
    setAllMediaFilms([]);
    setActiveSection("Media");
  }

  function openSection(section) {
    setActiveSection(section);
    setSelectedFilm(null);
    setProfileOpen(false);
  }

  function handleOpenFilm(film, films) {
    setAllMediaFilms(films || []);
    setSelectedFilm(film);
    setActiveSection("Media");
    setProfileOpen(false);
  }

  if (!isLoggedIn) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="logo">S</div>

          <h1>Welcome to Sivilization Shop</h1>

          <p className="subtitle">
            Log in to watch, play, shop and manage your account.
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
        <button
          className="brand brand-button"
          type="button"
          onClick={() => openSection("Media")}
        >
          <span className="small-logo">S</span>
          <span>Sivilization Shop</span>
        </button>

        <nav className="main-nav">
          <button
            className={activeSection === "Media" ? "active" : ""}
            type="button"
            onClick={() => openSection("Media")}
          >
            Films, Cartoons & Dramas
          </button>

          <button
            className={activeSection === "Games" ? "active" : ""}
            type="button"
            onClick={() => openSection("Games")}
          >
            Games
          </button>

          <button
            className={activeSection === "Shop" ? "active" : ""}
            type="button"
            onClick={() => openSection("Shop")}
          >
            Shop
          </button>

          <button
            className={activeSection === "Library" ? "active" : ""}
            type="button"
            onClick={() => openSection("Library")}
          >
            Library
          </button>

          <button
            className={activeSection === "Subscriptions" ? "active" : ""}
            type="button"
            onClick={() => openSection("Subscriptions")}
          >
            Subscriptions
          </button>

          {isAdmin && (
            <button
              className={
                ["Admin", "FilmStudio", "GameStudio"].includes(
                  activeSection,
                )
                  ? "active admin-nav-button"
                  : "admin-nav-button"
              }
              type="button"
              onClick={() => openSection("Admin")}
            >
              Admin
            </button>
          )}
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
                  onClick={() => openSection("Profile")}
                >
                  View profile
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openSection("Admin")}
                  >
                    Admin dashboard
                  </button>
                )}

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

      {activeSection === "Media" && !selectedFilm && (
        <MediaSection onOpenFilm={handleOpenFilm} />
      )}

      {activeSection === "Media" && selectedFilm && (
        <FilmDetailsPage
          film={selectedFilm}
          allFilms={allMediaFilms}
          email={email}
          onBack={() => setSelectedFilm(null)}
          onOpenFilm={(film) => setSelectedFilm(film)}
          onNavigateToSubscriptions={() => openSection("Subscriptions")}
        />
      )}

      {activeSection === "Games" && <GamesSection />}

      {activeSection === "Shop" && <ShopSection />}

      {activeSection === "Library" && <LibrarySection />}

      {activeSection === "Subscriptions" && (
        <SubscriptionsSection />
      )}

      {activeSection === "Profile" && (
        <ProfileSection
          email={email}
          isAdmin={isAdmin}
          handleLogout={handleLogout}
        />
      )}

      {isAdmin && activeSection === "Admin" && (
        <AdminDashboard
          onOpenFilmStudio={() => openSection("FilmStudio")}
          onOpenGameStudio={() => openSection("GameStudio")}
        />
      )}

      {isAdmin && activeSection === "FilmStudio" && (
        <FilmStudioPage onBack={() => openSection("Admin")} />
      )}

      {isAdmin && activeSection === "GameStudio" && (
        <GameStudioPage onBack={() => openSection("Admin")} />
      )}
    </main>
  );
}

export default App;