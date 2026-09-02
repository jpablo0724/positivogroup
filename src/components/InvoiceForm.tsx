import { useEffect, useMemo, useState } from "react";
import {
  FORMAS_PAGO,
  ID_BORRADOR,
  type InvoiceData,
  type InvoiceItem,
} from "../types";
import { formatCurrency, formatNumber } from "../utils/calculations";
import type { ContactoClientify } from "../utils/clientify";
import {
  guardarProducto as guardarEnCatalogo,
  type Producto,
} from "../utils/catalogo";
import { aHtml } from "../utils/richText";
import BuscadorCliente from "./BuscadorCliente";
import EditorObservaciones from "./EditorObservaciones";
import ModalNuevoProducto from "./ModalNuevoProducto";
import SearchableSelect, { selectTriggerClass } from "./SearchableSelect";
import SelectorContacto from "./SelectorContacto";

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
  /** Catálogo completo, cargado por App desde la base de datos. */
  productos: Producto[];
  onProductosChange: (productos: Producto[]) => void;
  /**
   * Los productos tal como deben verse en la cotización, incluyendo el que se
   * está capturando y aún no se ha agregado.
   */
  onVistaPreviaChange: (items: InvoiceItem[]) => void;
  onError: (err: unknown) => void;
}

const inputClass = selectTriggerClass;

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

// Cantidad y precio se guardan como texto para que el campo pueda quedar
// vacío en vez de mostrar un 0 que hay que borrar antes de escribir.
interface Draft {
  nombreProducto: string;
  descripcionProducto: string;
  cantidad: string;
  precioUnitario: string;
}

const draftVacio: Draft = {
  nombreProducto: "",
  descripcionProducto: "",
  cantidad: "",
  precioUnitario: "",
};

// Línea divisoria entre las observaciones de un producto y las del siguiente.
export const SEPARADOR_OBSERVACIONES = "<hr>";

type Catalogo = Record<string, { descripcion: string; observaciones: string }>;

// Une las observaciones de todos los productos de la cotización, una debajo
// de otra y divididas entre sí. Omite las repetidas para que dos productos
// que comparten observaciones no las dupliquen.
function observacionesDeProductos(
  nombresProducto: string[],
  catalogo: Catalogo,
): string {
  const vistas = new Set<string>();
  const bloques: string[] = [];

  for (const nombre of nombresProducto) {
    const observaciones = catalogo[nombre]?.observaciones?.trim();
    if (observaciones && !vistas.has(observaciones)) {
      vistas.add(observaciones);
      bloques.push(aHtml(observaciones));
    }
  }

  return bloques.join(SEPARADOR_OBSERVACIONES);
}

