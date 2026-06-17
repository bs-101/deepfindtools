import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const api = {
  async get(path) {
    const response = await fetch(path);
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    if (!response.ok) {
      throw new Error(path);
    }
    return response.json();
  },
  async send(path, method, body) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  },
};

function useData(includeDrafts = false) {
  const [data, setData] = useState({ tools: [], categories: [], news: [], loading: true });

  async function load() {
    try {
      const query = includeDrafts ? "?includeDrafts=1" : "";
      const [tools, categories, news] = await Promise.all([
        api.get(`/api/tools${query}`),
        api.get("/api/categories"),
        api.get(`/api/news${query}`),
      ]);
      setData({ tools, categories, news, loading: false });
    } catch (error) {
      if (error.message === "UNAUTHORIZED") {
        throw error;
      }
      const seed = await api.get("/data/seed.json");
      setData({ tools: seed.tools || [], categories: seed.categories || [], news: seed.news || [], loading: false });
    }
  }

  useEffect(() => {
    load().catch(() => setData((current) => ({ ...current, loading: false })));
  }, [includeDrafts]);

  return { ...data, reload: load };
}

function categoryName(categories, id) {
  return categories.find((category) => category.id === id)?.name || "未分类";
}

function Logo({ tool, size = "normal" }) {
  const [failed, setFailed] = useState(false);
  const hasLogo = Boolean(tool?.logo && !failed);
  return (
    <span className={`logo-orb ${size === "small" ? "logo-orb-small" : ""} ${hasLogo ? "has-logo" : "is-empty"}`}>
      {hasLogo ? <img src={tool.logo} alt="" loading="lazy" onError={() => setFailed(true)} /> : null}
    </span>
  );
}

function sectionId(id) {
  return id === "all" ? "tools-index" : `category-${id}`;
}

function SpotlightCard({ className = "", children, as: Tag = "article", ...props }) {
  const ref = useRef(null);

  function onPointerMove(event) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    ref.current.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    ref.current.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    <Tag ref={ref} onPointerMove={onPointerMove} className={`spotlight-card ${className}`} {...props}>
      {children}
    </Tag>
  );
}

