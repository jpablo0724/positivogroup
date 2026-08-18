interface PositivoLogoProps {
  variant?: "default" | "light";
  className?: string;
  showTagline?: boolean;
}

const GRADIENT_ID = "positivo-mark-gradient";

/**
 * Marca de Positivo Group: dos anillos cuadrados entrelazados en diagonal que
 * forman una cruz, con degradado de naranja (abajo-izquierda) a carmín
 * (arriba-derecha), junto al logotipo "positivogroup®".
 */
export default function PositivoLogo({
  variant = "default",
  className = "",
  showTagline = false,
}: PositivoLogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-[#16162B]";
  const taglineColor = variant === "light" ? "text-white/60" : "text-slate-400";

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="flex items-center gap-2">
        <svg
          viewBox="0 0 100 100"
          className="h-7 w-7 shrink-0"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={GRADIENT_ID}
              x1="8"
              y1="92"
              x2="92"
              y2="8"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#F97A1F" />
              <stop offset="45%" stopColor="#EF2D3C" />
              <stop offset="100%" stopColor="#E8145B" />
            </linearGradient>
          </defs>

          {/* Anillo inferior-izquierdo y anillo superior-derecho, entrelazados.
              Cada uno se dibuja como un cuadrado exterior con un cuadrado
              interior en sentido inverso (fill-rule evenodd) para dejar el
              hueco central. */}
          <path
            fill={`url(#${GRADIENT_ID})`}
            fillRule="evenodd"
            d="M6 44h46v46H6V44Zm14 14v18h18V58H20Z"
          />
          <path
            fill={`url(#${GRADIENT_ID})`}
            fillRule="evenodd"
            d="M40 10h46v46H40V10Zm14 14v18h18V24H54Z"
          />
        </svg>

        <p
          className={`whitespace-nowrap font-[Poppins] text-xl leading-none ${textColor}`}
        >
          <span className="font-bold tracking-tight">positivo</span>
          <span className="font-light tracking-tight">group</span>
          <sup className="ml-0.5 text-[8px] font-normal">&reg;</sup>
        </p>
      </div>

      {showTagline && (
        <p
          className={`mt-1 font-[Poppins] text-[7px] font-medium tracking-[0.2em] ${taglineColor}`}
        >
          PUBLICIDAD Y COMUNICACIÓN RESIDENCIAL
        </p>
      )}
    </div>
  );
}
