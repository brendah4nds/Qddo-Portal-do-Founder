import { isWeekend as dateFnsIsWeekend, format } from 'date-fns';

/**
 * Calculates Easter date for a given year using Meeus/Jones/Butcher algorithm.
 */
function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Checks if a date is a Brazilian national holiday.
 */
export function isNationalHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Fixed holidays
  const fixedHolidays = [
    { m: 0, d: 1 },   // Jan 1: Ano Novo
    { m: 3, d: 21 },  // Apr 21: Tiradentes
    { m: 4, d: 1 },   // May 1: Dia do Trabalho
    { m: 8, d: 7 },   // Sep 7: Independência
    { m: 9, d: 12 },  // Oct 12: Nossa Senhora Aparecida
    { m: 10, d: 2 },  // Nov 2: Finados
    { m: 10, d: 15 }, // Nov 15: Proclamação da República
    { m: 10, d: 20 }, // Nov 20: Dia da Consciência Negra
    { m: 11, d: 25 }, // Dec 25: Natal
  ];

  if (fixedHolidays.some(h => h.m === month && h.d === day)) return true;

  // Mobile holidays (Easter based)
  const easter = getEaster(year);
  
  // Carnaval (Tuesday) is 47 days before Easter
  const carnaval = new Date(easter);
  carnaval.setDate(easter.getDate() - 47);
  
  // Sexta-feira Santa is 2 days before Easter
  const sextaSanta = new Date(easter);
  sextaSanta.setDate(easter.getDate() - 2);
  
  // Corpus Christi is 60 days after Easter
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);

  const mobileHolidays = [carnaval, sextaSanta, corpusChristi];
  
  return mobileHolidays.some(h => 
    h.getFullYear() === year && 
    h.getMonth() === month && 
    h.getDate() === day
  );
}

/**
 * Checks if a date is a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  return dateFnsIsWeekend(date);
}

/**
 * Checks if a date is blocked for booking (weekend or holiday).
 */
export function isBlockedDay(date: Date): boolean {
  return isWeekend(date) || isNationalHoliday(date);
}
