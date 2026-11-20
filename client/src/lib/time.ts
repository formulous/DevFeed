const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function isNewPost(iso: string, now: number = Date.now()) {
  const diff = now - new Date(iso).getTime();
  return diff >= 0 && diff < DAY;
}

export function relativeTime(iso: string, now: number = Date.now()) {
  const time = new Date(iso).getTime();
  const diff = now - time;
  if (diff < MINUTE) return '방금 전';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayLabel(iso: string, now: number = Date.now()) {
  const d = new Date(iso);
  const start = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const days = Math.round((start(new Date(now)) - start(d)) / DAY);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return d.getFullYear() === new Date(now).getFullYear() ? md : `${d.getFullYear()}년 ${md}`;
}
