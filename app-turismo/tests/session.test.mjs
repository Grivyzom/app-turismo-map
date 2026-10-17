import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowWelcome } from '../src/mobile/session.ts';
import { toAuthUser } from '../src/utils/authUser.ts';

const base = {
  authLoading: false,
  authWaitExpired: false,
  isAuthenticated: false,
  guestDismissed: false,
};

test('shouldShowWelcome: sin sesión sale la bienvenida', () => {
  assert.equal(shouldShowWelcome(base), true);
});

test('shouldShowWelcome: mientras carga no sale, salvo que venza la espera', () => {
  assert.equal(shouldShowWelcome({ ...base, authLoading: true }), false);
  assert.equal(shouldShowWelcome({ ...base, authLoading: true, authWaitExpired: true }), true);
});

test('shouldShowWelcome: con sesión o invitado elegido no sale', () => {
  assert.equal(shouldShowWelcome({ ...base, isAuthenticated: true }), false);
  assert.equal(
    shouldShowWelcome({ ...base, authLoading: true, authWaitExpired: true, isAuthenticated: true }),
    false,
  );
  assert.equal(shouldShowWelcome({ ...base, guestDismissed: true }), false);
});

test('toAuthUser: nombre completo, email y foto subida', () => {
  assert.deepEqual(
    toAuthUser({
      fullName: 'Ana Pérez',
      firstName: 'Ana',
      primaryEmailAddress: { emailAddress: 'ana@example.com' },
      imageUrl: 'https://img.example.com/ana.png',
      hasImage: true,
    }),
    {
      fullName: 'Ana Pérez',
      firstName: 'Ana',
      email: 'ana@example.com',
      imageUrl: 'https://img.example.com/ana.png',
    },
  );
});

test('toAuthUser: solo firstName', () => {
  const user = toAuthUser({ fullName: null, firstName: 'Ana' });
  assert.equal(user.fullName, 'Ana');
  assert.equal(user.firstName, 'Ana');
});

test('toAuthUser: sin nombre ni email usa el perfil guardado o valores por defecto', () => {
  assert.deepEqual(toAuthUser({}, { fullName: 'Perfil Local', email: 'local@example.com' }), {
    fullName: 'Perfil Local',
    firstName: null,
    email: 'local@example.com',
    imageUrl: null,
  });
  assert.deepEqual(toAuthUser(null), {
    fullName: 'Usuario',
    firstName: null,
    email: '',
    imageUrl: null,
  });
});

test('toAuthUser: la imagen genérica de Clerk (hasImage false) no se usa', () => {
  const user = toAuthUser({ imageUrl: 'https://img.clerk.com/default.png', hasImage: false });
  assert.equal(user.imageUrl, null);
});
