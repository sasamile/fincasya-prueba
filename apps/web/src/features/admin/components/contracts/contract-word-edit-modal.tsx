"use client";

/**
 * Abre el contrato en SuperDoc (Word), permite editar y guardar:
 * exporta PDF → sube a storage → actualiza contracts.upsert (pdfUrl).
 */
import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ContractWordEditor,
  type ContractWordEditorHandle,
} from "@/features/admin/components/contracts/contract-word-editor";
import {
  buildDocxRequestFromSavedContract,
  type SavedContractForDocx,
} from "@/features/admin/utils/rebuild-contract-docx";
import { carpetaDeContrato } from "@/lib/contract-folder";

type Props = {
  contract: SavedContractForDocx | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function ContractWordEditModal({
  contract,
  open,
  onClose,
  onSaved,
}: Props) {
  const editorRef = useRef<ContractWordEditorHandle>(null);
  const upsert = useMutation(api.contracts.upsert);
  const [editorReady, setEditorReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const built = useMemo(
    () => (contract ? buildDocxRequestFromSavedContract(contract) : null),
    [contract],
  );

  const documentKey = useMemo(() => {
    if (!contract || !built) return "";
    return [
      contract.contractNumber,
      contract.updatedAt ?? "",
      built.propertyId,
      String(contract.valorTotal ?? ""),
      contract.fechaEntrada ?? "",
      contract.fechaSalida ?? "",
    ].join("|");
  }, [contract, built]);

  async function handleSave() {
    if (!contract || !built || !editorRef.current?.isReady()) return;
    setSaving(true);
    try {
      const { base64, filename } = await editorRef.current.exportPdf();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const fd = new FormData();
      fd.append(
        "file",
        new File([bytes], filename, { type: "application/pdf" }),
      );
      fd.append("folder", "documents");
      fd.append(
        "subpath",
        `${carpetaDeContrato(contract.contractNumber)}/contratos`,
      );
      const up = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const upData = (await up.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!up.ok || !upData.url) {
        throw new Error(upData.error || "No se pudo subir el PDF.");
      }

      await upsert({
        contractNumber: contract.contractNumber,
        ...(built.propertyId
          ? { propertyId: built.propertyId as Id<"properties"> }
          : {}),
        propertyTitle: contract.propertyTitle,
        propertyLocation: contract.propertyLocation,
        clienteNombre: contract.clienteNombre,
        clienteCedula: contract.clienteCedula,
        clienteEmail: contract.clienteEmail,
        clienteTelefono: contract.clienteTelefono,
        clienteCiudad: contract.clienteCiudad,
        clienteDireccion: contract.clienteDireccion,
        valorTotal: contract.valorTotal,
        fechaEntrada: contract.fechaEntrada,
        fechaSalida: contract.fechaSalida,
        draftJson: contract.draftJson,
        origen: contract.origen,
        pdfUrl: upData.url,
        pdfFilename: filename,
      });

      toast.success("Contrato actualizado (PDF guardado).");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el contrato.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[96vh] w-[min(98vw,1480px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold">
              Editar Word · {contract?.contractNumber ?? "—"}
            </DialogTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Edita el documento y pulsa Guardar para actualizar el PDF del
              contrato. Usa − / + para el zoom.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-lg font-semibold"
              disabled={!editorReady || saving || !built}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Guardar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              disabled={saving}
              onClick={onClose}
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
          {!contract ? null : !built ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Este contrato no tiene finca asociada; no se puede regenerar el
              Word.
            </div>
          ) : (
            <ContractWordEditor
              ref={editorRef}
              active={open}
              propertyId={built.propertyId}
              payload={built.body}
              documentKey={documentKey}
              heightClassName="min-h-0 flex-1"
              onReadyChange={setEditorReady}
              className="flex h-full min-h-0 flex-col"
              fitZoomOnReady
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
