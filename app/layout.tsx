import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const grotesk = Schibsted_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "TaskProX — team chat, events and files in one place", template: "%s · TaskProX" },
  description:
    "TaskProX is a team workspace: threaded chat, scheduled events with time zones, shared files and notifications.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#141310" },
  ],
};

// Applies the saved theme before first paint to avoid a flash. Content is static and has no user input.
const themeScript = `try{var t=localStorage.getItem("tpx-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${grotesk.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[100] rounded-md bg-surface px-3 py-2 text-ink shadow-pop">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
