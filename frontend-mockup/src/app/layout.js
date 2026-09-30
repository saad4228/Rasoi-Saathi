import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AuthProviderShell from "@/components/AuthProvider";
import { themeBootScript } from "@/lib/themeScript";

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
    // The boot script may switch data-theme before React hydrates.
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="font-body">
        <AuthProviderShell>{children}</AuthProviderShell>
      </body>
    </html>
  );
}
