import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const STATUS_GROUPS = [
  {
    id: "ordered",
    title: "Ordered",
    description: "Your order has been received.",
  },
  {
    id: "on_the_way",
    title: "On the way",
    description: "Your product is on the way.",
  },
  {
    id: "at_branch",
    title: "At branch",
    description: "Your product has arrived at the branch.",
  },
  {
    id: "ready_for_pickup",
    title: "Ready for pickup",
    description: "Your product is ready to collect.",
  },
  {
    id: "delivered",
    title: "Delivered",
    description: "Your product has been delivered.",
  },
  {
    id: "cancelled",
    title: "Cancelled",
    description: "This order was cancelled.",
  },
];

function formatPrice(cents) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

function getProductImage(product) {
  if (product.image_url) {
    return product.image_url;
  }

  if (!product.image_path) {
    return "";
  }

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(product.image_path);

  return data?.publicUrl || "";
}

export default function MyProductsSection() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadProducts() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Please log in to view your products.");
      }

      const { data, error: queryError } = await supabase
        .from("product_purchases")
        .select(
          `
          id,
          quantity,
          total_cents,
          status,
          tracking_note,
          created_at,
          updated_at,
          product:products (
            id,
            title,
            description,
            category,
            price_cents,
            image_url,
            image_path
          )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (queryError) {
        throw queryError;
      }

      if (!alive) {
        return;
      }

      setPurchases(data || []);
      setLoading(false);
    }

    loadProducts().catch((loadError) => {
      if (!alive) return;

      setError(
        loadError?.message || "Could not load your products.",
      );
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  const groupedProducts = useMemo(() => {
    return STATUS_GROUPS.map((group) => ({
      ...group,
      items: purchases.filter(
        (purchase) => purchase.status === group.id,
      ),
    }));
  }, [purchases]);

  if (loading) {
    return (
      <section className="section-page">
        <p className="media-status" role="status">
          Loading your products…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section-page">
        <p className="media-status media-error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="section-page my-products-page">
      <header className="section-heading">
        <p className="eyebrow">YOUR PURCHASES</p>

        <h1>My products</h1>

        <p>
          Track the status of every product you ordered from
          Sivilization.
        </p>
      </header>

      {purchases.length === 0 && (
        <div className="empty-library">
          <h2>No products yet</h2>

          <p>
            Products you buy from the Shop will appear here with
            their delivery status.
          </p>
        </div>
      )}

      {groupedProducts.map((group) => {
        if (group.items.length === 0) {
          return null;
        }

        return (
          <div className="product-status-section" key={group.id}>
            <div className="product-status-header">
              <h2>{group.title}</h2>

              <span className="product-status-count">
                {group.items.length}{" "}
                {group.items.length === 1 ? "product" : "products"}
              </span>
            </div>

            <p className="product-status-description">
              {group.description}
            </p>

            <div className="shop-grid">
              {group.items.map((purchase) => {
                const product = purchase.product;
                const imageUrl = getProductImage(product || {});

                return (
                  <article
                    className="shop-card"
                    key={purchase.id}
                  >
                    <div className="shop-product-image">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product?.title || "Product"}
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className="shop-product-placeholder"
                          aria-hidden="true"
                        >
                          🛍️
                        </span>
                      )}

                      <span className="product-category">
                        {group.title}
                      </span>
                    </div>

                    <div className="shop-card-body">
                      <h3>
                        {product?.title || "Product unavailable"}
                      </h3>

                      <p>
                        {product?.description ||
                          "This product is no longer available."}
                      </p>

                      <div className="shop-card-footer">
                        <strong>
                          {formatPrice(purchase.total_cents)}
                        </strong>

                        <span>
                          Quantity: {purchase.quantity}
                        </span>
                      </div>

                      {purchase.tracking_note && (
                        <p className="product-tracking-note">
                          {purchase.tracking_note}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}