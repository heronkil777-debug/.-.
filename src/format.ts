export function bytes(value: number, digits = 1): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : digits).replace('.', ',')} ${units[index]}`;
}
export function duration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}
export function relativeDate(timestamp: number): string {
  const delta = Math.max(0, Date.now() / 1000 - timestamp);
  if (delta < 60) return 'agora';
  if (delta < 3600) return `há ${Math.floor(delta / 60)} min`;
  if (delta < 86400) return `há ${Math.floor(delta / 3600)} h`;
  if (delta < 604800) return `há ${Math.floor(delta / 86400)} d`;
  return new Date(timestamp * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
export function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
}
