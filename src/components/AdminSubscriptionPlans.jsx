import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function AdminSubscriptionPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 4000);
  }

  useEffect(() => {
    async function loadPlans() {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_cents", { ascending: true });

      if (error) {
        console.error("Could not load subscription plans:", error);
        showMessage("Failed to load plans.", "error");
      } else {
        setPlans(data || []);
      }
      setLoading(false);
    }

    loadPlans();
  }, []);

  async function handleSavePlan(updatedPlan) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .update({
          name: updatedPlan.name,
          description: updatedPlan.description || null,
          price_cents: updatedPlan.price_cents,
          duration_days: updatedPlan.duration_days,
          is_active: updatedPlan.is_active,
        })
        .eq("id", updatedPlan.id);

      if (error) throw error;

      setPlans((prev) =>
        prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
      );
      showMessage("Plan updated successfully.", "success");
    } catch (err) {
      console.error(err);
      showMessage("Failed to update plan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePlan() {
    const newPlan = {
      name: "New Plan",
      description: "Describe this plan...",
      price_cents: 999,
      duration_days: 30,
      is_active: true,
    };

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .insert(newPlan)
        .select()
        .single();

      if (error) throw error;

      setPlans((prev) => [...prev, data]);
      showMessage("Plan created. Edit its details below.", "success");
    } catch (err) {
      console.error(err);
      showMessage("Failed to create plan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan(planId) {
    if (!confirm("Delete this subscription plan? This cannot be undone.")) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      setPlans((prev) => prev.filter((p) => p.id !== planId));
      showMessage("Plan deleted.", "success");
    } catch (err) {
      console.error(err);
      showMessage("Failed to delete plan.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(planId, field, value) {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, [field]: value } : p
      )
    );
  }

  function handleBlurSave(plan) {
    // Save on blur for text/number fields
    handleSavePlan(plan);
  }

  if (loading) {
    return (
      <section className="admin-upload-panel">
        <div className="admin-upload-header">
          <div>
            <p className="eyebrow">ADMIN TOOLS</p>
            <h2>Manage subscription plans</h2>
          </div>
        </div>
        <p className="media-status">Loading plans...</p>
      </section>
    );
  }

  return (
    <section className="admin-upload-panel">
      <div className="admin-upload-header">
        <div>
          <p className="eyebrow">ADMIN TOOLS</p>
          <h2>Manage subscription plans</h2>
          <p>
            Edit plan names, prices, and durations. Prices are in USD.
          </p>
        </div>
        <button
          className="admin-upload-button"
          type="button"
          onClick={handleCreatePlan}
          disabled={saving}
        >
          {saving ? "Saving..." : "Add new plan"}
        </button>
      </div>

      <div className="plans-list">
        {plans.length === 0 ? (
          <p className="media-status">No subscription plans yet.</p>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="plan-card">
              <div className="plan-header">
                <input
                  type="text"
                  className="plan-name-input"
                  value={plan.name}
                  onChange={(e) =>
                    handleFieldChange(plan.id, "name", e.target.value)
                  }
                  onBlur={() => handleBlurSave(plan)}
                />
                <label className="plan-active-toggle">
                  <input
                    type="checkbox"
                    checked={plan.is_active}
                    onChange={(e) =>
                      handleFieldChange(
                        plan.id,
                        "is_active",
                        e.target.checked
                      )
                    }
                    onBlur={() => handleBlurSave(plan)}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="plan-grid">
                <label className="plan-field">
                  <span>Price (USD)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(plan.price_cents / 100).toFixed(2)}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 0;
                      handleFieldChange(
                        plan.id,
                        "price_cents",
                        Math.round(value * 100)
                      );
                    }}
                    onBlur={() => handleBlurSave(plan)}
                  />
                </label>

                <label className="plan-field">
                  <span>Duration (days)</span>
                  <input
                    type="number"
                    min="1"
                    value={plan.duration_days}
                    onChange={(e) =>
                      handleFieldChange(
                        plan.id,
                        "duration_days",
                        Number(e.target.value) || 1
                      )
                    }
                    onBlur={() => handleBlurSave(plan)}
                  />
                </label>
              </div>

              <label className="plan-field plan-description-field">
                <span>Description</span>
                <textarea
                  rows="2"
                  value={plan.description || ""}
                  onChange={(e) =>
                    handleFieldChange(
                      plan.id,
                      "description",
                      e.target.value
                    )
                  }
                  onBlur={() => handleBlurSave(plan)}
                />
              </label>

              <div className="plan-actions">
                <button
                  className="admin-upload-button"
                  type="button"
                  onClick={() => handleSavePlan(plan)}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  className="admin-delete-button"
                  type="button"
                  onClick={() => handleDeletePlan(plan.id)}
                  disabled={saving}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {message && (
        <p
          className={`admin-upload-message ${messageType}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}

export default AdminSubscriptionPlans;
