import ReactMarkdown from "react-markdown";

/**
 * Long-form brand content.
 *
 * react-markdown renders to React elements and ignores raw HTML unless a plugin
 * enables it, so nothing here reaches dangerouslySetInnerHTML. Styling is
 * per-element rather than via a typography plugin, to keep the dependency list
 * short.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-4 text-[17px] leading-relaxed text-zinc-700">
      <ReactMarkdown
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
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-zinc-200" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
