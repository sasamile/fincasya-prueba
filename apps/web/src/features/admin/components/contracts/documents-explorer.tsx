"use client";

/**
 * EXPLORADOR DE CARPETAS de documentos (Adriana, 22-jul).
 *
 * Se navega como un explorador de archivos normal, tres niveles:
 *   1. las carpetas — una por contrato, con su codificación y nada más
 *   2. dentro: dos subcarpetas, Contratos y Confirmaciones
 *   3. dentro: los archivos, con su etiqueta
 *
 * Se busca por el nombre de la carpeta (la codificación). Solo aparece lo que
 * se le ENVIÓ al cliente: lo que se genera y no se manda no llega aquí.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Folder,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DocFolderWordEditor } from "@/features/admin/components/contracts/doc-folder-word-editor";

type Subcarpeta = "contratos" | "confirmaciones";

type DocRow = {
  _id: Id<"contractDocuments">;
  tipo: "contrato" | "contrato_word" | "contrato_firmado" | "confirmacion";
  estado: "enviado" | "firmado" | "nulo";
  url: string;
  filename: string;
  montoAbonado?: number;
  createdAt: number;
  validacionIa?: { motivo: string };
};

const ETIQUETA: Record<string, { texto: string; clase: string }> = {
  enviado: {
    texto: "Generado y enviado",
    clase: "border-amber-200 bg-amber-50 text-amber-800",
  },
  firmado: {
    texto: "Firmado por el cliente",
    clase: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  nulo: {
    texto: "Cliente no firmó · nulo",
    clase: "border-red-200 bg-red-50 text-red-700",
  },
};

function fechaCorta(ms: number): string {
  return new Date(ms).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CarpetaCard({
  nombre,
  detalle,
  onClick,
}: {
  nombre: string;
  detalle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/50"
    >
      <Folder className="h-8 w-8 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{nombre}</p>
        {detalle ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{detalle}</p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ArchivoRow({
  doc,
  onNulo,
  onEditar,
  onBorrar,
  marcando,
  borrando,
}: {
  doc: DocRow;
  onNulo: (id: Id<"contractDocuments">) => void;
  onEditar: (doc: DocRow) => void;
  onBorrar: (id: Id<"contractDocuments">) => void;
  marcando: boolean;
  borrando: boolean;
}) {
  const esDocx = /\.docx$/i.test(doc.filename) || doc.tipo === "contrato_word";
  const esWord = doc.tipo === "contrato_word";
  // El Word es el editable de respaldo, no un contrato aparte: se marca así
  // para que nadie lo confunda con el que se le envió al cliente.
  const etiqueta = esWord
    ? { texto: "Word editable", clase: "border-blue-200 bg-blue-50 text-blue-800" }
    : (ETIQUETA[doc.estado] ?? ETIQUETA.enviado);
  const firmado = doc.tipo === "contrato_firmado";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      {firmado ? (
        <FileCheck2 className="h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <FileText
          className={cn(
            "h-5 w-5 shrink-0",
            esWord ? "text-blue-600" : "text-muted-foreground",
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold">{doc.filename}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {fechaCorta(doc.createdAt)}
          {doc.montoAbonado
            ? ` · Abono $${doc.montoAbonado.toLocaleString("es-CO")}`
            : ""}
        </p>
        {doc.validacionIa ? (
          <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
            {doc.validacionIa.motivo}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[10px] font-bold",
          etiqueta.clase,
        )}
      >
        {etiqueta.texto}
      </span>
      <div className="flex items-center gap-1.5">
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
          title="Ver"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          href={doc.url}
          download={doc.filename || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
          title="Descargar"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
        {/* Editar: solo el Word (.docx) se abre en el editor; del PDF no se
            puede editar el texto, se regenera del Word. */}
        {esDocx ? (
          <button
            type="button"
            onClick={() => onEditar(doc)}
            title="Editar en Word"
            className="grid h-8 w-8 place-items-center rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {doc.tipo === "contrato" && doc.estado === "enviado" ? (
          <button
            type="button"
            onClick={() => onNulo(doc._id)}
            disabled={marcando}
            title="El cliente no firmó"
            className="grid h-8 w-8 place-items-center rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-60"
          >
            {marcando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onBorrar(doc._id)}
          disabled={borrando}
          title="Eliminar archivo"
          className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {borrando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

type Vista = "grid" | "list";

export function DocumentsExplorer() {
  const [buscar, setBuscar] = useState("");
  const [carpeta, setCarpeta] = useState<string | null>(null);
  const [subcarpeta, setSubcarpeta] = useState<Subcarpeta | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  /** Vista de las carpetas: cuadrícula o lista (como el Finder de Mac). */
  const [vista, setVista] = useState<Vista>("grid");
  /** Archivo Word abierto en el editor (null = editor cerrado). */
  const [editando, setEditando] = useState<DocRow | null>(null);

  const folders = useQuery(api.contractDocuments.listFolders, { buscar });
  const contenido = useQuery(
    api.contractDocuments.listByContract,
    carpeta ? { contractNumber: carpeta } : "skip",
  );
  const setEstado = useMutation(api.contractDocuments.setEstado);
  const deleteDocument = useMutation(api.contractDocuments.deleteDocument);

  const marcarNulo = async (id: Id<"contractDocuments">) => {
    if (
      !window.confirm(
        "¿Marcar este contrato como NO firmado? El contrato queda anulado.",
      )
    ) {
      return;
    }
    setMarcando(String(id));
    try {
      await setEstado({ documentId: id, estado: "nulo" });
      toast.success("Contrato marcado como no firmado.");
    } catch {
      toast.error("No se pudo marcar el contrato.");
    } finally {
      setMarcando(null);
    }
  };

  const borrarDoc = async (id: Id<"contractDocuments">) => {
    if (!window.confirm("¿Eliminar este archivo de la carpeta?")) return;
    setBorrando(String(id));
    try {
      await deleteDocument({ documentId: id });
      toast.success("Archivo eliminado.");
    } catch {
      toast.error("No se pudo eliminar el archivo.");
    } finally {
      setBorrando(null);
    }
  };

  const contratos = (contenido?.contratos ?? []) as DocRow[];
  const confirmaciones = (contenido?.confirmaciones ?? []) as DocRow[];
  const archivos = subcarpeta === "confirmaciones" ? confirmaciones : contratos;

  return (
    <div className="space-y-5">
      {/* Ruta de navegación */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={() => {
            setCarpeta(null);
            setSubcarpeta(null);
          }}
          className={cn(
            "rounded-lg px-2 py-1 font-semibold transition hover:bg-muted",
            !carpeta && "text-foreground",
            carpeta && "text-muted-foreground",
          )}
        >
          Documentos
        </button>
        {carpeta ? (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setSubcarpeta(null)}
              className={cn(
                "rounded-lg px-2 py-1 font-semibold transition hover:bg-muted",
                subcarpeta ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {carpeta}
            </button>
          </>
        ) : null}
        {carpeta && subcarpeta ? (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="rounded-lg px-2 py-1 font-semibold capitalize">
              {subcarpeta}
            </span>
          </>
        ) : null}
      </div>

      {/* Nivel 1 · las carpetas */}
      {!carpeta ? (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar carpeta por codificación…"
                className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/50"
              />
            </div>
            {/* Cambiar entre cuadrícula y lista */}
            <div className="flex shrink-0 rounded-xl border border-border p-0.5">
              <button
                type="button"
                onClick={() => setVista("grid")}
                title="Cuadrícula"
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-lg transition",
                  vista === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setVista("list")}
                title="Lista"
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-lg transition",
                  vista === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {folders === undefined ? (
            <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando
              carpetas…
            </div>
          ) : folders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {buscar
                ? "Ninguna carpeta coincide con esa búsqueda."
                : "Todavía no hay carpetas. Se crea una cuando se le envía el primer documento a un cliente."}
            </p>
          ) : vista === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map((f) => (
                <CarpetaCard
                  key={f.contractNumber}
                  nombre={f.contractNumber}
                  detalle={`${f.contratos} contrato${f.contratos === 1 ? "" : "s"} · ${f.confirmaciones} confirmación${f.confirmaciones === 1 ? "" : "es"}`}
                  onClick={() => {
                    setCarpeta(f.contractNumber);
                    setSubcarpeta(null);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {folders.map((f) => (
                <button
                  key={f.contractNumber}
                  type="button"
                  onClick={() => {
                    setCarpeta(f.contractNumber);
                    setSubcarpeta(null);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/50"
                >
                  <Folder className="h-5 w-5 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {f.contractNumber}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {f.contratos} contrato{f.contratos === 1 ? "" : "s"} ·{" "}
                    {f.confirmaciones} confirmación
                    {f.confirmaciones === 1 ? "" : "es"}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* Nivel 2 · las dos subcarpetas */}
      {carpeta && !subcarpeta ? (
        contenido === undefined ? (
          <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Abriendo carpeta…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <CarpetaCard
              nombre="Contratos"
              detalle={`${contratos.length} archivo${contratos.length === 1 ? "" : "s"}`}
              onClick={() => setSubcarpeta("contratos")}
            />
            <CarpetaCard
              nombre="Confirmaciones"
              detalle={`${confirmaciones.length} archivo${confirmaciones.length === 1 ? "" : "s"}`}
              onClick={() => setSubcarpeta("confirmaciones")}
            />
          </div>
        )
      ) : null}

      {/* Nivel 3 · los archivos */}
      {carpeta && subcarpeta ? (
        archivos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Esta subcarpeta está vacía.
          </p>
        ) : (
          <div className="space-y-2">
            {archivos.map((doc) => (
              <ArchivoRow
                key={String(doc._id)}
                doc={doc}
                onNulo={marcarNulo}
                onEditar={setEditando}
                onBorrar={borrarDoc}
                marcando={marcando === String(doc._id)}
                borrando={borrando === String(doc._id)}
              />
            ))}
          </div>
        )
      ) : null}

      {editando && carpeta ? (
        <DocFolderWordEditor
          contractNumber={carpeta}
          fileUrl={editando.url}
          filename={editando.filename}
          onClose={() => setEditando(null)}
          onSaved={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}
