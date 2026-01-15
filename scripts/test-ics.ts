import toICS from '../lib/calendar';
import type { EventSuggestion } from '../lib/types';
const events: EventSuggestion[] = [
  { id: 'demo-1', title: 'Test Event', time: { start: new Date(), end: new Date(Date.now()+60*60*1000) } }
];
const ics = toICS(events, 'My Demo Cal');
console.log(ics);
