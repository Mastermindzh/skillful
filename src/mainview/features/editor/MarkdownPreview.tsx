import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type MarkdownPreviewProps = {
  value: string;
};

/**
 * Allow-list schema that starts from rehype-sanitize defaults and keeps class attributes
 * so syntax-highlighted code blocks and tables still render correctly. We do not allow
 * inline `style`, raw HTML that could include scripts, or custom data-* attributes that
 * would expose DOM-clobbering surface.
 */
const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
  },
};

function stripFrontmatter(value: string) {
  return value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export function MarkdownPreview({ value }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {stripFrontmatter(value)}
      </ReactMarkdown>
    </div>
  );
}
