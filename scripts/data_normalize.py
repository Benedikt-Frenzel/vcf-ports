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
    'TLS/TCP': 'TLS/TCP',
    'gRPC/TCP': 'gRPC/TCP',
    'TLS': 'TLS',
    'SSL': 'SSL',
    'NFS': 'NFS',
    'SOAP': 'SOAP',
    'ESP (IP protocol 50)': 'ESP',
}

# Direction synonyms are collapsed. Functional scopes such as Management,
# User Interface, and Ingestion stay as published so they are not relabelled Internal.
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
}

_ICMP_PORT = re.compile(r'^Type (\d+), Code (\d+)$')


def normalise_protocol(value):
    if not value:
        return value
    return PROTOCOL_MAP.get(value, value)


def normalise_classification(value):
    if not value:
        return value
    return CLASSIFICATION_MAP.get(value, value)


def normalise_port(value):
    if not value:
        return value
    value = value.strip()
    match = _ICMP_PORT.match(value)
    return f'ICMP Type {match.group(1)}/Code {match.group(2)}' if match else value


def normalise_row(row):
    return {
        **row,
        'protocol': normalise_protocol(row.get('protocol')),
        'classification': normalise_classification(row.get('classification')),
        'port': normalise_port(row.get('port')),
    }
