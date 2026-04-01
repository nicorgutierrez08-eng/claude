const items = [
  "ENVÍOS GRATIS A TODO EL PAÍS",
  "★",
  "CUOTAS SIN INTERÉS",
  "★",
  "MÁS DE 130 AÑOS DE GARANTÍA",
  "★",
  "NUEVA FRAGANCIA: NEW SMART",
  "★",
  "SUCURSAL SAN ISIDRO ABIERTA",
  "★",
  "WHATSAPP: 11-3096-9196",
  "★",
];

export default function MarqueeBanner() {
  const repeated = [...items, ...items];

  return (
    <div className="bg-gold overflow-hidden py-3">
      <div className="flex whitespace-nowrap animate-marquee">
        {repeated.map((item, i) => (
          <span
            key={i}
            className="inline-block px-6 text-charcoal text-[10px] font-sans font-semibold tracking-[0.35em] uppercase"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
