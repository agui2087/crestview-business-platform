/** Presentation only: never convert minutes to assumed working days or infer entitlement. */
export function formatLeaveMinutes(minutes: unknown, locale: 'en' | 'es'): string {
  if (typeof minutes !== 'number' || !Number.isSafeInteger(minutes)) {
    return locale === 'es' ? 'Cantidad no disponible' : 'Amount unavailable';
  }
  const amount = Math.abs(minutes);
  const hours = Math.floor(amount / 60);
  const remainder = amount % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${locale === 'es' ? (hours === 1 ? 'hora' : 'horas') : (hours === 1 ? 'hour' : 'hours')}`);
  if (remainder || !hours) parts.push(`${remainder} ${locale === 'es' ? (remainder === 1 ? 'minuto' : 'minutos') : (remainder === 1 ? 'minute' : 'minutes')}`);
  return `${minutes < 0 ? '-' : ''}${parts.join(locale === 'es' ? ' y ' : ' and ')}`;
}

export function leaveEntryLabel(kind: string, locale: 'en' | 'es'): string {
  const labels: Record<string, [string, string]> = {
    opening: ['Opening balance', 'Saldo inicial'],
    accrual: ['Accrual credit', 'Crédito de acumulación'],
    taken: ['Leave deduction', 'Descuento de ausencia'],
    adjustment: ['Reviewed adjustment', 'Ajuste revisado'],
    carryover: ['Carryover adjustment', 'Ajuste de arrastre'],
  };
  return labels[kind]?.[locale === 'es' ? 1 : 0] ?? (locale === 'es' ? 'Movimiento no reconocido' : 'Unrecognized posting');
}
