"use client";

import { useEffect, useState } from "react";
import { Camera, MoreVertical, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import AddDishModal from "@/components/dashboard/AddDishModal";
import NoOutletNotice from "@/components/dashboard/NoOutletNotice";
import { useAuth } from "@/context/AuthContext";
import { useOutlets } from "@/context/OutletContext";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/services/api";
import { getDishImage } from "@/lib/dishImages";

const formatPrice = (price) => `₹${Number(price || 0).toLocaleString("en-IN")}`;
const categoryKey = (category) => (category || "Uncategorised").trim().toLowerCase();
const categoryLabel = (category) => {
  const text = (category || "Uncategorised").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function describeUploadError(error) {
  const message = error?.message || "";
  if (/bucket not found/i.test(message)) {
    return "photo storage isn't set up yet (run `alembic upgrade head` in backend/, or supabase/menu-images.sql in Supabase).";
  }
  if (/row-level security|unauthorized|not allowed/i.test(message)) return "photo storage rejected the upload (check the menu-images storage policies).";
  if (/exceeded|too large|payload/i.test(message)) return "the photo is too large (5 MB maximum).";
  return message || "the photo could not be uploaded.";
}

async function uploadDishImage(file) {
  if (!supabase) throw new Error("Supabase is not configured for image uploads.");
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("Your session has expired. Please sign in again.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const imagePath = `${userId}/menu/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("menu-images").upload(imagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("menu-images").getPublicUrl(imagePath).data.publicUrl;
}

export default function MenuPage() {
  const { applicationUser } = useAuth();
  const { activeOutletId, activeOutlet } = useOutlets();
  const canDelete = applicationUser?.role === "owner";
  const [catalog, setCatalog] = useState({ outletId: null, dishes: [], inventory: [], error: "" });
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAddDish, setShowAddDish] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!activeOutletId) return undefined;
    let cancelled = false;
    Promise.all([
      apiRequest(`/api/menu-items?branch_id=${activeOutletId}`),
      apiRequest(`/api/inventory-items?branch_id=${activeOutletId}`),
    ])
      .then(([dishes, inventory]) => {
        if (!cancelled) setCatalog({ outletId: activeOutletId, dishes, inventory, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setCatalog({ outletId: activeOutletId, dishes: [], inventory: [], error: error.message || "Unable to load the menu." });
      });
    return () => {
      cancelled = true;
    };
  }, [activeOutletId]);

  if (!activeOutletId) return <NoOutletNotice />;

  const loaded = catalog.outletId === activeOutletId;
  const dishes = loaded ? catalog.dishes : [];
  const categories = [...new Map(dishes.map((dish) => [categoryKey(dish.category), categoryLabel(dish.category)])).entries()];
  const filteredDishes = activeCategory === "all" ? dishes : dishes.filter((dish) => categoryKey(dish.category) === activeCategory);
  const activeCount = dishes.filter((dish) => dish.is_active).length;
  const lowStockLinked = dishes.reduce((total, dish) => total + Number(dish.low_stock_ingredient_count || 0), 0);
  const branchQuery = `?branch_id=${activeOutletId}`;

  function replaceDish(updated) {
    setCatalog((previous) => ({ ...previous, dishes: previous.dishes.map((dish) => (dish.id === updated.id ? updated : dish)) }));
  }

  async function addDish(values) {
    let imageUrl = null;
    let photoProblem = "";
    if (values.imageFile) {
      try {
        imageUrl = await uploadDishImage(values.imageFile);
      } catch (error) {
        photoProblem = describeUploadError(error); // still create the dish; the photo can be added later
      }
    }
    const created = await apiRequest("/api/menu-items", {
      method: "POST",
      body: JSON.stringify({
        branch_id: activeOutletId,
        name: values.name,
        description: values.description || null,
        category: values.category,
        food_type: values.food_type,
        image_url: imageUrl,
        price: values.price,
        is_active: values.is_active,
        ingredients: values.ingredients,
      }),
    });
    setCatalog((previous) => ({ ...previous, dishes: [created, ...previous.dishes] }));
    setNotice(photoProblem ? `"${created.name}" was added without its photo: ${photoProblem}` : "");
  }

  async function deleteDish(dish) {
    if (!window.confirm(`Delete "${dish.name}" from the menu?`)) return;
    setNotice("");
    try {
      await apiRequest(`/api/menu-items/${dish.id}`, { method: "DELETE" });
      setCatalog((previous) => ({ ...previous, dishes: previous.dishes.filter((item) => item.id !== dish.id) }));
    } catch (error) {
      setNotice(error.message || "The dish could not be deleted.");
    }
  }

  async function changeDishImage(id, file) {
    let imageUrl;
    try {
      imageUrl = await uploadDishImage(file);
    } catch (error) {
      throw new Error(`Photo not updated: ${describeUploadError(error)}`);
    }
    replaceDish(await apiRequest(`/api/menu-items/${id}${branchQuery}`, { method: "PATCH", body: JSON.stringify({ image_url: imageUrl }) }));
  }

  async function toggleAvailability(dish) {
    setNotice("");
    replaceDish({ ...dish, is_active: !dish.is_active });
    try {
      replaceDish(await apiRequest(`/api/menu-items/${dish.id}${branchQuery}`, { method: "PATCH", body: JSON.stringify({ is_active: !dish.is_active }) }));
    } catch (error) {
      replaceDish(dish);
      setNotice(error.message || "Failed to update dish availability.");
    }
  }

  async function updateDish(id, values) {
    replaceDish(await apiRequest(`/api/menu-items/${id}${branchQuery}`, { method: "PATCH", body: JSON.stringify(values) }));
  }

  return (
    <div className="p-2 sm:p-4">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Menu</h1>
          <p className="text-muted mt-1">Dishes, prices and availability. Recipes shown for {activeOutlet?.address}.</p>
        </div>
        <button
          onClick={() => setShowAddDish(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Add Dish
        </button>
      </div>

      {(notice || catalog.error) && (
        <p role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {notice || catalog.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Dishes</p>
          <p className="text-2xl font-bold text-ink">
            {activeCount} available <span className="text-sm font-medium text-muted">of {dishes.length}</span>
          </p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Recipe lines on low stock</p>
          <p className="text-2xl font-bold text-ink">{lowStockLinked}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[["all", "All"], ...categories].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeCategory === key ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white border-transparent" : "bg-surface text-muted border-border hover:border-orange-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <p className="py-16 text-center text-sm text-muted">Loading menu...</p>
      ) : filteredDishes.length === 0 ? (
        <EmptyMenuState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDishes.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              canDelete={canDelete}
              onDelete={deleteDish}
              onChangeImage={changeDishImage}
              onEdit={() => setEditingDish(dish)}
              onToggleAvailability={toggleAvailability}
            />
          ))}
        </div>
      )}

      <AddDishModal
        open={showAddDish}
        inventoryItems={loaded ? catalog.inventory : []}
        outletName={activeOutlet?.address}
        categories={categories.map(([, label]) => label)}
        onClose={() => setShowAddDish(false)}
        onAdd={addDish}
      />

      <EditDishModal
        key={editingDish?.id || "edit-dish"}
        dish={editingDish}
        categories={categories.map(([, label]) => label)}
        onClose={() => setEditingDish(null)}
        onSave={updateDish}
      />
    </div>
  );
}

function DishCard({ dish, canDelete, onDelete, onChangeImage, onEdit, onToggleAvailability }) {
  const [showMenu, setShowMenu] = useState(false);
  const [imageError, setImageError] = useState("");
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggleAvailability(dish);
    } finally {
      setToggling(false);
    }
  }

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

  const veg = dish.food_type !== "non-veg";

  return (
    <div className={`bg-surface border border-border rounded-xl overflow-hidden transition-opacity relative ${!dish.is_active ? "opacity-60" : ""}`}>
      <div className="relative w-full h-32 bg-surface-2 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- dish photos come from arbitrary storage URLs */}
        <img src={getDishImage(dish)} alt={dish.name} className="w-full h-full object-cover" />
        <span className={`absolute top-2 left-2 w-4 h-4 rounded-sm border-2 flex items-center justify-center bg-white ${veg ? "border-green-600" : "border-red-600"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${veg ? "bg-green-600" : "bg-red-600"}`} />
        </span>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between relative">
          <h3 className="font-semibold text-ink text-sm">{dish.name}</h3>
          <button onClick={() => setShowMenu(!showMenu)} className="text-muted hover:text-ink" aria-label={`Actions for ${dish.name}`}>
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-6 z-20 bg-surface border border-border rounded-lg shadow-lg py-1 w-36">
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
                {canDelete && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(dish);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-surface-2 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-accent font-bold mt-1">{formatPrice(dish.price)}</p>
        <p className="text-xs text-muted mt-1">{categoryLabel(dish.category)}</p>
        {imageError && <p className="text-xs text-red-500 mt-2">{imageError}</p>}

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted">{dish.ingredients?.length ? `${dish.ingredients.length} recipe item(s)` : "No recipe here"}</span>
          <div className="flex flex-col items-end gap-1">
            <button
              disabled={toggling}
              onClick={handleToggle}
              aria-label={dish.is_active ? "Mark unavailable" : "Mark available"}
              className={`relative w-9 h-5 rounded-full transition-colors ${dish.is_active ? "bg-accent" : "bg-surface-2 border border-border"} ${toggling ? "opacity-50 cursor-wait" : ""}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dish.is_active ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className={`text-[10px] font-medium ${dish.is_active ? "text-accent" : "text-muted"}`}>{dish.is_active ? "Available" : "Unavailable"}</span>
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
      <h2 className="text-lg font-bold text-ink">No dishes here yet</h2>
      <p className="text-muted mt-1 max-w-xs">Add a dish and it&apos;ll show up here.</p>
    </div>
  );
}

function EditDishModal({ dish, categories, onClose, onSave }) {
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!dish) return null;

  const values = formData || {
    name: dish.name || "",
    description: dish.description || "",
    category: dish.category || "",
    food_type: dish.food_type || "veg",
    price: String(Number(dish.price ?? 0)),
    is_active: dish.is_active ?? true,
  };

  function updateField(field, value) {
    setFormData((previous) => ({ ...(previous || values), [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values.name.trim() || values.price === "") {
      setError("Dish name and price are required.");
      return;
    }
    setSaving(true);
    try {
      await onSave(dish.id, {
        name: values.name.trim(),
        description: values.description.trim() || null,
        category: values.category.trim() || null,
        food_type: values.food_type,
        price: Number(values.price),
        is_active: values.is_active,
      });
      setFormData(null);
      onClose();
    } catch (saveError) {
      setError(saveError.message || "The dish could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-ink">Edit Dish</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none" aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-muted block mb-1.5">Dish Name</span>
            <input value={values.name} onChange={(event) => updateField("name", event.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted block mb-1.5">Description</span>
            <textarea rows={3} value={values.description} onChange={(event) => updateField("description", event.target.value)} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-muted block mb-1.5">Category</span>
              <input list="edit-dish-categories" value={values.category} onChange={(event) => updateField("category", event.target.value)} className={inputClass} />
              <datalist id="edit-dish-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted block mb-1.5">Price (₹)</span>
              <input type="number" min="0" step="0.01" value={values.price} onChange={(event) => updateField("price", event.target.value)} className={inputClass} />
            </label>
          </div>
          <div>
            <span className="text-xs font-semibold text-muted block mb-1.5">Type</span>
            <div className="flex gap-2">
              {[["veg", "Veg"], ["non-veg", "Non-Veg"]].map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateField("food_type", type)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border ${values.food_type === type ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-muted block mb-1.5">Recipe at this outlet</span>
            {dish.ingredients?.length ? (
              <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
                {dish.ingredients.map((ingredient) => (
                  <div key={ingredient.inventory_item_id} className="flex items-center justify-between text-sm text-ink">
                    <span>{ingredient.name}</span>
                    <span className="font-semibold">
                      {Number(ingredient.quantity_per_unit)} {ingredient.unit} / dish
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted rounded-lg border border-border bg-surface-2 p-3">No stock items linked at this outlet.</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={values.is_active} onChange={(event) => updateField("is_active", event.target.checked)} />
            Available for order
          </label>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-ink font-semibold py-2.5 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-accent to-accent-2 text-white font-bold py-2.5 rounded-lg disabled:opacity-60">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
