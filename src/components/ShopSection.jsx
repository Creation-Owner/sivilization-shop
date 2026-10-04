const products = [
  {
    title: "Premium Headphones",
    category: "Accessories",
    price: "$59.99",
    rating: "4.8",
    color: "#1e3a8a",
  },
  {
    title: "Sivilization Hoodie",
    category: "Clothing",
    price: "$39.99",
    rating: "4.7",
    color: "#7c2d12",
  },
  {
    title: "Digital Gift Card",
    category: "Digital",
    price: "$25.00",
    rating: "4.9",
    color: "#166534",
  },
  {
    title: "Collector Poster",
    category: "Decor",
    price: "$14.99",
    rating: "4.6",
    color: "#581c87",
  },
  {
    title: "Wireless Controller",
    category: "Gaming",
    price: "$49.99",
    rating: "4.8",
    color: "#0f766e",
  },
  {
    title: "Movie Night Bundle",
    category: "Bundles",
    price: "$29.99",
    rating: "4.9",
    color: "#9f1239",
  },
];

function ShopSection() {
  return (
    <section className="section-page">
      <div className="shop-hero">
        <div>
          <p className="eyebrow">SIVILIZATION MARKET</p>

          <h1>Everything you love, in one place.</h1>

          <p>
            Shop digital products, entertainment accessories and exclusive
            Sivilization items.
          </p>

          <button className="primary-action">
            Explore products
          </button>
        </div>
      </div>

      <div className="shop-heading">
        <div>
          <p className="eyebrow">DISCOVER OUR COLLECTION</p>
          <h2>Featured products</h2>
        </div>

        <button className="cart-button">
          🛒 Cart <span className="cart-count">0</span>
        </button>
      </div>

      <div className="shop-filters">
        <button className="selected">All products</button>
        <button>Digital</button>
        <button>Clothing</button>
        <button>Gaming</button>
        <button>Accessories</button>
        <button>Bundles</button>
      </div>

      <div className="shop-grid">
        {products.map((product) => (
          <article
            className="shop-card"
            key={product.title}
            style={{ "--product-color": product.color }}
          >
            <div className="shop-product-image">
              <span className="product-category">
                {product.category}
              </span>

              <button className="favorite-button" type="button">
                ♡
              </button>
            </div>

            <div className="shop-card-body">
              <div className="product-rating">
                ★ {product.rating}
              </div>

              <h3>{product.title}</h3>

              <p>{product.category}</p>

              <div className="shop-card-footer">
                <strong>{product.price}</strong>

                <button type="button">
                  Add to cart
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ShopSection;