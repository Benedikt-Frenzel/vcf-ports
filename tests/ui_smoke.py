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
        # The shared suite navbar stays consistent; app-specific tabs live in the sticky toolbar.
        assert page.locator('.view-tab.active').count()==1
        assert page.locator('header .view-tab').count()==0
        assert page.locator('#view-tabs').is_visible()
        assert page.locator('.toolbar .view-tab').count()==3
        assert 'sticky' in page.locator('.toolbar').evaluate('(e)=>getComputedStyle(e).position')
        assert page.locator('header .brand-copy .title').inner_text()=='VCF Tools'
        assert page.locator('header .header-actions .nav-link').all_inner_texts()==['Overview','Ports','Compliance','Feedback ✉','GitHub ↗']
        assert page.locator('header .header-actions .active').inner_text()=='Ports'
        assert 'subject=%5BVCF%20Ports%5D%20Feedback' in page.locator('header .header-actions a',has_text='Feedback').get_attribute('href')
        # Dropdown UX: counts in options, endpoints grouped by component.
        first_source=page.locator('#source option').nth(1)
        assert first_source.evaluate(r'(o)=>/\s\(\d[\d,]*\)$/.test(o.textContent)')
        assert page.locator('#source optgroup').count()>0
        assert page.locator('#release optgroup').count()>0
        # Filter chips: appear per active filter, removable individually.
        assert page.locator('.filter-chip').count()>=1  # vcenter component from URL
        page.locator('#product').select_option(value='6a05a29e4020a053ebfe0770')  # VMware vDefend
        assert page.locator('.filter-chip').count()==2
        page.locator('.filter-chip',has_text='VMware vDefend').click()
        assert page.locator('.filter-chip').count()==1
        page.locator('.filter-chip').click()
        assert page.locator('.filter-chip').is_hidden()
        page.goto(base+'?components=installer',wait_until='networkidle')
        assert page.locator('.node.selected').get_attribute('data-component')=='installer'
        assert 'VCF Installer selected' in page.locator('#component-selection').inner_text()
        assert page.locator('.edge.highlighted').count()>=10
        page.locator('#diagram-view').scroll_into_view_if_needed()
        page.screenshot(path=str(shots/'installer-paths.png'))
        page.goto(base+'?components=vcenter',wait_until='networkidle')
        assert page.locator('.direction-group').count()>0
        assert page.locator('.direction-group[open]').count()==0
        page.evaluate("localStorage.setItem('vcf-ports.environment-mapping',JSON.stringify({vcenter:'vc-mgmt-01.vcf.lab'}))")
        page.reload(wait_until='networkidle')
        with page.expect_download() as download:
            page.locator('#export-diagram').click()
        diagram_path=download.value.path()
        diagram=open(diagram_path,encoding='utf-8').read()
        assert download.value.suggested_filename=='vcf-9.1-vcenter-paths.svg'
        assert diagram.startswith('<?xml version="1.0" encoding="UTF-8"?>')
        assert '<title>VCF 9.1 communication paths: vCenter</title>' in diagram
        assert 'width="1500"' in diagram and 'height="925"' not in diagram
        assert 'class="node selected"' in diagram
        assert 'vc-mgmt-01.vcf.lab' in diagram
        assert 'Selected path ports and directions' in diagram
        assert '443 / TCP' in diagram and '→' in diagram
        page.evaluate("localStorage.removeItem('vcf-ports.environment-mapping')")
        page.reload(wait_until='networkidle')
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
        # Environment mapping: import installer JSON, persist, firewall exports.
        page.locator('.env-details summary').click()
        installer='{"hostSpecs":[{"hostname":"esx01.vcf.lab","credentials":{"password":"TopSecret-123"}},{"hostname":"esx02.vcf.lab"}],"vcenterSpec":{"vcenterHostname":"vc01.vcf.lab"},"licenseServerSpec":{"hostname":"vcf-lic01.vcf.lab"},"dnsSpec":{"nameservers":["192.168.30.29"]},"ntpServers":["192.168.30.30"]}'
        page.locator('#env-json').fill(installer)
        page.locator('#env-import').click()
        assert 'Imported 5 components' in page.locator('#env-status').inner_text()
        vcenter_value=page.locator('.env-field input[data-component="vcenter"]').input_value()
        assert vcenter_value=='vc01.vcf.lab', vcenter_value
        assert page.locator('.env-field input[data-component="external-dns"]').input_value()=='192.168.30.29'
        assert page.locator('.env-field input[data-component="external-ntp"]').input_value()=='192.168.30.30'
        page.reload(wait_until='networkidle')
        assert page.locator('.env-field input[data-component="vcenter"]').input_value()=='vc01.vcf.lab'
        with page.expect_download() as download:
            page.locator('#export-firewall').click()
        path=download.value.path()
        content=open(path,encoding='utf-8-sig').read()
        assert content.startswith('"Source address"')
        assert 'vc01.vcf.lab' in content and '<NSX IPs / FQDNs>' in content
        assert 'esx01.vcf.lab, esx02.vcf.lab' in content
        assert '"192.168.30.29","53","UDP"' in content
        assert '"192.168.30.30","123","UDP"' in content
        with page.expect_download() as download:
            page.locator('#export-firewall-md').click()
        md=open(download.value.path(),encoding='utf-8').read()
        assert md.startswith('# VCF 9.1 firewall request')
        assert '| vc01.vcf.lab |' in md
        assert '192.168.30.29' in md and '192.168.30.30' in md
        assert 'TopSecret' not in content and 'TopSecret' not in md
        page.locator('.env-details summary').click()
        page.locator('#env-clear').click()
        assert page.locator('.env-field input[data-component="vcenter"]').input_value()==''
        assert page.locator('.env-field input[data-component="external-dns"]').input_value()==''
        groups=page.locator('.domain-group>h3').all_inner_texts()
        assert any('Broadcom domains' in g for g in groups) and any('Third-party' in g for g in groups), groups
        assert page.locator('.domain-row').count()>0
        assert page.locator('.kb-table tbody tr').count()>=8
        assert page.locator('.domain-badge.broadcom').count()>0
        page.locator('#external-domains').scroll_into_view_if_needed()
        page.screenshot(path=str(shots/'domains.png'))
        page.locator('#product').select_option(value='6a05a29e4020a053ebfe0770')
        assert page.locator('.domain-row').count()<25
        page.locator('#reset').click()
        page.set_viewport_size({'width':320,'height':844})
        page.goto(base+'?components=vcenter',wait_until='networkidle')
        assert page.locator('header').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
        assert page.locator('header .brand-copy').is_hidden()
        assert page.locator('header .header-actions .nav-link:visible').all_inner_texts()==['Ports','Compliance','Feedback ✉']
        assert page.locator('#explorer>:first-child').get_attribute('class')=='toolbar'
        page.set_viewport_size({'width':390,'height':844})
        for view in ['list','matrix','diagram']:
            page.goto(base+f'?view={view}&components=automation,vcenter',wait_until='networkidle')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), view
            page.locator('#'+('path-ports' if view=='diagram' else view+'-view')).scroll_into_view_if_needed()
            page.screenshot(path=str(shots/f'{view}-mobile.png'))
        assert not errors,errors
        print('PASS: complete mapped diagram export, direction toggles, list sorting/paging/details, matrix drilldown, URL restore, empty state, mobile overflow.')
finally:
    server.shutdown()
    server.server_close()
