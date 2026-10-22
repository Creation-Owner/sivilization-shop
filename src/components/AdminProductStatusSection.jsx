import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const STATUS_OPTIONS = [
  { id: "ordered", label: "Ordered" },
  { id: "on_the_way", label: "On the way" },
  { id: "at_branch", label: "At branch" },
  { id: "ready_for_pickup", label: "Ready for pickup" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

function formatPrice(cents) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

export default function AdminProductStatusSection() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let alive = true;

    async function loadPurchases() {
      setLoading(true);
      setError("");

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
            title,
            category,
            price_cents
          ),
          user:profiles (
            email,
            full_name
          )
        `,
        )
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

    loadPurchases().catch((loadError) => {
      if (!alive) return;

      setError(
        loadError?.message ||
          "Could not load purchased products.",
      );
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  const filteredPurchases = useMemo(() => {
    if (statusFilter === "all") {
      return purchases;
    }

    return purchases.filter(
      (purchase) => purchase.status === statusFilter,
    );
  }, [purchases, statusFilter]);

  async function updateStatus(purchase, nextStatus) {
    setSavingId(purchase.id);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("product_purchases")
        .update({ status: nextStatus })
        .eq("id", purchase.id);

      if (updateError) {
        throw updateError;
      }

      setPurchases((current) =>
        current.map((item) =>
          item.id === purchase.id
            ? { ...item, status: nextStatus }
            : item,
        ),
      );

      setMessage("Product status updated.");
    } catch (updateError) {
      setError(
        updateError?.message || "Could not update product status.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function updateNote(purchase, note) {
    setSavingId(purchase.id);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("product_purchases")
        .update({ tracking_note: note })
        .eq("id", purchase.id);

      if (updateError) {
        throw updateError;
      }

      setPurchases((current) =>
        current.map((item) =>
          item.id === purchase.id
            ? { ...item, tracking_note: note }
            : item,
        ),
      );

      setMessage("Tracking note updated.");
    } catch (updateError) {
      setError(
        updateError?.message || "Could not update tracking note.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="section-page admin-product-status-page">
      <header className="section-heading">
        <p className="eyebrow">ADMIN CONTROL</p>

        <h1>Product fulfillment</h1>

        <p>
          Update the delivery status and tracking note for customer
          products.
        </p>
      </header>

      <div className="shop-filters">
        <button
          className={statusFilter === "all" ? "selected" : ""}
          type="button"
          onClick={() => setStatusFilter("all")}
        >
          All
        </button>

        {STATUS_OPTIONS.map((status) => (
          <button
            key={status.id}
            className={
              statusFilter === status.id ? "selected" : ""
            }
            type="button"
            onClick={() => setStatusFilter(status.id)}
          >
            {status.label}
          </button>
        ))}
      </div>

      {message && (
        <p className="shop-message" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="media-status media-error" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="media-status" role="status">
          Loading purchased products…
        </p>
      )}

      {!loading && filteredPurchases.length === 0 && (
        <div className="empty-library">
          <h2>No purchased products</h2>

          <p>
            Customer product purchases will appear here after checkout.
          </p>
        </div>
      )}

      <div className="admin-product-list">
        {filteredPurchases.map((purchase) => (
          <article
            className="admin-product-card"
            key={purchase.id}
          >
            <div>
              <h3>
                {purchase.product?.title ||
                  "Product unavailable"}
              </h3>

              <p>
                {purchase.user?.full_name ||
                  purchase.user?.email ||
                  "Customer"}
              </p>

              <p>
                Quantity: {purchase.quantity} • Total:{" "}
                {formatPrice(purchase.total_cents)}
              </p>

              <p>
                Ordered:{" "}
                {new Date(
                  purchase.created_at,
                ).toLocaleDateString()}
              </p>
            </div>

            <div className="admin-product-controls">
              <label>
                <span>Status</span>

                <select
                  value={purchase.status}
                  disabled={savingId === purchase.id}
                  onChange={(event) =>
                    updateStatus(purchase, event.target.value)
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option
                      key={status.id}
                      value={status.id}
                    >
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Tracking note</span>

                <input
                  type="text"
                  defaultValue={
                    purchase.tracking_note || ""
                  }
                  placeholder="Optional customer note"
                  onBlur={(event) =>
                    updateNote(purchase, event.target.value)
                  }
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}