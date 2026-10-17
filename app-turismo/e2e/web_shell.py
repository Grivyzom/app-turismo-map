"""Chequeos E2E del shell web (spec 2026-10-17-web-fundacion).

Requiere `pnpm web` corriendo (por defecto en :8082; otro puerto con E2E_BASE=http://localhost:PUERTO/).
Uso: python3 e2e/web_shell.py [check ...]   (sin args corre todos)
"""
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get('E2E_BASE', 'http://localhost:8082/')
WIDE = {'width': 1280, 'height': 800}
COMPACT = {'width': 390, 'height': 844}
TIMEOUT = int(os.environ.get("E2E_TIMEOUT", "90000"))

CHECKS = {}


def check(fn):
    CHECKS[fn.__name__] = fn
    return fn


def open_page(browser, viewport, query=''):
    page = browser.new_page(viewport=viewport)
    page.set_default_timeout(TIMEOUT)
    page.goto(BASE + query)
    page.wait_for_selector('[data-testid="app-shell"]')
    return page


def active_section(page):
    el = page.wait_for_selector('[data-testid$="-active"][data-testid^="section-"]')
    return el.get_attribute('data-testid').removeprefix('section-').removesuffix('-active')


def expect_section(page, key):
    page.wait_for_selector(f'[data-testid="section-{key}-active"]')
    assert active_section(page) == key, f'sección activa {active_section(page)!r}, esperaba {key!r}'


def search_param(page, name):
    m = re.search(rf'[?&]{name}=([^&#]*)', page.url)
    return m.group(1) if m else None


@check
def shell_renders_on_web(browser):
    page = open_page(browser, WIDE)
    expect_section(page, 'inicio')


@check
def mapa_param_loads_legacy(browser):
    page = open_page(browser, WIDE, '?s=mapa')
    expect_section(page, 'mapa')
    page.wait_for_selector('[data-testid="section-mapa-active"] canvas')


@check
def action_param_opens_mapa(browser):
    page = open_page(browser, WIDE, '?action=create_point')
    expect_section(page, 'mapa')


@check
def auth_param_opens_modal(browser):
    page = open_page(browser, WIDE, '?auth=login')
    page.wait_for_selector('[aria-label="Cerrar modal de autenticación"]')
    assert len(page.query_selector_all('[aria-label="Cerrar modal de autenticación"]')) == 1, \
        'hay más de un AuthModal abierto'


def main(names):
    selected = names or list(CHECKS)
    failed = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name in selected:
            try:
                CHECKS[name](browser)
                print(f'PASS {name}')
            except Exception as e:  # noqa: BLE001 — reportar y seguir con el resto
                failed.append(name)
                print(f'FAIL {name}: {str(e).splitlines()[0]}')
        browser.close()
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
