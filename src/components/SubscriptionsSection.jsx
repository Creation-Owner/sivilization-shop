import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function formatDuration(days) {
  if (days % 365 === 0) {
    const years = days / 365;
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  if (days % 30 === 0) {
    const months = days / 30;
    return `${months} month${months === 1 ? "" : "s"}`;
  }

  return `${days} day${days === 1 ? "" : "s"}`;
}

function SubscriptionsSection() {
  const [plans, setPlans] = useState([]);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    async function loadPlansAndSubscription() {
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_cents", { ascending: true });

      if (plansError) {
        setMessage("Subscription plans could not be loaded.");
        setMessageType("error");
      } else {
        setPlans(plansData || []);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("*, subscription_plans(*)")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .gte("ends_at", new Date().toISOString())
          .order("ends_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setActiveSubscription(subscription || null);
      }

      setLoading(false);
    }

    loadPlansAndSubscription();
  }, []);

  async function choosePlan(plan) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please sign in before choosing a subscription.");
      setMessageType("error");
      return;
    }

    const confirmed = window.confirm(
      `Subscribe to ${plan.name} for $${(plan.price_cents / 100).toFixed(2)} for ${formatDuration(plan.duration_days)}? This is a test checkout and does not charge your card.`
    );

    if (!confirmed) return;

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + plan.duration_days);

    const { data, error } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        is_active: true,
      })
      .select("*, subscription_plans(*)")
      .single();

    if (error) {
      setMessage(error.message || "Could not activate subscription.");
      setMessageType("error");
      return;
    }

    setActiveSubscription(data);
    setMessage(`Your ${plan.name} subscription is active.`);
    setMessageType("success");
  }

  if (loading) {
    return (
      <section className="subscriptions-page section-page">
        <p className="media-status">Loading subscription plans...</p>
      </section>
    );
  }

  return (
    <section className="subscriptions-page section-page">
      <div className="subscriptions-page-header">
        <p className="eyebrow">SUBSCRIPTIONS</p>
        <h1>Choose your subscription</h1>
        <p>
          Subscribe monthly or yearly to unlock all subscriber-only films.
          Your access stays active for the period shown on your plan.
        </p>
      </div>

      {activeSubscription && (
        <div className="current-subscription-card">
          <div>
            <p className="eyebrow">CURRENT PLAN</p>
            <h2>
              {activeSubscription.subscription_plans?.name || "Active subscription"}
            </h2>
            <p>
              Active until {new Date(activeSubscription.ends_at).toLocaleDateString()}
            </p>
          </div>
          <span className="subscription-active-badge">Active</span>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="empty-subscriptions">
          <h2>No plans available yet</h2>
          <p>The administrator has not published a subscription plan.</p>
        </div>
      ) : (
        <div className="subscription-page-grid">
          {plans.map((plan) => (
            <article className="subscription-page-card" key={plan.id}>
              <p className="eyebrow">{plan.name}</p>
              <h2>
                ${(plan.price_cents / 100).toFixed(2)}
                <span> / {formatDuration(plan.duration_days)}</span>
              </h2>
              <p>{plan.description || "Full access to subscriber-only films."}</p>
              <ul>
                <li>Subscriber-only films</li>
                <li>Watch during your active plan</li>
                <li>Progress saved to your account</li>
              </ul>
              <button
                className="subscription-choose-button"
                type="button"
                onClick={() => choosePlan(plan)}
              >
                Choose {plan.name}
              </button>
            </article>
          ))}
        </div>
      )}

      {message && (
        <p className={`subscription-page-message ${messageType}`} role="status">
          {message}
        </p>
      )}
    </section>
  );
}

export default SubscriptionsSection;
