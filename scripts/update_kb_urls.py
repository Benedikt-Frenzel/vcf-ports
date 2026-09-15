#!/usr/bin/env python3
"""Refresh the vendored Broadcom KB 327186 public URL list.

Fetches the public article and rewrites data/kb327186-urls.json atomically.
The article layout may change; the script refuses to write an empty or
unparseable result so a broken page never replaces a known-good list.
"""
from __future__ import annotations

import html
import json
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'data' / 'kb327186-urls.json'
ARTICLE = 'https://knowledge.broadcom.com/external/article/327186'
USER_AGENT = 'vcf-ports-reference-refresh/1.0'


def fetch() -> str:
    request = Request(ARTICLE, headers={'User-Agent': USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode('utf-8', errors='replace')


def parse(page: str) -> list[dict]:
    page = re.sub(r'<(script|style)[\s\S]*?</\1>', '', page)
    tables = re.findall(r'<table[\s\S]*?</table>', page)
    if not tables:
        raise ValueError('no table found in article')
    entries = []
    for table in tables:
        for row in re.findall(r'<tr[\s\S]*?</tr>', table)[1:]:
            cells = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', cell))).strip()
                     for cell in re.findall(r'<t[dh][\s\S]*?</t[dh]>', row)]
            if len(cells) < 7:
                continue
            source_products, versions, url, name, purpose, port, direction = cells[:7]
            domains = []
            for run in re.findall(r'(?:[a-z0-9-]+\.)+(?:com|net|org|io|edu|gov)', url.lower()):
                tokens = []
                for token in run.split('.'):
                    glued = re.fullmatch(r'(com|net|org|io|edu|gov)([a-z0-9-]{2,})', token)
                    tokens.extend(glued.groups() if glued else (token,))
                current = []
                for token in tokens:
                    current.append(token)
                    if token in ('com', 'net', 'org', 'io', 'edu', 'gov'):
                        domains.append('.'.join(current))
                        current = []
                if current:
                    domains.append('.'.join(current)) if not domains else None
            domains = [d for d in domains if '.' in d]
            if not domains:
                domains = [url.lower().strip()]
            entries.append({
                'domains': domains,
                'name': name,
                'purpose': purpose,
                'port': port,
                'direction': direction,
                'sourceProducts': source_products,
                'versions': versions,
            })
    if not entries:
        raise ValueError('article table parsed empty')
    return entries


def main() -> int:
    page = fetch()
    entries = parse(page)
    payload = {
        'kind': 'broadcom-kb-public-urls',
        'articleId': '327186',
        'title': 'Public URL list for VCF Products',
        'source': ARTICLE,
        'retrievedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'appliesTo': 'For VCF and vSphere Foundation 9.1',
        'note': 'Vendored reference for the public URLs required for online functionality. The article is the authoritative list and can change; refresh it with scripts/update_kb_urls.py or manually.',
        'entries': entries,
    }
    with tempfile.NamedTemporaryFile('w', dir=TARGET.parent, delete=False, encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    Path(handle.name).replace(TARGET)
    print(f'Refreshed {TARGET} with {len(entries)} entries')
    return 0


if __name__ == '__main__':
    sys.exit(main())
