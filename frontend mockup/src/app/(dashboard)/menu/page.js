"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Camera, Clock, MoreVertical, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import AddDishModal from "@/components/dashboard/AddDishModal";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/services/api";

const initialDishes = [
  {
    id: 1,
    name: "Chicken Biryani",
    price: "₹320",
    category: "mains",
    type: "non-veg",
    prepTime: "18 min",
    available: true,
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop",
  },
  {
    id: 2,
    name: "Paneer Roll",
    price: "₹90",
    category: "starters",
    type: "veg",
    prepTime: "8 min",
    available: true,
    image: "https://static.toiimg.com/thumb/66474043.cms?imgsize=399490&width=400&height=300&fit=crop",
  },
  {
    id: 3,
    name: "Veg Thali",
    price: "₹180",
    category: "mains",
    type: "veg",
    prepTime: "15 min",
    available: false,
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop",
  },
  {
    id: 4,
    name: "Iced Latte",
    price: "₹150",
    category: "beverages",
    type: "veg",
    prepTime: "4 min",
    available: true,
    image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop",
  },
];

const categories = [
  { key: "all", label: "All" },
  { key: "starters", label: "Starters" },
  { key: "mains", label: "Mains" },
  { key: "beverages", label: "Beverages" },
  { key: "desserts", label: "Desserts" },
];

