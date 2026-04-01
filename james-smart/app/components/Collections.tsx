"use client";

import { ArrowRight } from "lucide-react";
import { useInView } from "../hooks/useInView";

const collections = [
  {
    id: "trajes",
    label: "Trajes & Ambos",
    sub: "Formalidad impecable",
    span: "col-span-2",
    gradient: "linear-gradient(135deg, #0f2744 0%, #1a3a6b 60%, #0a1b36 100%)",
    accent: "#3B82F6",
  },
  {
    id: "blazers",
    label: "Blazers & Sacos",
    sub: "Estilo versátil",
    span: "",
    gradient: "linear-gradient(135deg, #1a3d2b 0%, #0d2010 70%, #061508 100%)",
    accent: "#10B981",
  },
  {
    id: "camisas",
    label: "Camisas",
    sub: "Tejidos premium",
    span: "",
    gradient: "linear-gradient(135deg, #6b4c30 0%, #a07050 50%, #3d2a18 100%)",
    accent: "#F59E0B",
  },
  {
    id: "pantalones",
    label: "Pantalones",
    sub: "Corte perfecto",
    span: "",
    gradient: "linear-gradient(135deg, #1e293b 0%, #334155 60%, #0f172a 100%)",
    accent: "#94A3B8",
  },
  {
    id: "accesorios",
    label: "Accesorios",
    sub: "Los detalles importan",
    span: "",
    gradient: "linear-gradient(135deg, #5c1a1a 0%, #7f2020 60%, #3a0d0d 100%)",
    accent: "#EF4444",
  },
  {
    id: "calzados",
    label: "Calzados",
    sub: "Cada paso con clase",
    span: "",
    gradient: "linear-gradient(135deg, #3d2310 0%, #6b3d1a 50%, #1a0e06 100%)",
    accent: "#CA8A04",
  },
];

export default function Collections() {
  const { ref, inView } = useInView();

  return (
    <section
      id="coleccion"
      ref={ref as React.RefObject<HTMLElement>}
      className="section-padding bg-cream-dark"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <p className="text-gold text-[10px] tracking-[0.45em] uppercase font-sans font-medium mb-3">
            Nuestra Colección
          </p>
          <h2 className="font-serif text-charcoal text-4xl sm:text-5xl font-light leading-tight">
            Viste con{" "}
            <span className="italic text-warm">Propósito</span>
          </h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-px w-12 bg-gold/50" />
            <div className="w-1 h-1 rounded-full bg-gold" />
            <div className="h-px w-12 bg-gold/50" />
          </div>
          <p className="text-muted font-sans font-light text-sm mt-4 max-w-md mx-auto">
            Cada pieza, seleccionada con los más altos estándares de calidad y elegancia.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Featured large card */}
          <div
            className={`lg:col-span-2 row-span-1 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
            style={{ transitionDelay: "100ms" }}
          >
            <CollectionCard card={collections[0]} large />
          </div>

          {/* Side card */}
          <div
            className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
            style={{ transitionDelay: "200ms" }}
          >
            <CollectionCard card={collections[1]} />
          </div>

          {/* Bottom row */}
          {collections.slice(2).map((card, i) => (
            <div
              key={card.id}
              className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${(i + 3) * 100}ms` }}
            >
              <CollectionCard card={card} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CollectionCard({
  card,
  large = false,
}: {
  card: (typeof collections)[0];
  large?: boolean;
}) {
  return (
    <a
      href={`#${card.id}`}
      className="group relative block overflow-hidden cursor-pointer"
      style={{ height: large ? "420px" : "320px" }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
        style={{ background: card.gradient }}
      />

      {/* Pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 8px)`,
        }}
      />

      {/* Gold shimmer on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px transition-all duration-500 group-hover:h-0.5"
        style={{ background: card.accent, opacity: 0.6 }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6">
        <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
          <p className="text-cream/60 text-[9px] tracking-[0.4em] uppercase font-sans mb-1">
            {card.sub}
          </p>
          <h3 className="font-serif text-cream text-2xl font-light tracking-wide leading-tight">
            {card.label}
          </h3>
          <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-gold text-[10px] tracking-[0.3em] uppercase font-sans font-medium">
              Ver colección
            </span>
            <ArrowRight size={12} className="text-gold" />
          </div>
        </div>
      </div>
    </a>
  );
}
