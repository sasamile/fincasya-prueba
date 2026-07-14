import { v } from 'convex/values';

/** Campos de un invitado del portal de check-in (schema + mutaciones). */
export const checkinGuestFields = {
  nombreCompleto: v.string(),
  cedula: v.optional(v.string()),
  tipoDocumento: v.optional(v.string()),
  esMenor: v.optional(v.boolean()),
  email: v.optional(v.string()),
  fechaNacimiento: v.optional(v.string()),
  telefono: v.optional(v.string()),
};

export const checkinGuestValidator = v.object(checkinGuestFields);