export default function MenuPage() {
  const { session } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAddDish, setShowAddDish] = useState(false);
  const [editingDish, setEditingDish] = useState(null);

  useEffect(() => {
    apiRequest("/api/branches", {}, session)
      .then((items) => {
        setBranches(items);
        if (items.length > 0) setSelectedBranchId(items[0].id);
      })
      .catch(() => setBranches([]));

    apiRequest("/api/menu-items", {}, session)
      .then((items) => setDishes(items.map((item) => ({ ...item, category: item.category?.toLowerCase(), image: item.image_url, price: `₹${Number(item.price).toLocaleString("en-IN")}`, available: item.is_active, type: item.food_type || "veg", prepTime: "—" }))))
      .catch(() => setDishes([]));
  }, [session]);

  useEffect(() => {
    if (!selectedBranchId) {
      return;
    }

    apiRequest(`/api/inventory-items?branch_id=${selectedBranchId}`, {}, session)
      .then(setInventoryItems)
      .catch(() => setInventoryItems([]));
  }, [selectedBranchId, session]);

  const filteredDishes =
    activeCategory === "all"
      ? dishes
      : dishes.filter((d) => d.category === activeCategory);

  const totalDishes = dishes.length;
  const lowStockLinked = dishes.reduce(
    (total, dish) => total + Number(dish.low_stock_ingredient_count || 0),
    0
  );

  async function addDish(newDish) {
    let imageUrl = null;
    if (newDish.imageFile) {
      if (!supabase) throw new Error("Supabase is not configured for image uploads.");
      const extension = newDish.imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const imagePath = `${session.user.id}/menu/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(imagePath, newDish.imageFile, {
          cacheControl: "3600",
          contentType: newDish.imageFile.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      imageUrl = supabase.storage.from("menu-images").getPublicUrl(imagePath).data.publicUrl;
    }

    const created = await apiRequest("/api/menu-items", {
      method: "POST",
      body: JSON.stringify({
        branch_id: newDish.branch_id || selectedBranchId,
        name: newDish.name,
        description: newDish.description || null,
        food_type: newDish.type || "veg",
        image_url: imageUrl,
        category: newDish.category,
        price: Number(String(newDish.price).replace(/[^0-9.]/g, "")),
        is_active: true,
        ingredients: (newDish.ingredients || []).map((ingredient) => ({
          inventory_item_name: ingredient.name,
          unit: ingredient.unit,
          current_stock: Number(ingredient.currentStock || 0),
          safety_stock_level: Number(ingredient.safetyStock || 0),
          reorder_delay_days: Number(ingredient.reorderDelayDays || 0),
          cost_per_unit: Number(ingredient.costPerUnit || 0),
          shelf_life_days: ingredient.shelfLifeDays ? Number(ingredient.shelfLifeDays) : null,
          quantity_per_unit: Number(ingredient.quantityPerUnit || 0),
        })),
      }),
    }, session);

    setDishes((prev) => [{ ...created, image: created.image_url, price: `₹${Number(created.price).toLocaleString("en-IN")}`, available: created.is_active, type: newDish.type || "veg", prepTime: newDish.prepTime || "—" }, ...prev]);
  }

  async function deleteDish(id) {
    await apiRequest(`/api/menu-items/${id}`, { method: "DELETE" }, session);
    setDishes((prev) => prev.filter((d) => d.id !== id));
  }

  async function changeDishImage(id, file) {
    if (!supabase) throw new Error("Supabase is not configured for image uploads.");
    if (!session?.user?.id) throw new Error("Your session is not ready. Please sign in again.");

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const imagePath = `${session.user.id}/menu/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("menu-images")
      .upload(imagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const imageUrl = supabase.storage.from("menu-images").getPublicUrl(imagePath).data.publicUrl;
    const updated = await apiRequest(`/api/menu-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ image_url: imageUrl }),
    }, session);

    setDishes((prev) => prev.map((dish) => (
      dish.id === id ? { ...dish, ...updated, type: updated.food_type || dish.type, image: updated.image_url } : dish
    )));
  }

  async function updateDish(id, values) {
    const updated = await apiRequest(`/api/menu-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    }, session);
    setDishes((prev) => prev.map((dish) => (
      dish.id === id ? { ...dish, ...updated, type: updated.food_type || dish.type, image: updated.image_url } : dish
    )));
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Menu</h1>
          <p className="text-muted mt-1">
            Manage your dishes, pricing, and availability.
          </p>
        </div>
        <button
          onClick={() => setShowAddDish(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Add Dish
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Total Dishes
          </p>
          <p className="text-2xl font-bold text-ink">{totalDishes} Active</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Low Stock Linked Items
          </p>
          <p className="text-2xl font-bold text-ink">{lowStockLinked}</p>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white border-transparent"
                  : "bg-surface text-muted border-border hover:border-orange-300"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Dish grid or empty state */}
      {filteredDishes.length === 0 ? (
        <EmptyMenuState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDishes.map((dish) => (
            <DishCard key={`${dish.id}-${dish.is_active}`} dish={dish} onDelete={deleteDish} onChangeImage={changeDishImage} onEdit={() => setEditingDish(dish)} />
          ))}
        </div>
      )}

      <AddDishModal
        open={showAddDish}
        branches={branches}
        inventoryItems={inventoryItems}
        selectedBranchId={selectedBranchId}
        onClose={() => setShowAddDish(false)}
        onAdd={addDish}
      />

      <EditDishModal
        key={editingDish?.id || "edit-dish"}
        dish={editingDish}
        onClose={() => setEditingDish(null)}
        onSave={updateDish}
      />
    </div>
  );
}

