"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, ReceiptText, Trash2 } from "lucide-react";
import NoOutletNotice from "@/components/dashboard/NoOutletNotice";
import { useOutlets } from "@/context/OutletContext";
import { apiRequest } from "@/services/api";
import { getDishImage } from "@/lib/dishImages";

const REFRESH_MS = 10_000;
const ORDER_TYPES = [
  ["DINE_IN", "Dine in", "supports_dine_in"],
  ["TAKEAWAY", "Takeaway", "supports_takeaway"],
  ["DELIVERY", "Delivery", "supports_delivery"],
];

export default function WaiterOrdersPage() {
  const { activeOutlet, activeOutletId } = useOutlets();
  const [menu, setMenu] = useState({ loaded: false, items: [], error: "" });
  const [ready, setReady] = useState({ outletId: null, orders: [] });
  const [cart, setCart] = useState([]);
  const [chosenType, setChosenType] = useState("DINE_IN");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/menu-items")
      .then((items) => {
        if (!cancelled) setMenu({ loaded: true, items: items.filter((item) => item.is_active), error: "" });
      })
      .catch((loadError) => {
        if (!cancelled) setMenu({ loaded: true, items: [], error: loadError.message || "Unable to load the menu." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeOutletId) return undefined;
    let cancelled = false;
    const load = () =>
      apiRequest(`/api/orders?branch_id=${activeOutletId}&status=READY`)
        .then((orders) => {
          if (!cancelled) setReady({ outletId: activeOutletId, orders });
        })
        .catch((loadError) => {
          if (!cancelled) setError(loadError.message || "Unable to load ready orders.");
        });
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeOutletId]);

  const availableTypes = ORDER_TYPES.filter(([, , flag]) => activeOutlet?.[flag]);
  const orderType = availableTypes.some(([value]) => value === chosenType) ? chosenType : availableTypes[0]?.[0];
  const readyOrders = ready.outletId === activeOutletId ? ready.orders : [];
  const total = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0), [cart]);

  if (!activeOutletId) return <NoOutletNotice />;

  function addToCart(menuItem) {
    setSuccess("");
    setCart((current) => {
      const existing = current.find((item) => item.id === menuItem.id);
      if (existing) return current.map((item) => (item.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item));
      return [...current, { ...menuItem, quantity: 1 }];
    });
  }

  function changeQuantity(id, amount) {
    setCart((current) =>
      current.map((item) => (item.id === id ? { ...item, quantity: item.quantity + amount } : item)).filter((item) => item.quantity > 0)
    );
  }

  async function confirmOrder() {
    if (cart.length === 0 || !orderType) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const order = await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          branch_id: activeOutletId,
          order_type: orderType,
          items: cart.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
        }),
      });
      setCart([]);
      setSuccess(`Order #${order.id.slice(0, 8)} sent to the kitchen.`);
    } catch (saveError) {
      setError(saveError.message || "The order could not be confirmed.");
    } finally {
      setSaving(false);
    }
  }

  async function completePayment(orderId) {
    setError("");
    try {
      await apiRequest(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }) });
      setReady((current) => ({ ...current, orders: current.orders.filter((order) => order.id !== orderId) }));
    } catch (saveError) {
      setError(saveError.message || "The order could not be completed.");
    }
  }

  return (
    <div className="p-2 sm:p-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Waiter Orders</h1>
        <p className="text-muted mt-1">
          {activeOutlet?.address} · Take new orders and close ready orders after payment.
        </p>
        {!activeOutlet?.is_active && <p className="mt-2 text-sm text-amber-700">This outlet is marked inactive and can&apos;t take new orders.</p>}
      </div>

      {(error || menu.error) && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || menu.error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-ink">Menu</h2>
            <select
              value={orderType || ""}
              onChange={(event) => setChosenType(event.target.value)}
              className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-ink"
              aria-label="Order type"
            >
              {availableTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {!menu.loaded ? (
            <p className="text-sm text-muted">Loading menu...</p>
          ) : menu.items.length === 0 ? (
            <p className="text-sm text-muted">No dishes are available right now.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {menu.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="text-left bg-surface border border-border rounded-xl overflow-hidden hover:border-accent hover:shadow-md transition-all group flex flex-col justify-between"
                >
                  <div className="relative w-full h-28 bg-surface-2 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element -- dish photos come from arbitrary storage URLs */}
                    <img src={getDishImage(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span
                      className={`absolute top-2 left-2 w-4 h-4 rounded-sm border-2 flex items-center justify-center bg-white ${
                        item.food_type === "non-veg" ? "border-red-600" : "border-green-600"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.food_type === "non-veg" ? "bg-red-600" : "bg-green-600"}`} />
                    </span>
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-semibold text-ink text-sm line-clamp-1">{item.name}</p>
                      <p className="text-accent font-bold mt-1 text-sm">₹{Number(item.price).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted group-hover:text-accent">
                      <span className="font-medium">Add to order</span>
                      <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                        <Plus size={12} />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <ReceiptText size={18} className="text-accent" />
            <h2 className="text-lg font-bold text-ink">Current order</h2>
          </div>
          {cart.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Add items from the menu.</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{item.name}</p>
                    <p className="text-xs text-muted">₹{Number(item.price).toLocaleString("en-IN")} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQuantity(item.id, -1)} className="p-1 rounded border border-border text-muted hover:text-ink" aria-label="Remove one">
                      <Minus size={13} />
                    </button>
                    <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => changeQuantity(item.id, 1)} className="p-1 rounded border border-border text-muted hover:text-ink" aria-label="Add one">
                      <Plus size={13} />
                    </button>
                    <button onClick={() => changeQuantity(item.id, -item.quantity)} className="p-1 text-red-500" aria-label="Remove item">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 text-base font-bold text-ink">
                <span>Total</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <button
                disabled={saving || !orderType || !activeOutlet?.is_active}
                onClick={confirmOrder}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-60"
              >
                {saving ? "Confirming..." : "Confirm order"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink">Ready orders</h2>
          <span className="text-sm text-muted">Payment pending: {readyOrders.length}</span>
        </div>
        {readyOrders.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center text-sm text-muted">No ready orders waiting for payment.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {readyOrders.map((order) => (
              <div key={order.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex justify-between gap-3">
                  <p className="font-bold text-ink">
                    #{order.id.slice(0, 8)}
                    {order.customer_name ? <span className="ml-2 text-xs font-medium text-muted">{order.customer_name}</span> : null}
                  </p>
                  <p className="font-bold text-accent">₹{Number(order.total_amount).toLocaleString("en-IN")}</p>
                </div>
                <p className="text-sm text-muted mt-2">{order.items.map((item) => `${item.quantity}x ${item.menu_item_name}`).join(", ")}</p>
                <button
                  onClick={() => completePayment(order.id)}
                  className="mt-4 flex items-center justify-center gap-2 w-full border border-accent text-accent font-semibold py-2 rounded-lg hover:bg-accent/10"
                >
                  <Check size={16} /> Payment received
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
