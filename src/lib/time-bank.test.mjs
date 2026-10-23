import assert from 'node:assert/strict';

import { availableSeconds, bankReducer, createDemoBank, parseRequestDate, reservedSeconds, validateRequest } from './time-bank-model.ts';

const at = '2030-01-01T10:00:00.000Z';
let bank = createDemoBank(new Date(at));
const openingBalance = bank.confirmedSeconds;
assert.equal(bank.ledger.reduce((sum, entry) => sum + entry.seconds, 0), openingBalance);
assert.equal(new Date(parseRequestDate('2032-02-29', '14:30')).getHours(), 14);
for (const [date, time] of [['2030-02-30', '10:00'], ['2030-13-01', '10:00'], ['2030-01-01', '24:00'], ['2030-01-01', '10:60']]) {
  assert.throws(() => parseRequestDate(date, time), /valid calendar/);
}
assert.throws(() => parseRequestDate('01/01/2030', '10:00'), /YYYY-MM-DD/);

const request = {
  id: 'request-1', title: 'Move two boxes', description: 'Please help move two light boxes.',
  category: 'Home', location: 'Sha Tin', memberName: 'Your community',
  startsAt: '2099-01-02T10:00:00.000Z', durationSeconds: 3600,
  direction: 'receive', state: 'open', memberConfirmed: false, partnerConfirmed: false,
};
bank = bankReducer(bank, { type: 'request', task: request });
assert.equal(reservedSeconds(bank), 3600);
assert.equal(availableSeconds(bank), openingBalance - 3600);
assert.equal(bank.confirmedSeconds, openingBalance);
assert.equal(bankReducer(bank, { type: 'request', task: request }), bank);
assert.throws(() => bankReducer(bank, { type: 'request', task: { ...request, id: 'too-long', durationSeconds: 14400 } }), /enough available/);
assert.doesNotThrow(() => validateRequest(request, 3600));
assert.throws(() => validateRequest({ ...request, durationSeconds: 1800 }, 900), /enough available/);
assert.throws(() => validateRequest({ ...request, startsAt: 'invalid' }, 99999), /valid date/);
assert.throws(() => validateRequest({ ...request, startsAt: at }, 99999, Date.parse(at)), /future/);
for (const durationSeconds of [0, 901, 15000, 1.5, NaN]) {
  assert.throws(() => validateRequest({ ...request, durationSeconds }, 99999), /duration/);
}
assert.throws(() => bankReducer(bank, { type: 'confirm-member', taskId: request.id, at }), /Finish/);
assert.throws(() => bankReducer(bank, { type: 'advance', taskId: 'missing', at }), /no longer/);

for (const type of ['accept', 'advance', 'advance', 'confirm-member']) {
  bank = bankReducer(bank, { type, taskId: request.id, at });
}
assert.equal(bank.confirmedSeconds, openingBalance);
assert.equal(reservedSeconds(bank), 3600);
bank = bankReducer(bank, { type: 'confirm-partner', taskId: request.id, at });
assert.equal(bank.confirmedSeconds, openingBalance - 3600);
assert.equal(reservedSeconds(bank), 0);
assert.equal(bank.ledger[0].seconds, -3600);
assert.equal(bankReducer(bank, { type: 'confirm-partner', taskId: request.id, at }), bank);
assert.equal(bank.ledger.filter((entry) => entry.taskId === request.id).length, 1);

bank = bankReducer(bank, { type: 'request', task: { ...request, id: 'cancel-me' } });
bank = bankReducer(bank, { type: 'cancel', taskId: 'cancel-me', at });
assert.equal(reservedSeconds(bank), 0);
assert.equal(bank.confirmedSeconds, openingBalance - 3600);
assert.throws(() => bankReducer(bank, { type: 'cancel', taskId: 'task-groceries', at }), /Only your open/);

for (const type of ['advance', 'advance', 'confirm-partner', 'confirm-member']) {
  bank = bankReducer(bank, { type, taskId: 'task-groceries', at });
}
assert.equal(bank.confirmedSeconds, openingBalance - 3600 + 2700);
assert.equal(bank.ledger[0].seconds, 2700);
assert.equal(bank.ledger.reduce((sum, entry) => sum + entry.seconds, 0), bank.confirmedSeconds);
console.log('time-bank: reservations, validation, confirmations, cancellation and balance conservation passed');
