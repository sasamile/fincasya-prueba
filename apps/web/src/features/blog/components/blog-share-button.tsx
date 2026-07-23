"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageWithBlur } from "@/components/ui/image-with-blur";
import { Share } from "lucide-react";
import {
  FaWhatsapp,
  FaFacebookF,
  FaXTwitter,
  FaEnvelope,
  FaLink,
  FaEllipsis,
} from "react-icons/fa6";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface BlogShareButtonProps {
  id: number;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  category?: string;
  readTime?: number;
  className?: string;
}

function resolveShareOrigin(): string {
  if (typeof window !== "undefined") {
    const { origin } = window.location;
    if (!/localhost|127\.0\.0\.1/i.test(origin)) return origin;
  }
  return "https://www.fincasya.com";
}

export function BlogShareButton({
  id,
  title,
  excerpt,
  imageUrl,
  category,
  readTime,
  className,
}: BlogShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    return `${resolveShareOrigin()}/blog/${id}`;
  }, [id]);

  const shareText = excerpt?.trim()
    ? `${title}\n\n${excerpt.trim()}`
    : `Mira este artículo de FincasYa: ${title}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Error al copiar");
    }
  };

  const shareOptions = [
    {
      name: copied ? "¡Copiado!" : "Copiar enlace",
      icon: <FaLink className="w-5 h-5" />,
      action: handleCopy,
    },
    {
      name: "WhatsApp",
      icon: <FaWhatsapp className="w-5 h-5 text-[#25D366]" />,
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
    },
    {
      name: "Facebook",
      icon: <FaFacebookF className="w-5 h-5 text-[#1877F2]" />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "Twitter / X",
      icon: <FaXTwitter className="w-5 h-5 text-black" />,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "Correo",
      icon: <FaEnvelope className="w-5 h-5 text-gray-600" />,
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
    },
    {
      name: "Más opciones",
      icon: <FaEllipsis className="w-5 h-5 text-gray-700" />,
      action: () => {
        if (navigator.share) {
          void navigator.share({ title, text: shareText, url: shareUrl });
        } else {
          void handleCopy();
        }
      },
    },
  ];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={
          className ||
          "flex items-center gap-2 rounded-full border-white/30 bg-white/10 font-semibold text-white hover:bg-white/20"
        }
        onClick={() => setIsOpen(true)}
      >
        <Share className="h-4 w-4" />
        <span className="text-xs underline sm:no-underline">Compartir</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100dvw-1rem)] max-w-[420px] max-h-[calc(100dvh-1rem)] gap-0 overflow-y-auto overflow-x-hidden rounded-[24px] border-none p-3 shadow-2xl sm:rounded-[28px] sm:p-6">
          <DialogHeader className="pb-4 pt-1">
            <DialogTitle className="pr-6 text-center text-xl font-bold tracking-tight sm:text-left sm:text-2xl">
              Comparte este artículo
            </DialogTitle>
          </DialogHeader>

          <div className="mb-5 flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50/50 p-3 sm:mb-6 sm:gap-4 sm:p-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-16 sm:w-16">
              <ImageWithBlur
                src={imageUrl || "/images/PHOTO-2026-07-23-11-02-24.jpg"}
                alt={title}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-bold text-gray-900 sm:text-base">
                {title}
              </h4>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 sm:gap-2 sm:text-sm">
                {category ? (
                  <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-bold text-gray-900">
                    {category}
                  </span>
                ) : null}
                {category && readTime ? (
                  <span className="text-neutral-300">•</span>
                ) : null}
                {readTime ? (
                  <span className="shrink-0">{readTime} min de lectura</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="xs:grid-cols-2 grid grid-cols-1 gap-2 sm:gap-3">
            {shareOptions.map((option) =>
              option.href ? (
                <a
                  key={option.name}
                  href={option.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-neutral-200 p-2.5 transition-all hover:bg-neutral-50 active:scale-95 sm:p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center transition-transform group-hover:scale-110">
                    {option.icon}
                  </div>
                  <span className="truncate text-[13px] font-semibold text-gray-700 sm:text-sm">
                    {option.name}
                  </span>
                </a>
              ) : (
                <button
                  key={option.name}
                  type="button"
                  onClick={option.action}
                  className="group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-neutral-200 p-2.5 text-left transition-all hover:bg-neutral-50 active:scale-95 sm:p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center transition-transform group-hover:scale-110">
                    {option.icon}
                  </div>
                  <span className="truncate text-[13px] font-semibold text-gray-700 sm:text-sm">
                    {option.name}
                  </span>
                </button>
              ),
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
