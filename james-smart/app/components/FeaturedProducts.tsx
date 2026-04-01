"use client";

import { ArrowRight, Heart } from "lucide-react";
import { useInView } from "../hooks/useInView";

const products = [
  {
    id: 1,
    name: "Saco Pura Lana",
    category: "Sacos",
    tag: "Destacado",
    description: "100% lana virgen. Estructura impecable, caída perfecta.",
    gradient: "linear-gradient(160deg, #1e293b 0%, #334155 60%, #0f172a 100%)",
  },
  {
    id: 2,
    name: "Camisa Sport Premium",
    category: "Camisas Sport",
    tag: "Nuevo",
    description: "Algodón pima de primera calidad. Fresco y elegante.",
    gradient: "linear-gradient(160deg, #6b4c30 0%, #8b6540 60%, #3d2818 100%)",
  },
  {
    id: 3,
    name: "Fragancia New Smart",
    category: "Perfumes",
    tag: "Nuevo",
    description: "Una nueva expresión del espíritu James Smart. Notas amaderadas.",
    gradient: "linear-gradient(160deg, #1a3d2b 0%, #2d6147 60%, #0d2010 100%)",
  },
  {
    id: 4,
    name: "Remera Cuello Redondo",
    category: "Remeras",
    tag: "Básicos",
    description: "El básico definitivo. Algodón peinado, corte clásico.",
    gradient: "linear-gradient(160deg, #1C1917 0%, #44403C 60%, #0c0a09 100%)",
  },
];

const tagColors: Record<string, string> = {
  Destacado: "bg-gold text-charcoal",
  Nuevo: "bg-green-700 text-cream",
  Básicos: "bg-warm text-cream",
};

export default function FeaturedProducts() {
  const { ref, inView } = useInView();

  return (
    <section
      id="novedades"
      ref={ref as React.RefObject<HTMLElement>}
      className="section-padding bg-cream"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row items-start sm:items-end justify-between mb-14 gap-4 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <div>
            <p className="text-gold text-[10px] tracking-[0.45em] uppercase font-sans font-medium mb-3">
              Selección
            </p>
            <h2 className="font-serif text-charcoal text-4xl sm:text-5xl font-light leading-tight">
              Productos{" "}
              <span className="italic">Destacados</span>
            </h2>
            <div className="h-px w-12 bg-gold/50 mt-4" />
          </div>
          <a
            href="#coleccion"
            className="group flex items-center gap-2 text-muted hover:text-gold text-xs tracking-[0.25em] uppercase font-sans font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap"
          >
            Ver todo
            <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
          </a>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              delay={i * 100}
              inView={inView}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  product,
  delay,
  inView,
}: {
  product: (typeof products)[0];
  delay: number;
  inView: boolean;
}) {
  return (
    <div
      className={`group cursor-pointer transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Image area */}
      <div
        className="relative overflow-hidden mb-4"
        style={{ height: "300px", background: product.gradient }}
      >
        {/* Overlay pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 8px)`,
          }}
        />
        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

        {/* Tag */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-[9px] tracking-[0.3em] uppercase font-sans font-semibold px-2.5 py-1 ${tagColors[product.tag] ?? "bg-warm text-cream"}`}
          >
            {product.tag}
          </span>
        </div>

        {/* Wishlist */}
        <button
          aria-label="Agregar a favoritos"
          className="absolute top-3 right-3 p-2 bg-cream/10 text-cream/70 hover:bg-cream/20 hover:text-gold opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
        >
          <Heart size={14} />
        </button>

        {/* Quick add CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <button className="w-full py-2.5 bg-gold text-charcoal text-[10px] tracking-[0.25em] uppercase font-sans font-semibold hover:bg-gold/90 transition-colors cursor-pointer">
            Ver Producto
          </button>
        </div>
      </div>

      {/* Info */}
      <div>
        <p className="text-muted text-[10px] tracking-[0.3em] uppercase font-sans mb-1">
          {product.category}
        </p>
        <h3 className="font-serif text-charcoal text-xl font-light group-hover:text-warm transition-colors duration-200">
          {product.name}
        </h3>
        <p className="text-muted/80 font-sans text-xs mt-1 leading-relaxed">
          {product.description}
        </p>
        <a
          href="#"
          className="inline-flex items-center gap-1.5 mt-3 text-gold text-[10px] tracking-widest uppercase font-sans font-medium hover:gap-2.5 transition-all duration-200 cursor-pointer"
        >
          Ver más
          <ArrowRight size={10} />
        </a>
      </div>
    </div>
  );
}
