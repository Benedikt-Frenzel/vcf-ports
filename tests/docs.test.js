import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { documentationRows, domainsInText, externalDomains } from '../logic.js';
import { COMPONENTS, componentForEndpoint, directedPairs, firewallRules, topologyPath } from '../topology.js';

const catalog = JSON.parse(readFileSync(new URL('../data/vcf-9.1-docs.json', import.meta.url)));
const kb = JSON.parse(readFileSync(new URL('../data/kb327186-urls.json', import.meta.url)));
const rows = documentationRows(catalog);

const REQUIRED_HOSTS = [
  'dl.broadcom.com', 'eapi.broadcom.com', 'vvs.broadcom.com', 'vsanhealth.vmware.com',
  'vcf.packages.broadcom.com', 'projects.packages.broadcom.com', 'pais-docker.packages.broadcom.com',
  'vcsa.vmware.com', 'vcsa.telemetry.broadcom.com', 'scapi.telemetry.broadcom.com', 'vcf.broadcom.com',
  'auth.esp.vmware.com', 'hostupdate.broadcom.com', 'packages.broadcom.com', 'registry.k8s.io',
  'projects.registry.vmware.com', 'registry.tkg.vmware.run', 'wp-content.broadcom.com', 'quay.io', 'ghcr.io',
  'api.prod.nsxti.vmware.com', '*.vmware.com.edgekey.net', '*.akamaiedge.net',
  'wp-content.broadcom.com.cdn.cloudflare.net', 'jfrog-prod-usw2-shared-oregon-main.s3.amazonaws.com'
];

test('every documented requirement cites a known VCF 9.1 page and expands to rows', () => {
  const documents = new Set(catalog.documents.map(document => document.id));
  assert.ok(catalog.requirements.length > 0);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  for (const requirement of catalog.requirements) {
    assert.ok(documents.has(requirement.documentId), requirement.id);
    assert.ok(requirement.purpose);
    assert.ok(requirement.sources.length);
    assert.ok(requirement.destinations.length);
  }
  const componentIds = new Set(COMPONENTS.map(component => component.id));
  for (const row of rows) {
    for (const id of directedPairs(row).flat()) assert.ok(componentIds.has(id), `${row.source} -> ${row.destination} mapped to ${id}`);
    assert.equal(row.origin, 'documentation');
    assert.equal(row.productId, 'vcf-9.1-docs');
    assert.match(row.citationUrl, /^https:\/\/(techdocs|knowledge)\.broadcom\.com\//);
    assert.ok(row.serviceDescription.includes(row.citationUrl));
  }
});

test('the VCF 9.1 public URL planning page is represented host for host', () => {
  const destinations = new Set(rows.map(row => row.destination));
  for (const host of REQUIRED_HOSTS) assert.ok(destinations.has(host), host);
  for (const host of REQUIRED_HOSTS) assert.ok(domainsInText(host).has(host), host);
  const packages = rows.filter(row => row.destination === 'vcf.packages.broadcom.com');
  assert.ok(packages.every(row => row.serviceDescription.includes('9.1.1')));
  assert.ok(rows.some(row => row.destination === 'api.prod.nsxti.vmware.com' && row.serviceDescription.includes('not part of the VCF SKU')));
  const external = new Set(externalDomains(rows).map(item => item.domain));
  assert.equal(external.has('techdocs.broadcom.com'), false, 'citation URLs are provenance, not communication destinations');
  assert.equal(external.has('knowledge.broadcom.com'), false, 'citation URLs are provenance, not communication destinations');
  const rules = firewallRules(rows);
  assert.ok(rules.every(rule => rule.origins.has('documentation')));
  assert.ok(rules.every(rule => rule.citations.size > 0));
});

test('component docs and KBs keep the ports they actually name', () => {
  const pair = (source, destination, port) => rows.find(row => row.source === source && row.destination === destination && row.port === port);
  assert.equal(pair('VCF Identity Broker node IP', 'Active Directory', '389').protocol, 'TCP');
  assert.equal(pair('VCF Identity Broker node IP', 'Active Directory', '636').protocol, 'TCP');
  assert.equal(pair('VCF Operations', 'SFTP backup server', '22').classification, 'Outbound');
  assert.equal(pair('VMSP Bootstrap VM', 'vCenter', '443').protocol, 'HTTPS');
  assert.equal(pair('SDDC Manager', 'VMSP Bootstrap VM', '5480').classification, 'Both');
  assert.equal(pair('vSAN host', 'Key Management Server', '0-65535').protocol, 'TCP');
  assert.equal(pair('Application monitoring', 'Cloud proxy', '4505').protocol, 'TCP');
  assert.equal(pair('Application monitoring', 'Cloud proxy', '4506').protocol, 'TCP');
  assert.equal(pair('Cloud proxy', 'Cloud proxy', 'Not specified').protocol, 'VRRP');
  assert.equal(pair('VCF Operations HCX', 'vcsa.vmware.com', 'Not specified').port, 'Not specified');
  assert.equal(pair('Fleet components', 'eapi.broadcom.com', '443').protocol, 'HTTPS');
  const planning = rows.find(row => row.id.startsWith('doc:public-binaries:') && row.destination === 'dl.broadcom.com');
  assert.equal(planning.protocol, 'Not specified');
});

test('documented endpoints land on the component the page describes', () => {
  assert.equal(componentForEndpoint('Fleet components'), 'depot');
  assert.equal(componentForEndpoint('VCF Download Tool'), 'clients');
  assert.equal(componentForEndpoint('Kyverno'), 'supervisor');
  assert.equal(topologyPath({source:'VCF Identity Broker node IP', destination:'Active Directory', product:'VCF 9.1 documentation'}).join(), 'identity,infrastructure');
  assert.equal(topologyPath({source:'License Server', destination:'VCF Operations'}).join(), 'licensing,operations');
  assert.equal(componentForEndpoint('License Hub Node IP Pool'), 'vdefend');
});

test('constraints record the license-server boundary and the legacy KB', () => {
  const text = catalog.constraints.map(item => item.text).join('\n');
  assert.match(text, /does not communicate with the Internet/);
  assert.match(text, /172\.16\.0\.0\/12/);
  assert.match(text, /KB 327186/);
  assert.match(text, /eapi\.broadcom\.com, vcf\.broadcom\.com, and dl\.broadcom\.com/);
  assert.ok(catalog.constraints.every(item => catalog.documents.some(document => document.id === item.documentId)));
});

test('KB 327186 stays labelled as the earlier-version list', () => {
  assert.match(kb.appliesTo, /earlier versions/i);
  assert.equal(JSON.stringify(kb).includes('ManagerVCF'), false);
  assert.equal(JSON.stringify(kb).includes('vCentervSphere'), false);
});
