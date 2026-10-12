import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function formatMoney(cents) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

export default function OwnerUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadUsers() {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase.rpc(
        "get_all_users"
      );

      if (!alive) return;

      if (queryError) {
        setUsers([]);
        setError(queryError.message);
      } else {
        setUsers(data || []);
      }

      setLoading(false);
    }

    loadUsers();

    return () => {
      alive = false;
    };
  }, []);

  const filteredUsers = users.filter((user) => {
    const term = search.trim().toLowerCase();

    return (
      !term ||
      (user.email || "").toLowerCase().includes(term) ||
      user.id.toLowerCase().includes(term)
    );
  });

  async function logAction(targetUserId, action, details = {}) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in.");
    }

    const { error: logError } = await supabase
      .from("owner_actions")
      .insert({
        owner_id: user.id,
        target_user_id: targetUserId,
        action,
        details,
      });

    if (logError) {
      throw logError;
    }
  }

  async function updateProfile(userId, updates, action) {
    setBusyId(userId);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }

      await logAction(userId, action, updates);

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, ...updates } : user
        )
      );

      setMessage("User updated successfully.");
    } catch (actionError) {
      setError(actionError?.message || "Could not update this user.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleAdmin(user) {
    updateProfile(
      user.id,
      { is_admin: !user.is_admin },
      user.is_admin ? "remove_admin" : "make_admin"
    );
  }

  function addMoney(user, amount) {
    const amountCents = Math.round(Number(amount) * 100);

    if (!amountCents || amountCents <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    updateProfile(
      user.id,
      {
        wallet_balance_cents:
          (Number(user.wallet_balance_cents) || 0) + amountCents,
      },
      "add_wallet_balance"
    );
  }

  function addSubscriptionDays(user, days) {
    const daysNumber = Number(days);

    if (!daysNumber || daysNumber <= 0) {
      setError("Enter a number of days greater than zero.");
      return;
    }

    const currentExpiry = user.subscription_expires_at
      ? new Date(user.subscription_expires_at)
      : new Date();

    const baseDate =
      currentExpiry > new Date() ? currentExpiry : new Date();

    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + daysNumber);

    updateProfile(
      user.id,
      { subscription_expires_at: newExpiry.toISOString() },
      "extend_subscription"
    );
  }

  return (
    <section className="section-page owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">OWNER CONTROL</p>
          <h1>User management</h1>
          <p>
            Review every Supabase account, promote administrators, extend
            subscriptions, and manually add wallet balance.
          </p>
        </div>
      </header>

      <input
        className="search-input owner-search"
        type="search"
        placeholder="Search by Gmail address or user ID"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="media-status" role="status">
          Loading users…
        </p>
      )}

      {!loading && !error && filteredUsers.length === 0 && (
        <div className="empty-library">
          <h2>No users found</h2>
          <p>Try a different Gmail address or user ID.</p>
        </div>
      )}

      <div className="owner-user-list">
        {filteredUsers.map((user) => (
          <OwnerUserCard
            key={user.id}
            user={user}
            busy={busyId === user.id}
            onToggleAdmin={() => toggleAdmin(user)}
            onAddMoney={addMoney}
            onAddSubscriptionDays={addSubscriptionDays}
          />
        ))}
      </div>
    </section>
  );
}

function OwnerUserCard({
  user,
  busy,
  onToggleAdmin,
  onAddMoney,
  onAddSubscriptionDays,
}) {
  const [moneyAmount, setMoneyAmount] = useState("");
  const [subscriptionDays, setSubscriptionDays] = useState("");

  return (
    <article className="owner-user-card">
      <div className="owner-user-main">
        <h3>{user.email || "No email available"}</h3>

        <p className="owner-user-id">ID: {user.id}</p>

        <div className="owner-user-badges">
          {user.is_owner && <span className="owner-badge">Owner</span>}

          {user.is_admin && <span className="admin-badge">Admin</span>}

          {!user.is_admin && !user.is_owner && (
            <span className="customer-badge">Customer</span>
          )}
        </div>

        <p>
          Wallet: <strong>{formatMoney(user.wallet_balance_cents)}</strong>
        </p>

        <p>
          Subscription:{" "}
          <strong>{formatDate(user.subscription_expires_at)}</strong>
        </p>

        <p>
          Last sign-in:{" "}
          <strong>{formatDate(user.last_sign_in_at)}</strong>
        </p>

        <p>
          Email confirmed:{" "}
          <strong>{user.email_confirmed_at ? "Yes" : "No"}</strong>
        </p>

        <p>
          Joined: <strong>{formatDate(user.created_at)}</strong>
        </p>
      </div>

      <div className="owner-user-actions">
        <button
          type="button"
          onClick={onToggleAdmin}
          disabled={busy || user.is_owner}
        >
          {user.is_admin ? "Remove admin" : "Make admin"}
        </button>

        <div className="owner-inline-form">
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Add $"
            value={moneyAmount}
            onChange={(event) => setMoneyAmount(event.target.value)}
            disabled={busy}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onAddMoney(user, moneyAmount);
              setMoneyAmount("");
            }}
          >
            Add money
          </button>
        </div>

        <div className="owner-inline-form">
          <input
            type="number"
            min="1"
            placeholder="Days"
            value={subscriptionDays}
            onChange={(event) => setSubscriptionDays(event.target.value)}
            disabled={busy}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onAddSubscriptionDays(user, subscriptionDays);
              setSubscriptionDays("");
            }}
          >
            Add subscription
          </button>
        </div>
      </div>
    </article>
  );
}