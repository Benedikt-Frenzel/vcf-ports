#!/usr/bin/env python3
"""Snapshot the public Ports tool's explicit VCF 9.1 release mappings."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

BASE = 'https://ports.esp.spespg1.vmw.saas.broadcom.com/manage/view/v1/'
ROOT = Path(__file__).resolve().parents[1]


def fetch(path):
    with urlopen(Request(BASE + path, headers={'User-Agent': 'VCF-Ports-Community/1.0'}), timeout=60) as response:
        return json.load(response)


def main():
    versions = fetch('vcfversions')
    version = next(v for v in versions if v['vcfVersion'] == '9.1' and v['active'])
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
            rows.append(entry)
            count += 1
        p['rowCount'] = count
        print(p['name'], count)
    if not rows:
        raise RuntimeError('No matching data; refusing to replace snapshot')
    result = {'vcfVersion': '9.1', 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'source': 'https://ports.broadcom.com/', 'apiBase': BASE, 'versionId': version['id'], 'products': list(products.values()), 'rows': rows}
    target = ROOT / 'data' / 'vcf-9.1.json'
    target.parent.mkdir(exist_ok=True)
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temp.replace(target)


if __name__ == '__main__':
    main()
