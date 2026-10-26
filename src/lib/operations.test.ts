import { describe,it,expect } from 'vitest'
import { overlapsBlock,stayNights,stayTotal } from './operations'
describe('availability and rates',()=>{
 const block={id:'b',property_id:'p',start_date:'2026-09-10',end_date:'2026-09-15',reason:'Maintenance',notes:''}
 it('blocks occupied nights and permits boundary arrivals/departures',()=>{
  expect(overlapsBlock(block,'p','2026-09-09','2026-09-11')).toBe(true)
  expect(overlapsBlock(block,'p','2026-09-15','2026-09-17')).toBe(false)
  expect(overlapsBlock(block,'p','2026-09-08','2026-09-10')).toBe(false)
  expect(overlapsBlock(block,'other','2026-09-10','2026-09-12')).toBe(false)
 })
 it('counts nights across DST and leap day rather than elapsed hours',()=>{
  expect(stayNights('2026-10-24','2026-10-26')).toBe(2)
  expect(stayNights('2028-02-28','2028-03-01')).toBe(2)
  expect(stayTotal('2026-09-10','2026-09-13',99.99)).toBe(299.97)
 })
})
