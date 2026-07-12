import { guessProofMimeType } from "@/lib/proof-file-utils";

const DRAFT_PREFIX = "fincasya_venta_draft_";
const IDB_NAME = "fincasya-venta-drafts";
const IDB_STORE = "proof-files";
const IDB_VERSION = 2;

export type VentaDraftPhase = "datos" | "pago";

export type VentaFormDraft = {
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  fechaNacimiento: string;
  paymentAmount: number;
  phase: VentaDraftPhase;
  uiStep?: number;
  updatedAt: number;
};

type StoredProofFile = {
  kind: "buffer";
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  savedAt: number;
};

function draftKey(token: string) {
  return `${DRAFT_PREFIX}${token}`;
}

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadVentaDraft(token: string): VentaFormDraft | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VentaFormDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveVentaDraft(
  token: string,
  draft: Omit<VentaFormDraft, "updatedAt">,
) {
  if (!canUseStorage()) return;
  try {
    const payload: VentaFormDraft = {
      ...draft,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(draftKey(token), JSON.stringify(payload));
  } catch {
    // localStorage puede fallar en modo privado o con cuota llena.
  }
}

export function clearVentaDraft(token: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(draftKey(token));
  } catch {
    // ignore
  }
}

function openProofDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isStoredProofFile(value: unknown): value is StoredProofFile {
  if (!value || typeof value !== "object") return false;
  const record = value as StoredProofFile;
  return (
    record.kind === "buffer" &&
    record.buffer instanceof ArrayBuffer &&
    typeof record.fileName === "string" &&
    typeof record.mimeType === "string"
  );
}

/** Copia el archivo a memoria para no depender del path en disco (evita NotReadableError). */
export async function materializeProofFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  if (!buffer.byteLength) {
    throw new Error("El archivo está vacío");
  }
  return new File([buffer], file.name || "comprobante", {
    type: guessProofMimeType(
      file.name || "comprobante",
      file.type || "application/octet-stream",
    ),
    lastModified: file.lastModified || Date.now(),
  });
}

/** Comprueba si un Blob/File sigue siendo legible (evita NotReadableError al enviar). */
export async function isProofBlobReadable(blob: Blob): Promise<boolean> {
  if (!blob || blob.size === 0) return false;
  try {
    const buf = await blob.arrayBuffer();
    return buf.byteLength > 0;
  } catch {
    return false;
  }
}

async function blobToStoredProof(file: Blob, fileName: string): Promise<StoredProofFile> {
  const mimeType = guessProofMimeType(
    fileName,
    file.type || "application/octet-stream",
  );
  return {
    kind: "buffer",
    buffer: await file.arrayBuffer(),
    fileName,
    mimeType,
    savedAt: Date.now(),
  };
}

function storedProofToFile(record: StoredProofFile): File {
  const mimeType = guessProofMimeType(record.fileName, record.mimeType);
  return new File([record.buffer], record.fileName, {
    type: mimeType,
    lastModified: record.savedAt,
  });
}

async function legacyValueToFile(value: unknown): Promise<File | null> {
  if (value instanceof File) {
    try {
      return await materializeProofFile(value);
    } catch {
      return null;
    }
  }
  if (value instanceof Blob) {
    try {
      return await materializeProofFile(
        new File([value], "comprobante", {
          type: value.type || "application/octet-stream",
        }),
      );
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveVentaProofFile(token: string, file: File) {
  if (!canUseStorage()) return;
  const stable = await materializeProofFile(file);
  const record = await blobToStoredProof(stable, stable.name || "comprobante");
  const db = await openProofDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record, token);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadVentaProofFile(token: string): Promise<File | null> {
  if (!canUseStorage()) return null;
  try {
    const db = await openProofDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(token);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });

    if (isStoredProofFile(value)) {
      return storedProofToFile(value);
    }

    const legacy = await legacyValueToFile(value);
    if (legacy) {
      // Migrar a formato estable en segundo plano.
      void saveVentaProofFile(token, legacy);
      return legacy;
    }

    if (value != null) {
      await clearVentaProofFile(token);
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearVentaProofFile(token: string) {
  if (!canUseStorage()) return;
  try {
    const db = await openProofDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(token);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

function cedulaDbKey(token: string) {
  return `${token}__cedula`;
}

export async function saveVentaCedulaFile(token: string, file: File) {
  if (!canUseStorage()) return;
  const stable = await materializeProofFile(file);
  const record = await blobToStoredProof(stable, stable.name || "cedula");
  const db = await openProofDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record, cedulaDbKey(token));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadVentaCedulaFile(token: string): Promise<File | null> {
  if (!canUseStorage()) return null;
  try {
    const db = await openProofDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(cedulaDbKey(token));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
    if (isStoredProofFile(value)) return storedProofToFile(value);
    return null;
  } catch {
    return null;
  }
}

export async function clearVentaCedulaFile(token: string) {
  if (!canUseStorage()) return;
  try {
    const db = await openProofDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(cedulaDbKey(token));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function clearVentaDraftAll(token: string) {
  clearVentaDraft(token);
  await clearVentaProofFile(token);
  await clearVentaCedulaFile(token);
}
