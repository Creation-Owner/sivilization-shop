import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import MediaSection from "./components/MediaSection";
import GamesSection from "./components/GamesSection";
import ShopSection from "./components/ShopSection";
import LibrarySection from "./components/LibrarySection";
import ProfileSection from "./components/ProfileSection";
import AdminDashboard from "./components/AdminDashboard";

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
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) setCart(JSON.parse(savedCart));

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true);
        setUser(session.user);
        checkAdmin(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsLoggedIn(true);
        setUser(session.user);
        checkAdmin(session.user.id);
      } else {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setUser(null);
      }
    });

    // Listen for admin dashboard open event from profile
    const handleOpenAdmin = () => setActiveSection("Admin");
    window.addEventListener('open-admin-dashboard', handleOpenAdmin);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('open-admin-dashboard', handleOpenAdmin);
    };
  }, []);

  async function checkAdmin(userId) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
    setIsAdmin(profile?.is_admin === true);
  }

  async function handleSignup() {
    if (!email || !password) { setMessage("⚠️ Enter email and password."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setMessage("❌ " + error.message);
    else setMessage("✅ Check email to confirm account.");
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) { setMessage("⚠️ Enter email and password."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); setMessage("❌ " + error.message); return; }
    await checkAdmin(data.user.id);
    setLoading(false);
    setMessage("");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setCart([]);
    localStorage.removeItem("cart");
    setActiveSection("Media");
  }

  function addToCart(product) {
    setCart(prev => {
      const existing = prev.find(item => item.title === product.title);
      let newCart;
      if (existing) {
        newCart = prev.map(item => item.title === product.title ? {...item, quantity: item.quantity + 1} : item);
      } else {
        newCart = [...prev, {...product, quantity: 1}];
      }
      localStorage.setItem("cart", JSON.stringify(newCart));
      return newCart;
    });
  }

  function removeFromCart(productTitle) {
    setCart(prev => {
      const newCart = prev.filter(item => item.title !== productTitle);
      localStorage.setItem("cart", JSON.stringify(newCart));
      return newCart;
    });
  }

  function updateQuantity(productTitle, newQty) {
    if (newQty < 1) { removeFromCart(productTitle); return; }
    setCart(prev => {
      const newCart = prev.map(item => item.title === productTitle ? {...item, quantity: newQty} : item);
      localStorage.setItem("cart", JSON.stringify(newCart));
      return newCart;
    });
  }

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price.replace("$", "")) * item.quantity), 0);

  if (!isLoggedIn) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="logo">S</div>
          <h1>Welcome to Sivilization Shop</h1>
          <p className="subtitle">Log in to continue shopping.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            <button type="submit" disabled={loading}>{loading ? "Please wait..." : "Log in"}</button>
          </form>
          <button className="forgot-button" type="button" onClick={async () => {
            if (!email) { setMessage("⚠️ Enter email first."); return; }
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
            if (error) setMessage("❌ " + error.message);
            else setMessage("✅ Check email for reset link.");
          }}>Forgot password?</button>
          <p className="signup-text">
            No account? <button className="signup-button" type="button" onClick={handleSignup} disabled={loading}>Create account</button>
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
          <button className={activeSection === "Media" ? "active" : ""} onClick={() => setActiveSection("Media")}>🎬 Media</button>
          <button className={activeSection === "Games" ? "active" : ""} onClick={() => setActiveSection("Games")}>🎮 Games</button>
          <button className={activeSection === "Shop" ? "active" : ""} onClick={() => setActiveSection("Shop")}>🛒 Shop</button>
          <button className={activeSection === "Library" ? "active" : ""} onClick={() => setActiveSection("Library")}>📚 Library</button>
        </nav>
        <div className="top-actions">
          <input className="search-input" type="search" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="cart-button" onClick={() => setActiveSection("Cart")}>
            🛒 Cart <span className="cart-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </button>
          <div className="profile-menu">
            <button className="profile-button" type="button" onClick={() => setProfileOpen((o) => !o)}>
              👤 {user?.email?.split("@")[0]} <span className="profile-arrow">{profileOpen ? "▲" : "▼"}</span>
            </button>
            {profileOpen && (
              <div className="profile-dropdown">
                <button type="button" onClick={() => { setActiveSection("Profile"); setProfileOpen(false); }}>View profile</button>
                <button className="dropdown-logout" type="button" onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {activeSection === "Media" && <MediaSection />}
      {activeSection === "Games" && <GamesSection />}
      {activeSection === "Shop" && <ShopSection addToCart={addToCart} />}
      {activeSection === "Library" && <LibrarySection />}
      {activeSection === "Profile" && <ProfileSection email={user?.email} isAdmin={isAdmin} handleLogout={handleLogout} />}
      {activeSection === "Admin" && isAdmin && <AdminDashboard />}
      {activeSection === "Cart" && (
        <section className="section-page">
          <h1 style={{color:"white",marginBottom:"20px"}}>🛒 Shopping Cart</h1>
          {cart.length === 0 ? (
            <p style={{color:"#94a3b8"}}>Your cart is empty.</p>
          ) : (
            <div>
              {cart.map(item => (
                <div key={item.title} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"15px",marginBottom:"10px",background:"#101c2e",borderRadius:"10px"}}>
                  <div>
                    <h3 style={{color:"white",margin:"0 0 5px"}}>{item.title}</h3>
                    <p style={{color:"#94a3b8",margin:0}}>{item.price} × {item.quantity}</p>
                  </div>
                  <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                    <button onClick={() => updateQuantity(item.title, item.quantity - 1)} style={{padding:"5px 10px",background:"#2563eb",color:"white",border:"none",borderRadius:"5px",cursor:"pointer"}}>-</button>
                    <span style={{color:"white"}}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.title, item.quantity + 1)} style={{padding:"5px 10px",background:"#2563eb",color:"white",border:"none",borderRadius:"5px",cursor:"pointer"}}>+</button>
                    <button onClick={() => removeFromCart(item.title)} style={{padding:"5px 10px",background:"#dc2626",color:"white",border:"none",borderRadius:"5px",cursor:"pointer"}}>Remove</button>
                  </div>
                </div>
              ))}
              <div style={{marginTop:"30px",padding:"20px",background:"#1e3a5f",borderRadius:"10px",textAlign:"right"}}>
                <h2 style={{color:"white",margin:"0 0 20px"}}>Total: ${cartTotal.toFixed(2)}</h2>
                <button onClick={() => {alert("✅ Checkout feature coming soon!");}} style={{padding:"12px 24px",background:"#22c55e",color:"white",border:"none",borderRadius:"8px",fontSize:"16px",fontWeight:"bold",cursor:"pointer"}}>Proceed to Checkout</button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;