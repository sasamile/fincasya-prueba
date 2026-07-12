/**
 * Compat con FincasYaWeb `features/admin/api/internal-pages-media.api`:
 * subía media al Nest; aquí sube al bucket S3 vía `/api/admin/upload`
 * (mismo endpoint que el resto del panel). Usado por el rich-text-editor.
 */

async function uploadTo(folder: 'images' | 'videos' | 'documents', file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? `Error subiendo archivo (${res.status})`);
  }
  return body.url;
}

export async function uploadInternalPageImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map((f) => uploadTo('images', f)));
}

export async function uploadInternalPageImage(file: File): Promise<string> {
  return uploadTo('images', file);
}

export async function uploadInternalPageVideo(file: File): Promise<string> {
  return uploadTo('videos', file);
}

export async function uploadInternalPageDocument(file: File): Promise<string> {
  return uploadTo('documents', file);
}
