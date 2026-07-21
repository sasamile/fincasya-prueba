/**
 * Menú desplegable del botón "+" del compositor (adjuntar): Documento, Fotos y
 * videos, Cámara, Audio · Catálogo · Respuestas rápidas.
 *
 * Documento, Fotos y videos, Cámara y Audio abren el selector de archivo y lo
 * envían por WhatsApp; Catálogo y Respuestas rápidas abren sus modales.
 *
 * OCULTOS (Vane, 21-jul-2026): Contacto, Encuesta, Evento y Nuevo sticker — la
 * API de WhatsApp (YCloud/Meta) no permite enviarlos, así que eran botones que
 * no hacían nada. Se dejan comentados por si algún día se habilitan.
 */
import { useEffect, useRef } from 'react';
import {
  Camera,
  FileText,
  Headphones,
  Images,
  Store,
  Zap,
} from 'lucide-react';

type Item = {
  id: string;
  label: string;
  icon: typeof FileText;
  color: string;
};

const ITEMS: Item[][] = [
  [
    { id: 'documento', label: 'Documento', icon: FileText, color: '#7f66ff' },
    { id: 'fotos', label: 'Fotos y videos', icon: Images, color: '#007bfc' },
    { id: 'camara', label: 'Cámara', icon: Camera, color: '#ff2e74' },
    { id: 'audio', label: 'Audio', icon: Headphones, color: '#ff6d00' },
    // Ocultos — la API no los soporta:
    // { id: 'contacto', label: 'Contacto', icon: Contact, color: '#009de2' },
    // { id: 'encuesta', label: 'Encuesta', icon: BarChart3, color: '#ffb400' },
    // { id: 'evento', label: 'Evento', icon: Calendar, color: '#ff2e74' },
    // { id: 'sticker', label: 'Nuevo sticker', icon: Sticker, color: '#00a884' },
  ],
  [
    { id: 'catalogo', label: 'Catálogo', icon: Store, color: '#8696a0' },
    { id: 'respuestas', label: 'Respuestas rápidas', icon: Zap, color: '#ffb400' },
  ],
];

export function AttachMenu({
  onSelect,
  onClose,
}: {
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-2 z-50 mb-1.5 w-[228px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-2xl"
      role="menu"
    >
      {ITEMS.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="my-0.5 border-t border-border/70" />}
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => onSelect(item.id)}
              className="flex w-full items-center gap-3 px-3.5 py-1.5 text-left transition-colors hover:bg-muted"
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" style={{ color: item.color }} strokeWidth={1.75} />
              <span className="text-[14px] leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
