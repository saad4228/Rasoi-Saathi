"use client";
import { useState } from "react";

const emptyIngredient = { inventoryItemId: "", quantityPerUnit: "" };
const inputClass = "w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";

export default function AddDishModal({ open, onClose, onAdd, inventoryItems = [], outletName = "", categories = [] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [vegType, setVegType] = useState("veg");
  const [available, setAvailable] = useState(true);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [ingredients, setIngredients] = useState([{ ...emptyIngredient }]);
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function handleImageChange(event) {
    const file = event.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("");
    setPrice("");
    setVegType("veg");
    setAvailable(true);
    setImagePreview(null);
    setImageFile(null);
    setIngredients([{ ...emptyIngredient }]);
    setSubmitError("");
  }

  function updateIngredient(index, field, value) {
    setIngredients((prev) => prev.map((ingredient, i) => (i === index ? { ...ingredient, [field]: value } : ingredient)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    if (!name.trim()) return setSubmitError("Enter a dish name.");
    if (price === "" || Number(price) < 0) return setSubmitError("Enter a valid price.");

    const started = ingredients.filter((ingredient) => ingredient.inventoryItemId || ingredient.quantityPerUnit);
    if (started.some((ingredient) => !ingredient.inventoryItemId || !(Number(ingredient.quantityPerUnit) > 0))) {
      return setSubmitError("Each recipe line needs a stock item and a quantity greater than zero.");
    }

    setSaving(true);
    try {
      await onAdd({
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        category: category.trim() || null,
        food_type: vegType,
        is_active: available,
        imageFile,
        ingredients: started.map((ingredient) => ({
          inventory_item_id: ingredient.inventoryItemId,
          quantity_per_unit: Number(ingredient.quantityPerUnit),
        })),
      });
      resetForm();
      onClose();
    } catch (error) {
      setSubmitError(error.message || "The dish could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="font-display font-bold text-xl text-ink">Add Dish</h2>
            {outletName && <p className="text-xs text-muted mt-0.5">Recipe uses stock from {outletName}</p>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="text-xs font-semibold text-muted block mb-1.5">Dish Photo</span>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl h-32 cursor-pointer hover:border-accent transition-colors overflow-hidden bg-surface-2">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <span className="text-2xl">📷</span>
                  <span className="text-xs text-muted">Click to upload a photo</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-muted block mb-1.5">Dish Name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Biryani" className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted block mb-1.5">Category</span>
              <input
                list="dish-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Mains"
                className={inputClass}
              />
              <datalist id="dish-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted block mb-1.5">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-muted block mb-1.5">Price (₹)</span>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="320" className={inputClass} />
            </label>
            <div>
              <span className="text-xs font-semibold text-muted block mb-1.5">Type</span>
              <div className="flex gap-2">
                {[
                  ["veg", "🟢 Veg", "bg-green-500/10 border-green-500 text-green-500"],
                  ["non-veg", "🔴 Non-Veg", "bg-red-500/10 border-red-500 text-red-500"],
                ].map(([value, label, activeClass]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVegType(value)}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${vegType === value ? activeClass : "border-border text-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Recipe ingredients</p>
              <button
                type="button"
                onClick={() => setIngredients((prev) => [...prev, { ...emptyIngredient }])}
                className="text-xs font-semibold text-accent hover:underline"
              >
                + Add ingredient
              </button>
            </div>
            {inventoryItems.length === 0 && (
              <p className="text-xs text-muted">
                This outlet has no stock items yet. Add them under Inventory to track ingredient usage for this dish.
              </p>
            )}
            {ingredients.map((ingredient, index) => {
              const unit = inventoryItems.find((item) => item.id === ingredient.inventoryItemId)?.unit;
              return (
                <div key={index} className="grid grid-cols-[1fr_140px_auto] gap-3 items-center rounded-xl border border-border bg-surface-2 p-3">
                  <select
                    value={ingredient.inventoryItemId}
                    onChange={(e) => updateIngredient(index, "inventoryItemId", e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    aria-label={`Ingredient ${index + 1}`}
                  >
                    <option value="">Select stock item</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={ingredient.quantityPerUnit}
                    onChange={(e) => updateIngredient(index, "quantityPerUnit", e.target.value)}
                    placeholder={unit ? `${unit} per dish` : "Qty per dish"}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    aria-label={`Quantity per dish for ingredient ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => setIngredients((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ ...emptyIngredient }]))}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <label className="flex items-center justify-between pt-1 text-sm font-semibold text-ink">
            Available for order
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4" />
          </label>

          {submitError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {submitError}
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-ink font-semibold py-2.5 rounded-lg hover:bg-surface-2 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-accent to-accent-2 text-white font-bold py-2.5 rounded-lg disabled:opacity-60">
              {saving ? "Adding..." : "Add Dish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
