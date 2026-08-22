"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

export default function WaiterOrdersPage() {
  const { session } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [orderType, setOrderType] = useState("DINE_IN");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest("/api/branches", {}, session),
      apiRequest("/api/menu-items", {}, session),
    ])
      .then(([loadedBranches, loadedMenu]) => {
        setBranches(loadedBranches);
        setBranchId(loadedBranches[0]?.id || "");
        setMenuItems(loadedMenu.filter((item) => item.is_active));
      })
      .catch((loadError) => setError(loadError.message || "Unable to load waiter data."));
  }, [session]);

  useEffect(() => {
    if (!branchId) return;
    const loadReadyOrders = () => apiRequest(`/api/orders?branch_id=${branchId}&status=READY`, {}, session)
      .then((orders) => setReadyOrders(orders))
      .catch((loadError) => setError(loadError.message || "Unable to load ready orders."));
    loadReadyOrders();
    const refreshTimer = window.setInterval(loadReadyOrders, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [branchId, session]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0), [cart]);

  function addToCart(menuItem) {
    setCart((current) => {
      const existing = current.find((item) => item.id === menuItem.id);
      if (existing) return current.map((item) => item.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...menuItem, quantity: 1 }];
    });
  }

  function changeQuantity(id, amount) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  }

  async function confirmOrder() {
    if (!branchId || cart.length === 0) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({ branch_id: branchId, order_type: orderType, items: cart.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })) }),
      }, session);
      setCart([]);
    } catch (saveError) {
      setError(saveError.message || "The order could not be confirmed.");
    } finally {
      setSaving(false);
    }
  }

  async function completePayment(orderId) {
    setError("");
    try {
      await apiRequest(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }) }, session);
      setReadyOrders((current) => current.filter((order) => order.id !== orderId));
    } catch (saveError) {
      setError(saveError.message || "The order could not be completed.");
    }
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Waiter Orders</h1>
          <p className="text-muted mt-1">Take new orders and close ready orders after payment.</p>
        </div>
        <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-ink">
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.address || "Branch"}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-ink">Menu</h2>
            <select value={orderType} onChange={(event) => setOrderType(event.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-ink">
              <option value="DINE_IN">Dine in</option>
              <option value="TAKEAWAY">Takeaway</option>
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {menuItems.map((item) => (
              <button key={item.id} onClick={() => addToCart(item)} className="text-left bg-surface border border-border rounded-xl p-4 hover:border-accent hover:bg-accent/5 transition-colors">
                <p className="font-semibold text-ink text-sm">{item.name}</p>
                <p className="text-accent font-bold mt-2">₹{Number(item.price).toLocaleString("en-IN")}</p>
                <span className="flex items-center gap-1 text-xs text-muted mt-3"><Plus size={13} /> Add</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 h-fit">
          <div className="flex items-center gap-2 mb-4"><ReceiptText size={18} className="text-accent" /><h2 className="text-lg font-bold text-ink">Current order</h2></div>
          {cart.length === 0 ? <p className="text-sm text-muted py-8 text-center">Add items from the menu.</p> : <div className="space-y-3">
            {cart.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-border pb-3"><div className="min-w-0"><p className="text-sm font-semibold text-ink truncate">{item.name}</p><p className="text-xs text-muted">₹{Number(item.price).toLocaleString("en-IN")} each</p></div><div className="flex items-center gap-2"><button onClick={() => changeQuantity(item.id, -1)} className="p-1 rounded border border-border text-muted hover:text-ink"><Minus size={13} /></button><span className="text-sm font-semibold w-4 text-center">{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} className="p-1 rounded border border-border text-muted hover:text-ink"><Plus size={13} /></button><button onClick={() => changeQuantity(item.id, -item.quantity)} className="p-1 text-red-500"><Trash2 size={14} /></button></div></div>)}
            <div className="flex justify-between pt-2 text-base font-bold text-ink"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
            <button disabled={saving} onClick={confirmOrder} className="w-full bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-60">{saving ? "Confirming..." : "Confirm order"}</button>
          </div>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-ink">Ready orders</h2><span className="text-sm text-muted">Payment pending: {readyOrders.length}</span></div>
        {readyOrders.length === 0 ? <div className="bg-surface border border-border rounded-2xl p-8 text-center text-sm text-muted">No ready orders waiting for payment.</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{readyOrders.map((order) => <div key={order.id} className="bg-surface border border-border rounded-xl p-4"><div className="flex justify-between gap-3"><p className="font-bold text-ink">#{order.id.slice(0, 8)}</p><p className="font-bold text-accent">₹{Number(order.total_amount).toLocaleString("en-IN")}</p></div><p className="text-sm text-muted mt-2">{order.items.map((item) => `${item.quantity}x ${item.menu_item_name}`).join(", ")}</p><button onClick={() => completePayment(order.id)} className="mt-4 flex items-center justify-center gap-2 w-full border border-accent text-accent font-semibold py-2 rounded-lg hover:bg-accent/10"><Check size={16} /> Payment received</button></div>)}</div>}
      </section>
    </div>
  );
}
