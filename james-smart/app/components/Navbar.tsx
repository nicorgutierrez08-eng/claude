"use client";

import { useEffect, useState } from "react";
import {
  Menu,
  X,
  Search,
  ShoppingBag,
  ChevronDown,
  MessageCircle,
} from "lucide-react";

const categories = [
  {
    label: "Formal",
    items: ["Ambos", "Blazers", "Sacos", "Pantalón Vestir", "Camisas Vestir", "Corbatas"],
  },
  {
    label: "Casual",
    items: ["Camisa Campo", "Camisas Sport", "Jeans", "Pantalón Sport", "Remeras y Chombas"],
  },
  {
    label: "Completá tu look",
    items: ["Accesorios", "Pañuelos", "Perfumes", "Sweaters", "Abrigos", "Calzados", "Pijamas"],
  },
];

const navLinks = [
  { label: "Inicio", href: "#inicio" },
  { label: "Novedades", href: "#novedades" },
  { label: "Quiénes Somos", href: "#nosotros" },
  { label: "Sucursales", href: "#sucursales" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-charcoal shadow-2xl py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <a href="#inicio" className="flex flex-col items-start group">
            <span className="font-serif text-2xl font-light tracking-[0.25em] text-cream uppercase leading-none">
              James Smart
            </span>
            <span className="text-gold text-[9px] tracking-[0.5em] font-sans font-medium uppercase mt-0.5 transition-opacity duration-300 group-hover:opacity-80">
              Est. 1851
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            <a
              href="#inicio"
              className="text-cream/80 hover:text-gold text-xs tracking-widest font-sans font-medium uppercase transition-colors duration-200 cursor-pointer"
            >
              Inicio
            </a>

            {/* Colección Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setCollectionsOpen(true)}
              onMouseLeave={() => setCollectionsOpen(false)}
            >
              <button className="flex items-center gap-1 text-cream/80 hover:text-gold text-xs tracking-widest font-sans font-medium uppercase transition-colors duration-200 cursor-pointer">
                Colección
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${collectionsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Mega Menu */}
              {collectionsOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[640px] bg-cream shadow-2xl border border-gold/20 p-8">
                  <div className="grid grid-cols-3 gap-6">
                    {categories.map((cat) => (
                      <div key={cat.label}>
                        <p className="text-gold text-[10px] tracking-[0.3em] uppercase font-sans font-semibold mb-3 pb-2 border-b border-gold/20">
                          {cat.label}
                        </p>
                        <ul className="space-y-2">
                          {cat.items.map((item) => (
                            <li key={item}>
                              <a
                                href="#productos"
                                className="text-charcoal/70 hover:text-gold text-sm font-sans transition-colors duration-150 cursor-pointer block"
                              >
                                {item}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-gold/20 flex gap-3">
                    <a
                      href="#guia"
                      className="text-[10px] tracking-widest text-charcoal/50 hover:text-gold font-sans uppercase transition-colors cursor-pointer"
                    >
                      Guía de Talles
                    </a>
                    <span className="text-charcoal/20">·</span>
                    <a
                      href="#novedades"
                      className="text-[10px] tracking-widest text-charcoal/50 hover:text-gold font-sans uppercase transition-colors cursor-pointer"
                    >
                      Novedades
                    </a>
                  </div>
                </div>
              )}
            </div>

            {navLinks.slice(1).map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-cream/80 hover:text-gold text-xs tracking-widest font-sans font-medium uppercase transition-colors duration-200 cursor-pointer"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Icons */}
          <div className="hidden lg:flex items-center gap-4">
            <button
              aria-label="Buscar"
              className="text-cream/70 hover:text-gold transition-colors duration-200 cursor-pointer"
            >
              <Search size={18} />
            </button>
            <a
              href="https://wa.me/5491130969196"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="text-cream/70 hover:text-gold transition-colors duration-200 cursor-pointer"
            >
              <MessageCircle size={18} />
            </a>
            <button
              aria-label="Carrito"
              className="relative text-cream/70 hover:text-gold transition-colors duration-200 cursor-pointer"
            >
              <ShoppingBag size={18} />
            </button>
            <a
              href="#productos"
              className="ml-2 px-5 py-2 bg-gold text-charcoal text-[10px] tracking-[0.2em] font-sans font-semibold uppercase hover:bg-gold/90 transition-colors duration-200 cursor-pointer"
            >
              Explorar
            </a>
          </div>

          {/* Mobile Hamburger */}
          <button
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-cream cursor-pointer"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-charcoal border-t border-gold/20 px-4 py-6 space-y-4">
          <a
            href="#inicio"
            onClick={() => setMobileOpen(false)}
            className="block text-cream/80 text-sm tracking-widest uppercase font-sans py-2 border-b border-cream/10 cursor-pointer"
          >
            Inicio
          </a>

          <div>
            <button
              onClick={() => setMobileCatOpen(!mobileCatOpen)}
              className="w-full flex items-center justify-between text-cream/80 text-sm tracking-widest uppercase font-sans py-2 border-b border-cream/10 cursor-pointer"
            >
              Colección
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${mobileCatOpen ? "rotate-180" : ""}`}
              />
            </button>
            {mobileCatOpen && (
              <div className="pt-3 pl-4 space-y-3">
                {categories.map((cat) => (
                  <div key={cat.label}>
                    <p className="text-gold text-[10px] tracking-widest uppercase font-semibold mb-2">
                      {cat.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cat.items.map((item) => (
                        <a
                          key={item}
                          href="#productos"
                          onClick={() => setMobileOpen(false)}
                          className="text-cream/60 hover:text-gold text-xs font-sans cursor-pointer"
                        >
                          {item}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {navLinks.slice(1).map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block text-cream/80 text-sm tracking-widest uppercase font-sans py-2 border-b border-cream/10 cursor-pointer"
            >
              {link.label}
            </a>
          ))}

          <div className="flex items-center gap-4 pt-2">
            <a
              href="https://wa.me/5491130969196"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream/70 hover:text-gold transition-colors cursor-pointer"
            >
              <MessageCircle size={20} />
            </a>
            <button className="text-cream/70 hover:text-gold transition-colors cursor-pointer">
              <Search size={20} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
