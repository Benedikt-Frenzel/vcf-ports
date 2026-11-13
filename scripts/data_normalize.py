"""Canonicalise protocol, classification, and port labels in source rows.

The Broadcom Ports API returns many near-duplicate values (e.g. HTTPS
versus HTTPS (REST); Inbound versus Incoming versus Incoming (to
connector)). Normalising on import keeps the bundled snapshot
deduplicated and aligns the labels with Clarity's standard direction
and protocol terminology.
"""
from __future__ import annotations

import re

PROTOCOL_MAP = {
    'TCP': 'TCP',
    'UDP': 'UDP',
    'ICMP': 'ICMP',
    'HTTPS': 'HTTPS',
    'HTTPS (REST)': 'HTTPS',
    'HTTPS (SOAP, REST)': 'HTTPS',
    'HTTP': 'HTTP',
    'TCP/UDP': 'TCP/UDP',
    'UDP TCP': 'TCP/UDP',
    'TCP and UDP': 'TCP/UDP',
    'TCP, UDP': 'TCP/UDP',
    'TLS/TCP': 'TCP',
    'gRPC/TCP': 'TCP',
    'TLS': 'TLS',
    'SSL': 'TLS',
    'NFS': 'NFS',
    'SOAP': 'HTTPS',
    'ESP (IP protocol 50)': 'ESP',
}

# Direction is the primary classification; functional scopes collapsed to Internal.
CLASSIFICATION_MAP = {
    'Inbound': 'Inbound',
    'Incoming': 'Inbound',
    'Incoming (to connector)': 'Inbound',
    'Outbound': 'Outbound',
    'Outgoing': 'Outbound',
    'Outgoing ': 'Outbound',
    'Both': 'Both',
    'bi-directional': 'Both',
    '-': 'N/A',
    'NA': 'N/A',
    'Management': 'Internal',
    'User Interface': 'Internal',
    'Ingestion': 'Internal',
    'Cluster Internal': 'Internal',
    'VCenter Internal': 'Internal',
}

CANONICAL_PROTOCOLS = frozenset(PROTOCOL_MAP.values())
CANONICAL_CLASSIFICATIONS = frozenset(CLASSIFICATION_MAP.values())

_ICMP_PORT = re.compile(r'^Type (\d+), Code (\d+)$')


def normalise_protocol(value):
    if not value:
        return value
    return PROTOCOL_MAP.get(value, value)


def normalise_classification(value):
    """Map to the canonical set; unknown upstream values become 'N/A'.

    The raw value is kept by normalise_row() in `classificationSource`, so an
    upstream data error (e.g. a protocol name in the classification column)
    never blocks the weekly refresh and stays visible in the snapshot.
    """
    if not value:
        return value
    mapped = CLASSIFICATION_MAP.get(value, CLASSIFICATION_MAP.get(value.strip(), value))
    return mapped if mapped in CANONICAL_CLASSIFICATIONS else 'N/A'


def normalise_port(value):
    if not value:
        return value
    match = _ICMP_PORT.match(value)
    return f'ICMP Type {match.group(1)}/Code {match.group(2)}' if match else value


def normalise_row(row):
    raw = row.get('classificationSource', row.get('classification'))
    classification = normalise_classification(raw)
    result = {
        **row,
        'protocol': normalise_protocol(row.get('protocol')),
        'classification': classification,
        'port': normalise_port(row.get('port')),
    }
    result.pop('classificationSource', None)
    if raw and classification == 'N/A' and CLASSIFICATION_MAP.get(raw.strip()) != 'N/A':
        result['classificationSource'] = raw
    return result


def unknown_values(rows):
    """Upstream values the maps do not know yet, for the refresh report."""
    report = {}
    for row in rows:
        if row.get('classificationSource'):
            report.setdefault('classification', set()).add(row['classificationSource'])
        if row.get('protocol') and row['protocol'] not in CANONICAL_PROTOCOLS:
            report.setdefault('protocol', set()).add(row['protocol'])
    return {key: sorted(values) for key, values in report.items()}
