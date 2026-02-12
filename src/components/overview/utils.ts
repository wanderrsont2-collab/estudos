export function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

export function formatWeekDayDate(isoDate: string) {
  const parsed = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
