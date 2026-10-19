import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "Dos Studio OS", template: "%s · Dos Studio OS" },
  description: "Sistema interno de Dos Studio: comercial, clientes, tareas, documentos y facturación",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/isotype.png" },
};

export const viewport: Viewport = {
  themeColor: "#5430FF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
