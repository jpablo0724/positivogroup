interface LogoEmpresaProps {
  /** Sobre qué fondo se pinta: decide cuál de los dos archivos se usa. */
  fondo?: "claro" | "oscuro";
  className?: string;
}

/**
 * El logo de la empresa, tal como lo entregó Positivo Group.
 *
 * Hay dos archivos porque el logotipo cambia de color según el fondo: sobre
 * blanco va el de texto azul marino, y sobre la barra lateral el de texto
 * blanco. Las rutas viven aquí y en ningún otro sitio, que los nombres se
 * parecen y llevan tildes.
 */
const ARCHIVO = {
  claro: "/Logo-Cotización.png",
  oscuro: "/Logo-cotizacion-blanco.png",
} as const;

export default function LogoEmpresa({
  fondo = "claro",
  className = "w-full max-w-[190px]",
}: LogoEmpresaProps) {
  return (
    <img src={ARCHIVO[fondo]} alt="Positivo Group" className={className} />
  );
}
