'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Star } from 'lucide-react';
import {
  FaWhatsapp,
  FaFacebookF,
  FaXTwitter,
  FaEnvelope,
  FaLink,
  FaEllipsis,
} from 'react-icons/fa6';
import { getSeededRating, slugify } from '@/lib/utils';
import { useState } from 'react';
import type { PropertyDetail } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  finca: PropertyDetail;
}

export function ShareModal({ isOpen, onClose, finca }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const sharePath = `/fincas/${encodeURIComponent(finca.slug || slugify(finca.title) || finca.id)}`;
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${sharePath}`
      : `https://fincasya.com${sharePath}`;
  const shareText = `Mira esta increíble finca en FincasYa: ${finca.title}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const shareOptions = [
    { name: 'Copia el enlace', icon: <FaLink className="w-5 h-5" />, action: handleCopy },
    {
      name: 'WhatsApp',
      icon: <FaWhatsapp className="w-5 h-5 text-[#25D366]" />,
      href: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
    },
    {
      name: 'Facebook',
      icon: <FaFacebookF className="w-5 h-5 text-[#1877F2]" />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Twitter',
      icon: <FaXTwitter className="w-5 h-5 text-black" />,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Correo electrónico',
      icon: <FaEnvelope className="w-5 h-5 text-gray-600" />,
      href: `mailto:?subject=${encodeURIComponent(finca.title)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`,
    },
    {
      name: 'Más opciones',
      icon: <FaEllipsis className="w-5 h-5 text-gray-700" />,
      action: () => {
        if (navigator.share) {
          void navigator.share({ title: finca.title, text: shareText, url: shareUrl });
        }
      },
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100dvw-1rem)] max-w-[420px] max-h-[calc(100dvh-1rem)] p-3 sm:p-6 rounded-[24px] sm:rounded-[28px] border-none shadow-2xl overflow-y-auto overflow-x-hidden gap-0">
        <DialogHeader className="pb-4 pt-1">
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-center sm:text-left pr-6">
            Comparte esta finca
          </DialogTitle>
        </DialogHeader>

        <div className="flex w-full min-w-0 gap-3 sm:gap-4 p-3 sm:p-4 items-center border border-neutral-100 rounded-2xl mb-5 sm:mb-6 bg-neutral-50/50 overflow-hidden">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 shadow-sm">
            <img
              src={finca.images?.[0] || '/gml/Logo.png'}
              alt={finca.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 truncate text-sm sm:text-base">{finca.title}</h4>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm text-gray-500 mt-0.5">
              <span className="flex items-center gap-0.5 bg-neutral-100 px-1.5 py-0.5 rounded-md">
                <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-black text-black" />
                <span className="font-bold text-gray-900">{getSeededRating(finca.id)}</span>
              </span>
              <span className="text-neutral-300">•</span>
              <span className="min-w-0 max-w-[100px] truncate sm:max-w-none">{finca.location}</span>
              <span className="text-neutral-300">•</span>
              <span className="shrink-0">{finca.capacity} pers.</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3">
          {shareOptions.map((option) =>
            option.href ? (
              <a
                key={option.name}
                href={option.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full min-w-0 items-center gap-3 p-2.5 sm:p-3 rounded-2xl border border-neutral-200 hover:bg-neutral-50 transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-center w-8 h-8 group-hover:scale-110 transition-transform shrink-0">
                  {option.icon}
                </div>
                <span className="text-[13px] sm:text-sm font-semibold text-gray-700 truncate">
                  {option.name}
                </span>
              </a>
            ) : (
              <button
                key={option.name}
                type="button"
                onClick={option.action}
                className="flex w-full min-w-0 items-center gap-3 p-2.5 sm:p-3 rounded-2xl border border-neutral-200 hover:bg-neutral-50 transition-all active:scale-95 group text-left"
              >
                <div className="flex items-center justify-center w-8 h-8 group-hover:scale-110 transition-transform shrink-0">
                  {option.icon}
                </div>
                <span className="text-[13px] sm:text-sm font-semibold text-gray-700 truncate">
                  {option.name === 'Copia el enlace' && copied ? '¡Copiado!' : option.name}
                </span>
              </button>
            ),
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
