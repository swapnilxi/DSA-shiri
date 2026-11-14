import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";
import { ToastProvider } from "@/components/ui/ToastContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NextLevel — The Engineer's Journey",
    template: "%s · NextLevel",
  },
  description:
    "A private, premium interview-preparation companion for software engineering and AI engineering interviews.",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%230c1428'/><path d='M8 22 L16 8 L24 22' stroke='%2360a5fa' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/><circle cx='16' cy='22' r='1.6' fill='%23fbbf24'/></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased tracking-tight`}
        suppressHydrationWarning
      >
        <ToastProvider>
          <NavBar />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