function DishCard({ dish, onDelete, onChangeImage, onEdit }) {
  const [available, setAvailable] = useState(dish.available);
  const [showMenu, setShowMenu] = useState(false);
  const [imageError, setImageError] = useState("");

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageError("");
    try {
      await onChangeImage(dish.id, file);
      setShowMenu(false);
    } catch (error) {
      setImageError(error.message || "The image could not be updated.");
    }
  }

  return (
    <div
      className={`bg-surface border border-border rounded-xl overflow-hidden transition-opacity relative ${
        !available ? "opacity-60" : ""
      }`}
    >
      {/* Image */}
      <div className="relative w-full h-32 bg-surface-2">
        {dish.image ? (
          <img src={dish.image} alt={dish.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">
            <UtensilsCrossed size={28} strokeWidth={1.5} />
          </div>
        )}
        <span
          className={`absolute top-2 left-2 w-4 h-4 rounded-sm border-2 flex items-center justify-center ${
            dish.type === "veg" ? "border-green-600" : "border-red-600"
          } bg-white`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              dish.type === "veg" ? "bg-green-600" : "bg-red-600"
            }`}
          />
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between relative">
          <h3 className="font-semibold text-ink text-sm">{dish.name}</h3>
          <button onClick={() => setShowMenu(!showMenu)} className="text-muted hover:text-ink">
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-6 z-20 bg-surface border border-border rounded-lg shadow-lg py-1 w-32">
                <button
                  onClick={() => {
                    onEdit();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-2 transition-colors"
                >
                  <Pencil size={14} />
                  Edit details
                </button>
                <label className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-2 transition-colors cursor-pointer">
                  <Camera size={14} />
                  Change image
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                <button
                  onClick={() => {
                    onDelete(dish.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-surface-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-accent font-bold mt-1">{dish.price}</p>

        {imageError && <p className="text-xs text-red-500 mt-2">{imageError}</p>}

        <div className="flex items-center justify-between mt-3">
          <span className="flex items-center gap-1 text-xs text-muted">
            <Clock size={12} />
            {dish.prepTime}
          </span>

          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => setAvailable(!available)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                available ? "bg-accent" : "bg-surface-2 border border-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  available ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-[10px] font-medium ${
                available ? "text-accent" : "text-muted"
              }`}
            >
              {available ? "Available" : "Unavailable"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyMenuState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/10 dark:to-amber-400/10 flex items-center justify-center mb-6">
        <UtensilsCrossed className="w-14 h-14 text-orange-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-bold text-ink">No dishes in this category</h2>
      <p className="text-muted mt-1 max-w-xs">
        Add a dish to this category and it&apos;ll show up here.
      </p>
    </div>
  );
}

function EditDishModal({ dish, onClose, onSave }) {
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState("");

  if (!dish) return null;

  const values = formData || {
    name: dish.name || "",
    description: dish.description || "",
    category: dish.category || "mains",
    food_type: dish.food_type || dish.type || "veg",
    price: String(dish.price || "").replace(/[^0-9.]/g, ""),
    is_active: dish.is_active ?? dish.available ?? true,
  };

  function updateField(field, value) {
    setFormData((previous) => ({ ...(previous || values), [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values.name.trim() || !values.price) {
      setError("Dish name and price are required.");
      return;
    }
    try {
      await onSave(dish.id, {
        name: values.name.trim(),
        description: values.description.trim() || null,
        category: values.category,
        food_type: values.food_type,
        price: Number(values.price),
        is_active: values.is_active,
      });
      setFormData(null);
      onClose();
    } catch (saveError) {
      setError(saveError.message || "The dish could not be updated.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-ink">Edit Dish</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted block mb-1.5">Dish Name</label>
            <input value={values.name} onChange={(event) => updateField("name", event.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted block mb-1.5">Description</label>
            <textarea rows={3} value={values.description} onChange={(event) => updateField("description", event.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Category</label>
              <select value={values.category} onChange={(event) => updateField("category", event.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent">
                <option value="starters">Starters</option>
                <option value="mains">Mains</option>
                <option value="beverages">Beverages</option>
                <option value="desserts">Desserts</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Price (₹)</label>
              <input type="number" min="0" value={values.price} onChange={(event) => updateField("price", event.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted block mb-1.5">Type</label>
            <div className="flex gap-2">
              {[["veg", "Veg"], ["non-veg", "Non-Veg"]].map(([type, label]) => (
                <button key={type} type="button" onClick={() => updateField("food_type", type)} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border ${values.food_type === type ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted block mb-1.5">Recipe ingredients</label>
            {dish.ingredients?.length ? (
              <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
                {dish.ingredients.map((ingredient) => (
                  <div key={ingredient.inventory_item_id} className="flex items-center justify-between text-sm text-ink">
                    <span>{ingredient.name}</span>
                    <span className="font-semibold">{ingredient.quantity_per_unit} {ingredient.unit} / dish</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted rounded-lg border border-border bg-surface-2 p-3">No inventory ingredients linked.</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={values.is_active} onChange={(event) => updateField("is_active", event.target.checked)} />
            Available for order
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-ink font-semibold py-2.5 rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 bg-gradient-to-r from-accent to-accent-2 text-white font-bold py-2.5 rounded-lg">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}