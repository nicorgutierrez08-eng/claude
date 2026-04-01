"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";

export default function Hero() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 60%, #2a2219 0%, #1C1917 45%, #0c0a09 100%)",
      }}
    >
      {/* Grain texture overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.3'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px",
        }}
      />

      {/* Decorative gold lines — left */}
      <div
        className={`absolute left-12 top-1/2 -translate-y-1/2 hidden xl:block transition-all duration-1000 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDelay: "900ms" }}
      >
        <div className="flex flex-col gap-2">
          {[40, 24, 14].map((w, i) => (
            <div
              key={i}
              className="h-px bg-gold/60"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>

      {/* Decorative gold lines — right */}
      <div
        className={`absolute right-12 top-1/2 -translate-y-1/2 hidden xl:block transition-all duration-1000 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDelay: "900ms" }}
      >
        <div className="flex flex-col items-end gap-2">
          {[40, 24, 14].map((w, i) => (
            <div
              key={i}
              className="h-px bg-gold/60"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>

      {/* Large background monogram */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
      >
        <span
          className="font-serif font-light text-cream/[0.04]"
          style={{ fontSize: "clamp(200px, 40vw, 520px)", letterSpacing: "0.05em" }}
        >
          JS
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Est. tag */}
        <div
          className={`transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "100ms" }}
        >
          <span className="inline-flex items-center gap-3 text-gold text-[11px] font-sans font-medium tracking-[0.45em] uppercase mb-8">
            <span className="block w-8 h-px bg-gold/60" />
            Desde 1851
            <span className="block w-8 h-px bg-gold/60" />
          </span>
        </div>

        {/* Main heading */}
        <h1
          className={`font-serif text-cream leading-none transition-all duration-1000 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          style={{
            fontSize: "clamp(56px, 10vw, 140px)",
            letterSpacing: "0.1em",
            transitionDelay: "250ms",
          }}
        >
          JAMES
          <br />
          <span className="italic font-light text-gold/90">Smart</span>
        </h1>

        {/* Divider */}
        <div
          className={`flex items-center justify-center gap-4 my-8 transition-all duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "500ms" }}
        >
          <div className="h-px w-16 bg-gold/40" />
          <div className="w-1 h-1 rounded-full bg-gold" />
          <div className="h-px w-16 bg-gold/40" />
        </div>

        {/* Tagline */}
        <p
          className={`text-cream/60 font-sans font-light text-sm sm:text-base tracking-[0.3em] uppercase mb-4 transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "600ms" }}
        >
          Elegancia Atemporal · Herencia Británica
        </p>
        <p
          className={`text-cream/40 font-sans font-light text-sm tracking-wider mb-12 transition-all duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "700ms" }}
        >
          Más de 130 años vistiendo al hombre argentino con clase
        </p>

        {/* CTAs */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "800ms" }}
        >
          <a
            href="#coleccion"
            className="group flex items-center gap-3 px-8 py-4 bg-gold text-charcoal text-xs font-sans font-semibold tracking-[0.25em] uppercase hover:bg-gold/90 transition-all duration-300 cursor-pointer"
          >
            Explorar Colección
            <ArrowRight
              size={14}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </a>
          <a
            href="#nosotros"
            className="flex items-center gap-3 px-8 py-4 border border-cream/30 text-cream text-xs font-sans font-medium tracking-[0.25em] uppercase hover:border-gold hover:text-gold transition-all duration-300 cursor-pointer"
          >
            Nuestra Historia
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-scroll-bounce">
        <span className="text-cream/30 text-[9px] tracking-[0.4em] uppercase font-sans">Scroll</span>
        <ChevronDown size={16} className="text-gold/50" />
      </div>
    </section>
  );
}
