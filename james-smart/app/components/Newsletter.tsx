"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useInView } from "../hooks/useInView";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { ref, inView } = useInView();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 800);
  }

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="relative py-24 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1C1917 0%, #0c0a09 100%)",
      }}
    >
      {/* Background decorative */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, #CA8A04 0px, #CA8A04 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, #CA8A04 0px, #CA8A04 1px, transparent 1px, transparent 60px)`,
          }}
        />
      </div>

      {/* Top and bottom gold lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div
        className={`relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center transition-all duration-1000 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 border border-gold/40 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-5 h-5 text-gold"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
        </div>

        <p className="text-gold text-[10px] tracking-[0.45em] uppercase font-sans font-medium mb-4">
          Newsletter Exclusivo
        </p>
        <h2 className="font-serif text-cream text-3xl sm:text-4xl font-light mb-3">
          Novedades &{" "}
          <span className="italic text-gold">Beneficios Exclusivos</span>
        </h2>
        <p className="text-cream/50 font-sans font-light text-sm leading-relaxed mb-8 max-w-md mx-auto">
          Sé el primero en conocer nuestras novedades, colecciones exclusivas y
          promociones especiales para suscriptores.
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <label htmlFor="newsletter-email" className="sr-only">
              Tu correo electrónico
            </label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="flex-1 px-5 py-3.5 bg-cream/10 border border-cream/20 text-cream placeholder-cream/30 text-sm font-sans focus:outline-none focus:border-gold transition-colors duration-200"
            />
            <button
              type="submit"
              disabled={loading}
              className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-gold text-charcoal text-xs tracking-[0.25em] uppercase font-sans font-semibold hover:bg-gold/90 transition-all duration-200 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-charcoal/30 border-t-charcoal rounded-full animate-spin" />
                  Enviando
                </span>
              ) : (
                <>
                  Suscribirse
                  <ArrowRight
                    size={12}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-center gap-3 text-green-400">
            <div className="w-8 h-8 rounded-full bg-green-400/20 flex items-center justify-center">
              <Check size={16} />
            </div>
            <p className="font-sans text-sm">
              ¡Gracias! Te enviaremos las novedades a tu correo.
            </p>
          </div>
        )}

        <p className="text-cream/25 font-sans text-[10px] mt-4">
          Sin spam. Podés darte de baja cuando quieras.
        </p>
      </div>
    </section>
  );
}
