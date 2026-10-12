import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function getPosterUrl(film) {
  if (film.poster_url) return film.poster_url;
  if (!film.poster_path) return "";

  const { data } = supabase.storage
    .from("film-posters")
    .getPublicUrl(film.poster_path);

  return data?.publicUrl || "";
}

function getProductImageUrl(product) {
  if (product.image_url) return product.image_url;
  if (!product.image_path) return "";

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(product.image_path);

  return data?.publicUrl || "";
}

function formatPrice(cents) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

export default function LibrarySection({ search = "" }) {
  const [activeTab, setActiveTab] = useState("products");
  const [savedFilms, setSavedFilms] = useState([]);
  const [purchasedProducts, setPurchasedProducts] = useState([]);
  const [purchasedFilms, setPurchasedFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadLibrary() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!alive) return;

      if (authError || !user) {
        setError("Please sign in to view your library.");
        setLoading(false);
        return;
      }

      try {
        const [savedRes, productsRes, filmsRes] = await Promise.all([
          supabase
            .from("saved_films")
            .select(`
              created_at,
              films (
                id,
                title,
                description,
                genre,
                release_year,
                duration,
                poster_url,
                poster_path,
                access_type
              )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("product_purchases")
            .select(`
              id,
              created_at,
              product:products (
                id,
                title,
                description,
                category,
                price_cents,
                image_url,
                image_path
              )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("purchases")
            .select(`
              id,
              purchase_type,
              price_cents,
              purchased_at,
              film:films (
                id,
                title,
                description,
                genre,
                release_year,
                duration,
                poster_url,
                poster_path,
                access_type
              )
            `)
            .eq("user_id", user.id)
            .order("purchased_at", { ascending: false }),
        ]);

        if (!alive) return;

        if (savedRes.error) {
          console.error("Saved films error:", savedRes.error);
        }
        if (productsRes.error) {
          console.error("Products error:", productsRes.error);
        }
        if (filmsRes.error) {
          console.error("Film purchases error:", filmsRes.error);
        }

        setSavedFilms(
          (savedRes.data || [])
            .filter((row) => row.films)
            .map((row) => ({
              ...row.films,
              saved_at: row.created_at,
            }))
        );

        setPurchasedProducts(
          (productsRes.data || [])
            .filter((row) => row.product)
            .map((row) => ({
              ...row.product,
              purchase_id: row.id,
              purchased_at: row.created_at,
            }))
        );

        setPurchasedFilms(
          (filmsRes.data || [])
            .filter((row) => row.film)
            .map((row) => ({
              ...row.film,
              purchase_id: row.id,
              purchase_type: row.purchase_type,
              purchased_at: row.purchased_at,
            }))
        );
      } catch (err) {
        if (alive) {
          setError(err?.message || "Could not load library.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    loadLibrary();

    return () => {
      alive = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return purchasedProducts;

    return purchasedProducts.filter((product) =>
      [product.title, product.description, product.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [purchasedProducts, search]);

  const filteredPurchasedFilms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return purchasedFilms;

    return purchasedFilms.filter((film) =>
      [film.title, film.description, film.genre]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [purchasedFilms, search]);

  const filteredSavedFilms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return savedFilms;

    return savedFilms.filter((film) =>
      [film.title, film.description, film.genre]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [savedFilms, search]);

  return (
    <section className="content-section">
      <header className="section-heading">
        <p className="eyebrow">Your collection</p>
        <h1>My library</h1>
        <p>
          Browse your purchased products, purchased films, and saved titles.
        </p>
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {loading && (
        <p className="status-line" role="status">
          Loading your library…
        </p>
      )}

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      <div className="media-categories" style={{ marginBottom: "24px" }}>
        <button
          type="button"
          className={activeTab === "products" ? "selected" : ""}
          onClick={() => setActiveTab("products")}
        >
          Purchased Products ({purchasedProducts.length})
        </button>

        <button
          type="button"
          className={activeTab === "films" ? "selected" : ""}
          onClick={() => setActiveTab("films")}
        >
          Purchased Films ({purchasedFilms.length})
        </button>

        <button
          type="button"
          className={activeTab === "saved" ? "selected" : ""}
          onClick={() => setActiveTab("saved")}
        >
          Saved Films ({savedFilms.length})
        </button>
      </div>

      {activeTab === "products" && (
        <>
          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <h2>No purchased products yet</h2>
              <p>Items you buy from the Shop will appear here after checkout.</p>
            </div>
          ) : (
            <div className="catalog-grid">
              {filteredProducts.map((product) => {
                const image = getProductImageUrl(product);

                return (
                  <article
                    className="catalog-card"
                    key={product.purchase_id || product.id}
                  >
                    <div className="catalog-art">
                      {image ? (
                        <img
                          src={image}
                          alt={product.title}
                          loading="lazy"
                        />
                      ) : (
                        <span aria-hidden="true">🛍️</span>
                      )}
                    </div>

                    <div className="catalog-card-body">
                      <div className="card-meta">
                        <span>{product.category || "Product"}</span>
                        <span>{formatPrice(product.price_cents)}</span>
                      </div>
                      <h2>{product.title}</h2>
                      <p>
                        {product.description || "An exclusive Sivilization item."}
                      </p>
                      <span className="access-label">✓ Purchased</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "films" && (
        <>
          {filteredPurchasedFilms.length === 0 ? (
            <div className="empty-state">
              <h2>No purchased films yet</h2>
              <p>Paid films unlocked through checkout will appear here.</p>
            </div>
          ) : (
            <div className="catalog-grid">
              {filteredPurchasedFilms.map((film) => {
                const poster = getPosterUrl(film);

                return (
                  <article
                    className="catalog-card"
                    key={film.purchase_id || film.id}
                  >
                    <div className="catalog-art">
                      {poster ? (
                        <img
                          src={poster}
                          alt={film.title}
                          loading="lazy"
                        />
                      ) : (
                        <span aria-hidden="true">🎬</span>
                      )}
                    </div>

                    <div className="catalog-card-body">
                      <div className="card-meta">
                        <span>{film.genre || "Film"}</span>
                        <span>{film.release_year || ""}</span>
                      </div>
                      <h2>{film.title}</h2>
                      <p>{film.description || ""}</p>
                      <span className="access-label">
                        ✓ Purchased Access
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "saved" && (
        <>
          {filteredSavedFilms.length === 0 ? (
            <div className="empty-state">
              <h2>No saved films</h2>
              <p>
                Save titles from the Media section to bookmark them here.
              </p>
            </div>
          ) : (
            <div className="catalog-grid">
              {filteredSavedFilms.map((film) => {
                const poster = getPosterUrl(film);

                return (
                  <article className="catalog-card" key={film.id}>
                    <div className="catalog-art">
                      {poster ? (
                        <img
                          src={poster}
                          alt={film.title}
                          loading="lazy"
                        />
                      ) : (
                        <span aria-hidden="true">🎬</span>
                      )}
                    </div>

                    <div className="catalog-card-body">
                      <div className="card-meta">
                        <span>{film.genre || "Film"}</span>
                        <span>{film.release_year || ""}</span>
                      </div>
                      <h2>{film.title}</h2>
                      <p>{film.description || ""}</p>
                      <span className="access-label">Saved</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}