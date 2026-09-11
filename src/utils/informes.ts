import { pedir } from "./api";

/**
 * Informe de contactos de Clientify: lo que trae /api/informes/contactos,
 * ya resuelto (estado de gestión sacado del campo personalizado, etiquetas
 * en una lista simple).
 */

export interface ContactoInforme {
  id: number;
  nombre: string;
  empresa: string;
  tipoContacto: string;
  estado: string;
  estadoGestion: string;
  etiquetas: string[];
}

export interface EstadoContacto {
  clave: string;
  etiqueta: string;
}

export interface EtiquetaCampana {
  etiqueta: string;
  nombre: string;
}

export interface CatalogosInforme {
  tiposContacto: string[];
  estados: EstadoContacto[];
  estadosGestion: string[];
  etiquetas: EtiquetaCampana[];
}

export interface DatosInforme {
  contactos: ContactoInforme[];
  catalogos: CatalogosInforme;
}

export async function obtenerInformeContactos(): Promise<DatosInforme> {
  return pedir<DatosInforme>("/api/informes/contactos");
}
