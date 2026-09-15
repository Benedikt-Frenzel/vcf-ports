"""Smoke test for the data normaliser used by scripts/update_data.py and
scripts/normalize_snapshot.py. Runs as a plain Python test because it
exercises Python source code, not the bundled snapshot or the UI.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from data_normalize import (  # noqa: E402
    CLASSIFICATION_MAP,
    PROTOCOL_MAP,
    normalise_classification,
    normalise_port,
    normalise_protocol,
    normalise_row,
)


def test_protocol_canonicalisation():
    assert normalise_protocol('HTTPS (REST)') == 'HTTPS'
    assert normalise_protocol('HTTPS (SOAP, REST)') == 'HTTPS'
    assert normalise_protocol('UDP TCP') == 'TCP/UDP'
    assert normalise_protocol('TCP and UDP') == 'TCP/UDP'
    assert normalise_protocol('TCP, UDP') == 'TCP/UDP'
    assert normalise_protocol('TLS/TCP') == 'TCP'
    assert normalise_protocol('gRPC/TCP') == 'TCP'
    assert normalise_protocol('SSL') == 'TLS'
    assert normalise_protocol('SOAP') == 'HTTPS'
    assert normalise_protocol('ESP (IP protocol 50)') == 'ESP'
    assert normalise_protocol('TCP') == 'TCP'
    assert normalise_protocol('') == ''
    assert PROTOCOL_MAP == {k: v for k, v in PROTOCOL_MAP.items() if k == v} | {k: v for k, v in PROTOCOL_MAP.items() if k != v and v != k}
    # Each non-canonical entry maps to a different canonical value; canonical entries map to themselves.
    canonical = {'TCP', 'UDP', 'ICMP', 'HTTPS', 'TCP/UDP', 'HTTP', 'TLS', 'ESP', 'NFS'}
    for key, target in PROTOCOL_MAP.items():
        assert target in canonical
        if key != target:
            assert key not in canonical, f'{key!r} should have been collapsed to a canonical value'


def test_classification_canonicalisation():
    assert normalise_classification('Inbound') == 'Inbound'
    assert normalise_classification('Incoming') == 'Inbound'
    assert normalise_classification('Incoming (to connector)') == 'Inbound'
    assert normalise_classification('Outbound') == 'Outbound'
    assert normalise_classification('Outgoing') == 'Outbound'
    assert normalise_classification('Outgoing ') == 'Outbound'
    assert normalise_classification('Both') == 'Both'
    assert normalise_classification('bi-directional') == 'Both'
    assert normalise_classification('-') == 'N/A'
    assert normalise_classification('NA') == 'N/A'
    for scope in ('Management', 'User Interface', 'Ingestion', 'Cluster Internal', 'VCenter Internal'):
        assert normalise_classification(scope) == 'Internal'


def test_port_canonicalisation():
    assert normalise_port('Type 0, Code 0') == 'ICMP Type 0/Code 0'
    assert normalise_port('Type 8, Code 0') == 'ICMP Type 8/Code 0'
    assert normalise_port('443') == '443'
    assert normalise_port('user-configurable') == 'user-configurable'
    assert normalise_port('') == ''


def test_row_keeps_other_fields_intact():
    original = {'id': 'x', 'port': 'Type 0, Code 0', 'protocol': 'HTTPS (REST)',
                'classification': 'Incoming', 'source': 'vc', 'destination': 'esx'}
    cleaned = normalise_row(original)
    assert cleaned['port'] == 'ICMP Type 0/Code 0'
    assert cleaned['protocol'] == 'HTTPS'
    assert cleaned['classification'] == 'Inbound'
    assert cleaned['id'] == 'x'
    assert cleaned['source'] == 'vc'
    assert cleaned['destination'] == 'esx'


def test_normalised_snapshot_is_deduplicated():
    """The bundled snapshot must contain only canonical values."""
    from json import load

    snapshot = load(open(Path(__file__).resolve().parents[1] / 'data' / 'vcf-9.1.json'))
    protocols = {row['protocol'] for row in snapshot['rows']}
    classifications = {row['classification'] for row in snapshot['rows']}
    assert protocols <= {'TCP', 'UDP', 'ICMP', 'HTTPS', 'TCP/UDP', 'HTTP', 'TLS', 'ESP', 'NFS'}
    assert classifications <= {'Inbound', 'Outbound', 'Both', 'N/A', 'Internal'}
    for row in snapshot['rows']:
        if row['port'].startswith('Type '):
            raise AssertionError(f'unnormalised ICMP port: {row["port"]!r}')


if __name__ == '__main__':
    test_protocol_canonicalisation()
    test_classification_canonicalisation()
    test_port_canonicalisation()
    test_row_keeps_other_fields_intact()
    test_normalised_snapshot_is_deduplicated()
    print('data normaliser: all checks passed')
