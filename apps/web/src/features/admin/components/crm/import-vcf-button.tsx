"use client";

/**
 * Importar nombres desde un .vcf (contactos exportados del celular).
 * Parsea el archivo en el navegador (FN/N + TEL, con soporte de
 * QUOTED-PRINTABLE de exports Android) y manda pares {nombre, teléfono}
 * al backend, que actualiza SOLO los contactos que ya existen en la base.
 */

import { useRef, useState } from "react";
import { useMutation as useConvexMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

type VcfItem = { name: string; phone: string };

/** Decodifica QUOTED-PRINTABLE (=C3=B1 → ñ), común en exports de Android. */
function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "=" && /^[0-9A-Fa-f]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      for (const b of encoder.encode(ch)) bytes.push(b);
    }
  }
  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

/** "Apellido;Nombre;Segundo;;" (campo N) → "Nombre Segundo Apellido". */
function nameFromNParts(n: string): string {
  const [last = "", first = "", middle = ""] = n.split(";");
  return [first, middle, last].map((s) => s.trim()).filter(Boolean).join(" ");
}

export function parseVcf(text: string): VcfItem[] {
  const rawLines = text.split(/\r\n|\r|\n/);

  // Unfold RFC (continuación = línea que empieza con espacio/tab).
  const unfolded: string[] = [];
  for (const l of rawLines) {
    if (/^[ \t]/.test(l) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += l.slice(1);
    } else {
      unfolded.push(l);
    }
  }

  // Soft-wrap de QUOTED-PRINTABLE: la línea termina en "=" y sigue abajo.
  const lines: string[] = [];
  for (let i = 0; i < unfolded.length; i++) {
    let l = unfolded[i];
    if (/ENCODING=QUOTED-PRINTABLE/i.test(l)) {
      while (l.endsWith("=") && i + 1 < unfolded.length) {
        l = l.slice(0, -1) + unfolded[++i];
      }
    }
    lines.push(l);
  }

  const items: VcfItem[] = [];
  const seen = new Set<string>();
  let fn = "";
  let nField = "";
  let tels: string[] = [];

  const flush = () => {
    const name = (fn || nameFromNParts(nField)).trim().replace(/\s+/g, " ");
    if (!name) return;
    for (const tel of tels) {
      const digits = tel.replace(/\D+/g, "");
      if (digits.length < 10) continue;
      const key = digits.slice(-10);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ name, phone: digits });
    }
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:VCARD")) {
      fn = "";
      nField = "";
      tels = [];
      continue;
    }
    if (upper.startsWith("END:VCARD")) {
      flush();
      continue;
    }
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const keyPart = line.slice(0, colon);
    const keyUpper = keyPart.toUpperCase();
    // iOS exporta como "item1.TEL:..." → nos quedamos con el nombre base.
    const propRaw = keyUpper.split(";")[0];
    const prop = propRaw.includes(".") ? propRaw.split(".").pop()! : propRaw;
    const isQP = /ENCODING=QUOTED-PRINTABLE/.test(keyUpper);
    const value = isQP ? decodeQuotedPrintable(line.slice(colon + 1)) : line.slice(colon + 1);

    if (prop === "FN" && !fn) fn = value;
    else if (prop === "N" && !nField) nField = value;
    else if (prop === "TEL") tels.push(value);
  }

  return items;
}

const BATCH_SIZE = 400;

export function ImportVcfButton({ onDone }: { onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const applyNames = useConvexMutation(api.contactsImport.applyVcfNames);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const items = parseVcf(text);
      if (items.length === 0) {
        toast.error("No se encontraron contactos con número en el archivo.");
        return;
      }
      const ok = window.confirm(
        `Se encontraron ${items.length} números con nombre en "${file.name}".\n\n` +
          "Se actualizará el nombre de los que YA existen en la base " +
          "(no se crean contactos nuevos). ¿Continuar?",
      );
      if (!ok) return;

      let actualizados = 0;
      let sinCambio = 0;
      let noEncontrados = 0;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const res = await applyNames({ items: items.slice(i, i + BATCH_SIZE) });
        actualizados += res.actualizados;
        sinCambio += res.sinCambio;
        noEncontrados += res.noEncontrados;
      }
      toast.success(
        `Nombres actualizados: ${actualizados} · ya estaban igual: ${sinCambio} · no están en la base: ${noEncontrados}`,
        { duration: 8000 },
      );
      onDone?.();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "No se pudo importar el .vcf.",
      );
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        variant="outline"
        className="h-11 w-full sm:w-auto rounded-xl font-bold gap-2"
        disabled={importing}
        onClick={() => inputRef.current?.click()}
      >
        {importing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        Importar nombres (.vcf)
      </Button>
    </>
  );
}
