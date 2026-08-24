"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

const OutletContext = createContext(null);

export function OutletProvider({ children }) {
  const { session, applicationUser } = useAuth();
  const [outletList, setOutletList] = useState([]);
  const [activeOutletId, setActiveOutletId] = useState(null);

  useEffect(() => {
    if (!session) return;

    apiRequest("/api/branches", {}, session)
      .then((branches) => {
        if (Array.isArray(branches) && branches.length > 0) {
          const restaurantName =
            applicationUser?.restaurant_name ||
            branches[0]?.restaurant_name ||
            applicationUser?.name ||
            "Saffron Junction";

          const formatted = branches.map((b, idx) => ({
            id: b.id,
            name: restaurantName,
            area: b.address || `Branch ${idx + 1}`,
            isPrimary: idx === 0,
            status: b.is_active ? "Active" : "Inactive",
            address: b.address || "Main Branch",
            phone: b.phone || "",
            cuisine: "North Indian, Chinese",
            openTime: "11:00 AM",
            closeTime: "11:00 PM",
            gst: "27ABCDE1234F1Z5",
            fssai: "12345678901234",
          }));

          setOutletList(formatted);
          setActiveOutletId(formatted[0].id);
        }
      })
      .catch(() => {});
  }, [session, applicationUser]);

  const activeOutlet =
    outletList.find((o) => o.id === activeOutletId) ||
    outletList[0] || {
      id: "default",
      name: applicationUser?.restaurant_name || applicationUser?.name || "Saffron Junction",
      area: "Main Kitchen",
      isPrimary: true,
      status: "Active",
      address: "Main Branch",
    };

  const value = {
    outlets: outletList,
    setOutlets: setOutletList,
    activeOutletId: activeOutlet?.id,
    setActiveOutletId,
    activeOutlet,
  };

  return (
    <OutletContext.Provider value={value}>{children}</OutletContext.Provider>
  );
}

export function useOutlets() {
  const context = useContext(OutletContext);
  if (!context) {
    throw new Error("useOutlets must be used inside an OutletProvider");
  }
  return context;
}