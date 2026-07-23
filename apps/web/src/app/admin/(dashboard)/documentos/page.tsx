"use client";

import { FolderOpen } from "lucide-react";
import { DocumentsExplorer } from "@/features/admin/components/contracts/documents-explorer";

export default function DocumentosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-600">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Una carpeta por contrato. Adentro, los contratos y las
            confirmaciones que se le enviaron al cliente.
          </p>
        </div>
      </div>

      <DocumentsExplorer />
    </div>
  );
}
