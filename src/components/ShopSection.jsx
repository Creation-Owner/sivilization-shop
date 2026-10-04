import { useState } from "react";

export default function ShopSection() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [cartCount, setCartCount] = useState(0);

  const filters = ["All", "Electronics", "Fashion", "Home", "Accessories"];

  const products = [
    {
      name: "Wireless Headphones",
      category: "Electronics",
      rating: 4.5,
      price: 129.99,
      color: "#2563eb",
    },
    {
      name: "Smart Watch",
      category: "Electronics",
      rating: 4.7,
      price: 199.99,
      color: "#7c3aed",
    },
    {
      name: "Designer Jacket",
      category: "Fashion",
      rating: 4.6,
      price: 249.99,
      color: "#dc2626",
    },
    {
      name: "Minimalist Lamp",
      category: "Home",
      rating: 4.8,
      price: 89.99,
      color: "#059669",
    },
  ];

  const filteredProducts =
    activeFilter === "All"
      ? products
      : products.filter((p) => p.category === activeFilter);

  function addToCart() {
    setCartCount((c) => c + 1);
  }

  return (
    <div className="media-page">
      {/* Hero - Media style */}
      <section className="media-hero">
        <div className="media-hero-content">
          <h1>Shop</h1>
          <p className="media-hero-description">
            Premium products curated for quality and style. From tech to fashion.
          </p>
          <div className="media-meta">
            <span>2026</span>
            <span>🛍️ Shopping</span>
            <span>★ 4.6</span>
          </div>
          <div className="media-hero-actions">
            <button className="media-watch-button">Browse All</button>
            <button className="media-list-button">
              Cart {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
        </div>
      </section>

      {/* Filters - Media style */}
      <div className="media-categories">
        {filters.map((f) => (
          <button
            key={f}
            className={activeFilter === f ? "selected" : ""}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Products Grid - Media style cards */}
      <section className="media-row-section">
        <div className="media-row-heading">
          <h2>{activeFilter} Products</h2>
          <button>View All</button>
        </div>

        <div className="media-film-grid">
          {filteredProducts.map((product, idx) => (
            <div key={idx} className="media-film-card">
              <div
                className="media-film-poster"
                style={{ "--film-color": product.color }}
              >
                <div className="media-film-top">
                  <span>{product.category}</span>
                  <button className="media-save-button">♥</button>
                </div>
                <div className="media-film-bottom">
                  <span>★ {product.rating}</span>
                </div>
                <button className="media-play-button" onClick={addToCart}>
                  ▶
                </button>
              </div>
              <div className="media-film-body">
                <h3>{product.name}</h3>
                <p>${product.price}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
