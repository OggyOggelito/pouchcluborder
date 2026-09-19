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
    <div className="space-y-4 text-[17px] leading-relaxed text-zinc-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="pt-2 text-xl font-semibold tracking-tight text-zinc-900">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="pt-2 text-lg font-semibold tracking-tight text-zinc-900">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="pt-1 font-semibold tracking-tight text-zinc-900">{children}</h4>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-900">{children}</strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-zinc-200 pl-4 text-zinc-500">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm">{children}</code>
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
          hr: () => <hr className="border-zinc-200" />,
          table: ({ children }) => (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full border-collapse text-[15px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-zinc-200">{children}</thead>,
          th: ({ children }) => (
            <th className="px-2 py-2 text-left text-sm font-semibold text-zinc-500">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-zinc-100 px-2 py-2 align-top">{children}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
