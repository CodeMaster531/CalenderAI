import type { EventSuggestion } from './types';
function fmtUTC(d: Date) {
const iso = d.toISOString().replace(/[-:]/g, '').split('.')[0];
return iso + 'Z';
}
function fmtDATE(d: Date) {
return d.toISOString().slice(0, 10).replace(/-/g, '');
}
function esc(t = '') {
  return t
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/[,;]/g, '\\$&');
}

export function toICS(
  events: EventSuggestion[],
  calendarName = 'Calendar AI'
): string {
  const now = fmtUTC(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Calendar AI//EN',
'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`
  ];
  events.forEach((e, i) => {
    const uid = e.id || `${Date.now()}-${i}@calendar.ai`;
    const start = e.time.allDay
      ? `DTSTART;VALUE=DATE:${fmtDATE(e.time.start)}`
      : `DTSTART:${fmtUTC(e.time.start)}`;
    const endLine = e.time.end

      ? (e.time.allDay
          ? `DTEND;VALUE=DATE:${fmtDATE(e.time.end)}`
          : `DTEND:${fmtUTC(e.time.end)}`
        )
      : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      start,
      ...(endLine ? [endLine] : []),
      `SUMMARY:${esc(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.labels && e.labels.length
        ? [`CATEGORIES:${e.labels.map(esc).join(',')}`]
        : []),
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export const buildICS = toICS;
export default toICS;
