import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

import HomeSection from "./components/HomeSection";
import MediaSection from "./components/MediaSection";
import FilmDetailsPage from "./components/FilmDetailsPage";
import GamesSection from "./components/GamesSection";
import ShopSection from "./components/ShopSection";
import CartSection from "./components/CartSection";
import LibrarySection from "./components/LibrarySection";
import ProfileSection from "./components/ProfileSection";
import AdminContentPage from "./components/AdminContentPage";
import OwnerUsersPage from "./components/OwnerUsersPage";
import ProductStudioPage from "./components/ProductStudioPage";
import SubscriptionsSection from "./components/SubscriptionsSection";
import SubscriptionStudioPage from "./components/SubscriptionStudioPage";

const NAV_ITEMS = [
  { id: "Home", label: "Home" },
  { id: "Media", label: "Films & media" },
  { id: "Games", label: "Games" },
  { id: "Shop", label: "Shop" },
  { id: "Subscriptions", label: "Subscriptions" },
  { id: "Cart", label: "Cart" },
  { id: "Library", label: "Library" },
];

function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    showMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });

        if (error) throw error;

        setPassword("");
        setMode("login");

        showMessage(
          "Account created. Check your email to confirm your address before logging in.",
          "success",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      showMessage(error?.message || "Authentication failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      showMessage("Enter your email address first.", "error");
      return;
    }

    setBusy(true);
    showMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: window.location.origin },
      );

      if (error) throw error;

      showMessage(
        "If an account exists for that address, a password reset email has been sent.",
        "success",
      );
    } catch (error) {
      showMessage(
        error?.message || "Could not send the reset email.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>

        <p className="eyebrow">Sivilization</p>

        <h1 id="auth-title">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>

        <p className="auth-subtitle">
          Sign in to explore films, games, and your saved library.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email address</label>

          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={busy}
          />

          <label htmlFor="auth-password">Password</label>

          <input
            id="auth-password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={busy}
          />

          <button
            className="button button-primary auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        {mode === "login" && (
          <button
            className="text-button reset-link"
            type="button"
            onClick={handlePasswordReset}
            disabled={busy}
          >
            Forgot password?
          </button>
        )}

        <p className="auth-switch">
          {mode === "signup"
            ? "Already have an account?"
            : "New to Sivilization?"}{" "}
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setMode((current) =>
                current === "signup" ? "login" : "signup",
              );
              showMessage("");
            }}
          >
            {mode === "signup" ? "Log in" : "Create account"}
          </button>
        </p>

        {message && (
          <p
            className={`notice ${messageType}`}
            role={messageType === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}

function AppShell({ user }) {
  const [activeSection, setActiveSection] = useState("Home");
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState("");
  const [cartCount, setCartCount] = useState(0);

  // This parent state determines whether catalogue or film page is rendered.
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [allMediaFilms, setAllMediaFilms] = useState([]);

  const email = user.email || "";
  const username = email ? email.split("@")[0] : "Sivilization user";

  useEffect(() => {
    let alive = true;

    async function loadRole() {
      setRoleLoading(true);
      setRoleError("");

      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin,is_owner")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setIsAdmin(false);
        setIsOwner(false);
        setRoleError(error.message);
      } else {
        setIsAdmin(data?.is_admin === true);
        setIsOwner(data?.is_owner === true);
      }

      setRoleLoading(false);
    }

    loadRole();

    return () => {
      alive = false;
    };
  }, [user.id]);

  useEffect(() => {
    let alive = true;

    async function loadCartCount() {
      const { data, error } = await supabase
        .from("cart_items")
        .select("quantity")
        .eq("user_id", user.id);

      if (!alive) return;

      if (!error) {
        setCartCount(
          (data || []).reduce(
            (total, item) => total + (Number(item.quantity) || 0),
            0,
          ),
        );
      }
    }

    loadCartCount();

    return () => {
      alive = false;
    };
  }, [user.id]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) setRoleError(error.message);
  }

  function navigate(section) {
    setActiveSection(section);
    setProfileOpen(false);

    if (section !== "Media") {
      setSelectedFilm(null);
    }

    if (!["Media", "Games", "Shop", "Library"].includes(section)) {
      setSearch("");
    }
  }

  function handleOpenFilm(film, films = []) {
    if (!film) return;

    setAllMediaFilms(films);
    setSelectedFilm(film);
    setActiveSection("Media");
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleOpenRelatedFilm(film) {
    if (!film) return;

    setSelectedFilm(film);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBackToFilms() {
    setSelectedFilm(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refreshCartCount() {
    setCartCount((current) => current + 1);
  }

  return (
    <main className="site-page">
      <header className="topbar">
        <button
          className="brand brand-button"
          type="button"
          onClick={() => navigate("Home")}
          aria-label="Sivilization home"
        >
          <span className="brand-mark small" aria-hidden="true">
            S
          </span>
          <span>Sivilization</span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={activeSection === item.id ? "active" : ""}
              type="button"
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              {item.label}

              {item.id === "Cart" && cartCount > 0 && (
                <span className="cart-count">{cartCount}</span>
              )}
            </button>
          ))}

          {!roleLoading && isAdmin && (
            <button
              className={
                activeSection === "Admin"
                  ? "active admin-nav-button"
                  : "admin-nav-button"
              }
              type="button"
              aria-current={activeSection === "Admin" ? "page" : undefined}
              onClick={() => navigate("Admin")}
            >
              Admin
            </button>
          )}

          {!roleLoading && isOwner && (
            <>
              <button
                className={
                  activeSection === "Owner"
                    ? "active owner-nav-button"
                    : "owner-nav-button"
                }
                type="button"
                aria-current={activeSection === "Owner" ? "page" : undefined}
                onClick={() => navigate("Owner")}
              >
                Owner
              </button>

              <button
                className={
                  activeSection === "ProductStudio"
                    ? "active owner-nav-button"
                    : "owner-nav-button"
                }
                type="button"
                aria-current={
                  activeSection === "ProductStudio" ? "page" : undefined
                }
                onClick={() => navigate("ProductStudio")}
              >
                Product Studio
              </button>

              <button
                className={
                  activeSection === "SubscriptionStudio"
                    ? "active owner-nav-button"
                    : "owner-nav-button"
                }
                type="button"
                aria-current={
                  activeSection === "SubscriptionStudio" ? "page" : undefined
                }
                onClick={() => navigate("SubscriptionStudio")}
              >
                Subscription Studio
              </button>
            </>
          )}
        </nav>

        <div className="top-actions">
          {["Media", "Games", "Shop", "Library"].includes(activeSection) &&
            !(activeSection === "Media" && selectedFilm) && (
              <>
                <label className="visually-hidden" htmlFor="site-search">
                  Search catalog
                </label>

                <input
                  id="site-search"
                  className="search-input"
                  type="search"
                  placeholder="Search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </>
            )}

          <div className="profile-menu">
            <button
              className="profile-button"
              type="button"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span>{username}</span>
              <span aria-hidden="true">{profileOpen ? "▲" : "▼"}</span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <button type="button" onClick={() => navigate("Profile")}>
                  Profile
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

      {roleError && (
        <div className="content-section">
          <p className="notice error" role="alert">
            Could not read your account role: {roleError}
          </p>
        </div>
      )}

      {activeSection === "Home" && (
        <HomeSection
          email={email}
          cartItemCount={cartCount}
          onNavigate={navigate}
        />
      )}

      {activeSection === "Media" && !selectedFilm && (
        <MediaSection
          search={search}
          onOpenFilm={handleOpenFilm}
          onOpenSubscriptions={() => navigate("Subscriptions")}
        />
      )}

      {activeSection === "Media" && selectedFilm && (
        <FilmDetailsPage
          key={selectedFilm.id}
          film={selectedFilm}
          allFilms={allMediaFilms}
          email={email}
          onBack={handleBackToFilms}
          onOpenFilm={handleOpenRelatedFilm}
          onNavigateToSubscriptions={() => navigate("Subscriptions")}
        />
      )}

      {activeSection === "Games" && <GamesSection search={search} />}

      {activeSection === "Shop" && (
        <ShopSection
          search={search}
          onOpenCart={() => navigate("Cart")}
          onCartChange={refreshCartCount}
        />
      )}

      {activeSection === "Subscriptions" && <SubscriptionsSection />}

      {activeSection === "Cart" && (
        <CartSection onCartChange={refreshCartCount} />
      )}

      {activeSection === "Library" && <LibrarySection search={search} />}

      {activeSection === "Profile" && (
        <ProfileSection
          email={email}
          isAdmin={isAdmin}
          handleLogout={handleLogout}
          onOpenSubscriptions={() => navigate("Subscriptions")}
        />
      )}

      {activeSection === "Admin" && isAdmin && (
        <AdminContentPage onBack={() => navigate("Home")} />
      )}

      {activeSection === "Admin" && !roleLoading && !isAdmin && (
        <section className="content-section">
          <div className="empty-state">
            <h2>Administrator access required</h2>
            <p>Your account is not authorized to open the admin area.</p>
          </div>
        </section>
      )}

      {activeSection === "Owner" && isOwner && <OwnerUsersPage />}

      {activeSection === "Owner" && !roleLoading && !isOwner && (
        <section className="content-section">
          <div className="empty-state">
            <h2>Owner access required</h2>
            <p>Only the website owner can manage users and permissions.</p>
          </div>
        </section>
      )}

      {activeSection === "ProductStudio" && isOwner && (
        <ProductStudioPage />
      )}

      {activeSection === "SubscriptionStudio" && isOwner && (
        <SubscriptionStudioPage />
      )}

      {activeSection === "SubscriptionStudio" &&
        !roleLoading &&
        !isOwner && (
          <section className="content-section">
            <div className="empty-state">
              <h2>Owner access required</h2>
              <p>Only the website owner can manage subscription plans.</p>
            </div>
          </section>
        )}

      {activeSection === "ProductStudio" && !roleLoading && !isOwner && (
        <section className="content-section">
          <div className="empty-state">
            <h2>Owner access required</h2>
            <p>Only the website owner can create paid products.</p>
          </div>
        </section>
      )}

      <footer className="app-footer">
        <span>© {new Date().getFullYear()} Sivilization</span>
        <span>Films, games, products, and memberships in one place.</span>
      </footer>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    let alive = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;

        if (error) setStartupError(error.message);
        setSession(data?.session ?? null);
      })
      .catch((error) => {
        if (alive) {
          setStartupError(
            error?.message || "Could not read the login session.",
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="app-loading" role="status">
        <span className="brand-mark" aria-hidden="true">
          S
        </span>
        <p>Connecting to Supabase…</p>
      </main>
    );
  }

  if (startupError && !session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark" aria-hidden="true">
            !
          </div>

          <p className="eyebrow">Supabase connection</p>
          <h1>Could not start your session</h1>
          <p className="auth-subtitle">{startupError}</p>
          <p className="setup-hint">
            Check the Supabase URL and publishable/anon key in `.env.local`,
            then restart Vite.
          </p>

          <button
            className="button button-secondary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  return session ? <AppShell user={session.user} /> : <AuthPage />;
}