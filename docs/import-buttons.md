# Skillful Import Buttons

Skillful supports import links for public GitHub repositories that contain skills and/or agents.

For GitHub READMEs and other Markdown surfaces, use the GitHub-safe HTTPS redirect URL:

```text
https://skillful.md/import/?repo=owner/repo&ref=main&path=skills/example&collection=My%20Skills
```

That page opens the native desktop deep link for the user:

```text
skillful://import?repo=owner/repo&ref=main&path=skills/example&collection=My%20Skills
```

Do not use `skillful://` directly in GitHub Markdown. GitHub may sanitize custom
protocol links, which makes the badge look correct but not open the app. Use the
HTTPS redirect unless you fully control the publishing surface.

## Parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `repo` | Yes | GitHub repository in `owner/repo` format |
| `ref` | No | Branch, tag, or commit |
| `path` | No | Subdirectory to import from the repository archive |
| `collection` | No | Suggested destination collection name |

## Generator

Use the web generator when you want a ready-to-copy README snippet:

- <https://skillful.md/generator/>

## Examples

```md
[![OpenAI skills](https://img.shields.io/badge/OpenAI%20skills-Import%20to%20Skillful-6c3cb4?style=for-the-badge)](https://skillful.md/import/?repo=openai/skills&collection=OpenAI%20Skills)
```

```md
[![GitHub Copilot skills inside awesome-copilot](https://img.shields.io/badge/GitHub%20Copilot%20skills%20inside%20awesome--copilot-Import%20to%20Skillful-6c3cb4?style=for-the-badge)](https://skillful.md/import/?repo=github/awesome-copilot&path=skills&collection=GitHub%20Copilot%20Skills)
```
