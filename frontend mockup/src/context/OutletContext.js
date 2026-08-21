"use client";

import { createContext, useContext, useState } from "react";

// The list of outlets lives here now — this is the ONE place it's defined.
// Both the Topbar switcher and the Outlets page will read from here.
const outlets = [
  {
    id: 1,
    name: "Red Villa Restaurant",
    area: "Andheri West",
    isPrimary: true,
    status: "Active",
    address: "Shop 4, Linking Road, Andheri West, Mumbai",
    phone: "+91 98765 43210",
    cuisine: "North Indian, Chinese",
    openTime: "11:00 AM",
    closeTime: "11:00 PM",
    gst: "27ABCDE1234F1Z5",
    fssai: "12345678901234",
  },
  {
    id: 2,
    name: "Red Villa Restaurant",
    area: "Powai",
    isPrimary: false,
    status: "Active",
    address: "Unit 12, Hiranandani Gardens, Powai, Mumbai",
    phone: "+91 91234 56789",
    cuisine: "North Indian, Chinese",
    openTime: "12:00 PM",
    closeTime: "10:30 PM",
    gst: "27ABCDE1234F1Z6",
    fssai: "12345678901235",
  },
];

// This is the "box" itself — starts empty, gets filled in by the Provider below
const OutletContext = createContext(null);

// This wraps your whole dashboard and makes the outlet data + active outlet
// available to any page or component nested inside it
export function OutletProvider({ children }) {
  const [outletList, setOutletList] = useState(outlets);
  const [activeOutletId, setActiveOutletId] = useState(1);

  const activeOutlet = outletList.find((o) => o.id === activeOutletId);

  const value = {
    outlets: outletList,
    setOutlets: setOutletList,
    activeOutletId,
    setActiveOutletId,
    activeOutlet,
  };

  return (
    <OutletContext.Provider value={value}>{children}</OutletContext.Provider>
  );
}

// A little shortcut hook — instead of importing useContext + OutletContext
// everywhere, any file can just call useOutlets() to get everything above
export function useOutlets() {
  const context = useContext(OutletContext);
  if (!context) {
    throw new Error("useOutlets must be used inside an OutletProvider");
  }
  return context;
}