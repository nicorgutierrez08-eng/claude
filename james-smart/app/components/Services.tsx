"use client";

import { useInView } from "../hooks/useInView";

const services = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    title: "Envíos Gratis",
    subtitle: "A todo el país",
    description:
      "Envíos sin costo a todo Argentina en compras superiores a $300.000. También retiro en cualquiera de nuestras sucursales.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    title: "Cuotas Sin Interés",
    subtitle: "Todas las tarjetas",
    description:
      "Financiá tu compra en cómodas cuotas sin interés con las principales tarjetas de crédito. Consulta las promociones vigentes.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "130 Años de Garantía",
    subtitle: "Calidad certificada",
    description:
      "Más de un siglo respaldando la calidad de cada prenda. Nuestro compromiso con la excelencia es nuestra mayor garantía.",
  },
];

export default function Services() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="py-16 bg-charcoal border-t border-gold/10 border-b border-gold/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 md:divide-x md:divide-gold/20">
          {services.map((service, i) => (
            <div
              key={service.title}
              className={`flex flex-col sm:flex-row md:flex-col lg:flex-row items-start gap-5 px-0 md:px-8 first:pl-0 last:pr-0 transition-all duration-700 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="text-gold flex-shrink-0">{service.icon}</div>
              <div>
                <h3 className="font-serif text-cream text-xl font-light mb-0.5">
                  {service.title}
                </h3>
                <p className="text-gold text-[10px] tracking-[0.3em] uppercase font-sans font-medium mb-2">
                  {service.subtitle}
                </p>
                <p className="text-cream/50 font-sans font-light text-sm leading-relaxed">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
