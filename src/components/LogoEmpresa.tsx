interface LogoEmpresaProps {
  className?: string;
}

/**
 * El logo de la empresa, tal como lo entregó Positivo Group.
 *
 * Se usa donde el fondo es claro: la cotización y la pantalla de acceso.
 * Para la barra lateral, que tiene fondo oscuro, sigue estando PositivoLogo,
 * que dibuja la marca y puede pintar el texto en blanco.
 *
 * La ruta vive aquí y en ningún otro sitio: el nombre del archivo lleva tilde
 * y conviene no repetirlo por el código.
 */
export default function LogoEmpresa({
  className = "w-full max-w-[190px]",
}: LogoEmpresaProps) {
  return (
    <img src="/Logo-Cotización.png" alt="Positivo Group" className={className} />
  );
}
