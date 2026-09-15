"""Optional Camoufox UI smoke test. Build dist/ first; run with a Python
interpreter that has camoufox installed. Screenshots go to a temporary folder.
No browser dependency is required by the static site or the Node test suite.
"""
from tempfile import mkdtemp
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from camoufox.sync_api import Camoufox
from camoufox.addons import DefaultAddons

root=Path(__file__).resolve().parents[1] / 'dist'
assert (root / 'index.html').exists(), 'Run mise run build first'
shots=Path(mkdtemp(prefix='vcf-ui-'))
print(f'Screenshots: {shots}')
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
try:
    with Camoufox(headless=True, exclude_addons=[DefaultAddons.UBO]) as browser:
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(base+'?components=vcenter',wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        assert 'Metropolis' in page.locator('body').evaluate('(e)=>getComputedStyle(e).fontFamily')
        assert page.locator('body').evaluate('(e)=>getComputedStyle(e).getPropertyValue("--clr-font")').strip()
        assert page.locator('.direction-group').count()>0
        assert page.locator('.direction-group[open]').count()==0
        page.locator('#path-ports').scroll_into_view_if_needed()
        page.screenshot(path=str(shots/'paths.png'))
        page.locator('#toggle-paths').click()
        assert page.locator('.direction-group[open]').count()==page.locator('.direction-group').count()
        page.locator('#toggle-paths').click()
        page.locator('.direction-group summary').first.focus()
        page.keyboard.press('Enter')
        assert page.locator('.direction-group[open]').count()==1
        page.locator('#path-ports').scroll_into_view_if_needed()
        page.screenshot(path=str(shots/'paths-open.png'))
        page.locator('#list-tab').click()
        page.locator('#list-size').select_option('20')
        assert page.locator('#rows tr').count()==20
        page.locator('#list-sort').select_option('port')
        page.locator('.record-details summary').first.click()
        assert page.locator('.record-details[open]').count()==1
        page.locator('#list-view').scroll_into_view_if_needed()
        page.screenshot(path=str(shots/'list.png'))
        page.locator('#external-domains').scroll_into_view_if_needed()
        page.screenshot(path=str(shots/'domains.png'))
        page.locator('#next').click()
        assert 'Page 2' in page.locator('#page').inner_text()
        page.locator('#list-order').select_option('desc')
        assert 'Page 1' in page.locator('#page').inner_text()
        page.locator('#matrix-tab').click()
        page.locator('#matrix-view').scroll_into_view_if_needed()
        page.screenshot(path=str(shots/'matrix.png'))
        assert page.locator('.matrix-cell').count()>0
        page.locator('#matrix-order').select_option('alphabetical')
        labels=page.locator('.matrix-table tbody th').all_inner_texts()
        assert labels==page.evaluate('(labels)=>[...labels].sort((a,b)=>a.localeCompare(b,"en",{numeric:true}))',labels)
        page.locator('#matrix-order').select_option('activity')
        cell=page.locator('.matrix-cell').first
        expected=int(cell.inner_text())
        cell.click()
        assert page.locator('#list-view').is_visible()
        assert page.locator('#list-count').inner_text()==f'{expected} entries'
        # Shared URL restores source/destination and component filters.
        page.reload(wait_until='networkidle')
        assert page.locator('#list-count').inner_text()==f'{expected} entries'
        page.locator('#reset').click()
        page.locator('#search').fill('nonexistent-xyz-port')
        assert page.locator('#empty').is_visible()
        page.locator('#reset').click()
        # External internet destinations: filter-aware groups + vendored KB reference.
        groups=page.locator('.domain-group>h3').all_inner_texts()
        assert any('Broadcom domains' in g for g in groups) and any('Third-party' in g for g in groups), groups
        assert page.locator('.domain-row').count()>0
        assert page.locator('.kb-table tbody tr').count()>=8
        assert page.locator('.domain-badge.broadcom').count()>0
        page.locator('#external-domains').scroll_into_view_if_needed()
        page.screenshot(path=str(shots/'domains.png'))
        page.locator('#product').select_option(label='VMware vDefend')
        assert page.locator('.domain-row').count()<25
        page.locator('#reset').click()
        page.set_viewport_size({'width':390,'height':844})
        for view in ['list','matrix','diagram']:
            page.goto(base+f'?view={view}&components=automation,vcenter',wait_until='networkidle')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), view
            page.locator('#'+('path-ports' if view=='diagram' else view+'-view')).scroll_into_view_if_needed()
            page.screenshot(path=str(shots/f'{view}-mobile.png'))
        assert not errors,errors
        print('PASS: direction toggles, list sorting/paging/details, matrix drilldown, URL restore, empty state, mobile overflow.')
finally:
    server.shutdown()
    server.server_close()
