"use client";
import { useMemo, useState } from "react";

const categories = ["Starters", "Mains", "Beverages", "Desserts"];
const emptyIngredient = {
  inventoryItemId: "",
  quantityPerUnit: "",
};

export default function AddDishModal({ open, onClose, onAdd, branches = [], inventoryItems = [], selectedBranchId = null }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Starters");
  const [price, setPrice] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [vegType, setVegType] = useState("veg");
  const [available, setAvailable] = useState(true);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [branchId, setBranchId] = useState(selectedBranchId || branches[0]?.id || "");
  const [ingredients, setIngredients] = useState([{ ...emptyIngredient }]);
  const [submitError, setSubmitError] = useState("");

  const branchOptions = useMemo(() => branches, [branches]);
  const activeBranchId = branchId || selectedBranchId || branchOptions[0]?.id || "";

  if (!open) return null;

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("Starters");
    setPrice("");
    setPrepTime("");
    setVegType("veg");
    setAvailable(true);
    setImagePreview(null);
    setImageFile(null);
    setBranchId(selectedBranchId || branches[0]?.id || "");
    setIngredients([{ ...emptyIngredient }]);
    setSubmitError("");
  }

  function updateIngredient(index, field, value) {
    setIngredients((prev) => prev.map((ingredient, ingredientIndex) =>
      ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
    ));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { ...emptyIngredient }]);
  }

  function removeIngredient(index) {
    setIngredients((prev) => (prev.length > 1 ? prev.filter((_, ingredientIndex) => ingredientIndex !== index) : prev));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");
    if (!name.trim()) {
      setSubmitError("Enter a dish name.");
      return;
    }
    if (!price) {
      setSubmitError("Enter a dish price.");
      return;
    }
    if (!activeBranchId) {
      setSubmitError("Create or select a branch before adding a dish.");
      return;
    }

    const normalizedIngredients = ingredients
      .filter((ingredient) => ingredient.inventoryItemId && ingredient.quantityPerUnit)
      .map((ingredient) => ({
        inventoryItemId: ingredient.inventoryItemId,
        name: inventoryItems.find((item) => item.id === ingredient.inventoryItemId)?.name,
        unit: inventoryItems.find((item) => item.id === ingredient.inventoryItemId)?.unit,
        quantityPerUnit: ingredient.quantityPerUnit,
      }));

    if (normalizedIngredients.length === 0 || normalizedIngredients.some((ingredient) => !ingredient.name)) {
      setSubmitError("Select an inventory item and enter its quantity per dish.");
      return;
    }

    onAdd({
      id: Date.now(),
      branch_id: activeBranchId,
      name,
      description,
      price: "₹" + price,
      category: category.toLowerCase(),
      type: vegType,
      prepTime: (prepTime || "0") + " min",
      available,
      image: imagePreview,
      imageFile,
      ingredients: normalizedIngredients,
    })
      .then(() => {
        resetForm();
        onClose();
      })
      .catch((error) => {
        setSubmitError(error.message || "The dish could not be created.");
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-display font-bold text-xl text-ink">Add Dish</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted block mb-1.5">Dish Photo</label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl h-32 cursor-pointer hover:border-accent transition-colors overflow-hidden bg-surface-2">
              {imagePreview ? (
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
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Branch</label>
              <select
                value={activeBranchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              >
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.address || `Branch ${branch.id.slice(0, 4)}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Dish Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chicken Biryani"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short dish description for recipe and forecasting context"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Price (₹)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="320"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVegType("veg")}
                  className={
                    "flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors " +
                    (vegType === "veg" ? "bg-green-500/10 border-green-500 text-green-500" : "border-border text-muted")
                  }
                >
                  🟢 Veg
                </button>
                <button
                  type="button"
                  onClick={() => setVegType("non-veg")}
                  className={
                    "flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors " +
                    (vegType === "non-veg" ? "bg-red-500/10 border-red-500 text-red-500" : "border-border text-muted")
                  }
                >
                  🔴 Non-Veg
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Prep Time (min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="18"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Recipe ingredients</p>
              <button type="button" onClick={addIngredient} className="text-xs font-semibold text-accent hover:underline">
                + Add ingredient
              </button>
            </div>

            {ingredients.map((ingredient, index) => (
              <div key={index} className="rounded-xl border border-border bg-surface-2 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">Ingredient {index + 1}</p>
                  {ingredients.length > 1 && (
                    <button type="button" onClick={() => removeIngredient(index)} className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={ingredient.inventoryItemId}
                    onChange={(e) => updateIngredient(index, "inventoryItemId", e.target.value)}
                    className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  >
                    <option value="">Select inventory item</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                    ))}
                  </select>
                </div>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={ingredient.quantityPerUnit}
                  onChange={(e) => updateIngredient(index, "quantityPerUnit", e.target.value)}
                  placeholder="Quantity used per dish"
                  className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-semibold text-ink">Available for order</span>
            <button
              type="button"
              onClick={() => setAvailable(!available)}
              className={
                "w-11 h-6 rounded-full relative transition-colors " +
                (available ? "bg-accent" : "bg-surface-2 border border-border")
              }
            >
              <span
                className={
                  "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all " +
                  (available ? "left-[22px]" : "left-0.5")
                }
              />
            </button>
          </div>

          {submitError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {submitError}
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border text-ink font-semibold py-2.5 rounded-lg hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-accent to-accent-2 text-white font-bold py-2.5 rounded-lg hover:-translate-y-0.5 transition-transform"
            >
              Add Dish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}