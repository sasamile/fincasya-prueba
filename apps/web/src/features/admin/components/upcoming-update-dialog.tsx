"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const UPDATE_VIDEO_SRC = "/mobile.mov";

export function UpcomingUpdateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (open) {
      video.currentTime = 0;
      void video.play().catch(() => {
        /* autoplay puede fallar sin interacción; el usuario usa controls */
      });
      return;
    }
    video.pause();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden border-border/60 bg-card p-0 sm:max-w-md"
        showCloseButton
      >
        <DialogHeader className="space-y-2 border-b border-border/60 px-5 pt-5 pb-4 text-left">
          <div className="flex items-center gap-2.5">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-primary text-[11px] font-semibold tracking-[0.12em] uppercase">
                Novedades
              </p>
              <DialogTitle className="text-base font-semibold tracking-tight">
                Próxima actualización
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            Vista previa de la experiencia móvil que estamos preparando para FincasYa.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-neutral-950 px-4 py-4 sm:px-5">
          <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[1.35rem] bg-black shadow-[0_20px_50px_-24px_rgba(0,0,0,0.85)] ring-1 ring-white/10">
            <div className="flex items-center justify-center gap-1.5 py-2.5">
              <span className="h-1 w-8 rounded-full bg-white/20" />
            </div>
            <video
              ref={videoRef}
              src={UPDATE_VIDEO_SRC}
              controls
              playsInline
              preload="metadata"
              className="aspect-9/16 w-full bg-black object-contain"
            >
              Tu navegador no puede reproducir este video.
            </video>
            <div className="h-4" />
          </div>
        </div>

        <div className="text-muted-foreground border-t border-border/60 px-5 py-3 text-center text-[11px]">
          Borrador interno · solo visible para el equipo
        </div>
      </DialogContent>
    </Dialog>
  );
}
