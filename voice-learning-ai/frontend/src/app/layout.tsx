import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Learning AI — Local Voice Assessment",
  description: "Practice FAANG-level interviews with local AI — fully offline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
