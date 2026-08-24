import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AuthProviderShell from "@/components/AuthProvider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains",
});

export const metadata = {
  title: "RasoiSaathi — One Connected System. Every Restaurant Operation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="font-body"><AuthProviderShell>{children}</AuthProviderShell></body>
    </html>
  );
}