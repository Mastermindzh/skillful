#!/usr/bin/env node
// Prints the CHANGELOG.md section for one version as GitHub release notes.
// Relative links are rewritten to the tagged commit, because release notes cannot resolve them.
//
//   node scripts/release-notes.mjs v1.3.0 > release-notes.md
import { readFileSync } from "node:fs";

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: node scripts/release-notes.mjs <tag>");
  process.exit(1);
}

const repository = process.env.GITHUB_REPOSITORY || "Mastermindzh/skillful";
const version = tag.replace(/^v/, "");
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

const lines = changelog.split("\n");
const start = lines.findIndex((line) =>
  new RegExp(`^## ${version.replaceAll(".", "\\.")}\\b`).test(line)
);
if (start === -1) {
  console.error(`::warning::CHANGELOG.md has no section for ${version}.`);
  console.log(`See [CHANGELOG.md](https://github.com/${repository}/blob/${tag}/CHANGELOG.md).`);
  process.exit(0);
}
const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
const section = lines
  .slice(start + 1, end === -1 ? undefined : end)
  .join("\n")
  .trim();

// `![alt](./docs/x.png)` points at the raw file; `[text](./docs/x.md)` at the rendered page.
const relativeLink = /(!?)\[([^\]]*)\]\((?:\.\/)?(?!https?:|#|mailto:)([^)\s]+)\)/g;
const notes = section.replace(relativeLink, (_match, image, text, target) => {
  const base = image
    ? `https://raw.githubusercontent.com/${repository}/${tag}`
    : `https://github.com/${repository}/blob/${tag}`;
  return `${image}[${text}](${base}/${target})`;
});

console.log(notes);
