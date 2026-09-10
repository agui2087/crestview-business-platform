import test from 'node:test';
import assert from 'node:assert/strict';
import {formatLeaveMinutes, leaveEntryLabel} from './workforce-leave-display.ts';

test('leave durations preserve exact signed minutes without assuming workdays', () => {
  assert.equal(formatLeaveMinutes(480, 'en'), '8 hours');
  assert.equal(formatLeaveMinutes(-481, 'en'), '-8 hours and 1 minute');
  assert.equal(formatLeaveMinutes(61, 'es'), '1 hora y 1 minuto');
  assert.equal(formatLeaveMinutes(0, 'es'), '0 minutos');
  assert.equal(formatLeaveMinutes(-0, 'en'), '0 minutes');
  assert.equal(formatLeaveMinutes(1, 'en'), '1 minute');
  assert.equal(formatLeaveMinutes(1440, 'en'), '24 hours');
});

test('missing or invalid durations are not displayed as a zero balance', () => {
  for (const value of [null, undefined, '', '480', NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(formatLeaveMinutes(value, 'en'), 'Amount unavailable');
  }
});

test('journal kinds have bilingual labels and a safe unknown fallback', () => {
  assert.equal(leaveEntryLabel('taken', 'en'), 'Leave deduction');
  assert.equal(leaveEntryLabel('opening', 'es'), 'Saldo inicial');
  for (const kind of ['opening', 'accrual', 'taken', 'adjustment', 'carryover']) {
    assert.notEqual(leaveEntryLabel(kind, 'es'), kind);
  }
  assert.equal(leaveEntryLabel('unknown', 'en'), 'Unrecognized posting');
});
