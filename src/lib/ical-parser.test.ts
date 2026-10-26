import { describe, it, expect } from 'vitest'
import { parseIcal, validateFeedUrl } from '../../supabase/functions/ical-sync/parser'
const calendar = (event = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${event}END:VCALENDAR\r\n`
const event = (extra = '') => `BEGIN:VEVENT\r\nUID:one\r\nDTSTART;VALUE=DATE:20270914\r\nDTEND;VALUE=DATE:20270915\r\nSUMMARY:Airbnb (Not available)\r\n${extra}END:VEVENT\r\n`
describe('iCal snapshots', () => {
 it('imports Priko as one blocked night in 2027, with exclusive checkout',()=>expect(parseIcal(calendar(event()))).toEqual([{uid:'one',start:'2027-09-14',end:'2027-09-15',title:'Airbnb (Not available)',kind:'block',cancelled:false}]))
 it('accepts a valid empty Booking calendar',()=>expect(parseIcal(calendar())).toEqual([]))
 it('deduplicates identical UID entries',()=>expect(parseIcal(calendar(event()+event()))).toHaveLength(1))
 it('rejects conflicting duplicate UIDs',()=>expect(()=>parseIcal(calendar(event()+event().replace('20270915','20270916')))).toThrow('duplicate'))
 it('rejects truncation and HTML so previous data survives',()=>{expect(()=>parseIcal(calendar(event()).replace('END:VCALENDAR',''))).toThrow();expect(()=>parseIcal('<html>Login</html>')).toThrow()})
 it('rejects recurrence instead of applying a partial snapshot',()=>expect(()=>parseIcal(calendar(event('RRULE:FREQ=DAILY\r\n')))).toThrow('Recurring'))
 it('rejects missing dates and reversed stays',()=>{expect(()=>parseIcal(calendar(event().replace('DTEND;VALUE=DATE:20270915\r\n','')))).toThrow();expect(()=>parseIcal(calendar(event().replace('20270915','20270913')))).toThrow()})
 it('reads folded and escaped text and cancellation',()=>expect(parseIcal(calendar(event('STATUS:CANCELLED\r\n').replace('Airbnb (Not available)','Reserved\\, Guest\r\n  Name')))[0]).toMatchObject({title:'Reserved, Guest Name',cancelled:true,kind:'reservation'}))
 it('does not mistake an alarm date for the event date',()=>expect(parseIcal(calendar(event('BEGIN:VALARM\r\nDTSTART:20000101\r\nEND:VALARM\r\n')))[0].start).toBe('2027-09-14'))
 it('only fetches supported HTTPS provider endpoints',()=>{expect(validateFeedUrl('https://ical.booking.com/v1/export?t=test').hostname).toBe('ical.booking.com');for(const url of ['http://ical.booking.com/v1/export','https://127.0.0.1/a','https://airbnb.com.evil.test/calendar/ical/1.ics','https://user:pass@airbnb.com/calendar/ical/1.ics','https://airbnb.com:8080/calendar/ical/1.ics'])expect(()=>validateFeedUrl(url)).toThrow()})
})
