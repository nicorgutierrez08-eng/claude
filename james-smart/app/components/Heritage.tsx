"use client";

import { useInView } from "../hooks/useInView";

const stats = [
  { value: "1851", label: "Fundación en Londres" },
  { value: "1888", label: "Llegada a Buenos Aires" },
  { value: "130+", label: "Años en Argentina" },
  { value: "∞", label: "Elegancia sin tiempo" },
];

export default function Heritage() {
  const { ref, inView } = useInView(0.1);
  const { ref: ref2, inView: inView2 } = useInView(0.1);

  return (
    <section
      id="nosotros"
      className="section-padding relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #1C1917 0%, #292524 50%, #1C1917 100%)",
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg, #CA8A04 0px, #CA8A04 1px, transparent 1px, transparent 12px)`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <div
            ref={ref as React.RefObject<HTMLDivElement>}
            className={`transition-all duration-1000 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
          >
            <p className="text-gold text-[10px] tracking-[0.45em] uppercase font-sans font-medium mb-5">
              Nuestra Historia
            </p>
            <h2 className="font-serif text-cream text-4xl sm:text-5xl lg:text-6xl font-light leading-tight mb-6">
              Una herencia
              <br />
              <span className="italic text-gold">de elegancia</span>
            </h2>

            <div className="h-px w-16 bg-gold/40 mb-8" />

            <div className="space-y-5 text-cream/60 font-sans font-light text-sm sm:text-base leading-relaxed">
              <p>
                James Smart nació en Londres en <strong className="text-cream/80 font-medium">1851</strong>, en plena era victoriana, cuando la elegancia masculina alcanzaba su máxima expresión. Fundada sobre principios de calidad excepcional y sastrería impecable, la marca rápidamente se convirtió en sinónimo de estilo refinado.
              </p>
              <p>
                En <strong className="text-cream/80 font-medium">1888</strong>, James Smart cruzó el Atlántico para establecerse en Buenos Aires, trayendo consigo la tradición británica de excelencia y adaptándola al espíritu argentino. Más de 130 años después, esa misión sigue intacta.
              </p>
              <p>
                Hoy, James Smart es mucho más que una tienda de ropa. Es una institución cultural, un guardián de la elegancia clásica en un mundo en constante cambio.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 mt-8">
              <a
                href="#sucursales"
                className="group flex items-center gap-2 px-6 py-3 border border-gold/40 text-gold text-xs tracking-[0.25em] uppercase font-sans font-medium hover:bg-gold hover:text-charcoal transition-all duration-300 cursor-pointer"
              >
                Nuestras Sucursales
              </a>
              <a
                href="#coleccion"
                className="group flex items-center gap-2 px-6 py-3 bg-transparent text-cream/60 hover:text-cream text-xs tracking-[0.25em] uppercase font-sans font-medium transition-all duration-300 cursor-pointer"
              >
                Ver Colección →
              </a>
            </div>
          </div>

          {/* Right: Stats */}
          <div
            ref={ref2 as React.RefObject<HTMLDivElement>}
            className={`transition-all duration-1000 ${inView2 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}
            style={{ transitionDelay: "200ms" }}
          >
            {/* Decorative frame */}
            <div className="relative">
              <div className="absolute -inset-4 border border-gold/10" />
              <div className="absolute -inset-8 border border-gold/05" />

              <div className="grid grid-cols-2 gap-6 p-8 border border-gold/20">
                {stats.map((stat, i) => (
                  <div
                    key={stat.value}
                    className={`p-6 border border-cream/5 hover:border-gold/30 transition-all duration-300 cursor-default transition-all duration-700 ${inView2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                    style={{ transitionDelay: `${(i + 3) * 100}ms` }}
                  >
                    <div className="font-serif text-gold text-5xl sm:text-6xl font-light leading-none mb-2">
                      {stat.value}
                    </div>
                    <div className="text-cream/50 text-[10px] tracking-[0.3em] uppercase font-sans font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quote */}
            <div className="mt-8 pl-6 border-l-2 border-gold/40">
              <p className="font-serif text-cream/70 text-lg italic font-light leading-relaxed">
                "La verdadera elegancia no se nota. Es invisible."
              </p>
              <p className="text-gold text-[10px] tracking-widest uppercase font-sans mt-2">
                — Principio James Smart
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
