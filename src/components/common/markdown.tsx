import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders job-description markdown. react-markdown does NOT pass raw HTML through
 * (no rehype-raw here), so untrusted markup can't inject scripts — XSS-safe by default.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-rove">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
