import { isProofBlobReadable } from "./venta-draft-storage";

function isNotReadableError(err: unknown) {
  return (
    (err instanceof DOMException && err.name === "NotReadableError") ||
    (err instanceof Error && err.name === "NotReadableError")
  );
}

/** Convierte un File/Blob a base64; usa arrayBuffer si FileReader falla. */
export async function fileToBase64(file: Blob): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("El archivo está vacío. Vuelve a adjuntar el comprobante.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("El archivo debe pesar menos de 10 MB");
  }

  if (!(await isProofBlobReadable(file))) {
    throw new Error(
      "El comprobante ya no se puede leer. Quítalo y vuelve a adjuntarlo.",
    );
  }

  try {
    return await readViaArrayBuffer(file);
  } catch (err) {
    if (!isNotReadableError(err)) throw err;
  }

  return readViaFileReader(file);
}

function readViaFileReader(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("No se pudo leer el comprobante"));
        return;
      }
      const base64 = reader.result.split(",")[1];
      if (!base64) {
        reject(new Error("No se pudo convertir el comprobante"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => {
      reject(
        reader.error ??
          new Error("No se pudo leer el comprobante. Vuelve a adjuntarlo."),
      );
    };
    reader.readAsDataURL(file);
  });
}

async function readViaArrayBuffer(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
