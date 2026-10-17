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
    # El toast de errores de desarrollo (LogBox web) tapa el dock; no existe en producción
    page.add_style_tag(content='#error-toast{display:none!important}')
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


def click_section(page, label):
    """Navega con el dock o el rail, el que esté visible."""
    page.get_by_role('tab', name=label, exact=True).first.click()


def wait_param(page, value):
    page.wait_for_function(f"new URLSearchParams(location.search).get('s') === '{value}'")


@check
def url_tracks_section(browser):
    page = open_page(browser, COMPACT)
    click_section(page, 'Rutas')
    expect_section(page, 'rutas')
    wait_param(page, 'rutas')


@check
def back_button_restores_section(browser):
    page = open_page(browser, COMPACT)
    click_section(page, 'Rutas')
    expect_section(page, 'rutas')
    click_section(page, 'Perfil')
    expect_section(page, 'perfil')
    page.go_back()
    expect_section(page, 'rutas')
    page.go_back()
    expect_section(page, 'inicio')


@check
def url_keeps_other_params(browser):
    page = open_page(browser, COMPACT, '?foo=1')
    click_section(page, 'Rutas')
    wait_param(page, 'rutas')
    assert search_param(page, 'foo') == '1', f'se perdió foo: {page.url}'


@check
def invalid_param_falls_back(browser):
    page = open_page(browser, COMPACT, '?s=xyz')
    expect_section(page, 'inicio')
    page = open_page(browser, COMPACT, '?s=RUTAS')
    expect_section(page, 'rutas')


@check
def reload_keeps_section(browser):
    page = open_page(browser, COMPACT)
    click_section(page, 'Perfil')
    wait_param(page, 'perfil')
    page.reload()
    page.wait_for_selector('[data-testid="app-shell"]')
    expect_section(page, 'perfil')


def count(page, testid):
    return len(page.query_selector_all(f'[data-testid="{testid}"]'))


@check
def rail_on_wide_dock_on_compact(browser):
    page = open_page(browser, WIDE)
    page.wait_for_selector('[data-testid="side-rail"]')
    assert count(page, 'tab-bar') == 0, 'el dock no debe verse en escritorio'
    box = page.query_selector('[data-testid="side-rail"]').bounding_box()
    assert box['x'] == 0 and abs(box['width'] - 88) <= 1, f'rail mal ubicado: {box}'
    for label, key in [('Mapa', 'mapa'), ('Guía', 'guia'), ('Rutas', 'rutas'), ('Perfil', 'perfil'), ('Inicio', 'inicio')]:
        click_section(page, label)
        expect_section(page, key)

    page = open_page(browser, COMPACT)
    page.wait_for_selector('[data-testid="tab-bar"]')
    assert count(page, 'side-rail') == 0, 'el rail no debe verse en ancho de teléfono'


@check
def content_starts_after_rail(browser):
    page = open_page(browser, WIDE)
    box = page.wait_for_selector('[data-testid="section-inicio-active"]').bounding_box()
    assert abs(box['x'] - 88) <= 1, f'el contenido debe empezar después del rail: {box}'


@check
def resize_keeps_section(browser):
    page = open_page(browser, WIDE)
    click_section(page, 'Rutas')
    expect_section(page, 'rutas')
    page.set_viewport_size(COMPACT)
    page.wait_for_selector('[data-testid="tab-bar"]')
    expect_section(page, 'rutas')
    page.set_viewport_size(WIDE)
    page.wait_for_selector('[data-testid="side-rail"]')
    expect_section(page, 'rutas')


def content_box(page, section, scroll_testid):
    sel = f'[data-testid="section-{section}-active"] [data-testid="{scroll_testid}"] > div'
    return page.wait_for_selector(sel).bounding_box()


@check
def screens_centered_on_wide(browser):
    page = open_page(browser, WIDE)
    area_x, area_w = 88, WIDE['width'] - 88
    for label, key, scroll in [('Inicio', 'inicio', 'screen-scroll'), ('Rutas', 'rutas', 'screen-scroll'),
                               ('Perfil', 'perfil', 'screen-scroll'), ('Guía', 'guia', 'guia-scroll')]:
        click_section(page, label)
        expect_section(page, key)
        box = content_box(page, key, scroll)
        assert box['width'] <= 761, f'{key}: columna de {box["width"]}px, máx 760'
        center = box['x'] + box['width'] / 2
        assert abs(center - (area_x + area_w / 2)) <= 2, f'{key}: columna no centrada ({box})'


@check
def screens_full_width_on_compact(browser):
    page = open_page(browser, COMPACT)
    box = content_box(page, 'inicio', 'screen-scroll')
    assert abs(box['width'] - COMPACT['width']) <= 1, f'en teléfono el contenido usa todo el ancho: {box}'


@check
def carousel_fits_column(browser):
    page = open_page(browser, WIDE)
    col = content_box(page, 'inicio', 'screen-scroll')
    page.wait_for_selector('[data-testid="events-carousel"]')
    page.wait_for_timeout(1000)
    box = page.query_selector('[data-testid="events-carousel"]').bounding_box()
    assert box['x'] >= col['x'] - 1 and box['x'] + box['width'] <= col['x'] + col['width'] + 1, \
        f'carrusel {box} fuera de la columna {col}'
    imgs = page.eval_on_selector_all(
        '[data-testid="events-carousel"] img',
        'els => els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.left < innerWidth && r.right > 0).map(r => [r.left, r.right])')
    assert imgs, 'no se ve ninguna ilustración'
    for left, right in imgs:
        if right > col['x'] and left < col['x'] + col['width']:
            assert right <= col['x'] + col['width'] + 1, f'ilustración desborda: {left}-{right}, columna {col}'


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
