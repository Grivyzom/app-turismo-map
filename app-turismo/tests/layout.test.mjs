import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  initialSection,
  layoutModeFor,
  parseSection,
  withSectionParam,
} from '../src/mobile/layout.ts';

test('layoutModeFor: wide solo en web desde 768px', () => {
  assert.equal(layoutModeFor('web', 768), 'wide');
  assert.equal(layoutModeFor('web', 1280), 'wide');
  assert.equal(layoutModeFor('web', 767), 'compact');
  assert.equal(layoutModeFor('android', 1280), 'compact');
  assert.equal(layoutModeFor('ios', 1024), 'compact');
});

test('parseSection: valores válidos, normalizados y basura', () => {
  assert.equal(parseSection('rutas'), 'rutas');
  assert.equal(parseSection('MAPA'), 'mapa');
  assert.equal(parseSection(' guia '), 'guia');
  assert.equal(parseSection(['perfil', 'mapa']), 'perfil');
  assert.equal(parseSection('xyz'), 'inicio');
  assert.equal(parseSection(''), 'inicio');
  assert.equal(parseSection(undefined), 'inicio');
  assert.equal(parseSection(null), 'inicio');
  assert.equal(parseSection(42), 'inicio');
});

test('initialSection: s manda; action legacy abre mapa', () => {
  assert.equal(initialSection({}), 'inicio');
  assert.equal(initialSection({ s: 'rutas' }), 'rutas');
  assert.equal(initialSection({ action: 'create_point' }), 'mapa');
  assert.equal(initialSection({ action: 'create_sector' }), 'mapa');
  assert.equal(initialSection({ action: 'create_route' }), 'mapa');
  assert.equal(initialSection({ s: 'perfil', action: 'create_point' }), 'perfil');
  assert.equal(initialSection({ action: 'otra' }), 'inicio');
});

test('withSectionParam: agrega o reemplaza s y conserva el resto', () => {
  assert.equal(withSectionParam('', 'mapa'), '?s=mapa');
  assert.equal(withSectionParam('?s=inicio', 'rutas'), '?s=rutas');
  assert.equal(withSectionParam('?foo=1', 'guia'), '?foo=1&s=guia');
  assert.equal(withSectionParam('?foo=1&s=mapa&bar=2', 'perfil'), '?foo=1&s=perfil&bar=2');
});
