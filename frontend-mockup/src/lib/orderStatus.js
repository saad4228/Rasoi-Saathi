// Mirrors backend/app/services/order_rules.py so the UI only offers allowed moves.

export const STATUS_LABELS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ALLOWED_TRANSITIONS = {
  PENDING: ["CONFIRMED", "PREPARING", "READY", "CANCELLED"],
  CONFIRMED: ["PREPARING", "READY", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PREPARING", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const ROLES_FOR_STATUS = {
  CONFIRMED: ["owner", "chef"],
  PREPARING: ["owner", "chef"],
  READY: ["owner", "chef"],
  COMPLETED: ["owner", "waiter"],
  CANCELLED: ["owner", "chef"],
};

export function nextStatuses(current, role) {
  return (ALLOWED_TRANSITIONS[current] || []).filter((status) => ROLES_FOR_STATUS[status]?.includes(role));
}

export const OPEN_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];