function HomePage() {
  const { tools, categories, news, loading } = useData(false);
  const [activeSection, setActiveSection] = useState("all");
  const [sort, setSort] = useState("featured");
  const [query, setQuery] = useState("");
  const [newsFilter, setNewsFilter] = useState("all");

  function scrollToCategory(id) {
    setActiveSection(id);
    document.getElementById(sectionId(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const categoryItems = useMemo(() => {
    const all = { id: "all", name: "全部工具", icon: "A", count: tools.length };
    return [all].concat(
      categories.map((item) => ({
        ...item,
        count: tools.filter((tool) => tool.category === item.id).length,
      })),
    );
  }, [categories, tools]);

  const sortedTools = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tools
      .filter((tool) => {
        if (!keyword) return true;
        return [tool.name, tool.summary, categoryName(categories, tool.category), ...(tool.tags || [])]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => {
        if (sort === "new") return Number(b.isNew) - Number(a.isNew) || String(b.id).localeCompare(String(a.id));
        if (sort === "popular") return Number(b.featured) - Number(a.featured) || String(a.name).localeCompare(String(b.name));
        return Number(b.featured) - Number(a.featured) || Number(b.isNew) - Number(a.isNew);
      });
  }, [tools, categories, query, sort]);

  const filteredNews = news.filter((item) => item.status !== "draft" && (newsFilter === "all" || item.kind === newsFilter));
  const featuredTools = tools.filter((tool) => tool.featured).slice(0, 12);
  const latestTools = tools.filter((tool) => tool.isNew).slice(0, 8);
  const homeSections = categories.filter((item) => tools.some((tool) => tool.category === item.id));
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.name, item.id])), [categories]);
  const quickLinks = [
    { label: "AI写作", category: "AI写作工具" },
    { label: "AI图像", category: "AI图像工具" },
    { label: "AI视频", category: "AI视频工具" },
    { label: "AI办公", category: "AI办公工具" },
    { label: "AI编程", category: "AI编程工具" },
    { label: "AI搜索", category: "AI搜索引擎" },
  ];

  return (
    <div className="app-frame">
      <aside className="rail">
        <a className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            <strong>DeepFind</strong>
            <small>AI tools directory</small>
          </span>
        </a>

        <div className="rail-section">
          <p className="rail-label">AI 工具分类</p>
          <nav className="category-stack" aria-label="工具分类">
            {categoryItems.map((item) => (
              <button
                className={`category-tune ${activeSection === item.id ? "active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => scrollToCategory(item.id)}
              >
                <span className="category-code">{item.icon || item.name.slice(0, 1)}</span>
                <span>{item.name}</span>
                <small>{item.count}</small>
              </button>
            ))}
          </nav>
        </div>

        <div className="rail-footer">
          <span>目录结构</span>
          <strong>首页推荐 / 分类索引 / 每日资讯</strong>
        </div>
      </aside>

      <main className="workspace">
        <section className="hero-zone">
          <SpotlightCard className="hero-copy" as="div">
            <p className="eyebrow">AI tools directory</p>
            <h1>AI 工具导航</h1>
            <p>
              汇总常用 AI 写作、图像、视频、办公、聊天、智能体、编程、搜索和学习资源。按目录浏览、按关键词检索，快速找到适合当前任务的工具。
            </p>
            <div className="command-bar">
              <span>搜索</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工具名称、标签或使用场景" />
              <button type="button" onClick={() => setQuery("")}>
                清空
              </button>
            </div>
            <div className="quick-links" aria-label="常用入口">
              {quickLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (categoryMap.has(item.category)) scrollToCategory(categoryMap.get(item.category));
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </SpotlightCard>

          <SpotlightCard className="directory-panel" as="div">
            <div className="directory-card-head">
              <p className="eyebrow">site index</p>
              <h2>工具目录层级</h2>
              <p>参考成熟 AI 工具导航的信息组织方式，重组为适合本项目上线的原创白色界面。</p>
            </div>
            <div className="directory-stats">
              <div>
                <strong>{tools.length}</strong>
                <span>收录工具</span>
              </div>
              <div>
                <strong>{categories.length}</strong>
                <span>一级分类</span>
              </div>
              <div>
                <strong>{news.length}</strong>
                <span>每日资讯</span>
              </div>
            </div>
            <div className="directory-channels">
              {categories.slice(0, 8).map((item) => (
                <button key={item.id} type="button" onClick={() => scrollToCategory(item.id)}>
                  <span>{item.icon || item.name.slice(0, 1)}</span>
                  {item.name}
                </button>
              ))}
            </div>
          </SpotlightCard>
        </section>

        <section className="control-strip">
          <div className="segment">
            {[
              ["featured", "推荐"],
              ["new", "最新"],
              ["popular", "热门"],
            ].map(([id, label]) => (
              <button key={id} className={sort === id ? "active" : ""} type="button" onClick={() => setSort(id)}>
                {label}
              </button>
            ))}
          </div>
          <p>{loading ? "正在接收工具信号..." : `显示 ${query.trim() ? sortedTools.length : tools.length} / ${tools.length} 个工具`}</p>
        </section>

        {query.trim() ? (
          <ToolSection id="search-results" title="搜索结果" subtitle={`匹配 ${sortedTools.length} 个工具`} tools={sortedTools.slice(0, 80)} categories={categories} />
        ) : (
          <>
            <div id="tools-index" className="home-feature-grid scroll-anchor">
              <ToolSection title="热门工具" subtitle="近期更常被推荐和使用的 AI 工具" tools={featuredTools} categories={categories} />
              <ToolSection title="最新收录" subtitle="新加入工具库的产品和项目" tools={latestTools} categories={categories} compact />
            </div>
            {homeSections.map((item) => (
              <ToolSection
                key={item.id}
                id={sectionId(item.id)}
                title={item.name}
                subtitle={`收录 ${tools.filter((tool) => tool.category === item.id).length} 个相关工具`}
                tools={sortedTools.filter((tool) => tool.category === item.id)}
                categories={categories}
              />
            ))}
          </>
        )}

        <section id="daily" className="briefing">
          <div className="section-title">
            <div>
              <p className="eyebrow">daily pulse</p>
              <h2>每日 AI 资讯</h2>
            </div>
            <div className="segment">
              {["all", "资讯", "项目", "教程"].map((item) => (
                <button key={item} className={newsFilter === item ? "active" : ""} type="button" onClick={() => setNewsFilter(item)}>
                  {item === "all" ? "全部" : item}
                </button>
              ))}
            </div>
          </div>
          <div className="news-lanes">
            {filteredNews.map((item) => (
              <SpotlightCard className="news-tile" key={item.id || item.title}>
                <time>{item.publishedAt || "今日"}</time>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                <span>{item.kind || "资讯"}</span>
              </SpotlightCard>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ToolSection({ id, title, subtitle, tools, categories, compact = false }) {
  if (!tools.length) return null;
  return (
    <section id={id} className={`tool-section ${compact ? "compact-section" : ""} scroll-anchor`}>
      <div className="section-title">
        <div>
          <p className="eyebrow">directory</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="section-more">{tools.length} 项</span>
      </div>
      <div className={`tool-matrix ${compact ? "compact-matrix" : ""}`}>
        {tools.map((tool) => (
          <ToolCard key={`${title}-${tool.id}-${tool.name}`} tool={tool} category={categoryName(categories, tool.category)} />
        ))}
      </div>
    </section>
  );
}

function ToolCard({ tool, category }) {
  const href = tool.url || tool.detailUrl || "#";
  return (
    <SpotlightCard className="tool-tile" as="a" href={href} target="_blank" rel="noreferrer" aria-label={`打开 ${tool.name}`}>
      <div className="tool-head">
        <Logo tool={tool} />
        <div>
          <h3>{tool.name}</h3>
          <small>{category}</small>
        </div>
      </div>
      <p>{tool.summary || "暂无简介，可在后台补充。"}</p>
      <div className="chips">
        {(tool.tags || []).slice(0, 3).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="tool-actions">
        <span>{tool.isNew ? "新收录" : tool.featured ? "热门" : "收录"}</span>
      </div>
    </SpotlightCard>
  );
}

function LoginPage() {
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ username: "admin", password: "" });

  async function submit(event) {
    event.preventDefault();
    try {
      await api.send("/api/login", "POST", form);
      window.location.href = "/admin";
    } catch (error) {
      setMessage("用户名或密码不正确");
    }
  }

  return (
    <main className="login-screen">
      <SpotlightCard className="login-card" as="section">
        <a className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            <strong>DeepFind Admin</strong>
            <small>private console</small>
          </span>
        </a>
        <div>
          <p className="eyebrow">restricted access</p>
          <h1>登录后维护工具和资讯</h1>
          <p>默认账号 admin / admin123。上线前用环境变量替换为强密码。</p>
        </div>
        <form className="console-form" onSubmit={submit}>
          <label>
            用户名
            <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="username" />
          </label>
          <label>
            密码
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="current-password"
              placeholder="admin123"
            />
          </label>
          <button type="submit">登录后台</button>
          <p className="form-message">{message}</p>
        </form>
      </SpotlightCard>
    </main>
  );
}

function AdminPage() {
  const { tools, categories, news, loading, reload } = useData(true);
  const [toolQuery, setToolQuery] = useState("");
  const [newsQuery, setNewsQuery] = useState("");
  const [toolForm, setToolForm] = useState(emptyTool());
  const [newsForm, setNewsForm] = useState(emptyNews());
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("/api/session").then((session) => {
      if (!session.authenticated) window.location.href = "/login";
    });
  }, []);

  function updateTool(key, value) {
    setToolForm((current) => ({ ...current, [key]: value }));
  }

  function updateNews(key, value) {
    setNewsForm((current) => ({ ...current, [key]: value }));
  }

  async function saveTool(event) {
    event.preventDefault();
    const payload = {
      ...toolForm,
      tags: String(toolForm.tags || "")
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      featured: toolForm.featured === "true",
      isNew: toolForm.isNew === "true",
    };
    await api.send(payload.id ? `/api/tools/${encodeURIComponent(payload.id)}` : "/api/tools", payload.id ? "PUT" : "POST", payload);
    setMessage("工具已保存");
    setToolForm(emptyTool());
    await reload();
  }

  async function saveNews(event) {
    event.preventDefault();
    await api.send(newsForm.id ? `/api/news/${encodeURIComponent(newsForm.id)}` : "/api/news", newsForm.id ? "PUT" : "POST", newsForm);
    setMessage("资讯已保存");
    setNewsForm(emptyNews());
    await reload();
  }

  async function remove(collection, id) {
    await api.send(`/api/${collection}/${encodeURIComponent(id)}`, "DELETE", {});
    await reload();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const shownTools = tools.filter((tool) => [tool.name, tool.summary, categoryName(categories, tool.category)].join(" ").toLowerCase().includes(toolQuery.toLowerCase()));
  const shownNews = news.filter((item) => [item.title, item.summary, item.kind].join(" ").toLowerCase().includes(newsQuery.toLowerCase()));

  if (loading) return <main className="loading-screen">正在打开后台...</main>;

  return (
    <div className="admin-frame">
      <aside className="rail admin-rail">
        <a className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            <strong>DeepFind Admin</strong>
            <small>工具与资讯管理</small>
          </span>
        </a>
        <button className="rail-action" type="button" onClick={() => (window.location.href = "/")}>
          查看前台
        </button>
        <button className="rail-action ghost" type="button" onClick={logout}>
          退出登录
        </button>
        <p className="rail-note">后台写入 PostgreSQL；前台不会暴露入口。</p>
      </aside>

      <main className="admin-workspace">
        <header className="admin-top">
          <div>
            <p className="eyebrow">admin console</p>
            <h1>维护 AI 工具和每日资讯</h1>
          </div>
          <span>{tools.length} 工具 / {news.length} 资讯</span>
        </header>

        <section className="admin-grid">
          <SpotlightCard className="editor-panel" as="section">
            <h2>{toolForm.id ? `编辑工具：${toolForm.name}` : "新增工具"}</h2>
            <form className="console-form" onSubmit={saveTool}>
              <label>工具名称<input value={toolForm.name} onChange={(e) => updateTool("name", e.target.value)} required /></label>
              <label>官网链接<input value={toolForm.url} onChange={(e) => updateTool("url", e.target.value)} required /></label>
              <label>Logo 地址<input value={toolForm.logo} onChange={(e) => updateTool("logo", e.target.value)} /></label>
              <div className="form-pair">
                <label>分类<select value={toolForm.category} onChange={(e) => updateTool("category", e.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>状态<select value={toolForm.status} onChange={(e) => updateTool("status", e.target.value)}><option value="published">发布</option><option value="draft">草稿</option></select></label>
              </div>
              <label>标签<input value={toolForm.tags} onChange={(e) => updateTool("tags", e.target.value)} placeholder="写作, 免费, 生成" /></label>
              <label>简介<textarea value={toolForm.summary} onChange={(e) => updateTool("summary", e.target.value)} rows="4" /></label>
              <div className="form-pair">
                <label>推荐<select value={toolForm.featured} onChange={(e) => updateTool("featured", e.target.value)}><option value="false">否</option><option value="true">是</option></select></label>
                <label>新收录<select value={toolForm.isNew} onChange={(e) => updateTool("isNew", e.target.value)}><option value="true">是</option><option value="false">否</option></select></label>
              </div>
              <div className="form-actions"><button type="submit">保存工具</button><button type="button" onClick={() => setToolForm(emptyTool())}>清空</button></div>
            </form>
          </SpotlightCard>

          <SpotlightCard className="list-panel" as="section">
            <div className="panel-head"><h2>工具库</h2><input value={toolQuery} onChange={(e) => setToolQuery(e.target.value)} placeholder="搜索工具" /></div>
            <div className="admin-list">
              {shownTools.slice(0, 160).map((tool) => (
                <AdminRow key={tool.id} item={tool} meta={`${categoryName(categories, tool.category)} · ${tool.status || "published"}`} onEdit={() => setToolForm({ ...tool, tags: (tool.tags || []).join(", "), featured: String(Boolean(tool.featured)), isNew: String(Boolean(tool.isNew)) })} onDelete={() => remove("tools", tool.id)} />
              ))}
            </div>
          </SpotlightCard>
        </section>

        <section className="admin-grid">
          <SpotlightCard className="editor-panel" as="section">
            <h2>{newsForm.id ? `编辑资讯：${newsForm.title}` : "新增每日资讯"}</h2>
            <form className="console-form" onSubmit={saveNews}>
              <label>标题<input value={newsForm.title} onChange={(e) => updateNews("title", e.target.value)} required /></label>
              <div className="form-pair">
                <label>类型<select value={newsForm.kind} onChange={(e) => updateNews("kind", e.target.value)}><option value="资讯">资讯</option><option value="项目">项目</option><option value="教程">教程</option><option value="模型">模型</option></select></label>
                <label>日期<input type="date" value={newsForm.publishedAt} onChange={(e) => updateNews("publishedAt", e.target.value)} /></label>
              </div>
              <label>来源链接<input value={newsForm.sourceUrl} onChange={(e) => updateNews("sourceUrl", e.target.value)} /></label>
              <label>摘要<textarea value={newsForm.summary} onChange={(e) => updateNews("summary", e.target.value)} rows="4" /></label>
              <label>状态<select value={newsForm.status} onChange={(e) => updateNews("status", e.target.value)}><option value="published">发布</option><option value="draft">草稿</option></select></label>
              <div className="form-actions"><button type="submit">保存资讯</button><button type="button" onClick={() => setNewsForm(emptyNews())}>清空</button></div>
            </form>
          </SpotlightCard>

          <SpotlightCard className="list-panel" as="section">
            <div className="panel-head"><h2>每日资讯</h2><input value={newsQuery} onChange={(e) => setNewsQuery(e.target.value)} placeholder="搜索资讯" /></div>
            <div className="admin-list">
              {shownNews.map((item) => (
                <AdminRow key={item.id} item={{ ...item, name: item.title }} meta={`${item.publishedAt || "未定日期"} · ${item.kind || "资讯"} · ${item.status || "published"}`} onEdit={() => setNewsForm(item)} onDelete={() => remove("news", item.id)} />
              ))}
            </div>
          </SpotlightCard>
        </section>
        <p className="form-message">{message}</p>
      </main>
    </div>
  );
}

function AdminRow({ item, meta, onEdit, onDelete }) {
  return (
    <div className="admin-row">
      <Logo tool={item} size="small" />
      <div><strong>{item.name}</strong><small>{meta}</small></div>
      <div className="row-actions"><button type="button" onClick={onEdit}>编辑</button><button type="button" onClick={onDelete}>删除</button></div>
    </div>
  );
}

function emptyTool() {
  return { id: "", name: "", url: "", logo: "", category: "chat", status: "published", tags: "", summary: "", featured: "false", isNew: "true" };
}

function emptyNews() {
  return { id: "", title: "", kind: "资讯", publishedAt: new Date().toISOString().slice(0, 10), sourceUrl: "", summary: "", status: "published" };
}

function App() {
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return <AdminPage />;
  if (path.startsWith("/login")) return <LoginPage />;
  return <HomePage />;
}

createRoot(document.getElementById("root")).render(<App />);
