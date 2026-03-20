import { isNationalHoliday, isWeekend, isBlockedDay } from './src/utils/holidays';
import { format } from 'date-fns';

const testDates = [
  { date: new Date(2026, 0, 1), name: 'Ano Novo (Jan 1)' },
  { date: new Date(2026, 1, 17), name: 'Carnaval (Feb 17)' },
  { date: new Date(2026, 3, 3), name: 'Sexta-feira Santa (Apr 3)' },
  { date: new Date(2026, 3, 21), name: 'Tiradentes (Apr 21)' },
  { date: new Date(2026, 4, 1), name: 'Dia do Trabalho (May 1)' },
  { date: new Date(2026, 5, 4), name: 'Corpus Christi (Jun 4)' },
  { date: new Date(2026, 8, 7), name: 'Independência (Sep 7)' },
  { date: new Date(2026, 9, 12), name: 'Nossa Senhora Aparecida (Oct 12)' },
  { date: new Date(2026, 10, 2), name: 'Finados (Nov 2)' },
  { date: new Date(2026, 10, 15), name: 'Proclamação da República (Nov 15)' },
  { date: new Date(2026, 10, 20), name: 'Dia da Consciência Negra (Nov 20)' },
  { date: new Date(2026, 11, 25), name: 'Natal (Dec 25)' },
  { date: new Date(2026, 2, 21), name: 'Saturday (Mar 21)' },
  { date: new Date(2026, 2, 22), name: 'Sunday (Mar 22)' },
  { date: new Date(2026, 2, 23), name: 'Monday (Mar 23) - Not holiday' },
];

console.log('Testing Holiday and Weekend Logic for 2026:\n');

testDates.forEach(({ date, name }) => {
  const holiday = isNationalHoliday(date);
  const weekend = isWeekend(date);
  const blocked = isBlockedDay(date);
  console.log(`${format(date, 'yyyy-MM-dd')} (${name}):`);
  console.log(`  Holiday: ${holiday}`);
  console.log(`  Weekend: ${weekend}`);
  console.log(`  Blocked: ${blocked}`);
  
  if (name.includes('Not holiday')) {
    if (blocked) console.error('  FAILED: Should NOT be blocked');
  } else {
    if (!blocked) console.error('  FAILED: Should BE blocked');
  }
});
