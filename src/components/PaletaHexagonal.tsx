interface PaletaHexagonalProps {
  onElegir: (color: string) => void;
}

/**
 * Paleta de colores en panal, como la de los editores de ofimática.
 *
 * Las 61 celdas no están escritas a mano: se calculan sobre coordenadas
 * hexagonales. El ángulo desde el centro da el tono y la distancia da la
 * claridad, de modo que el centro es blanco y el borde, los tonos más
 * intensos. Escribirlas una a una sería una lista larguísima e imposible de
 * corregir.
 */

const RADIO = 4;
const LADO = 13; // ancho de cada celda, en píxeles

/** Claridad de cada anillo, del centro hacia afuera. */
const CLARIDAD = [100, 88, 74, 56, 34];

function aHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const canal = (n: number) => {
    const k = (n + h / 30) % 12;
    const valor = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * valor)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${canal(0)}${canal(8)}${canal(4)}`;
}

interface Celda {
  color: string;
  x: number;
  y: number;
}

/** Recorre el panal una sola vez, al cargar el módulo. */
const CELDAS: Celda[] = (() => {
  const celdas: Celda[] = [];

  for (let fila = -RADIO; fila <= RADIO; fila++) {
    const desde = Math.max(-RADIO, -RADIO - fila);
    const hasta = Math.min(RADIO, RADIO - fila);

    for (let columna = desde; columna <= hasta; columna++) {
      // Distancia en pasos hasta el centro: es el anillo al que pertenece.
      const anillo =
        (Math.abs(columna) + Math.abs(fila) + Math.abs(columna + fila)) / 2;

      // Posición en el plano, con las filas desplazadas media celda.
      const x = LADO * (columna + fila / 2);
      const y = LADO * 0.87 * fila;

      const tono = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      const claridad = CLARIDAD[anillo];

      celdas.push({
        // El centro no tiene ángulo: es blanco.
        color: anillo === 0 ? "#ffffff" : aHex(tono, 100, claridad),
        x,
        y,
      });
    }
  }

  return celdas;
})();

/** Grises, aparte del panal: son los que más se usan y ahí no caben. */
const GRISES = [0, 12, 25, 37, 50, 62, 75, 87, 100].map((n) =>
  aHex(0, 0, 100 - n),
);

const ANCHO = LADO * (2 * RADIO + 1);
const ALTO = LADO * 0.87 * (2 * RADIO + 1);
const HEXAGONO = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

export default function PaletaHexagonal({ onElegir }: PaletaHexagonalProps) {
  return (
    <div>
      <div
        className="relative mx-auto"
        style={{ width: ANCHO, height: ALTO }}
        role="group"
        aria-label="Paleta de colores"
      >
        {CELDAS.map((celda) => (
          <button
            key={`${celda.x},${celda.y}`}
            type="button"
            title={celda.color}
            aria-label={celda.color}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onElegir(celda.color)}
            className="absolute transition-transform hover:z-10 hover:scale-125"
            style={{
              left: ANCHO / 2 + celda.x - LADO / 2,
              top: ALTO / 2 + celda.y - LADO / 2,
              width: LADO,
              height: LADO * 1.15,
              backgroundColor: celda.color,
              clipPath: HEXAGONO,
            }}
          />
        ))}
      </div>

      <div className="mt-2 flex justify-center gap-0.5">
        {GRISES.map((gris) => (
          <button
            key={gris}
            type="button"
            title={gris}
            aria-label={gris}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onElegir(gris)}
            className="h-4 w-4 border border-slate-200 transition-transform hover:scale-125"
            style={{ backgroundColor: gris, clipPath: HEXAGONO }}
          />
        ))}
      </div>
    </div>
  );
}
