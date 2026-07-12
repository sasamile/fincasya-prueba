'use client';

import { Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ShareModal } from './ShareModal';
import type { PropertyDetail } from '../types';

interface ShareButtonProps {
  finca: PropertyDetail;
  className?: string;
}

export function ShareButton({ finca, className }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={
          className ||
          'flex items-center gap-2 rounded-full font-semibold hover:bg-neutral-50 transition-all border-neutral-300'
        }
        onClick={() => setIsOpen(true)}
      >
        <Share className="w-4 h-4" />
        <span className="underline text-xs">Compartir</span>
      </Button>
      <ShareModal isOpen={isOpen} onClose={() => setIsOpen(false)} finca={finca} />
    </>
  );
}
