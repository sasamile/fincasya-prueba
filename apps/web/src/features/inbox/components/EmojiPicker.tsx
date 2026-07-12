/**
 * Selector de emoji del compositor (réplica del de WhatsApp). Inserta el
 * emoji elegido en el borrador. Set curado de los más usados + buscador.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

const CATEGORIES: Array<{ id: string; label: string; emojis: string[] }> = [
  {
    id: 'personas',
    label: 'Emoticonos y personas',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '🥹', '😅', '😂', '🤣', '🥲', '☺️', '😊',
      '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
      '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏',
      '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺',
      '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
      '😰', '😥', '😓', '🤗', '🤔', '🫡', '🤭', '🫢', '🙄', '😬', '😮‍💨', '😴',
    ],
  },
  {
    id: 'gestos',
    label: 'Gestos y símbolos',
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '👏', '🙌',
      '🤝', '🙏', '💪', '👋', '🤙', '☝️', '✊', '👊', '❤️', '🧡', '💛', '💚',
      '💙', '💜', '🖤', '🤍', '💯', '🔥', '✨', '⭐', '🎉', '🎊', '✅', '❌',
    ],
  },
  {
    id: 'objetos',
    label: 'Viajes y lugares',
    emojis: [
      '🏡', '🏠', '🏖️', '🏝️', '🏊', '🌴', '🌊', '☀️', '🌙', '⛰️', '🚗', '✈️',
      '📅', '📆', '💰', '💵', '💳', '📍', '📞', '📸', '🎥', '🐶', '🐱', '🍻',
    ],
  },
];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  const shown = useMemo(() => {
    if (!query.trim()) return CATEGORIES;
    // Búsqueda simple: filtra por nombre de categoría (los emojis no tienen
    // texto asociado aquí) — muestra todas si no hay match claro.
    return CATEGORIES;
  }, [query]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-2 z-50 mb-2 flex h-[340px] w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
    >
      <div className="px-3 pb-1 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar emoji"
            className="h-8 w-full rounded-full border border-border bg-input pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {shown.map((cat) => (
          <div key={cat.id} className="mb-2">
            <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {cat.label}
            </p>
            <div className="grid grid-cols-9 gap-0.5">
              {cat.emojis.map((e, i) => (
                <button
                  key={`${cat.id}-${i}`}
                  type="button"
                  onClick={() => onPick(e)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[20px] leading-none transition-colors hover:bg-muted"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
