/**
 * Accessibility tests for the VCF Ports landing shell.
 *
 * Loads index.html + theme.js in jsdom (no network, app.js module omitted) and
 * runs axe-core plus structural checks for the shared chrome. Dynamic explorer
 * content is covered by the optional Camoufox UI smoke test.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const axe = require("axe-core");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadPage() {
  let html = fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  html = html.replace(/<link rel="stylesheet"[^>]*>\n?/g, "");
  // Offline shell only: drop the ES module app entry (needs fetch + layout).
  html = html.replace(/<script type="module"[^>]*><\/script>\n?/g, "");

  const themeJs = fs.readFileSync(path.join(REPO_ROOT, "theme.js"), "utf8");
  assert.ok(!themeJs.includes("</script"), "theme.js must not contain a closing script tag");
  html = html.replace(
    '<script src="theme.js"></script>',
    "<script>\n" + themeJs + "\n</script>"
  );

  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      });
    },
  });

  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

async function runAxe(dom) {
  const { window } = dom;
  window.eval(axe.source);
  return window.axe.run(window.document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "best-practice"] },
    rules: { "color-contrast": { enabled: false } },
  });
}

function formatViolations(violations) {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    - ${n.target.join(", ")}: ${n.failureSummary}`)
        .join("\n");
      return `${v.id} (${v.impact}): ${v.help}\n${nodes}`;
    })
    .join("\n\n");
}

test("axe-core finds no WCAG 2 A/AA violations on the page shell", async () => {
  const dom = loadPage();
  const results = await runAxe(dom);
  assert.equal(
    results.violations.length,
    0,
    `axe violations:\n${formatViolations(results.violations)}`
  );
  dom.window.close();
});

test("document language, landmarks, and heading hierarchy are in place", () => {
  const dom = loadPage();
  const doc = dom.window.document;

  assert.equal(doc.documentElement.lang, "en");
  assert.ok(doc.querySelector('a.skip[href="#main"]'), "skip link targets #main");
  assert.ok(doc.getElementById("main"), "#main landmark target exists");
  assert.equal(doc.querySelector("main")?.id, "main");
  assert.equal(doc.querySelector('nav[aria-label="Primary navigation"]')?.tagName, "NAV");
  assert.equal(doc.querySelector("h1")?.textContent.includes("Communication matrix"), true);
  assert.ok(doc.querySelector('aside[aria-label="Disclaimer"]'));

  const headings = [...doc.querySelectorAll("h1, h2, h3")].map((el) => ({
    level: Number(el.tagName[1]),
    text: el.textContent.trim(),
  }));
  assert.equal(headings[0].level, 1, "first heading must be h1");
  for (let i = 1; i < headings.length; i++) {
    assert.ok(
      headings[i].level <= headings[i - 1].level + 1,
      `heading level jump: ${headings[i - 1].text} (h${headings[i - 1].level}) → ${headings[i].text} (h${headings[i].level})`
    );
  }

  dom.window.close();
});

test("primary nav marks Ports as current and names the home link", () => {
  const dom = loadPage();
  const doc = dom.window.document;

  assert.ok(doc.querySelector('header .branding a[aria-label="VCF Tools home"]'));
  const active = doc.querySelector("header .header-actions .nav-link.active");
  assert.equal(active?.textContent.trim(), "Ports");
  assert.equal(active?.getAttribute("aria-current"), "page");

  const labels = [...doc.querySelectorAll("header .header-actions .nav-link")].map((a) =>
    a.textContent.trim()
  );
  assert.deepEqual(labels, ["Overview", "Ports", "Compliance", "Feedback ✉", "GitHub ↗"]);

  dom.window.close();
});

test("theme switcher exposes a pressed state and updates on click", () => {
  const dom = loadPage();
  const doc = dom.window.document;
  const root = doc.getElementById("theme-switcher");

  assert.ok(root);
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(root.getAttribute("aria-label"), "Color theme");

  const buttons = [...root.querySelectorAll("button[data-theme]")];
  assert.deepEqual(
    buttons.map((b) => b.dataset.theme),
    ["light", "dark", "system"]
  );

  assert.equal(buttons.find((b) => b.dataset.theme === "system")?.getAttribute("aria-pressed"), "true");
  buttons.find((b) => b.dataset.theme === "dark").click();
  assert.equal(buttons.find((b) => b.dataset.theme === "dark")?.getAttribute("aria-pressed"), "true");
  assert.equal(buttons.find((b) => b.dataset.theme === "system")?.getAttribute("aria-pressed"), "false");
  assert.equal(doc.body.getAttribute("cds-theme"), "dark");
  assert.equal(dom.window.localStorage.getItem("vcf-tools.theme"), "dark");

  dom.window.close();
});

test("interactive controls in the shell are named and no positive tabindex is used", () => {
  const dom = loadPage();
  const doc = dom.window.document;

  const positiveTabindex = [...doc.querySelectorAll("[tabindex]")].filter(
    (el) => Number(el.getAttribute("tabindex")) > 0
  );
  assert.deepEqual(
    positiveTabindex.map((el) => el.outerHTML.slice(0, 80)),
    [],
    "positive tabindex values create a custom tab order"
  );

  for (const el of doc.querySelectorAll("a, button")) {
    const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
    assert.ok(name, `unnamed interactive element: ${el.outerHTML.slice(0, 120)}`);
  }

  for (const el of doc.querySelectorAll("[aria-hidden='true']")) {
    assert.equal(
      el.querySelectorAll("a, button, input, select, textarea").length,
      0,
      "aria-hidden must not wrap focusable controls"
    );
  }

  dom.window.close();
});
