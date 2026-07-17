/**
 * Sonido de notificación del inbox (réplica del "pop" de WhatsApp Web).
 *
 * Se sintetiza con Web Audio (dos notas cortas con decaimiento) para no
 * depender de un archivo de audio. El navegador exige un gesto del usuario
 * antes de poder sonar; el AudioContext se crea perezoso y, si está
 * suspendido, se intenta reanudar (los operadores ya interactuaron con el
 * panel al iniciar sesión, así que en la práctica siempre suena).
 *
 * Preferencia on/off persistida en localStorage (`inbox-sound-enabled`).
 */

const STORAGE_KEY = 'inbox-sound-enabled';
/** Evento same-tab para que cabecera / modal / contacto se sincronicen. */
export const SOUND_ENABLED_EVENT = 'inbox-sound-enabled';

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

/** Mínimo entre sonidos para no hacer ráfagas si entran varios chats a la vez. */
const MIN_GAP_MS = 1500;

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  window.dispatchEvent(new CustomEvent(SOUND_ENABLED_EVENT, { detail: on }));
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Una nota corta tipo marimba (senoidal con ataque rápido y cola breve). */
function blip(
  audio: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  peak: number,
): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/** Pide permiso de notificaciones del navegador (se llama desde el toggle). */
export function ensureNotificationPermission(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

/** Notificación de escritorio cuando la pestaña no está visible (como WhatsApp Web). */
function notifyBrowserIfHidden(): void {
  if (typeof document === 'undefined' || !document.hidden) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification('FincasYa · Chats', {
      body: 'Tienes un mensaje nuevo en el inbox',
      tag: 'fincasya-inbox', // reemplaza la anterior en vez de apilar
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* algunos navegadores restringen Notification fuera de service worker */
  }
}

/**
 * Avisa de un mensaje nuevo: notificación de escritorio (si la pestaña está
 * oculta) y tono (si el sonido está habilitado). Silenciar solo apaga el audio.
 */
export function playNotificationSound(): void {
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;
  notifyBrowserIfHidden();

  if (!isSoundEnabled()) return;

  const audio = getContext();
  if (!audio) return;
  const fire = () => {
    const t = audio.currentTime + 0.01;
    // Dos notas ascendentes (D6 → A6), el "pop-pop" clásico de WhatsApp Web.
    blip(audio, 1174.66, t, 0.16, 0.22);
    blip(audio, 1760.0, t + 0.09, 0.22, 0.18);
  };
  if (audio.state === 'suspended') {
    void audio
      .resume()
      .then(fire)
      .catch(() => {
        /* sin gesto del usuario aún: el próximo intento sonará */
      });
  } else {
    fire();
  }
}
