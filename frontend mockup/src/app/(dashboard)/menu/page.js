"use client";

import { useState } from "react";
import Image from "next/image";
import { Clock, MoreVertical, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import AddDishModal from "@/components/dashboard/AddDishModal";

const initialDishes = [
  {
    id: 1,
    name: "Chicken Biryani",
    price: "₹320",
    category: "mains",
    type: "non-veg",
    prepTime: "18 min",
    available: true,
    image: null,
  },
  {
    id: 2,
    name: "Paneer Roll",
    price: "₹90",
    category: "starters",
    type: "veg",
    prepTime: "8 min",
    available: true,
    image: null,
  },
  {
    id: 3,
    name: "Veg Thali",
    price: "₹180",
    category: "mains",
    type: "veg",
    prepTime: "15 min",
    available: false,
    image: null,
  },
  {
    id: 4,
    name: "Iced Latte",
    price: "₹150",
    category: "beverages",
    type: "veg",
    prepTime: "4 min",
    available: true,
    image: null,
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
  const [dishes, setDishes] = useState(initialDishes);
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAddDish, setShowAddDish] = useState(false);

  const filteredDishes =
    activeCategory === "all"
      ? dishes
      : dishes.filter((d) => d.category === activeCategory);

  const totalDishes = dishes.length;
  const lowStockLinked = 0; // Wire this to Inventory module later

  function addDish(newDish) {
    setDishes((prev) => [newDish, ...prev]);
  }

  function deleteDish(id) {
    setDishes((prev) => prev.filter((d) => d.id !== id));
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
            <DishCard key={dish.id} dish={dish} onDelete={deleteDish} />
          ))}
        </div>
      )}

      <AddDishModal open={showAddDish} onClose={() => setShowAddDish(false)} onAdd={addDish} />
    </div>
  );
}

function DishCard({ dish, onDelete }) {
  const [available, setAvailable] = useState(dish.available);
  const [showMenu, setShowMenu] = useState(false);

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
        Add a dish to this category and it'll show up here.
      </p>
    </div>
  );
}