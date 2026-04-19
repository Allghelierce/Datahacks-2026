import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "bioscope — biodiversity intelligence",
  description: "Regional biodiversity monitoring dashboard powered by iNaturalist data and Google Gemini AI",
  icons: { icon: "/favicon.png" }
};

import { DataProvider } from "@/context/DataContext";
import Navbar from "@/components/ui/Navbar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.variable} ${mono.variable} ${outfit.variable} font-sans`}>
        <DataProvider>
          <Navbar />
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
