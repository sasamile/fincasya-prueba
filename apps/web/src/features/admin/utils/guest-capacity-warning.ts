export type PropertyCapacityLike = {
  capacity?: number | null;
  eventCapacity?: number | null;
};

export function getEffectivePropertyCapacity(
  property: PropertyCapacityLike | null | undefined,
  isEvent?: boolean,
): number | null {
  if (!property) return null;
  if (isEvent && property.eventCapacity != null && property.eventCapacity > 0) {
    return property.eventCapacity;
  }
  const cap = property.capacity;
  if (cap == null || cap <= 0) return null;
  return cap;
}

export function getGuestCapacityWarning(
  guestCount: number,
  property: PropertyCapacityLike | null | undefined,
  options?: { isEvent?: boolean },
): string | null {
  const cap = getEffectivePropertyCapacity(property, options?.isEvent);
  if (cap == null || !Number.isFinite(guestCount) || guestCount <= 0) return null;
  if (guestCount <= cap) return null;

  const overBy = guestCount - cap;
  const capLabel = options?.isEvent
    ? "capacidad de evento"
    : "capacidad de hospedaje";

  return `${guestCount} huéspedes superan la ${capLabel} de la finca (${cap} personas, +${overBy} extra). Confirma que Hernán autorizó personas adicionales con cobro extra antes de continuar.`;
}

export function guestsExceedPropertyCapacity(
  guestCount: number,
  property: PropertyCapacityLike | null | undefined,
  options?: { isEvent?: boolean },
): boolean {
  return getGuestCapacityWarning(guestCount, property, options) !== null;
}
