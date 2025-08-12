const leftPad = (num: number) => (num < 10 ? `0${num}` : num);

export default function secondsToDuration(d: number, showSeconds = false) {
  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);

  if (showSeconds) {
    const s = Math.floor((d % 3600) % 60);
    if (h > 0) {
    return `${h}:${leftPad(m)}:${leftPad(s)}`;
    }
    if (m > 0) {
      return `${m}:${leftPad(s)}`;
    }
    if (s > 0) {
      return "" + s;
    }
  }

  if (h > 0) {
    return `${h}:${leftPad(m)}`;
  }
  if (m > 0) {
    return `00:${leftPad(m)}`;
  }
  return null;
}