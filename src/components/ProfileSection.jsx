import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDaysRemaining(value) {
  if (!value) {
    return 0;
  }

  const difference = new Date(value).getTime() - Date.now();

  return Math.max(0, Math.ceil(difference / 86400000));
}

function ProfileSection({ email, isAdmin, handleLogout }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSubscription() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        return;
      }

      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
          id,
          started_at,
          ends_at,
          cancel_at_period_end,
          subscription_plans (
            name,
            description,
            price_cents
          )
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .eq("payment_status", "paid")
        .gt("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setSubscription(data || null);
    } catch (error) {
      console.error("Could not load membership:", error);
      setMessage(error.message || "Could not load your subscription.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  async function cancelRenewal() {
    if (!subscription) {
      return;
    }

    const confirmed = window.confirm(
      `Cancel renewal? You will still have access until ${formatDate(
        subscription.ends_at,
      )}.`,
    );

    if (!confirmed) {
      return;
    }

    setUpdating(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({
          cancel_at_period_end: true,
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      if (error) {
        throw error;
      }

      setSubscription((current) => ({
        ...current,
        cancel_at_period_end: true,
      }));

      setMessage(
        `Renewal cancelled. Access remains until ${formatDate(
          subscription.ends_at,
        )}.`,
      );
    } catch (error) {
      setMessage(error.message || "Could not cancel renewal.");
    } finally {
      setUpdating(false);
    }
  }

  async function resumeRenewal() {
    if (!subscription) {
      return;
    }

    setUpdating(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({
          cancel_at_period_end: false,
          cancelled_at: null,
        })
        .eq("id", subscription.id);

      if (error) {
        throw error;
      }

      setSubscription((current) => ({
        ...current,
        cancel_at_period_end: false,
      }));

      setMessage("Renewal resumed successfully.");
    } catch (error) {
      setMessage(error.message || "Could not resume renewal.");
    } finally {
      setUpdating(false);
    }
  }

  const plan = subscription?.subscription_plans;
  const days = getDaysRemaining(subscription?.ends_at);

  return (
    <section className="section-page">
      <div className="profile-layout">
        <div className="profile-avatar">S</div>

        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Your profile</h1>
          <p>{email}</p>
          <p>{isAdmin ? "Administrator account" : "Customer account"}</p>
        </div>
      </div>

      <section className="membership-card">
        <div className="membership-card-heading">
          <div>
            <p className="eyebrow">YOUR MEMBERSHIP</p>
            <h2>Subscription status</h2>
          </div>

          {subscription && (
            <span
              className={
                subscription.cancel_at_period_end
                  ? "membership-status ending"
                  : "membership-status active"
              }
            >
              {subscription.cancel_at_period_end ? "Ending" : "Active"}
            </span>
          )}
        </div>

        {loading ? (
          <p className="membership-loading">Loading membership...</p>
        ) : subscription ? (
          <div className="membership-details">
            <div className="membership-plan-row">
              <div>
                <h3>{plan?.name || "Premium subscription"}</h3>

                <p>
                  {plan?.description ||
                    "Subscriber-only film access."}
                </p>
              </div>

              <strong>{formatCurrency(plan?.price_cents)}</strong>
            </div>

            <div className="membership-meta-grid">
              <div>
                <span>Started</span>
                <strong>{formatDate(subscription.started_at)}</strong>
              </div>

              <div>
                <span>Access ends</span>
                <strong>{formatDate(subscription.ends_at)}</strong>
              </div>

              <div>
                <span>Days remaining</span>
                <strong>
                  {days} day{days === 1 ? "" : "s"}
                </strong>
              </div>
            </div>

            <div className="membership-notice">
              {subscription.cancel_at_period_end ? (
                <>
                  Renewal is cancelled. You can continue watching until{" "}
                  <strong>{formatDate(subscription.ends_at)}</strong>.
                </>
              ) : (
                <>
                  Your membership is active until{" "}
                  <strong>{formatDate(subscription.ends_at)}</strong>.
                </>
              )}
            </div>

            {subscription.cancel_at_period_end ? (
              <button
                className="membership-resume-button"
                type="button"
                onClick={resumeRenewal}
                disabled={updating}
              >
                {updating ? "Updating..." : "Resume renewal"}
              </button>
            ) : (
              <button
                className="membership-cancel-button"
                type="button"
                onClick={cancelRenewal}
                disabled={updating}
              >
                {updating ? "Cancelling..." : "Cancel renewal"}
              </button>
            )}
          </div>
        ) : (
          <div className="membership-empty">
            <h3>No active subscription</h3>

            <p>
              Choose a plan from the Subscriptions page to unlock
              subscriber-only films.
            </p>
          </div>
        )}

        {message && (
          <p className="membership-message" role="status">
            {message}
          </p>
        )}
      </section>

      <div className="profile-settings">
        <button type="button">Account settings</button>
        <button type="button">Order history</button>
        <button type="button">Payment methods</button>

        <button
          className="danger-button"
          type="button"
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </section>
  );
}

export default ProfileSection;