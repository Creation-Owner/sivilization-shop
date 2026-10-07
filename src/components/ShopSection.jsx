import { useEffect, useMemo, useState } from "react";

const filters = ["All", "Electronics", "Fashion", "Home", "Accessories"];

const products = [
  {
    id: "wireless-headphones",
    name: "Wireless Headphones",
    category: "Electronics",
    rating: 4.5,
    price: 129.99,
    color: "#2563eb",
    description: "Immersive sound, comfortable fit, and all-day wireless listening.",
  },
  {
    id: "smart-watch",
    name: "Smart Watch",
    category: "Electronics",
    rating: 4.7,
    price: 199.99,
    color: "#7c3aed",
    description: "A sleek everyday watch for activity, health, and notifications.",
  },
  {
    id: "designer-jacket",
    name: "Designer Jacket",
    category: "Fashion",
    rating: 4.6,
    price: 249.99,
    color: "#dc2626",
    description: "A premium jacket designed for confident everyday style.",
  },
  {
    id: "minimalist-lamp",
    name: "Minimalist Lamp",
    category: "Home",
    rating: 4.8,
    price: 89.99,
    color: "#059669",
    description: "Warm, focused lighting with a simple modern silhouette.",
  },
];

export default function ShopSection() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [cartItems, setCartItems] = useState([]);
  const [savedProductIds, setSavedProductIds] = useState(() => new Set());
  const [notice, setNotice] = useState("");

  const filteredProducts = useMemo(() => {
    if (activeFilter === "All") {
      return products;
    }

    return products.filter((product) => product.category === activeFilter);
  }, [activeFilter]);

  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice("");
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  function scrollToProducts() {
    document.getElementById("shop-products")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function showAllProducts() {
    setActiveFilter("All");

    window.setTimeout(() => {
      scrollToProducts();
    }, 0);
  }

  function addToCart(product) {
    setCartItems((previousCartItems) => {
      const existingItem = previousCartItems.find(
        (item) => item.id === product.id,
      );

      if (existingItem) {
        return previousCartItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...previousCartItems, { ...product, quantity: 1 }];
    });

    setNotice(`${product.name} added to your cart.`);
  }

  function toggleSavedProduct(product) {
    setSavedProductIds((previousIds) => {
      const nextIds = new Set(previousIds);

      if (nextIds.has(product.id)) {
        nextIds.delete(product.id);
        setNotice(`${product.name} removed from your saved products.`);
      } else {
        nextIds.add(product.id);
        setNotice(`${product.name} saved for later.`);
      }

      return nextIds;
    });
  }

  function showCartSummary() {
    if (cartItems.length === 0) {
      setNotice("Your cart is empty.");
      return;
    }

    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    setNotice(
      `Your cart has ${cartCount} item${cartCount === 1 ? "" : "s"} — total $${total.toFixed(2)}.`,
    );
  }

  return (
    <section className="media-page section-page">
      <section className="media-hero">
        <div className="media-hero-content">
          <p className="eyebrow">SIVILIZATION STORE</p>
          <h1>Shop</h1>

          <p className="media-hero-description">
            Premium products curated for quality and style, from technology to
            fashion and home essentials.
          </p>

          <div className="media-meta">
            <span>{products.length} featured products</span>
            <span>🛍️ Curated shopping</span>
            <span>★ 4.6 average rating</span>
          </div>

          <div className="media-hero-actions">
            <button
              className="media-watch-button"
              type="button"
              onClick={showAllProducts}
            >
              Browse all
            </button>

            <button
              className="media-list-button"
              type="button"
              onClick={showCartSummary}
            >
              Cart{" "}
              {cartCount > 0 && (
                <span className="cart-count">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </section>

      <div className="media-categories" aria-label="Shop categories">
        {filters.map((filter) => (
          <button
            key={filter}
            className={activeFilter === filter ? "selected" : ""}
            type="button"
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <section className="media-row-section" id="shop-products">
        <div className="media-row-heading">
          <div>
            <p className="eyebrow">COLLECTION</p>
            <h2>{activeFilter} products</h2>
          </div>

          <button type="button" onClick={showAllProducts}>
            View all
          </button>
        </div>

        {filteredProducts.length === 0 ? (
          <p className="media-status">
            No products are available in this category yet.
          </p>
        ) : (
          <div className="media-film-grid">
            {filteredProducts.map((product) => {
              const isSaved = savedProductIds.has(product.id);

              return (
                <article key={product.id} className="media-film-card">
                  <div
                    className="media-film-poster"
                    style={{ "--film-color": product.color }}
                  >
                    <div className="media-film-top">
                      <span>{product.category}</span>

                      <button
                        className={
                          isSaved
                            ? "media-save-button saved"
                            : "media-save-button"
                        }
                        type="button"
                        onClick={() => toggleSavedProduct(product)}
                        aria-label={
                          isSaved
                            ? `Remove ${product.name} from saved products`
                            : `Save ${product.name} for later`
                        }
                      >
                        {isSaved ? "♥" : "♡"}
                      </button>
                    </div>

                    <div className="media-film-bottom">
                      <span>★ {product.rating}</span>
                    </div>

                    <button
                      className="media-play-button"
                      type="button"
                      onClick={() => addToCart(product)}
                      aria-label={`Add ${product.name} to cart`}
                    >
                      🛒
                    </button>
                  </div>

                  <div className="media-film-body">
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <strong>${product.price.toFixed(2)}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {notice && (
        <p className="premium-notice" role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </section>
  );
}