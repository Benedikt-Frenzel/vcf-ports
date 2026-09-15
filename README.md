# VCF 9.1 Communication Matrix

An English-language, static communication explorer using [Clarity Design](https://clarity.design/) (`@clr/ui` 17.9.0). Ready for GitHub Pages, including repository subpaths. No backend, runtime CDN, analytics, npm dependencies, or build bundler.

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
- Product, exact mapped release, protocol, classification, source, and destination filters.
- Interactive infrastructure diagram inspired by the official VCF 9.1 Fleet Latency diagram, with nested Fleet Services, Management Domain, Workload Infrastructure, Platform Services, and External Systems boxes. Select a component to draw its direct paths; select a connected box or path to isolate it and label its ports/protocols directly on the link.
- Paginated connection list with original service descriptions and source record IDs.
- Source × destination matrix with independently paginated axes; select a populated cell to inspect its connections.
- Filtered CSV export with quoting, UTF-8 BOM, and spreadsheet formula mitigation.
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

The diagram layout is informed by Broadcom's public **VMware Cloud Foundation 9.1 Fleet Latency Logical Diagram v3**, available in the official tool's [VMware Cloud Foundation network diagrams](https://ports.broadcom.com/network-diagrams/VMware-Cloud-Foundation). The project does not copy that image, model latency thresholds, or claim that every port record is represented in the latency diagram. Use the official diagram and product documentation for latency requirements.

Matrix counts represent **source records**, not unique ports or firewall rules. Topology aliases are applied only by the explicit, tested rules in `topology.js`; they are not written back to the source snapshot or CSV export. “Both”, “bi-directional”, and other upstream classifications remain visible; the matrix does not invent reverse records. A blank matrix cell means no matching source record, not that traffic is forbidden or unnecessary.

The refresh command runs only on explicit request, not on page load or deployment. It writes the snapshot atomically after successful retrieval. Review mapping, coverage, and row changes before committing a refresh. Public API schemas may change.

**Do not apply this dataset directly as a firewall policy.** Validate against the official tool, current product documentation, deployment topology, and enabled features. The project provides no guarantee of completeness or accuracy.

## Structure

- `index.html`, `styles.css`, `app.js`: single-page interface.
- `logic.js`: independently tested filtering, matrix aggregation, and CSV helpers.
- `topology.js`: tested logical component aliases, path selection, link aggregation, and highlighted port sets.
- `data/vcf-9.1.json`: source snapshot and coverage metadata.
- `vendor/`: locally hosted Clarity CSS and its upstream license.
- `scripts/`: snapshot refresh and static build.
- `tests/`: dependency-free Node tests.
- `mise.toml`: development tools and tasks.

## Third-party notices

Clarity CSS is vendored unmodified from `https://unpkg.com/@clr/ui@17.9.0/clr-ui.min.css`. Its MIT license is included in `vendor/CLARITY-LICENSE` (from the upstream v17.9.0 tag). Port data is attributed to Broadcom's public Ports and Protocols tool; no ownership or independent license over that source data is claimed. Review applicable upstream terms before redistributing it. No Broadcom branding or logo is used as this project's identity.

## Verification

`mise run build` runs the automated data/logic tests and syntax checks. Browser-level visual and accessibility testing is separate; it has not been performed in this environment because no Cameofox browser tool is attached.
