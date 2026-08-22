const FALLBACK_IMAGES = {
  biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop",
  paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop",
  thali: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop",
  tikka: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop",
  lassi: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop",
  jamun: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop",
  roll: "https://static.toiimg.com/thumb/66474043.cms?imgsize=399490&width=400&height=300&fit=crop",
  latte: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop",
  default: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
};

export function getDishImage(item) {
  if (!item) return FALLBACK_IMAGES.default;
  if (typeof item === "string" && item.trim()) return item;

  const url = item.image_url || item.image;
  if (url && typeof url === "string" && url.trim()) return url;

  const name = (item.name || "").toLowerCase();
  const category = (item.category || "").toLowerCase();

  if (name.includes("biryani")) return FALLBACK_IMAGES.biryani;
  if (name.includes("paneer")) return FALLBACK_IMAGES.paneer;
  if (name.includes("thali")) return FALLBACK_IMAGES.thali;
  if (name.includes("tikka") || name.includes("chicken")) return FALLBACK_IMAGES.tikka;
  if (name.includes("lassi") || category.includes("beverage")) return FALLBACK_IMAGES.lassi;
  if (name.includes("jamun") || category.includes("dessert")) return FALLBACK_IMAGES.jamun;
  if (name.includes("roll")) return FALLBACK_IMAGES.roll;
  if (name.includes("latte") || name.includes("coffee")) return FALLBACK_IMAGES.latte;

  return FALLBACK_IMAGES.default;
}