export default function InvoiceForm({
  data,
  onChange,
  productos,
  onProductosChange,
  onVistaPreviaChange,
  onError,
}: InvoiceFormProps) {
  const [draft, setDraft] = useState<Draft>(draftVacio);
  // id del producto que se está editando; null mientras se captura uno nuevo.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Empleados de la empresa elegida en Clientify cuando hay más de uno; se
  // listan bajo el campo Contacto para escoger cuál va en la cotización.
  const [contactosCliente, setContactosCliente] = useState<ContactoClientify[]>(
    [],
  );
  const [modalProductoAbierto, setModalProductoAbierto] = useState(false);

  const opcionesProducto = useMemo(
    () => productos.map((p) => p.nombre),
    [productos],
  );

  const catalogo = useMemo<Catalogo>(
    () =>
      Object.fromEntries(
        productos.map((p) => [
          p.nombre,
          { descripcion: p.descripcion, observaciones: p.observaciones },
        ]),
      ),
    [productos],
  );

  // Refleja en la cotización el producto que se está capturando, sin esperar a
  // que se agregue. Las dependencias son valores sueltos (no el objeto draft)
  // para que el efecto solo corra cuando algo cambia de verdad.
  useEffect(() => {
    const enCaptura = draft.nombreProducto !== "";

    if (!enCaptura) {
      onVistaPreviaChange(data.items);
      return;
    }

    const borrador: InvoiceItem = {
      id: editandoId ?? ID_BORRADOR,
      nombreProducto: draft.nombreProducto,
      descripcionProducto: draft.descripcionProducto,
      cantidad: Number(draft.cantidad) || 0,
      precioUnitario: Number(draft.precioUnitario) || 0,
    };

    // Al editar se sustituye la fila del producto; al capturar uno nuevo se
    // suma al final.
    onVistaPreviaChange(
      editandoId
        ? data.items.map((item) => (item.id === editandoId ? borrador : item))
        : [...data.items, borrador],
    );
  }, [
    data.items,
    draft.nombreProducto,
    draft.descripcionProducto,
    draft.cantidad,
    draft.precioUnitario,
    editandoId,
    onVistaPreviaChange,
  ]);

  function updateCliente<K extends keyof InvoiceData["cliente"]>(
    field: K,
    value: InvoiceData["cliente"][K],
  ) {
    onChange({ ...data, cliente: { ...data.cliente, [field]: value } });
  }

  function updateField<K extends keyof InvoiceData>(
    field: K,
    value: InvoiceData[K],
  ) {
    onChange({ ...data, [field]: value });
  }

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Al borrar por completo la razón social se limpian también los datos que
   * habían llegado de Clientify, para no dejar el NIT o el contacto de la
   * empresa anterior pegados a una nueva.
   */
  function cambiarRazonSocial(razonSocial: string) {
    if (razonSocial.trim() === "") {
      setContactosCliente([]);
      onChange({
        ...data,
        cliente: {
          razonSocial: "",
          nit: "",
          email: "",
          contacto: "",
          clientifyId: undefined,
        },
      });
      return;
    }
    updateCliente("razonSocial", razonSocial);
  }

  function elegirContacto(contacto: ContactoClientify) {
    setContactosCliente([]);
    onChange({
      ...data,
      cliente: {
        ...data.cliente,
        contacto: contacto.nombre,
        email: contacto.email || data.cliente.email,
      },
    });
  }

  function selectProducto(nombreProducto: string, catalogoActual = catalogo) {
    const info = catalogoActual[nombreProducto];
    setDraft((prev) => ({
      ...prev,
      nombreProducto,
      descripcionProducto: info?.descripcion ?? "",
    }));

    // Al editar se sustituye el producto de ese ítem; al capturar uno nuevo
    // se suma al final.
    const nombres = editandoId
      ? data.items.map((item) =>
          item.id === editandoId ? nombreProducto : item.nombreProducto,
        )
      : [...data.items.map((item) => item.nombreProducto), nombreProducto];

    onChange({
      ...data,
      observaciones: observacionesDeProductos(nombres, catalogoActual),
    });
  }

  async function crearProducto(producto: {
    nombre: string;
    descripcion: string;
    observaciones: string;
  }) {
    setModalProductoAbierto(false);

    // Se deja elegido de una vez, que es para lo que se acaba de crear. El
    // catálogo del estado todavía no incluye el producto nuevo, así que se le
    // pasa uno ya actualizado.
    selectProducto(producto.nombre, {
      ...catalogo,
      [producto.nombre]: {
        descripcion: producto.descripcion,
        observaciones: producto.observaciones,
      },
    });

    try {
      onProductosChange(await guardarEnCatalogo(producto));
    } catch (err) {
      onError(err);
    }
  }

  // Basta con elegir el producto: cantidad y precio son opcionales, para poder
  // incluir en la cotización servicios sin valor, como los bonificados.
  const draftValido = draft.nombreProducto !== "";

  function guardarProducto() {
    if (!draftValido) return;

    const producto = {
      nombreProducto: draft.nombreProducto,
      descripcionProducto: draft.descripcionProducto,
      cantidad: Number(draft.cantidad),
      precioUnitario: Number(draft.precioUnitario),
    };

    const items = editandoId
      ? data.items.map((item) =>
          item.id === editandoId ? { ...item, ...producto } : item,
        )
      : [...data.items, { id: crypto.randomUUID(), ...producto }];

    onChange({
      ...data,
      items,
      observaciones: observacionesDeProductos(
        items.map((item) => item.nombreProducto),
        catalogo,
      ),
    });
    setDraft(draftVacio);
    setEditandoId(null);
  }

  function editarProducto(item: InvoiceItem) {
    setDraft({
      nombreProducto: item.nombreProducto,
      descripcionProducto: item.descripcionProducto,
      // Un valor en cero se muestra vacío, no como "0": significa que el
      // producto va sin cantidad o sin precio.
      cantidad: item.cantidad > 0 ? String(item.cantidad) : "",
      precioUnitario:
        item.precioUnitario > 0 ? String(item.precioUnitario) : "",
    });
    setEditandoId(item.id);
  }

  function cancelarEdicion() {
    setDraft(draftVacio);
    setEditandoId(null);
  }

  function removeItem(id: string) {
    const items = data.items.filter((item) => item.id !== id);
    const enEdicion = editandoId === id;

    onChange({
      ...data,
      items,
      observaciones: observacionesDeProductos(
        [
          ...items.map((item) => item.nombreProducto),
          enEdicion ? "" : draft.nombreProducto,
        ],
        catalogo,
      ),
    });

    // Si se elimina el producto que se estaba editando, se limpia el formulario.
    if (enEdicion) {
      setDraft(draftVacio);
      setEditandoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos del cliente
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Razón social</label>
            <BuscadorCliente
              value={data.cliente.razonSocial}
              onChange={cambiarRazonSocial}
              onContactosDisponibles={setContactosCliente}
              onSeleccionar={(cliente) =>
                onChange({
                  ...data,
                  cliente: {
                    ...data.cliente,
                    razonSocial: cliente.razonSocial,
                    ...(cliente.nit ? { nit: cliente.nit } : {}),
                    ...(cliente.contacto ? { contacto: cliente.contacto } : {}),
                    ...(cliente.email ? { email: cliente.email } : {}),
                    clientifyId: cliente.clientifyId,
                  },
                })
              }
            />
          </div>
          <div>
            <label className={labelClass}>NIT</label>
            <input
              className={inputClass}
              value={data.cliente.nit}
              onChange={(e) => updateCliente("nit", e.target.value)}
              placeholder="900.000.000-1"
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={data.cliente.email}
              onChange={(e) => updateCliente("email", e.target.value)}
              placeholder="contacto@positivogroup.com"
            />
          </div>
          <div className="relative">
            <label className={labelClass}>Contacto</label>
            <input
              className={inputClass}
              value={data.cliente.contacto}
              onChange={(e) => updateCliente("contacto", e.target.value)}
              placeholder={
                contactosCliente.length > 0
                  ? "Elige el contacto abajo"
                  : "Nombre del contacto"
              }
            />
            <SelectorContacto
              contactos={contactosCliente}
              onElegir={elegirContacto}
              onOmitir={() => setContactosCliente([])}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos de la cotización
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              className={inputClass}
              value={data.fecha}
              onChange={(e) => updateField("fecha", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Válida hasta</label>
            <input
              type="date"
              className={inputClass}
              value={data.validaHasta}
              onChange={(e) => updateField("validaHasta", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Forma de pago</label>
            <SearchableSelect
              value={data.formaPago}
              onChange={(value) => updateField("formaPago", value)}
              options={FORMAS_PAGO}
              placeholder="Selecciona una opción"
            />
          </div>
          <div>
            <label className={labelClass}>IVA (%)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              className={inputClass}
              value={data.ivaPorcentaje}
              onChange={(e) =>
                updateField("ivaPorcentaje", Number(e.target.value) || 0)
              }
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Productos
          </h2>
          <button
            type="button"
            onClick={() => setModalProductoAbierto(true)}
            className="flex items-center gap-1 text-xs font-semibold text-accion-fin transition-colors hover:text-accion"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-3.5 w-3.5"
            >
              <path d="M10 4v12M4 10h12" />
            </svg>
            Agregar producto
          </button>
        </div>

        {data.items.length > 0 && (
          <div className="mb-4 space-y-2">
            {data.items.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                  editandoId === item.id
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {index + 1}. {item.nombreProducto}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[
                      item.cantidad > 0
                        ? `Cantidad: ${formatNumber(item.cantidad)}`
                        : null,
                      item.precioUnitario > 0
                        ? `Precio unitario: ${formatCurrency(item.precioUnitario)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin cantidad ni precio"}
                  </p>
                  {editandoId === item.id && (
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      Editando abajo
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => editarProducto(item)}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Nombre producto</label>
              <SearchableSelect
                value={draft.nombreProducto}
                onChange={(nombre) => selectProducto(nombre)}
                options={opcionesProducto}
                placeholder="Selecciona un producto"
                extraOptionLabel="+ Agregar producto nuevo"
                onExtraOption={() => setModalProductoAbierto(true)}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Descripción del producto</label>
              <EditorObservaciones
                etiqueta="Descripción del producto"
                value={draft.descripcionProducto}
                onChange={(html) => updateDraft("descripcionProducto", html)}
                placeholder="Se completa automáticamente al elegir el producto"
              />
            </div>
            <div>
              <label className={labelClass}>
                Cantidad <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.cantidad}
                onChange={(e) => updateDraft("cantidad", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>
                Precio unitario{" "}
                <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.precioUnitario}
                onChange={(e) => updateDraft("precioUnitario", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={guardarProducto}
              disabled={!draftValido}
              className="w-full rounded-md boton-accion py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed"
            >
              {editandoId ? "Guardar cambios" : "Agregar producto"}
            </button>
            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicion}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
              >
                Cancelar
              </button>
            )}
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            {editandoId
              ? "Estás editando un producto ya agregado a la cotización."
              : "Basta con elegir el producto. Si dejas cantidad o precio vacíos, aparece en la cotización sin valor."}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Observaciones
        </h2>
        <EditorObservaciones
          value={data.observaciones}
          onChange={(html) => updateField("observaciones", html)}
        />
      </section>

      <ModalNuevoProducto
        abierto={modalProductoAbierto}
        nombresExistentes={opcionesProducto}
        onGuardar={crearProducto}
        onCerrar={() => setModalProductoAbierto(false)}
      />
    </div>
  );
}
