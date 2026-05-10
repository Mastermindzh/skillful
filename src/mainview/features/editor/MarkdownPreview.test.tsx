import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

/**
 * Renders the component via `renderToStaticMarkup` so the test stays in a Node environment.
 * This is sufficient to assert the rehype-sanitize allow-list because sanitization happens
 * during the markdown → hast transform, which is identical on the server and the client.
 */
function render(markdown: string) {
  return renderToStaticMarkup(React.createElement(MarkdownPreview, { value: markdown }));
}

describe("MarkdownPreview sanitization", () => {
  it("strips <script> tags from raw HTML", () => {
    const html = render("Before\n\n<script>alert(1)</script>\n\nAfter");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("drops onerror / onclick inline event handlers on raw HTML", () => {
    const html = render('<img src="x" onerror="alert(1)" />');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
  });

  it("rejects javascript: URLs on links", () => {
    const html = render("[click me](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("alert(1)");
  });

  it("keeps className on <code> (needed for syntax highlighting)", () => {
    const html = render("```ts\nconst x = 1;\n```\n");
    expect(html).toMatch(/<code[^>]*class="[^"]*language-ts/);
  });

  it('applies target="_blank" rel="noreferrer" to rendered links', () => {
    const html = render("[skillful](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('href="https://example.com"');
  });

  it("strips YAML frontmatter before rendering", () => {
    const markdown = ["---", "name: Skill", "description: desc", "---", "", "# Heading"].join("\n");
    const html = render(markdown);
    expect(html).not.toContain("name: Skill");
    expect(html).toContain("Heading");
  });

  it("renders GFM tables via remark-gfm", () => {
    const markdown = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");
    const html = render(markdown);
    expect(html).toContain("<table");
    expect(html).toContain("<td>1</td>");
  });

  it("drops inline style attributes", () => {
    const html = render('<p style="background:url(javascript:alert(1))">hi</p>');
    expect(html).not.toContain("style=");
    expect(html).not.toContain("javascript:");
  });
});
