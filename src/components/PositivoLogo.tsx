interface PositivoLogoProps {
  variant?: "default" | "light";
  className?: string;
  showTagline?: boolean;
}

const GRADIENT_ID = "positivo-mark-gradient";

export default function PositivoLogo({
  variant = "default",
  className = "",
  showTagline = false,
}: PositivoLogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-[#151726]";
  const taglineColor = variant === "light" ? "text-white/60" : "text-slate-400";

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 64 64" className="h-6 w-6 shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id={GRADIENT_ID} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ef1d63" />
              <stop offset="55%" stopColor="#f2172f" />
              <stop offset="100%" stopColor="#ff8a24" />
            </linearGradient>
          </defs>
          <g transform="rotate(-6 32 32)">
            <rect x="25" y="6" width="14" height="52" rx="3" fill={`url(#${GRADIENT_ID})`} />
            <rect x="6" y="25" width="52" height="14" rx="3" fill={`url(#${GRADIENT_ID})`} />
          </g>
        </svg>
        <p
          className={`whitespace-nowrap font-[Poppins] text-xl leading-none ${textColor}`}
        >
          <span className="font-bold">positivo</span>
          <span className="font-light">group</span>
          <sup className="ml-0.5 text-[8px] font-normal">&reg;</sup>
        </p>
      </div>
      {showTagline && (
        <p
          className={`mt-0.5 font-[Poppins] text-[7px] font-medium tracking-[0.2em] ${taglineColor}`}
        >
          PUBLICIDAD Y COMUNICACIÓN RESIDENCIAL
        </p>
      )}
    </div>
  );
}
