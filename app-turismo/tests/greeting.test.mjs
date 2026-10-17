import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatToday, greeting } from '../src/mobile/data/greeting.ts';

const at = (h, m = 0) => new Date(2026, 9, 17, h, m);

test('greeting: cortes de mañana, tarde y noche', () => {
  assert.equal(greeting(at(0)), 'Buenos días');
  assert.equal(greeting(at(11, 59)), 'Buenos días');
  assert.equal(greeting(at(12)), 'Buenas tardes');
  assert.equal(greeting(at(19, 59)), 'Buenas tardes');
  assert.equal(greeting(at(20)), 'Buenas noches');
  assert.equal(greeting(at(23, 59)), 'Buenas noches');
});

test('formatToday: fecha corta que empieza con mayúscula', () => {
  const s = formatToday(at(10));
  assert.ok(s.length > 0);
  assert.equal(s[0], s[0].toUpperCase());
  assert.match(s, /17/);
});
