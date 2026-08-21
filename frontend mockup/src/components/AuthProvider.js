"use client";

import { AuthProvider } from "@/context/AuthContext";

export default function AuthProviderShell({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}