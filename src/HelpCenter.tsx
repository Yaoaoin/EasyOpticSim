import { useEffect, useRef, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import Modal from "./Modal";
import { articles, findArticles } from "./help";
import { allTabs } from "./navigation";
function Markdown({
  body,
  navigate,
  query,
}: {
  body: string;
  navigate: (id: string) => void;
  query: string;
}) {
  const terms = query.normalize("NFKC").trim().split(/\s+/).filter(Boolean);
  const highlight = (value: string) => {
    if (!terms.length) return value;
    const re = new RegExp(
      `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "gi",
    );
    return value
      .split(re)
      .map((t, i) => (i % 2 ? <mark key={i}>{t}</mark> : t));
  };
  // Documentation is bundled plain text: no injected HTML or remote scripts.
  const inline = (line: string) =>
    line.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g).map((s, i) => {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s);
      if (link)
        return link[2].startsWith("https://") ? (
          <a key={i} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        ) : (
          <button
            className="help-link"
            key={i}
            onClick={() => navigate(link[2].replace(/\.md(?:#.*)?$/, ""))}
          >
            {link[1]}
          </button>
        );
      if (s.startsWith("`")) return <code key={i}>{s.slice(1, -1)}</code>;
      if (s.startsWith("**")) return <strong key={i}>{s.slice(2, -2)}</strong>;
      return highlight(s);
    });
  let code = false;
  return body.split("\n").map((line, i) => {
    if (line.startsWith("```")) {
      code = !code;
      return null;
    }
    if (code) return <pre key={i}>{line || " "}</pre>;
    if (!line.trim()) return null;
    if (line.startsWith("### "))
      return <h3 key={i}>{inline(line.slice(4))}</h3>;
    if (line.startsWith("## ")) return <h2 key={i}>{inline(line.slice(3))}</h2>;
    if (line.startsWith("# ")) return <h1 key={i}>{inline(line.slice(2))}</h1>;
    if (/^[-*] /.test(line))
      return (
        <p className="help-bullet" key={i}>
          • {inline(line.slice(2))}
        </p>
      );
    return <p key={i}>{inline(line)}</p>;
  });
}
export default function HelpCenter({
  initial,
  close,
  onNavigate,
}: {
  initial: string;
  close: () => void;
  onNavigate: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(initial);
  const content = useRef<HTMLElement>(null);
  const results = findArticles(query),
    article = articles.find((a) => a.id === active) ?? articles[0];
  const open = (id: string) => {
    setActive(id);
    setQuery("");
  };
  const entry = allTabs.find((t) => t[2] === article.id);
  useEffect(() => {
    const pane = content.current,
      mark = pane?.querySelector("mark");
    if (pane) {
      pane.scrollTop = 0;
      if (mark && query)
        pane.scrollTop +=
          mark.getBoundingClientRect().top -
          pane.getBoundingClientRect().top -
          30;
    }
  }, [active, query]);
  const snippet = (body: string) => {
    const plain = body.replace(/[#*`]/g, "").replace(/\s+/g, " ");
    const at = plain
      .toLowerCase()
      .indexOf(query.trim().split(/\s+/)[0]?.toLowerCase() ?? "");
    return (
      (at > 30 ? "…" : "") +
      plain.slice(Math.max(0, at - 30), Math.max(0, at - 30) + 95) +
      "…"
    );
  };
  return (
    <Modal title="EasyOpticSim 帮助与教程" wide onCancel={close}>
      <div className="help-toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            autoFocus
            aria-label="检索使用说明"
            placeholder="搜索功能、术语或报错，例如：角落、MTF、无法采纳…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="清空帮助搜索" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
        </label>
        <button onClick={close}>
          <X size={15} />
          关闭
        </button>
      </div>
      <div className="help-layout">
        <nav aria-label="使用说明目录">
          {query && <p>{results.length} 篇匹配文档</p>}
          {results.map((a) => (
            <button
              className={a.id === active ? "active" : ""}
              key={a.id}
              onClick={() => setActive(a.id)}
            >
              <span>
                <BookOpen size={14} />
                {a.title}
              </span>
              {query && <small>{snippet(a.body)}</small>}
            </button>
          ))}
          {!results.length && <p>没有找到结果。试试“视场”“光圈”或“保存”。</p>}
        </nav>
        <article className="manual-content" ref={content} key={active}>
          <Markdown body={article.body} navigate={open} query={query} />
          {entry && (
            <button
              className="primary"
              onClick={() => {
                close();
                onNavigate(entry[0]);
              }}
            >
              前往 {entry[1]}
            </button>
          )}
        </article>
      </div>
    </Modal>
  );
}
