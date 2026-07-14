'use client';

import { useRef, useState } from 'react';
import { Facebook, Instagram, ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  createCrossPost,
  type MetaConnection,
} from '@/features/admin/api/meta-channels.api';

type MediaKind = 'image' | 'video';

async function uploadMedia(file: File): Promise<string> {
  const isVideo = file.type.startsWith('video/');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', isVideo ? 'videos' : 'images');
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? 'No se pudo subir el archivo');
  }
  return json.url;
}

function mediaKindFromFile(file: File): MediaKind {
  return file.type.startsWith('video/') ? 'video' : 'image';
}

export function ComposeCrossPostDialog({
  connection,
  open,
  onOpenChange,
  onPublished,
}: {
  connection: MetaConnection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [publishFacebook, setPublishFacebook] = useState(true);
  const [publishInstagram, setPublishInstagram] = useState(!!connection.igUserId);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const hasInstagram = !!connection.igUserId;
  const hasMedia = !!mediaFile;
  const busy = uploading || publishing;

  function clearMedia() {
    if (mediaPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setMediaKind(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    if (busy) return;
    setMessage('');
    clearMedia();
    setPublishFacebook(true);
    setPublishInstagram(hasInstagram);
    onOpenChange(false);
  }

  function handleFileSelect(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      toast.error('Solo imágenes (JPG, PNG…) o videos (MP4, MOV…)');
      return;
    }

    clearMedia();
    const kind = mediaKindFromFile(file);
    setMediaFile(file);
    setMediaKind(kind);
    setMediaPreview(URL.createObjectURL(file));
  }

  async function handlePublish() {
    if (!message.trim() && !hasMedia) return;
    if (publishInstagram && !hasMedia) {
      toast.error('Instagram requiere una foto o video');
      return;
    }

    setPublishing(true);
    try {
      let imageUrl: string | undefined;
      let videoUrl: string | undefined;

      if (mediaFile) {
        setUploading(true);
        const url = await uploadMedia(mediaFile);
        if (mediaKind === 'video') videoUrl = url;
        else imageUrl = url;
        setUploading(false);
      }

      const res = await createCrossPost(connection.pageId, message, {
        imageUrl,
        videoUrl,
        publishFacebook,
        publishInstagram,
      });

      const fbOk = !publishFacebook || res.facebook?.ok;
      const igOk = !publishInstagram || res.instagram?.ok;

      if (fbOk && igOk) {
        const channels = [
          publishFacebook ? 'Facebook' : null,
          publishInstagram ? 'Instagram' : null,
        ]
          .filter(Boolean)
          .join(' e ');
        toast.success(`Publicado en ${channels}`);
        handleClose();
        onPublished();
        return;
      }

      const errors = [
        publishFacebook && !res.facebook?.ok ? res.facebook?.error : null,
        publishInstagram && !res.instagram?.ok ? res.instagram?.error : null,
      ].filter(Boolean);
      toast.error(errors.join(' · ') || 'Error al publicar');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al publicar');
    } finally {
      setUploading(false);
      setPublishing(false);
    }
  }

  const canPublish =
    !busy &&
    (message.trim().length > 0 || hasMedia) &&
    (publishFacebook || publishInstagram) &&
    (!publishInstagram || hasMedia);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 via-violet-500 to-pink-500">
              <Facebook className="h-3.5 w-3.5 text-white" />
            </span>
            Publicar en redes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/40 flex flex-wrap gap-4 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="pub-fb"
                checked={publishFacebook}
                onCheckedChange={(v) => setPublishFacebook(v === true)}
                disabled={busy}
              />
              <Label htmlFor="pub-fb" className="flex items-center gap-1.5 text-sm">
                <Facebook className="h-4 w-4 text-blue-600" /> Facebook
              </Label>
            </div>
            {hasInstagram ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pub-ig"
                  checked={publishInstagram}
                  onCheckedChange={(v) => setPublishInstagram(v === true)}
                  disabled={busy}
                />
                <Label htmlFor="pub-ig" className="flex items-center gap-1.5 text-sm">
                  <Instagram className="h-4 w-4 text-pink-500" /> Instagram
                </Label>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Instagram no vinculado a esta página.
              </p>
            )}
          </div>

          <Textarea
            placeholder="¿Qué quieres compartir?"
            className="min-h-[120px] resize-none text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2200}
            disabled={busy}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={busy}
          />

          {hasMedia && mediaPreview ? (
            <div className="relative overflow-hidden rounded-xl border">
              {mediaKind === 'video' ? (
                <video
                  src={mediaPreview}
                  controls
                  className="aspect-video w-full bg-black object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaPreview}
                  alt="Vista previa"
                  className="aspect-video w-full object-cover"
                />
              )}
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearMedia}
                  disabled={busy}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-muted-foreground bg-background/90 px-3 py-1.5 text-xs">
                {mediaFile?.name}
                {mediaKind === 'video' ? ' · Video' : ' · Imagen'}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="border-border hover:bg-muted/40 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 transition-colors"
            >
              <ImageIcon className="text-muted-foreground h-8 w-8" />
              <span className="text-sm font-medium">Subir foto o video</span>
              <span className="text-muted-foreground text-xs">
                JPG, PNG, MP4, MOV — máx. 25 MB imagen / 300 MB video
              </span>
            </button>
          )}

          {publishInstagram && !hasMedia ? (
            <p className="text-muted-foreground rounded-lg bg-amber-500/10 px-3 py-2 text-xs dark:text-amber-200">
              Instagram requiere foto o video. Facebook puede publicar solo texto.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void handlePublish()} disabled={!canPublish}>
            {(uploading || publishing) && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'Subiendo…' : publishing ? 'Publicando…' : 'Publicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
