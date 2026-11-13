#!/usr/bin/env python3
"""Snapshot the public Ports tool's explicit VCF 9.1 release mappings."""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from data_normalize import normalise_row, unknown_values

BASE = 'https://ports.esp.spespg1.vmw.saas.broadcom.com/manage/view/v1/'
ROOT = Path(__file__).resolve().parents[1]


def fetch(path):
    with urlopen(Request(BASE + path, headers={'User-Agent': 'VCF-Ports-Community/1.0'}), timeout=60) as response:
        return json.load(response)


def main():
    versions = fetch('vcfversions')
    version = next((v for v in versions if v['vcfVersion'] == '9.1' and v['active']), None)
    if version is None:
        raise RuntimeError('VCF 9.1 is no longer an active version in the Ports API')
    mappings = [m for m in fetch('vcfproductreleasemappings') if m['vcfVersion']['id'] == version['id']]
    products = {}
    for m in mappings:
        p, r = m['product'], m['release']
        if m.get('active') is False:
            continue
        item = products.setdefault(p['id'], {'id': p['id'], 'name': p['displayName'], 'category': p.get('category'), 'releases': []})
        item['releases'].append({'id': r['id'], 'name': r['displayName']})
    rows = []
    for p in products.values():
        allowed = {r['id'] for r in p['releases']}
        listings = fetch('vmwareproducts/' + p['id'] + '/listings1')
        count = 0
        for row in listings:
            releases = [r for r in row.get('releases', []) if r['id'] in allowed]
            if not releases or row.get('status') != 'PUBLISHED' or str(row.get('active')).lower() != 'true':
                continue
            entry = {k: row.get(k, '') or '' for k in ['id', 'port', 'protocol', 'source', 'destination', 'purpose', 'serviceDescription', 'classification', 'publishDate']}
            entry.update(product=p['name'], productId=p['id'], releases=[{'id': r['id'], 'name': r['displayName']} for r in releases])
            rows.append(normalise_row(entry))
            count += 1
        p['rowCount'] = count
        print(p['name'], count)
    if not rows:
        raise RuntimeError('No matching data; refusing to replace snapshot')
    target = ROOT / 'data' / 'vcf-9.1.json'
    if target.exists() and '--force' not in sys.argv:
        previous = json.loads(target.read_text(encoding='utf-8'))
        if len(rows) < 0.9 * len(previous.get('rows', [])) or len(products) < len(previous.get('products', [])):
            raise RuntimeError(f"Snapshot would shrink from {len(previous['rows'])} to {len(rows)} rows / "
                               f"{len(previous['products'])} to {len(products)} products; rerun with --force after review")
    report = unknown_values(rows)
    lines = [f'- Unknown upstream {key} values (normalised, raw kept): ' + ', '.join(f'`{v}`' for v in values)
             for key, values in report.items()]
    for line in lines:
        print('WARNING', line)
    if os.environ.get('GITHUB_STEP_SUMMARY') and lines:
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as summary:
            summary.write('### Data quality\n' + '\n'.join(lines) + '\n')
    result = {'vcfVersion': '9.1', 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'source': 'https://ports.broadcom.com/', 'apiBase': BASE, 'versionId': version['id'], 'products': list(products.values()), 'rows': rows}
    target.parent.mkdir(exist_ok=True)
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(target)


if __name__ == '__main__':
    main()
