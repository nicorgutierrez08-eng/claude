"use client";

import { MapPin, Phone, Clock } from "lucide-react";
import { useInView } from "../hooks/useInView";

const stores = [
  {
    name: "Casa Central",
    address: "Santa Fe 1715",
    city: "C.A.B.A., Buenos Aires",
    phone: "11-4812-5220",
    hours: "Lun–Vie 10:00–20:00 · Sáb 10:00–18:00",
    featured: true,
  },
  {
    name: "Sucursal San Isidro",
    address: "Consultar dirección",
    city: "San Isidro, Buenos Aires",
    phone: "11-4812-5220",
    hours: "Lun–Sáb 10:00–18:00",
    featured: false,
    badge: "Reabierta",
  },
  {
    name: "WhatsApp Shop",
    address: "Atención online",
    city: "Todo Argentina",
    phone: "11-3096-9196",
    hours: "Lun–Vie 10:00–20:00 · Sáb 10:00–17:00",
    featured: false,
    isWhatsApp: true,
  },
];

export default function Stores() {
  const { ref, inView } = useInView();

  return (
    <section
      id="sucursales"
      ref={ref as React.RefObject<HTMLElement>}
      className="section-padding bg-cream-dark"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <p className="text-gold text-[10px] tracking-[0.45em] uppercase font-sans font-medium mb-3">
            Dónde Encontrarnos
          </p>
          <h2 className="font-serif text-charcoal text-4xl sm:text-5xl font-light leading-tight">
            Nuestras{" "}
            <span className="italic text-warm">Sucursales</span>
          </h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-px w-12 bg-gold/50" />
            <div className="w-1 h-1 rounded-full bg-gold" />
            <div className="h-px w-12 bg-gold/50" />
          </div>
        </div>

        {/* Store cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {stores.map((store, i) => (
            <div
              key={store.name}
              className={`relative group p-8 border transition-all duration-500 cursor-default ${
                store.featured
                  ? "border-gold/50 bg-charcoal"
                  : "border-charcoal/10 bg-cream hover:border-gold/30"
              } transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              {/* Featured label */}
              {store.featured && (
                <div className="absolute -top-3 left-6">
                  <span className="bg-gold text-charcoal text-[9px] tracking-[0.3em] uppercase font-sans font-semibold px-3 py-1">
                    Principal
                  </span>
                </div>
              )}

              {/* New badge */}
              {store.badge && (
                <div className="absolute -top-3 left-6">
                  <span className="bg-green-700 text-cream text-[9px] tracking-[0.3em] uppercase font-sans font-semibold px-3 py-1">
                    {store.badge}
                  </span>
                </div>
              )}

              {/* WhatsApp badge */}
              {store.isWhatsApp && (
                <div className="absolute -top-3 left-6">
                  <span className="bg-charcoal text-cream text-[9px] tracking-[0.3em] uppercase font-sans font-semibold px-3 py-1">
                    Online
                  </span>
                </div>
              )}

              {/* Gold accent bar */}
              <div className="h-0.5 w-8 bg-gold mb-6" />

              <h3
                className={`font-serif text-2xl font-light mb-4 ${store.featured ? "text-cream" : "text-charcoal"}`}
              >
                {store.name}
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin
                    size={14}
                    className={`mt-0.5 flex-shrink-0 ${store.featured ? "text-gold" : "text-gold"}`}
                  />
                  <div>
                    <p
                      className={`text-sm font-sans ${store.featured ? "text-cream/80" : "text-charcoal/80"}`}
                    >
                      {store.address}
                    </p>
                    <p
                      className={`text-xs font-sans ${store.featured ? "text-cream/50" : "text-charcoal/50"}`}
                    >
                      {store.city}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone
                    size={14}
                    className="flex-shrink-0 text-gold"
                  />
                  <a
                    href={`tel:${store.phone}`}
                    className={`text-sm font-sans hover:text-gold transition-colors cursor-pointer ${
                      store.featured ? "text-cream/80" : "text-charcoal/80"
                    }`}
                  >
                    {store.phone}
                  </a>
                </div>

                <div className="flex items-start gap-3">
                  <Clock
                    size={14}
                    className="mt-0.5 flex-shrink-0 text-gold"
                  />
                  <p
                    className={`text-xs font-sans leading-relaxed ${
                      store.featured ? "text-cream/50" : "text-charcoal/50"
                    }`}
                  >
                    {store.hours}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact email */}
        <div
          className={`text-center transition-all duration-700 ${inView ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "500ms" }}
        >
          <p className="text-muted font-sans text-sm">
            Consultas por e-mail:{" "}
            <a
              href="mailto:shop@jamessmart.com"
              className="text-gold hover:text-gold/80 transition-colors cursor-pointer"
            >
              shop@jamessmart.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
