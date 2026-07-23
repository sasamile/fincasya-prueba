'use client';

/**
 * Editor Word de un archivo YA guardado en la carpeta de Documentos
 * (Adriana, 22-jul): abre el .docx archivado, se corrige y al guardar sube al
 * MISMO folder una versión nueva (Word + PDF) SIN borrar la anterior — quedan
 * ambas, y desde la carpeta se elimina la que no sirva.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { toast } from 'sonner';
import { FileWarning, Loader2, Save, X } from 'lucide-react';
import {
  loadSuperDocModules,
  preloadSuperDoc,
} from '@/features/admin/utils/preload-superdoc';
import { justifySuperDocContract } from '@/features/admin/utils/superdoc-justify-contract';
import { carpetaDeContrato } from '@/lib/contract-folder';

// SuperDoc se carga dinámico (solo cliente); su API no está tipada aquí, así
// que se maneja de forma laxa (igual que el editor de contrato).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperDocInstance = any;

const EDITOR_ID = 'superdoc-doc-folder-editor';
const TOOLBAR_ID = 'superdoc-doc-folder-toolbar';

export function DocFolderWordEditor({
  contractNumber,
  fileUrl,
  filename,
  conversationId,
  onClose,
  onSaved,
}: {
  contractNumber: string;
  fileUrl: string;
  filename: string;
  conversationId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const registerDocument = useMutation(api.contractDocuments.registerDocument);
  const superdocRef = useRef<SuperDocInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseName = filename.replace(/\.docx$/i, '') || 'contrato';

  useEffect(() => {
    let cancelled = false;
    void preloadSuperDoc();

    async function init() {
      setLoading(true);
      setError(null);
      setReady(false);
      try {
        const [res, { SuperDoc, fontsMod }] = await Promise.all([
          fetch(fileUrl),
          loadSuperDocModules(),
        ]);
        if (!res.ok) throw new Error('No se pudo descargar el documento.');
        const blob = await res.blob();
        if (cancelled) return;

        const file = new File([blob], filename || 'contrato.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const fonts = fontsMod.createSuperDocFonts();
        (
          fonts as { resolveAssetUrl?: (c: { file: string }) => string }
        ).resolveAssetUrl = (c) => `/superdoc-fonts/${c.file}`;

        const instance = new SuperDoc({
          selector: `#${EDITOR_ID}`,
          toolbar: `#${TOOLBAR_ID}`,
          documentMode: 'editing',
          fonts,
          documents: [{ id: 'doc', type: 'docx', data: file }],
          onReady: (sd: SuperDocInstance) => {
            if (cancelled) return;
            const live = sd ?? instance;
            justifySuperDocContract(live);
            superdocRef.current = live;
            setReady(true);
            setLoading(false);
          },
        });
        superdocRef.current = instance;
      } catch (e) {
        if (!cancelled) {
          setLoading(false);
          setError(e instanceof Error ? e.message : 'Error al abrir el Word.');
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      try {
        superdocRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      superdocRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  async function subir(blob: Blob, name: string): Promise<string | null> {
    const fd = new FormData();
    fd.append('file', new File([blob], name, { type: blob.type }));
    fd.append('folder', 'documents');
    fd.append('subpath', `${carpetaDeContrato(contractNumber)}/contratos`);
    const up = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const data = (await up.json().catch(() => ({}))) as { url?: string };
    return up.ok && data.url ? data.url : null;
  }

  async function handleSave() {
    const sd = superdocRef.current;
    if (!sd?.export) return;
    setSaving(true);
    try {
      const stamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[:T-]/g, '');
      const docxName = `${baseName}-editado-${stamp}.docx`;

      // 1) Word editado → sube a la carpeta (NO borra el anterior).
      const docxBlob = await sd.export({
        exportType: ['docx'],
        exportedName: docxName,
      });
      if (!(docxBlob instanceof Blob)) {
        throw new Error('No se pudo exportar el Word.');
      }
      const docxUrl = await subir(docxBlob, docxName);
      if (docxUrl) {
        await registerDocument({
          contractNumber,
          tipo: 'contrato_word',
          estado: 'enviado',
          url: docxUrl,
          filename: docxName,
          conversationId,
        });
      }

      // 2) El mismo Word → PDF, también a la carpeta.
      const pdfName = `${baseName}-editado-${stamp}.pdf`;
      const fd = new FormData();
      fd.append('file', new File([docxBlob], docxName, { type: docxBlob.type }));
      const pdfRes = await fetch('/api/fincas/contract-docx-to-pdf', {
        method: 'POST',
        body: fd,
      });
      const pdfData = (await pdfRes.json().catch(() => ({}))) as {
        fileBase64?: string;
      };
      if (pdfRes.ok && pdfData.fileBase64) {
        const bytes = Uint8Array.from(atob(pdfData.fileBase64), (c) =>
          c.charCodeAt(0),
        );
        const pdfUrl = await subir(
          new Blob([bytes], { type: 'application/pdf' }),
          pdfName,
        );
        if (pdfUrl) {
          await registerDocument({
            contractNumber,
            tipo: 'contrato',
            estado: 'enviado',
            url: pdfUrl,
            filename: pdfName,
            conversationId,
          });
        }
      }

      toast.success('Versión editada guardada en la carpeta.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Editar · {filename}</p>
            <p className="text-[11px] text-muted-foreground">
              Al guardar se agrega una versión nueva; la anterior se conserva.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          id={TOOLBAR_ID}
          className="shrink-0 overflow-x-auto border-b border-border bg-background"
        />

        <div className="relative flex-1 overflow-auto bg-muted/40">
          <div id={EDITOR_ID} className="min-h-full" />
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Abriendo el documento…
              </p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <FileWarning className="h-7 w-7 text-destructive" />
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!ready || saving}
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar versión editada
          </button>
        </footer>
      </div>
    </div>
  );
}
