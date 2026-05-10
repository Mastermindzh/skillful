#!/usr/bin/env -S npx tsx
/**
 * Generates a collection with a configurable number of skills and agents.
 *
 * Usage:
 *   npx tsx scripts/generate-collection.ts [options]
 *
 * Options:
 *   --name    Collection folder name (default: "generated-collection")
 *   --count   Total number of items to generate (default: 1000)
 *   --root    Scan root directory (default: ~/.skillful)
 *   --ratio   Ratio of skills to agents, e.g. "0.7" = 70% skills (default: 0.6)
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// ── CLI args ──────────────────────────────────────────────────────────
function arg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const COLLECTION_NAME = arg("--name", "generated-collection");
const TOTAL_ITEMS = Number(arg("--count", "1000"));
const SCAN_ROOT = arg("--root", path.join(os.homedir(), ".skillful-stress-test"));
const SKILL_RATIO = Number(arg("--ratio", "0.6"));

const SKILL_COUNT = Math.round(TOTAL_ITEMS * SKILL_RATIO);
const AGENT_COUNT = TOTAL_ITEMS - SKILL_COUNT;

// ── Vocabulary for random names ───────────────────────────────────────
const ADJECTIVES = [
  "fast", "smart", "lazy", "clever", "robust", "elegant", "precise",
  "dynamic", "minimal", "verbose", "strict", "flexible", "async",
  "reactive", "parallel", "atomic", "fluent", "modular", "secure", "lean",
];

const SKILL_NOUNS = [
  "reviewer", "linter", "formatter", "debugger", "optimizer", "refactorer",
  "scanner", "migrator", "deployer", "profiler", "documenter", "transpiler",
  "bundler", "validator", "generator", "analyzer", "compiler", "parser",
  "serializer", "transformer",
];

const AGENT_NOUNS = [
  "triage-agent", "release-agent", "review-agent", "merge-agent",
  "deploy-agent", "monitor-agent", "alert-agent", "backup-agent",
  "cleanup-agent", "onboard-agent", "audit-agent", "report-agent",
  "sync-agent", "rollback-agent", "hotfix-agent", "notify-agent",
  "schedule-agent", "provision-agent", "scale-agent", "patch-agent",
];

const DOMAINS = [
  "TypeScript", "React", "Node.js", "Python", "Rust", "Go", "CSS",
  "SQL", "GraphQL", "Docker", "Kubernetes", "CI/CD", "REST API",
  "WebSocket", "gRPC", "Redis", "PostgreSQL", "MongoDB", "AWS", "Git",
];

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function titleCase(s: string): string {
  return s.replace(/(^|\s|-)\w/g, (c) => c.toUpperCase());
}

// ── Content generators ────────────────────────────────────────────────
function skillContent(index: number): { slug: string; markdown: string } {
  const adj = pick(ADJECTIVES, index);
  const noun = pick(SKILL_NOUNS, index);
  const domain = pick(DOMAINS, index + 3);
  const slug = `${adj}-${noun}-${index + 1}`;
  const title = titleCase(`${adj} ${noun}`);
  const description = `A skill that helps with ${adj} ${noun.replace("-", " ")} tasks in ${domain} projects.`;

  const markdown = `---
name: "${title}"
description: "${description}"
---

# ${title}

${description}

## When to use

Use this skill when you need to perform ${adj} ${noun.replace("-", " ")} operations on ${domain} codebases.

## Instructions

1. Analyze the current ${domain} project structure.
2. Identify areas that need ${adj} ${noun.replace("-", " ")}.
3. Apply the recommended changes.
4. Verify the results meet quality standards.
`;

  return { slug, markdown };
}

function agentContent(index: number): { slug: string; markdown: string } {
  const adj = pick(ADJECTIVES, index + 7);
  const noun = pick(AGENT_NOUNS, index);
  const domain = pick(DOMAINS, index + 5);
  const slug = `${adj}-${noun}-${index + 1}`;
  const title = titleCase(`${adj} ${noun}`);
  const description = `An agent that handles ${adj} ${noun.replace("-agent", "")} workflows for ${domain} systems.`;

  const markdown = `---
name: "${title}"
description: "${description}"
---

# ${title}

${description}

## Responsibilities

- Monitor ${domain} projects for ${noun.replace("-agent", "")} opportunities.
- Automatically perform ${adj} ${noun.replace("-agent", "")} when conditions are met.
- Report results and escalate issues when needed.

## Configuration

This agent works best with ${domain} projects that follow standard conventions.
`;

  return { slug, markdown };
}

async function main() {
  const skillsDir = path.join(SCAN_ROOT, "skills", COLLECTION_NAME);
  const agentsDir = path.join(SCAN_ROOT, "agents", COLLECTION_NAME);

  console.log(`Generating collection "${COLLECTION_NAME}" at ${SCAN_ROOT}`);
  console.log(`  Skills: ${SKILL_COUNT}, Agents: ${AGENT_COUNT} (total: ${TOTAL_ITEMS})`);

  // Create skills
  for (let i = 0; i < SKILL_COUNT; i++) {
    const { slug, markdown } = skillContent(i);
    const dir = path.join(skillsDir, slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "SKILL.md"), markdown, "utf-8");
  }

  // Create agents
  for (let i = 0; i < AGENT_COUNT; i++) {
    const { slug, markdown } = agentContent(i);
    const dir = path.join(agentsDir, slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "AGENT.md"), markdown, "utf-8");
  }

  console.log(`Done! Created ${SKILL_COUNT} skills and ${AGENT_COUNT} agents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
