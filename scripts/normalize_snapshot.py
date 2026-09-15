#!/usr/bin/env python3
"""Re-normalise the checked-in snapshot with the same rules used on import.

Useful after the normaliser rules change but the API snapshot was already
cached, or to deduplicate values without re-fetching from Broadcom.
Refuses to overwrite an empty snapshot or one with fewer rows than the
existing one.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from data_normalize import normalise_row

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'data' / 'vcf-9.1.json'


def main() -> int:
    snapshot = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    rows = snapshot.get('rows')
    if not isinstance(rows, list) or not rows:
        print('Refusing to normalise: snapshot has no rows.', file=sys.stderr)
        return 1
    original = len(rows)
    snapshot['rows'] = [normalise_row(row) for row in rows]
    with tempfile.NamedTemporaryFile('w', dir=SNAPSHOT.parent, delete=False, encoding='utf-8') as handle:
        json.dump(snapshot, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    Path(handle.name).replace(SNAPSHOT)
    print(f'Normalised {original} rows in {SNAPSHOT.name}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
