# VCF 9.1 Communication Matrix

An English-language, static communication explorer using [Clarity Design](https://clarity.design/) (`@clr/ui` 17.9.0). Ready for GitHub Pages, including repository subpaths. No backend, runtime CDN, analytics, npm dependencies, or build bundler.

Design alignment: all colors, radii, shadows, and typography derive from the vendored Clarity/CDS design tokens (`--cds-*`/`--clr-*`); Clarity components (header, cards, buttons, form fields, tables, alerts) are used with their native styling. Custom components without a CSS-only Clarity equivalent (the segmented header tabs, filter chips, domain badges, and the topology diagram) follow the same token palette.

**Independent private project. Not affiliated with, endorsed by, or supported by Broadcom Inc. or any of its subsidiaries. Provided as-is, without warranty.** Product names and trademarks belong to their respective owners.

## Development with mise

Install [mise](https://mise.jdx.dev/), then:

```sh
mise trust
mise install
mise run dev
```

Open **http://localhost:8080**. Use HTTP rather than opening `index.html` as a file, because the app uses JavaScript modules and fetches a local JSON snapshot.

The project pins Node and Python in `mise.toml`; GitHub Actions uses the same configuration. No `npm install` is required.

```sh
mise run test          # Data integrity, filters, matrix counts, CSV safety
mise run check         # JavaScript and Python syntax checks
mise run build         # Checks + tests + static artifact in dist/
mise run refresh-data  # Explicit upstream refresh; review changes before committing
```

## GitHub Pages

1. Push the repository to GitHub on branch `main`.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. The included `.github/workflows/pages.yml` validates and publishes `dist/`.

Pull requests run validation without deployment. All asset paths are relative, so both `https://user.github.io/repository/` and a custom domain work. Hosting is not provisioned until the repository is pushed and Pages is enabled.

## Features

- Search across ports, endpoints, service descriptions, products, and releases; multiple search words use AND semantics.
- Product, exact mapped release, protocol, classification, source, and destination filters. Dropdowns show snapshot record counts, releases are grouped by product, and endpoints are grouped by their diagram component; active filters appear as removable chips.
- Prominent, sticky segmented view tabs (path diagram, connection list, endpoint matrix) with result count and CSV export always in view.
- Interactive infrastructure diagram inspired by the official VCF 9.1 Fleet Latency diagram, with nested Fleet Services (including VCF Operations HCX), Management Domain (VCF Management Services, SDDC Manager, vCenter, Software Depot, Identity Broker, License Hub/Server), Workload Infrastructure, Advanced Services, and External Systems boxes. Select a component to draw its direct paths; select a connected box or path to isolate it and label its ports/protocols directly on the link.
- Compact, expandable port groups by direction and protocol, with exact label counts and an expand/collapse-all control.
- Sortable connection list with separate endpoint columns, 20/40/80 rows per page, and expandable original service descriptions and source metadata.
- Source × destination matrix with independently paginated axes, count shading, and activity/alphabetical ordering; select a populated cell to inspect its connections.
- Filtered CSV export with quoting, UTF-8 BOM, and spreadsheet formula mitigation.
- External internet destinations: internet domains named by the filtered records, grouped as Broadcom, VMware, and third-party, with connecting products, ports, and record counts; endpoint labels that are explicit domains carry a badge in the connection list. A vendored reference table of the public depot/telemetry/licensing URLs from Broadcom KB 327186 is included and linked.
- Shareable URL query parameters for filters and selected view.
- Visible source timestamp, product/release coverage, snapshot download, and independence disclaimer.
- Keyboard-operable controls, labelled tables and inputs, live result counts, responsive layout, error and empty states.

## Data provenance and interpretation

`data/vcf-9.1.json` is a checked-in snapshot of the public API used by **https://ports.broadcom.com/**. Its `retrievedAt` field is the retrieval time, not a claim of product release date or completeness.

`scripts/update_data.py` reads:

1. `manage/view/v1/vcfversions` to identify the active VCF 9.1 version.
2. `manage/view/v1/vcfproductreleasemappings` to select that version's explicit product/release mappings.
3. `manage/view/v1/vmwareproducts/{productId}/listings1` for each mapped product.

API origin: `https://ports.esp.spespg1.vmw.saas.broadcom.com/`.

Only **published, active** entries with at least one explicitly mapped release ID are retained. Release memberships are intersected with the mapping; unrelated releases on shared records are excluded. The initial snapshot contains **1,209 entries across 20 products**. Mapping includes patch releases and add-ons with different version numbers (for example, Avi and vDefend). This is not a claim that every mapped product itself has release number 9.1.

Endpoint names, ports, classifications, purpose, and service descriptions are retained as source text. Entries are not split, silently combined, or deduplicated. The path diagram maps those exact endpoint labels to documented local presentation aliases in `topology.js`; unmatched labels remain visible under “Infrastructure & External Services”. This grouping is a navigation aid and does not alter exported records. One product-context rule is intentional: VMSP endpoints included in the `VCF Automation` release are presented at the Automation service boundary, while the same endpoint in `VCF Management Services` remains under Management Services. This exposes the source-backed Automation ↔ vCenter TCP 443 path without rewriting the underlying endpoint names.

The diagram layout is informed by Broadcom's public **VMware Cloud Foundation 9.1 Fleet Latency Logical Diagram v3**, available in the official tool's [VMware Cloud Foundation network diagrams](https://ports.broadcom.com/network-diagrams/VMware-Cloud-Foundation), and cross-checked against the VCF 9.1 documentation: components such as the license server are documented parts of the platform deployed in the management domain, HCX is part of VCF Operations, identity broker and software depot are VCF management services components, and DSM, Avi, vDefend, and Protection & Recovery are advanced services. SSP endpoints (SSP Installer, SSP Node/Service IP Pools) occur only in the vDefend product data and are therefore presented under vDefend. The project does not copy the diagram image, model latency thresholds, or claim that every port record is represented in the latency diagram. Use the official diagram and product documentation for latency requirements.

Matrix counts represent **source records**, not unique ports or firewall rules. Topology aliases are applied only by the explicit, tested rules in `topology.js`; they are not written back to the source snapshot or CSV export. “Both”, “bi-directional”, and other upstream classifications remain visible; the matrix does not invent reverse records. A blank matrix cell means no matching source record, not that traffic is forbidden or unnecessary.

The refresh command runs only on explicit request, not on page load or deployment. It writes the snapshot atomically after successful retrieval. Review mapping, coverage, and row changes before committing a refresh. Public API schemas may change.

The external-domains view derives its domain list only from text published in the snapshot (endpoint labels and service descriptions) and from the public, attributed KB 327186 article. Domains are never guessed or expanded beyond what the sources state, and the KB remains the authoritative list for depot and support URLs. Grouping treats vmware.com and legacy lastline.com (vDefend ATP cloud) as VMware-operated — VMware is a Broadcom division — while Dell/EMC, NVIDIA, Google, Microsoft, and CNCF domains remain third-party.

**Do not apply this dataset directly as a firewall policy.** Validate against the official tool, current product documentation, deployment topology, and enabled features. The project provides no guarantee of completeness or accuracy.

## Structure

- `index.html`, `styles.css`, `app.js`: single-page interface.
- `logic.js`: independently tested filtering, matrix aggregation, and CSV helpers.
- `topology.js`: tested logical component aliases, path selection, link aggregation, and highlighted port sets.
- `data/vcf-9.1.json`: source snapshot and coverage metadata.
- `data/kb327186-urls.json`: vendored public URL reference from Broadcom KB 327186 (`mise run refresh-kb-urls`).
- `vendor/`: locally hosted CDS design tokens, Clarity CSS, and upstream licenses.
- `scripts/`: snapshot refresh, KB reference refresh, and static build.
- `tests/`: dependency-free Node tests and an optional Camoufox UI smoke test.
- `mise.toml`: development tools and tasks.

## Third-party notices

Clarity CSS is vendored unmodified from `https://unpkg.com/@clr/ui@17.9.0/clr-ui.min.css` together with its required CDS design tokens from `https://unpkg.com/@cds/core@6.9.2/global.min.css`. Their MIT licenses are included in `vendor/CLARITY-LICENSE` and `vendor/CDS-LICENSE`. The Metropolis typeface (Clarity's brand font) is self-hosted from `@fontsource/metropolis@5.3.0`; its public-domain (Unlicense) notice is in `vendor/fonts/LICENSE`. Port data is attributed to Broadcom's public Ports and Protocols tool; no ownership or independent license over that source data is claimed. Review applicable upstream terms before redistributing it. No Broadcom branding or logo is used as this project's identity.

## Verification

`mise run build` runs the automated data/logic tests and syntax checks. For the optional browser smoke test, build first, then run `python tests/ui_smoke.py` using a Python environment with Camoufox and its browser installed. It serves `dist/` on an ephemeral localhost port, checks port-group expansion, list sorting/paging/details, matrix drilldown, URL restoration, empty states, and mobile overflow, and saves screenshots to a temporary directory. It uses a fresh browser context, not a personal profile. Camoufox is not required by the site or the normal build.

Desktop and mobile screenshots have been reviewed with Camoufox; this is not a comprehensive accessibility audit.
