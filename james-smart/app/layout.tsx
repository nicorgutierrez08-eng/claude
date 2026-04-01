import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "James Smart — Elegancia Atemporal desde 1851",
  description:
    "Ropa masculina de alta calidad con raíces en Londres desde 1851 y más de 130 años de presencia en Argentina. Trajes, camisas, blazers y accesorios de primera línea.",
  keywords: "ropa masculina, trajes, camisas, blazers, moda hombre, Buenos Aires, James Smart",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Montserrat:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
