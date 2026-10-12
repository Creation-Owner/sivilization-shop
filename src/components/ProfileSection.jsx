import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ProfileSection({
  email,
  isAdmin,
  handleLogout,
  onOpenSubscriptions,
}) {
  const [subscription, setSubscription] = useState(null);
  const [loadingSubscription, setLoadingSubscription] =
    useState(true);

  useEffect(() => {
    let alive = true;

    async function loadSubscription() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (alive) {
          setLoadingSubscription(false);
        }

        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          status,
          ends_at,
          plan_slug,
          subscription_plans (
            name,
            billing_interval
          )
        `)
        .eq("user_id", user.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) {
        return;
      }

      if (!error && data) {
        const isStillValid =
          !data.ends_at ||
          new Date(data.ends_at) > new Date();

        setSubscription(isStillValid ? data : null);
      } else {
        setSubscription(null);
      }

      setLoadingSubscription(false);
    }

    loadSubscription();

    return () => {
      alive = false;
    };
  }, []);

  const planName =
    subscription?.subscription_plans?.name ||
    subscription?.plan_slug ||
    "Membership";

  return (
    <section className="section-page">
      <div className="profile-layout">
        <div className="profile-avatar">S</div>

        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Your profile</h1>
          <p className="profile-email">{email}</p>
          <p className="profile-account-type">
            {isAdmin
              ? "Administrator account"
              : "Customer account"}
          </p>
        </div>
      </div>

      <section className="subscription-status-card profile-membership-card">
        <p className="eyebrow">MEMBERSHIP</p>

        {loadingSubscription ? (
          <p>Loading your membership status…</p>
        ) : subscription ? (
          <>
            <h2>{planName}</h2>

            <p>
              Status: <strong>{subscription.status}</strong>
            </p>

            {subscription.ends_at && (
              <p>
                Access until:{" "}
                <strong>
                  {new Date(
                    subscription.ends_at
                  ).toLocaleDateString()}
                </strong>
              </p>
            )}

            <p>
              Your membership gives you access to subscription-only
              films while it is active.
            </p>
          </>
        ) : (
          <>
            <h2>No active membership</h2>

            <p>
              Subscribe to unlock films marked as subscription-only.
            </p>

            <button
              className="media-watch-button"
              type="button"
              onClick={onOpenSubscriptions}
            >
              View memberships
            </button>
          </>
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