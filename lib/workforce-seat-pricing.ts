// Whole employee seats; bounded to keep checkout amounts within supported limits.
export const MAX_WORKFORCE_SEATS = 99999;
export const WORKFORCE_SEAT_USD = 2;
export function parseWorkforceSeats(raw: unknown): number {
  if(typeof raw!=='string' && typeof raw!=='number') throw new Error('Enter a whole employee count.');
  if(typeof raw==='string' && !/^[0-9]+$/.test(raw.trim())) throw new Error('Enter a whole employee count.');
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<1||value>MAX_WORKFORCE_SEATS) throw new Error('Enter an employee count from 1 to 99,999.');
  return value;
}
