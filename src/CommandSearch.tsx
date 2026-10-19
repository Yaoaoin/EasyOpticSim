import { useState } from "react";
import { Search } from "lucide-react";
import Modal from "./Modal";
import { allTabs, matchesQuery, sectionFor } from "./navigation";
import { findArticles } from "./help";
export default function CommandSearch({
  close,
  navigate,
  help,
}: {
  close: () => void;
  navigate: (tab: string) => void;
  help: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <Modal title="查找功能与帮助" onCancel={close}>
      <label className="search-box">
        <Search size={17} />
        <input
          autoFocus
          aria-label="查找功能与帮助"
          placeholder="输入名称，如：光圈扫描、图纸、非球面…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="command-results">
        <h3>功能入口</h3>
        {allTabs
          .filter((t) =>
            matchesQuery(t.join(" ") + " " + sectionFor(t[0]).label, query),
          )
          .map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                close();
                navigate(id);
              }}
            >
              <span>{label}</span>
              <small>{sectionFor(id).label}</small>
            </button>
          ))}
        <h3>使用说明</h3>
        {findArticles(query)
          .slice(0, 8)
          .map((a) => (
            <button
              key={a.id}
              onClick={() => {
                close();
                help(a.id);
              }}
            >
              {a.title}
            </button>
          ))}
      </div>
      <div className="dialog-actions">
        <button onClick={close}>关闭 · Esc</button>
      </div>
    </Modal>
  );
}
