import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function SubscriptionsSection() {
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [activatingPlan, setActivatingPlan] = useState(null);

  // Load active subscription for this user
  useEffect(() => {
    async function loadSubscription() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentPlan(null);
        setLoading(false);
        return;
      }

      const { data, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (subError) {
        setError(subError.message);
        setCurrentPlan(null);
        setLoading(false);
        return;
      }

      if (data && data.ends_at) {
        const endsAt = new Date(data.ends_at);
        const now = new Date();
        if (endsAt <= now) {
          setCurrentPlan(null);
          setLoading(false);
          return;
        }
      }

      setCurrentPlan(data || null);
      setLoading(false);
    }

    loadSubscription();
  }, []);

  // Load subscription plans from admin-managed table
  useEffect(() => {
    async function loadPlans() {
      setPlansLoading(true);

      const { data, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (plansError) {
        console.error("Could not load subscription plans:", plansError);
        setPlans([]);
        setPlansLoading(false);
        return;
      }

      setPlans(data || []);
      setPlansLoading(false);
    }

    loadPlans();
  }, []);

  async function handleActivatePlan(planKey) {
    setActivatingPlan(planKey);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in to activate a plan.");
      setActivatingPlan(null);
      return;
    }

    // Cancel any existing active subscription first (simple approach)
    if (currentPlan?.id) {
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({ status: "canceled", ends_at: new Date().toISOString() })
        .eq("id", currentPlan.id);

      if (updateError) {
        setError(updateError.message);
        setActivatingPlan(null);
        return;
      }
    }

    const now = new Date();
    const endsAt = new Date(now);

    // Default to 1 month; you can later make this depend on plan.interval
    endsAt.setMonth(endsAt.getMonth() + 1);

    const { data, error: insertError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        plan_name: planKey,
        status: "active",
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setActivatingPlan(null);
      return;
    }

    setCurrentPlan(data);
    setActivatingPlan(null);
  }

  async function handleCancelSubscription() {
    if (!currentPlan?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Cancel your subscription? It will remain active until the end of the current period.",
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        ends_at: new Date().toISOString(),
      })
      .eq("id", currentPlan.id);

    if (error) {
      setError(error.message);
      return;
    }

    setCurrentPlan((prev) =>
      prev
        ? {
            ...prev,
            status: "canceled",
            ends_at: new Date().toISOString(),
          }
        : null,
    );
  }

  if (loading || plansLoading) {
    return (
      <section className="subscriptions-page section-page">
        <h1>Subscriptions</h1>
        <p>Loading subscription plans and your current plan…</p>
      </section>
    );
  }

  const activePlan =
    currentPlan &&
    (currentPlan.status === "active" || currentPlan.status === "trialing") &&
    (!currentPlan.ends_at || new Date(currentPlan.ends_at) > new Date())
      ? currentPlan
      : null;

  function formatPrice(plan) {
    const price = (plan.price_cents || 0) / 100;
    const currency = plan.currency || "USD";
    const interval = plan.interval || "month";

    return `${currency === "USD" ? "$" : currency}${price.toFixed(2)} / ${interval}`;
  }

  return (
    <section className="subscriptions-page section-page">
      <h1>Subscriptions</h1>

      {error && <p className="media-status media-error">{error}</p>}

      {activePlan ? (
        <div className="subscription-status-card">
          <h2>Your current plan</h2>
          <p className="eyebrow">
            {plans.find((p) => p.plan_key === activePlan.plan_name)?.name ||
              activePlan.plan_name}
          </p>
          <p>
            Status: <strong>{activePlan.status}</strong>
          </p>
          {activePlan.ends_at && (
            <p>
              Active until:{" "}
              {new Date(activePlan.ends_at).toLocaleDateString()}
            </p>
          )}

          <button
            className="media-watch-button"
            type="button"
            onClick={handleCancelSubscription}
          >
            Cancel subscription
          </button>
        </div>
      ) : (
        <div className="subscription-status-card">
          <h2>No active subscription</h2>
          <p>
            Subscribe to unlock all subscription films in our library.
          </p>
        </div>
      )}

      {plans.length === 0 ? (
        <p className="media-status">
          No subscription plans are available at the moment.
        </p>
      ) : (
        <div className="subscriptions-plans-grid">
          {plans.map((plan) => {
            const isCurrent = activePlan?.plan_name === plan.plan_key;

            return (
              <article
                key={plan.id}
                className={`subscription-plan-card ${
                  isCurrent ? "current-plan" : ""
                }`}
              >
                <h3>{plan.name}</h3>
                <p className="subscription-price">
                  {formatPrice(plan)}
                </p>

                <ul className="subscription-features">
                  {(plan.features || []).map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>

                {isCurrent ? (
                  <p className="subscription-current-label">
                    Your current plan
                  </p>
                ) : (
                  <button
                    className="media-watch-button"
                    type="button"
                    onClick={() => handleActivatePlan(plan.plan_key)}
                    disabled={activatingPlan === plan.plan_key}
                  >
                    {activatingPlan === plan.plan_key
                      ? "Activating…"
                      : "Choose this plan"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SubscriptionsSection;