/**
 * Gestura móvil estilo WhatsApp: deslizar la burbuja para responder.
 * Mensajes del cliente → deslizar a la derecha; salientes → a la izquierda.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CornerUpLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/shared/use-mobile';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 52;
const MAX_DRAG = 68;

type SwipeDirection = 'left' | 'right';

export function SwipeToReply({
  children,
  direction,
  onReply,
  disabled = false,
  className,
}: {
  children: ReactNode;
  direction: SwipeDirection;
  onReply: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const slideRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<'x' | 'y' | null>(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef(0);
  const onReplyRef = useRef(onReply);
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);

  onReplyRef.current = onReply;

  const enabled = isMobile && !disabled;
  const progress = Math.min(1, Math.abs(offset) / SWIPE_THRESHOLD);

  useEffect(() => {
    const el = slideRef.current;
    if (!el || !enabled) return;

    function reset() {
      draggingRef.current = false;
      startRef.current = null;
      axisRef.current = null;
      offsetRef.current = 0;
      setAnimating(true);
      setOffset(0);
    }

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      if (!touch) return;
      startRef.current = { x: touch.clientX, y: touch.clientY };
      axisRef.current = null;
      draggingRef.current = true;
      setAnimating(false);
    }

    function onTouchMove(e: TouchEvent) {
      if (!draggingRef.current || !startRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;

      if (!axisRef.current) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axisRef.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      }
      if (axisRef.current !== 'x') return;

      const valid =
        direction === 'right'
          ? Math.max(0, Math.min(dx, MAX_DRAG))
          : Math.min(0, Math.max(dx, -MAX_DRAG));

      if (valid !== 0) {
        e.preventDefault();
        offsetRef.current = valid;
        setOffset(valid);
      }
    }

    function onTouchEnd() {
      if (!draggingRef.current) return;
      const triggered = Math.abs(offsetRef.current) >= SWIPE_THRESHOLD;
      if (triggered) {
        onReplyRef.current();
        navigator.vibrate?.(12);
      }
      reset();
    }

    function onTouchCancel() {
      reset();
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled, direction]);

  if (!enabled) {
    return <div className={cn('w-fit max-w-full shrink-0', className)}>{children}</div>;
  }

  return (
    <div
      className={cn(
        'relative inline-flex max-w-full shrink-0 touch-pan-y',
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 z-0 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8696a0] transition-opacity duration-75',
          direction === 'right' ? 'left-0.5' : 'right-0.5',
        )}
        style={{ opacity: progress * 0.95 }}
      >
        <CornerUpLeft
          className={cn('h-[22px] w-[22px]', direction === 'left' && 'scale-x-[-1]')}
          strokeWidth={2.25}
        />
      </div>
      <div
        ref={slideRef}
        className={cn(
          'relative z-1 inline-flex w-fit max-w-full',
          animating && 'transition-transform duration-200 ease-out',
        )}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
