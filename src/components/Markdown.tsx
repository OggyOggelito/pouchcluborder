import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Long-form brand content.
 *
 * react-markdown renders to React elements and ignores raw HTML unless a plugin
 * enables it, so nothing here reaches dangerouslySetInnerHTML. Styling is
 * per-element rather than via a typography plugin, to keep the dependency list
 * short.
 *
 * remark-gfm is loaded for tables — plain react-markdown renders a pipe table
 * as literal pipes, which is how the ZONE strength key first shipped.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    // prose-measure caps the line at ~65ch. It does nothing on a phone, where
    // the viewport is already narrower than that, and stops long Swedish
    // paragraphs running the full width of a desktop sidebar layout.
    <div className="prose-measure space-y-4 text-[17px] leading-relaxed text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="pt-2 text-xl font-semibold tracking-tight text-ink">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="pt-2 text-lg font-semibold tracking-tight text-ink">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="pt-1 font-semibold tracking-tight text-ink">{children}</h4>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-line pl-4 text-muted">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-sm">{children}</code>
          ),
          a: ({ href, children }) => {
            // Cross-links between brand pages stay in the tab; only links off
            // the site open a new one.
            const external = Boolean(href && /^https?:\/\//i.test(href));
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="underline underline-offset-4"
              >
                {children}
              </a>
            );
          },
          hr: () => <hr className="border-line" />,
          table: ({ children }) => (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full border-collapse text-[15px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-line">{children}</thead>,
          th: ({ children }) => (
            <th className="px-2 py-2 text-left text-sm font-semibold text-muted">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-line px-2 py-2 align-top">{children}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
