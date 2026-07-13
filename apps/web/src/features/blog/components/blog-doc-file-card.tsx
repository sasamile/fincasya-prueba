import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type BlogDocFileCardProps = {
  url: string;
  fileName: string;
  className?: string;
};

export function BlogDocFileCard({ url, fileName, className }: BlogDocFileCardProps) {
  return (
    <div
      className={cn(
        "flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-xl border border-border bg-muted/20 p-8 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FileText className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground">{fileName}</p>
        <p className="text-xs text-muted-foreground">Documento Word</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90"
      >
        <Download className="h-4 w-4" />
        Descargar documento
      </a>
    </div>
  );
}
