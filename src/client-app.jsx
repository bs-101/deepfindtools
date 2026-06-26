import React, { useEffect, useMemo, useRef, useState } from "react";

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

const searchModes = [
  {
    id: "common",
    label: "常用",
    providers: [
      { label: "站内", placeholder: "站内AI工具搜索", type: "site" },
      { label: "Bing", placeholder: "微软Bing搜索", url: "https://www.bing.com/search?q=%s" },
      { label: "百度", placeholder: "百度搜索", url: "https://www.baidu.com/s?wd=%s" },
      { label: "Google", placeholder: "Google搜索", url: "https://www.google.com/search?q=%s" },
      { label: "Perplexity", placeholder: "Perplexity搜索", url: "https://www.perplexity.ai/search?q=%s" },
    ],
  },
  {
    id: "search",
    label: "搜索",
    providers: [
      { label: "Bing", placeholder: "微软Bing搜索", url: "https://www.bing.com/search?q=%s" },
      { label: "百度", placeholder: "百度搜索", url: "https://www.baidu.com/s?wd=%s" },
      { label: "Google", placeholder: "Google搜索", url: "https://www.google.com/search?q=%s" },
      { label: "Perplexity", placeholder: "Perplexity搜索", url: "https://www.perplexity.ai/search?q=%s" },
      { label: "YOU", placeholder: "You.com搜索", url: "https://you.com/search?q=%s" },
      { label: "360", placeholder: "360搜索", url: "https://www.so.com/s?q=%s" },
      { label: "搜狗", placeholder: "搜狗搜索", url: "https://www.sogou.com/web?query=%s" },
      { label: "神马", placeholder: "神马搜索", url: "https://m.sm.cn/s?q=%s" },
    ],
  },
  {
    id: "community",
    label: "社区",
    providers: [
      { label: "Hugging Face", placeholder: "Hugging Face AI模型社区", url: "https://huggingface.co/search/full-text?q=%s" },
      { label: "GitHub", placeholder: "GitHub开源项目搜索", url: "https://github.com/search?q=%s" },
      { label: "飞桨", placeholder: "飞桨AI Studio搜索", url: "https://aistudio.baidu.com/search?query=%s" },
      { label: "魔搭", placeholder: "魔搭社区模型搜索", url: "https://modelscope.cn/models?name=%s" },
      { label: "和鲸", placeholder: "和鲸社区搜索", url: "https://www.heywhale.com/search?keyword=%s" },
      { label: "掘金", placeholder: "掘金AI文章搜索", url: "https://juejin.cn/search?query=%s" },
      { label: "知乎", placeholder: "知乎AI话题搜索", url: "https://www.zhihu.com/search?type=content&q=%s" },
    ],
  },
];

const fallbackNews = [
  {
    id: "fallback-1",
    title: "SpaceX 600亿美元收购 Cursor",
    summary:
      "市场传闻称大型科技公司持续加码 AI 编程工具，代码生成、代理式开发和模型训练生态会成为下一阶段基础设施竞争重点。",
    sourceName: "机器之心",
    publishedAt: "2026-06-17",
    kind: "资讯",
    status: "published",
  },
  {
    id: "fallback-2",
    title: "DeepSeek首次融资落地，募集超500亿，估值超3300亿元",
    summary:
      "国产大模型公司继续吸引长期资金进入，模型能力、算力供给和生态合作成为投资人判断 AI 公司价值的核心变量。",
    sourceName: "机器之心",
    publishedAt: "2026-06-17",
    kind: "资讯",
    status: "published",
  },
  {
    id: "fallback-3",
    title: "智谱上线并开源 GLM-5.2，专注 Coding 与长程任务",
    summary:
      "新一代模型强化长上下文、代码生成和复杂任务执行能力，正在把 AI 工具从单点问答推向可持续协作的工作流。",
    sourceName: "智谱",
    publishedAt: "2026-06-17",
    kind: "模型",
    status: "published",
  },
  {
    id: "fallback-4",
    title: "MiniMax 开源原生多模态旗舰模型 MiniMax M3",
    summary:
      "多模态模型继续降低视频、图片、音频与文本的跨媒介创作门槛，设计和内容团队会获得更多可嵌入流程的生产工具。",
    sourceName: "MiniMax",
    publishedAt: "2026-06-16",
    kind: "模型",
    status: "published",
  },
];

function useData(includeDrafts = false, initialData = null) {
  const [data, setData] = useState(() => initialData ? { tools: initialData.tools || [], categories: initialData.categories || [], news: initialData.news || [], candidates: [], loading: false } : { tools: [], categories: [], news: [], candidates: [], loading: true });

  async function load() {
    try {
      const query = includeDrafts ? "?includeDrafts=1" : "";
      const [tools, categories, news, candidates] = await Promise.all([
        api.get(`/api/tools${query}`),
        api.get("/api/categories"),
        api.get(`/api/news${query}`),
        includeDrafts ? api.get("/api/candidates") : Promise.resolve([]),
      ]);
      setData({ tools, categories, news, candidates, loading: false });
    } catch (error) {
      if (error.message === "UNAUTHORIZED") {
        throw error;
      }
      const seed = await api.get("/data/seed.json");
      setData({ tools: seed.tools || [], categories: seed.categories || [], news: seed.news || [], candidates: [], loading: false });
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

function getCategoryItems(categories, tools) {
  const all = { id: "all", name: "全部工具", icon: "A", count: tools.length };
  return [all].concat(
    categories.map((item) => ({
      ...item,
      count: tools.filter((tool) => tool.category === item.id).length,
    })),
  );
}

function sectionId(id) {
  return id === "all" ? "tools-index" : `category-${id}`;
}

function categoryHref(id) {
  if (id === "all") return "/";
  return `/category/${encodeURIComponent(id)}`;
}

const categoryIconMap = {
  all: "grid",
  writing: "pen",
  image: "image",
  video: "video",
  office: "briefcase",
  chat: "chat",
  agent: "spark",
  code: "code",
  dev: "terminal",
  platform: "terminal",
  design: "palette",
  audio: "wave",
  search: "search",
  learning: "book",
  training: "cube",
  model: "cube",
  detector: "shield",
  detect: "shield",
  prompt: "prompt",
  business: "stack",
};

function CategoryGlyph({ id }) {
  const type = categoryIconMap[id] || "spark";

  return (
    <span className={`category-code category-icon-${type}`} aria-hidden="true">
      {type === "grid" ? (
        <svg viewBox="0 0 24 24">
          <rect x="4" y="4" width="6" height="6" rx="1.6" />
          <rect x="14" y="4" width="6" height="6" rx="1.6" />
          <rect x="4" y="14" width="6" height="6" rx="1.6" />
          <rect x="14" y="14" width="6" height="6" rx="1.6" />
        </svg>
      ) : null}
      {type === "pen" ? (
        <svg viewBox="0 0 24 24">
          <path d="M4 20l4.3-1 10-10a2.1 2.1 0 0 0 0-3l-.3-.3a2.1 2.1 0 0 0-3 0l-10 10L4 20z" />
          <path d="M13.8 6.9l3.3 3.3" />
        </svg>
      ) : null}
      {type === "image" ? (
        <svg viewBox="0 0 24 24">
          <rect x="3.5" y="5" width="17" height="14" rx="3" />
          <path d="M7 16l3.2-3.2 2.4 2.4 2.1-2.1L18 16" />
          <circle className="fill-dot" cx="8.4" cy="9.2" r="1.5" />
        </svg>
      ) : null}
      {type === "video" ? (
        <svg viewBox="0 0 24 24">
          <rect x="3.5" y="6" width="12.5" height="12" rx="2.5" />
          <path d="M16 10l4-2.2v8.4L16 14z" />
        </svg>
      ) : null}
      {type === "briefcase" ? (
        <svg viewBox="0 0 24 24">
          <rect x="3.5" y="7" width="17" height="12" rx="2.5" />
          <path d="M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7" />
          <path d="M3.5 12h17" />
        </svg>
      ) : null}
      {type === "chat" ? (
        <svg viewBox="0 0 24 24">
          <path d="M5 6.5h14v9H9l-4 3v-12z" />
          <path d="M8.2 10.2h7.6M8.2 13h4.8" />
        </svg>
      ) : null}
      {type === "spark" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 3l1.8 5 5.2 1.8-5.2 1.8L12 17l-1.8-5.4L5 9.8 10.2 8z" />
          <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
        </svg>
      ) : null}
      {type === "code" ? (
        <svg viewBox="0 0 24 24">
          <path d="M9 7l-5 5 5 5" />
          <path d="M15 7l5 5-5 5" />
          <path d="M13 5l-2 14" />
        </svg>
      ) : null}
      {type === "terminal" ? (
        <svg viewBox="0 0 24 24">
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <path d="M7 9l3 3-3 3" />
          <path d="M12.5 15h4" />
        </svg>
      ) : null}
      {type === "palette" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 4a8 8 0 0 0-1 15.9c1.3.1 1.7-.8 1.3-1.8-.5-1.2.3-2.1 1.7-2.1h1.2A4.8 4.8 0 0 0 20 11.2C20 7.2 16.4 4 12 4z" />
          <circle className="fill-dot" cx="8.2" cy="10" r="1.2" />
          <circle className="fill-dot" cx="11.4" cy="8" r="1.2" />
          <circle className="fill-dot" cx="14.7" cy="10" r="1.2" />
        </svg>
      ) : null}
      {type === "wave" ? (
        <svg viewBox="0 0 24 24">
          <path d="M4 13v-2M8 17V7M12 20V4M16 17V7M20 13v-2" />
        </svg>
      ) : null}
      {type === "search" ? (
        <svg viewBox="0 0 24 24">
          <circle cx="10.8" cy="10.8" r="5.8" />
          <path d="M15.2 15.2L20 20" />
        </svg>
      ) : null}
      {type === "book" ? (
        <svg viewBox="0 0 24 24">
          <path d="M5 5.5A3 3 0 0 1 8 4h11v15H8a3 3 0 0 0-3 1.5z" />
          <path d="M5 5.5v15M9 8h6" />
        </svg>
      ) : null}
      {type === "cube" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 3.8l7 4v8.4l-7 4-7-4V7.8z" />
          <path d="M5 7.8l7 4 7-4M12 11.8v8.4" />
        </svg>
      ) : null}
      {type === "shield" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 3.8l7 2.4v5.4c0 4.2-2.8 7-7 8.6-4.2-1.6-7-4.4-7-8.6V6.2z" />
          <path d="M9.2 12.1l2 2 4-4" />
        </svg>
      ) : null}
      {type === "prompt" ? (
        <svg viewBox="0 0 24 24">
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M8 10h8M8 14h5" />
          <circle className="fill-dot" cx="16.5" cy="14" r="1" />
        </svg>
      ) : null}
      {type === "stack" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 4l8 4-8 4-8-4z" />
          <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
        </svg>
      ) : null}
    </span>
  );
}

function sortAndFilterTools(tools, categories, query, sort = "featured") {
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
}

function toolDetailHref(tool) {
  return tool?.detailUrl || (tool?.id ? `/sites/${encodeURIComponent(tool.id)}.html` : tool?.url || "#");
}

function officialToolUrl(tool) {
  return tool?.officialUrl || tool?.url || "#";
}

function splitLines(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFaq(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        question: String(item.question || item.q || "").trim(),
        answer: String(item.answer || item.a || "").trim(),
      }))
      .filter((item) => item.question && item.answer);
  }
  return splitLines(value)
    .map((line) => {
      const [question, ...answerParts] = line.split("|");
      return {
        question: String(question || "").trim(),
        answer: answerParts.join("|").trim(),
      };
    })
    .filter((item) => item.question && item.answer);
}

function stringifyFaq(value) {
  return parseFaq(value)
    .map((item) => `${item.question} | ${item.answer}`)
    .join("\n");
}

function safeContentUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? url : "";
  } catch {
    return "";
  }
}

function renderInlineMarkdown(text, keyPrefix = "inline") {
  const source = String(text || "");
  const tokens = [];
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let index = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > lastIndex) tokens.push(source.slice(lastIndex, match.index));
    if (match[2]) {
      tokens.push(<strong key={`${keyPrefix}-b-${index}`}>{match[2]}</strong>);
    } else {
      const href = safeContentUrl(match[4]);
      tokens.push(
        href ? (
          <a key={`${keyPrefix}-a-${index}`} href={href} target={href.startsWith("/") ? undefined : "_blank"} rel={href.startsWith("/") ? undefined : "noopener noreferrer"}>
            {match[3]}
          </a>
        ) : (
          match[3]
        ),
      );
    }
    lastIndex = match.index + match[0].length;
    index += 1;
  }
  if (lastIndex < source.length) tokens.push(source.slice(lastIndex));
  return tokens;
}

function MarkdownContent({ value }) {
  const lines = String(value || "").split(/\r?\n/);
  const nodes = [];
  let listItems = [];
  let paragraph = [];

  function flushList() {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listItems.map((item, index) => (
          <li key={`${nodes.length}-${index}`}>{renderInlineMarkdown(item, `li-${nodes.length}-${index}`)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  function flushParagraph() {
    if (!paragraph.length) return;
    nodes.push(<p key={`p-${nodes.length}`}>{renderInlineMarkdown(paragraph.join(" "), `p-${nodes.length}`)}</p>);
    paragraph = [];
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      flushList();
      const src = safeContentUrl(image[2]);
      if (src) {
        nodes.push(
          <figure className="markdown-figure" key={`img-${nodes.length}`}>
            <img src={src} alt={image[1] || ""} loading="lazy" />
            {image[1] ? <figcaption>{image[1]}</figcaption> : null}
          </figure>,
        );
      }
      return;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      nodes.push(<h3 key={`h3-${nodes.length}`}>{renderInlineMarkdown(line.slice(4), `h3-${nodes.length}`)}</h3>);
      return;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      nodes.push(<h2 key={`h2-${nodes.length}`}>{renderInlineMarkdown(line.slice(3), `h2-${nodes.length}`)}</h2>);
      return;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2));
      return;
    }
    paragraph.push(line);
  });
  flushParagraph();
  flushList();

  return <div className="markdown-content">{nodes}</div>;
}

function defaultToolFeatures(tool, category) {
  if (splitLines(tool.features).length) return splitLines(tool.features);
  const tags = tool.tags || [];
  return [
    `面向 ${category} 场景，帮助用户更快完成信息处理、内容生成或工作流搭建。`,
    tool.summary || `围绕 ${tool.name} 的核心能力提供 AI 辅助，适合在日常工作中快速试用。`,
    tags.length ? `覆盖 ${tags.slice(0, 3).join("、")} 等关键词，方便和同类工具做横向比较。` : "提供清晰的官网入口和同类工具推荐，便于快速决策。",
  ];
}

function defaultToolUseCases(tool, category) {
  if (splitLines(tool.useCases).length) return splitLines(tool.useCases);
  return [
    `个人用户：用 ${tool.name} 快速验证 ${category} 相关需求，减少在多个工具之间反复试错。`,
    `团队协作：把 ${tool.name} 作为项目流程中的一个候选工具，用于提升交付效率。`,
    `运营选型：结合标签、简介和相似工具，判断它是否适合当前业务或内容生产场景。`,
  ];
}

function defaultToolFaq(tool, category) {
  const custom = parseFaq(tool.faq);
  if (custom.length) return custom;
  return [
    {
      question: `${tool.name} 是否免费？`,
      answer: "具体免费额度、订阅价格和商用限制以官网最新说明为准，本站主要提供工具定位和入口参考。",
    },
    {
      question: `${tool.name} 适合什么人使用？`,
      answer: `适合正在寻找 ${category} 的创作者、设计师、运营、开发者、学生或团队用户。`,
    },
    {
      question: `DeepFind Tools 为什么做 ${tool.name} 详情页？`,
      answer: "详情页用于整理工具简介、分类、标签、官网入口和同类工具，帮助用户在访问官网前完成初步判断。",
    },
  ];
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

function FrontShell({ tools, categories, activeSection = "all", onCategoryClick, query, setQuery, children, hero = true }) {
  const categoryItems = useMemo(() => getCategoryItems(categories, tools), [categories, tools]);

  function goCategory(id) {
    if (onCategoryClick) {
      onCategoryClick(id);
      return;
    }
    window.location.href = categoryHref(id);
  }

  return (
    <div className="app-frame">
      <Sidebar categories={categoryItems} activeSection={activeSection} onCategoryClick={goCategory} />
      <main className="workspace">
        <TopNav />
        {hero ? <HeroSearch query={query} setQuery={setQuery} /> : null}
        {children}
      </main>
    </div>
  );
}

function Sidebar({ categories, activeSection, onCategoryClick }) {
  return (
    <aside className="rail">
      <a className="brand" href="/">
        <span className="brand-mark">AI</span>
        <span>
          <strong>AI工具集</strong>
          <small>ai tools directory</small>
        </span>
      </a>

      <div className="rail-section">
        <p className="rail-label">AI 工具分类</p>
        <nav className="category-stack" aria-label="工具分类">
          {categories.map((item) => (
            <button
              className={`category-tune ${activeSection === item.id ? "active" : ""}`}
              key={item.id}
              type="button"
              onClick={() => onCategoryClick(item.id)}
            >
              <CategoryGlyph id={item.id} />
              <span>{item.name}</span>
              <small>{item.count}</small>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function TopNav() {
  return (
    <header className="top-nav">
      <button className="menu-button" type="button" aria-label="展开菜单">
        <span />
        <span />
        <span />
      </button>
      <nav aria-label="顶部导航">
        <a href="/">AI工具集</a>
        <a href="/category/agent">AI应用集</a>
        <a href="/daily-ai-news">每日AI资讯</a>
        <a href="/category/latest">最新AI项目</a>
        <a href="/category/learning">AI教程资源</a>
        <a href="/#tools-index">关于我们</a>
      </nav>
    </header>
  );
}

function HeroSearch({ query, setQuery }) {
  const [modeId, setModeId] = useState("common");
  const [providerIndex, setProviderIndex] = useState(0);
  const mode = searchModes.find((item) => item.id === modeId) || searchModes[0];
  const provider = mode.providers[providerIndex] || mode.providers[0];

  function switchMode(nextId) {
    setModeId(nextId);
    setProviderIndex(0);
  }

  function submitSearch(event) {
    event.preventDefault();
    const keyword = query.trim();
    if (provider.type === "site") {
      if (keyword) document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!keyword) return;
    window.open(provider.url.replace("%s", encodeURIComponent(keyword)), "_blank", "noopener,noreferrer");
  }

  return (
    <section className="hero-search">
      <div className="hero-brand">
        <span className="hero-mark">AI</span>
        <h1>AI工具集</h1>
      </div>
      <div className="search-tabs" aria-label="搜索模式">
        {searchModes.map((item) => (
          <button key={item.id} className={modeId === item.id ? "active" : ""} type="button" onClick={() => switchMode(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <form className="command-bar" onSubmit={submitSearch}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={provider.placeholder} />
        <button type="submit" aria-label="搜索">
          搜索
        </button>
      </form>
      <div className="search-provider-row" aria-label="搜索来源">
        {mode.providers.map((item, index) => (
          <button key={item.label} className={index === providerIndex ? "active" : ""} type="button" onClick={() => setProviderIndex(index)}>
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function HomePage({ initialData = null } = {}) {
  const { tools, categories, news, loading } = useData(false, initialData);
  const [activeSection, setActiveSection] = useState("all");
  const [sort, setSort] = useState("featured");
  const [query, setQuery] = useState("");
  const [newsFilter, setNewsFilter] = useState("all");

  function scrollToCategory(id) {
    setActiveSection(id);
    document.getElementById(sectionId(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const sortedTools = useMemo(() => sortAndFilterTools(tools, categories, query, sort), [tools, categories, query, sort]);
  const filteredNews = news.filter((item) => item.status !== "draft" && (newsFilter === "all" || item.kind === newsFilter));
  const featuredTools = tools.filter((tool) => tool.featured).slice(0, 12);
  const latestTools = tools.filter((tool) => tool.isNew).slice(0, 12);
  const homeSections = categories.filter((item) => tools.some((tool) => tool.category === item.id));

  return (
    <FrontShell tools={tools} categories={categories} activeSection={activeSection} onCategoryClick={scrollToCategory} query={query} setQuery={setQuery}>
      <PortalStrip />

      <section className="ad-bands" aria-label="推荐入口">
        <div className="ad-band frog-band">
          <strong>蛙蛙写作</strong>
          <span>一站式 AI 创作平台，从小说、剧本到漫画视频</span>
          <button type="button" onClick={() => setQuery("蛙蛙")}>免费使用</button>
        </div>
        <div className="ad-band qoder-band">
          <strong>QoderWork</strong>
          <span>你的 AI 办公搭子，描述需求、自主执行、直接交付结果</span>
          <button type="button" onClick={() => setQuery("Qoder")}>领取会员</button>
        </div>
      </section>

      <section className="control-strip">
        <span className="hot-pill">热门工具</span>
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
        <ToolSection id="search-results" title="搜索结果" subtitle={`匹配 ${sortedTools.length} 个工具`} tools={sortedTools.slice(0, 120)} categories={categories} />
      ) : (
        <>
          <div id="tools-index" className="home-feature-grid scroll-anchor">
            <ToolSection title="热门工具" subtitle="近期更常被推荐和使用的 AI 工具" tools={featuredTools} categories={categories} moreHref="/category/featured" />
            <ToolSection title="最新收录" subtitle="新加入工具库的产品和项目" tools={latestTools} categories={categories} moreHref="/category/latest" />
          </div>
          {homeSections.map((item) => (
            <ToolSection
              key={item.id}
              id={sectionId(item.id)}
              title={item.name}
              subtitle={`收录 ${tools.filter((tool) => tool.category === item.id).length} 个相关工具`}
              tools={sortedTools.filter((tool) => tool.category === item.id)}
              categories={categories}
              moreHref={categoryHref(item.id)}
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
          <a className="section-more" href="/daily-ai-news">查看更多 &gt;&gt;</a>
        </div>
        <div className="news-filter">
          {["all", "资讯", "项目", "教程"].map((item) => (
            <button key={item} className={newsFilter === item ? "active" : ""} type="button" onClick={() => setNewsFilter(item)}>
              {item === "all" ? "全部" : item}
            </button>
          ))}
        </div>
        <div className="news-lanes">
          {filteredNews.slice(0, 8).map((item) => (
            <SpotlightCard className="news-tile" key={item.id || item.title} as="a" href="/daily-ai-news">
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
    </FrontShell>
  );
}

function PortalStrip() {
  return (
    <section className="portal-strip" aria-label="资讯入口">
      <div className="portal-tabs">
        {["AI快讯", "AI项目", "AI百科"].map((item, index) => (
          <button className={index === 0 ? "active" : ""} type="button" key={item}>
            <span>{index + 1}</span>
            {item}
          </button>
        ))}
      </div>
      <div className="portal-cards">
        <FeatureTile href="/daily-ai-news" tone="blue" icon="NEWS" title="每日 AI 快讯" subtitle="工具更新、模型动态、行业热闻" />
        <FeatureTile href="/daily-ai-news" tone="green" icon="AI" title="免费 AI 社群" subtitle="交流工具经验和使用案例" />
        <FeatureTile href="/category/latest" tone="violet" icon="NEW" title="最新 AI 项目" subtitle="新产品、开源项目和上线动态" />
        <FeatureTile href="/category/learning" tone="sky" icon="EDU" title="热门 AI 教程" subtitle="高频教程、提示词和实战资料" />
        <FeatureTile href="/category/video" tone="dark" icon="2.0" title="Seedance 2.0 上线" subtitle="视频生成能力更新" />
      </div>
    </section>
  );
}

function FeatureTile({ tone, title, subtitle, href, icon }) {
  return (
    <a className={`feature-tile ${tone}`} href={href || "#"}>
      <span className="feature-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <em>{subtitle}</em>
    </a>
  );
}

function CategoryPage({ categoryId, initialData = null }) {
  const { tools, categories, loading } = useData(false, initialData);
  const [query, setQuery] = useState("");
  const decodedId = decodeURIComponent(categoryId || "all");
  const category = categories.find((item) => item.id === decodedId);

  const pageTools = useMemo(() => {
    if (decodedId === "all") return tools;
    if (decodedId === "latest") return tools.filter((tool) => tool.isNew);
    if (decodedId === "featured") return tools.filter((tool) => tool.featured);
    return tools.filter((tool) => tool.category === decodedId);
  }, [decodedId, tools]);

  const shownTools = useMemo(() => sortAndFilterTools(pageTools, categories, query, decodedId === "latest" ? "new" : "featured"), [pageTools, categories, query, decodedId]);
  const title = decodedId === "latest" ? "最新收录" : decodedId === "featured" ? "热门工具" : category?.name || "全部工具";
  const subtitle = loading ? "正在加载工具数据..." : `共收录 ${shownTools.length} 个工具，点击卡片可直接访问目标网站。`;

  return (
    <FrontShell tools={tools} categories={categories} activeSection={category?.id || decodedId} query={query} setQuery={setQuery}>
      <section className="archive-head">
        <div className="breadcrumb">
          <a href="/">首页</a>
          <span>·</span>
          <span>AI工具集</span>
          <span>·</span>
          <strong>{title}</strong>
        </div>
        <div className="archive-title">
          <div>
            <p className="eyebrow">directory archive</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <a className="archive-back" href="/">返回首页</a>
        </div>
      </section>

      <ToolSection title={title} subtitle={subtitle} tools={shownTools} categories={categories} />
    </FrontShell>
  );
}

function DailyNewsPage({ initialData = null } = {}) {
  const { tools, categories, news } = useData(false, initialData);
  const [query, setQuery] = useState("");
  const publishedNews = news.filter((item) => item.status !== "draft");
  const introArticle = publishedNews.find((item) => item.title?.includes("每日AI快讯"));
  const dailyIntro =
    introArticle?.summary ||
    "AI工具集每个工作日实时更新 AI 行业的最新资讯、新闻、热点、融资、产品动态、爆料等，让你随时了解人工智能领域最新趋势、更新突破和热门大事件。";
  const dailyItems = publishedNews.length
    ? publishedNews.filter((item) => !introArticle || item.id !== introArticle.id || item.title !== introArticle.title)
    : fallbackNews;
  const grouped = groupNewsByDate(dailyItems);
  const hotTools = tools.filter((tool) => tool.featured).slice(0, 10);
  const latestTools = tools.filter((tool) => tool.isNew).slice(0, 8);

  return (
    <FrontShell tools={tools} categories={categories} activeSection="daily" query={query} setQuery={setQuery} hero={false}>
      <section className="daily-layout">
        <article className="daily-article">
          <div className="breadcrumb">
            <a href="/">首页</a>
            <span>·</span>
            <a href="/daily-ai-news">AI快讯</a>
            <span>·</span>
            <strong>每日AI快讯热闻</strong>
          </div>

          <div className="daily-card">
            <header className="daily-header">
              <h1>每日AI快讯热闻</h1>
              <div className="daily-meta">
                <span>AI快讯</span>
                <span>{introArticle?.updatedLabel || "每日更新"}</span>
                <span>{introArticle?.author || "AI小集"}</span>
                <span>{introArticle?.comments || 75}</span>
                <span>{introArticle?.likes || 1585}</span>
              </div>
            </header>

            {introArticle?.coverImage ? (
              <img className="daily-cover-img" src={introArticle.coverImage} alt="每日AI快讯" />
            ) : (
              <div className="daily-cover">
                <div className="daily-paper" aria-hidden="true">
                  <span>NEWS</span>
                  <i />
                  <i />
                  <i />
                </div>
                <div className="daily-signal" aria-hidden="true" />
                <strong>每日AI快讯</strong>
                <small>AI行业资讯 / 热点 / 融资 / 产品动态</small>
              </div>
            )}

            <p className="daily-intro">{dailyIntro}</p>

            <div className="timeline">
              {grouped.map((group) => (
                <section className="timeline-day" key={group.label}>
                  <h2>{group.label}</h2>
                  {group.items.map((item) => (
                    <NewsArticleItem key={item.id || item.title} item={item} />
                  ))}
                </section>
              ))}
            </div>
          </div>
        </article>

        <aside className="daily-sidebar">
          <a className="side-ad dark-ad" href="/category/code">
            <strong>TRAE</strong>
            <span>字节旗下 AI 代码助手，编程更高效</span>
          </a>
          <a className="side-ad blue-ad" href="/category/office">
            <strong>iTab新标签页</strong>
            <span>重新定义你的浏览器体验</span>
          </a>
          <MiniToolPanel title="热门工具" tools={hotTools} categories={categories} />
          <MiniToolPanel title="最新收录" tools={latestTools} categories={categories} />
          <section className="mini-panel">
            <h3>最新文章</h3>
            <div className="mini-articles">
              {publishedNews.slice(0, 5).map((item) => (
                <a key={item.id || item.title} href={item.sourceUrl || "/daily-ai-news"}>
                  <strong>{item.title}</strong>
                  <span>{item.publishedAt || "今日"} · {item.kind || "资讯"}</span>
                </a>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </FrontShell>
  );
}

function groupNewsByDate(items) {
  const groups = new Map();
  items.forEach((item) => {
    const label = item.dayLabel || formatDateLabel(item.publishedAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  });
  return Array.from(groups, ([label, groupItems]) => ({ label, items: groupItems }));
}

function formatDateLabel(value) {
  if (!value) return "今日";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${date.getMonth() + 1}月${date.getDate()}·${weekdays[date.getDay()]}`;
}

function NewsArticleItem({ item }) {
  const content = (
    <>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <span>来源：{item.sourceName || item.kind || "AI工具集"}</span>
    </>
  );
  return item.sourceUrl ? (
    <a className="timeline-item" href={item.sourceUrl} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <div className="timeline-item">{content}</div>
  );
}

function MiniToolPanel({ title, tools, categories }) {
  return (
    <section className="mini-panel">
      <h3>{title}</h3>
      <div className="mini-tool-grid">
        {tools.map((tool) => (
          <a key={`${title}-${tool.id}`} href={toolDetailHref(tool)}>
            <Logo tool={tool} size="small" />
            <span>{tool.name}</span>
            <small>{categoryName(categories, tool.category)}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

function ToolSection({ id, title, subtitle, tools, categories, moreHref }) {
  if (!tools.length) return null;
  const inlineLimit = 24;
  const visibleTools = moreHref ? tools.slice(0, inlineLimit) : tools;
  const showMore = Boolean(moreHref && tools.length > visibleTools.length);
  return (
    <section id={id} className="tool-section scroll-anchor">
      <div className="section-title">
        <div>
          <p className="eyebrow">directory</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {showMore ? <a className="section-more" href={moreHref}>查看更多 &gt;&gt;</a> : <span className="section-more">{tools.length} 项</span>}
      </div>
      <div className="tool-matrix">
        {visibleTools.map((tool) => (
          <ToolCard key={`${title}-${tool.id}-${tool.name}`} tool={tool} category={categoryName(categories, tool.category)} />
        ))}
      </div>
    </section>
  );
}

function ToolCard({ tool, category }) {
  const href = toolDetailHref(tool);
  return (
    <SpotlightCard className="tool-tile" as="a" href={href} aria-label={`查看 ${tool.name} 详情`}>
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

function ToolDetailPage({ toolId, initialData = null }) {
  const { tools, categories, loading } = useData(false, initialData);
  const [query, setQuery] = useState("");
  const decodedId = decodeURIComponent(toolId || "");
  const tool = tools.find((item) => String(item.id) === decodedId);
  const category = tool ? categoryName(categories, tool.category) : "AI工具";
  const relatedTools = tool ? tools.filter((item) => item.category === tool.category && String(item.id) !== String(tool.id)).slice(0, 8) : [];
  const officialUrl = tool ? officialToolUrl(tool) : "#";
  const customMarkdown = String(tool?.detailMarkdown || "").trim();
  const galleryImages = splitLines(tool?.galleryImages).map(safeContentUrl).filter(Boolean);
  const features = tool ? defaultToolFeatures(tool, category) : [];
  const useCases = tool ? defaultToolUseCases(tool, category) : [];
  const faqs = tool ? defaultToolFaq(tool, category) : [];

  useEffect(() => {
    if (tool?.name) document.title = `${tool.name} - ${category} | DeepFind Tools`;
  }, [tool?.name, category]);

  if (loading && !tool) {
    return (
      <FrontShell tools={tools} categories={categories} activeSection="all" query={query} setQuery={setQuery} hero={false}>
        <section className="detail-shell"><p className="eyebrow">loading</p><h1>正在加载工具详情...</h1></section>
      </FrontShell>
    );
  }

  if (!tool) {
    return (
      <FrontShell tools={tools} categories={categories} activeSection="all" query={query} setQuery={setQuery} hero={false}>
        <section className="detail-shell"><p className="eyebrow">not found</p><h1>工具不存在或已下架</h1><a className="archive-back" href="/">返回首页</a></section>
      </FrontShell>
    );
  }

  return (
    <FrontShell tools={tools} categories={categories} activeSection={tool.category} query={query} setQuery={setQuery} hero={false}>
      <article className="tool-detail">
        <div className="breadcrumb">
          <a href="/">首页</a>
          <span>·</span>
          <a href={`/category/${encodeURIComponent(tool.category)}`}>{category}</a>
          <span>·</span>
          <strong>{tool.name}</strong>
        </div>

        <section className="detail-hero">
          <div className="detail-logo-panel">
            <Logo tool={tool} />
          </div>
          <div className="detail-copy">
            <span className="detail-category">{category}</span>
            <h1>{tool.name}</h1>
            <p>{tool.summary || `${tool.name} 是 DeepFind Tools 收录的 ${category}，可用于提升 AI 工作流效率。`}</p>
            <div className="detail-tags">
              {(tool.tags || [category]).slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <div className="detail-actions">
              {officialUrl && officialUrl !== "#" ? <a className="primary-link" href={officialUrl} target="_blank" rel="nofollow sponsored noopener noreferrer">访问官网</a> : null}
              <a className="secondary-link" href={`/category/${encodeURIComponent(tool.category)}`}>查看同类工具</a>
            </div>
          </div>
        </section>

        <section className="detail-content">
          <div className="detail-main">
            {customMarkdown ? (
              <MarkdownContent value={customMarkdown} />
            ) : (
              <>
                <h2>{tool.name} 是什么？</h2>
                <p>{tool.summary || `${tool.name} 是一款 ${category}，适合需要 AI 辅助创作、办公、开发或学习的用户。`}</p>
                <h2>核心能力</h2>
                <ul className="detail-list">
                  {features.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <h2>适合的使用场景</h2>
                <ul className="detail-list">
                  {useCases.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <h2>使用建议</h2>
                <p>建议先确认 {tool.name} 的定价、数据隐私、模型能力和团队协作方式，再结合本站同类工具进行对比。对于生产环境或商业用途，优先查看官网最新条款与功能说明。</p>
              </>
            )}

            {galleryImages.length ? (
              <section className="detail-gallery" aria-label={`${tool.name} 图片展示`}>
                {galleryImages.map((src, index) => (
                  <figure key={`${src}-${index}`}>
                    <img src={src} alt={`${tool.name} 展示图 ${index + 1}`} loading="lazy" />
                    <figcaption>{tool.name} 展示图 {index + 1}</figcaption>
                  </figure>
                ))}
              </section>
            ) : null}

            {faqs.length ? (
              <section className="detail-faq">
                <h2>常见问题</h2>
                {faqs.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </section>
            ) : null}
          </div>
          <aside className="detail-side">
            <h3>工具信息</h3>
            <dl>
              <dt>分类</dt><dd>{category}</dd>
              <dt>状态</dt><dd>{tool.isNew ? "新收录" : tool.featured ? "热门推荐" : "已收录"}</dd>
              <dt>标签</dt><dd>{(tool.tags || []).slice(0, 3).join(" / ") || category}</dd>
              <dt>内容</dt><dd>{customMarkdown ? "已自定义详情" : "自动生成基础详情"}</dd>
              {officialUrl && officialUrl !== "#" ? <><dt>官网</dt><dd><a href={officialUrl} target="_blank" rel="nofollow sponsored noopener noreferrer">打开官网</a></dd></> : null}
            </dl>
          </aside>
        </section>

        {relatedTools.length ? <ToolSection title="相似 AI 工具" subtitle={`更多 ${category} 可选工具`} tools={relatedTools} categories={categories} /> : null}
      </article>
    </FrontShell>
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
          <p>后台账号由服务器环境变量控制。请使用部署时配置的管理员凭据登录。</p>
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
              placeholder="输入后台密码"
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
  const { tools, categories, news, candidates, loading, reload } = useData(true);
  const [activeAdminSection, setActiveAdminSection] = useState("tools");
  const [toolQuery, setToolQuery] = useState("");
  const [newsQuery, setNewsQuery] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
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
      features: splitLines(toolForm.features),
      useCases: splitLines(toolForm.useCases),
      galleryImages: splitLines(toolForm.galleryImages),
      faq: parseFaq(toolForm.faq),
      detailMarkdown: String(toolForm.detailMarkdown || "").trim(),
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

  async function acceptCandidate(candidate, targetType = candidate.type || "news") {
    if (targetType === "tool") {
      await api.send("/api/tools", "POST", candidateToToolForm(candidate));
    } else {
      await api.send("/api/news", "POST", candidateToNewsForm(candidate));
    }
    await api.send(`/api/candidates/${encodeURIComponent(candidate.id)}`, "PUT", { status: "accepted", acceptedAs: targetType, acceptedAt: new Date().toISOString() });
    setMessage(`候选已采纳为${targetType === "tool" ? "工具草稿" : "资讯草稿"}`);
    await reload();
  }

  async function rejectCandidate(candidate) {
    await api.send(`/api/candidates/${encodeURIComponent(candidate.id)}`, "PUT", { status: "rejected", rejectedAt: new Date().toISOString() });
    setMessage("候选已拒绝");
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

  const shownTools = tools.filter((tool) => [tool.name, tool.summary, tool.detailMarkdown, categoryName(categories, tool.category)].join(" ").toLowerCase().includes(toolQuery.toLowerCase()));
  const shownNews = news.filter((item) => [item.title, item.summary, item.kind, item.sourceName].join(" ").toLowerCase().includes(newsQuery.toLowerCase()));
  const shownCandidates = candidates
    .filter((item) => [item.title, item.name, item.summary, item.sourceName, item.reason, item.type, item.status].join(" ").toLowerCase().includes(candidateQuery.toLowerCase()))
    .sort((a, b) => {
      const statusRank = { pending: 0, accepted: 1, rejected: 2 };
      return (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3) || Number(b.score || 0) - Number(a.score || 0);
    });
  const pendingCandidates = candidates.filter((item) => (item.status || "pending") === "pending");

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
            <h1>内容运营后台</h1>
            <p>维护工具库、Logo、分类、推荐状态和每日 AI 快讯内容。</p>
          </div>
          <span>PostgreSQL · {tools.length} 工具 / {news.length} 资讯 / {pendingCandidates.length} 待审</span>
        </header>

        <section className="admin-metrics" aria-label="后台概览">
          <div>
            <span>工具总数</span>
            <strong>{tools.length}</strong>
            <small>已发布 {tools.filter((tool) => tool.status !== "draft").length}</small>
          </div>
          <div>
            <span>最新收录</span>
            <strong>{tools.filter((tool) => tool.isNew).length}</strong>
            <small>首页自动展示前 4 行</small>
          </div>
          <div>
            <span>推荐工具</span>
            <strong>{tools.filter((tool) => tool.featured).length}</strong>
            <small>用于热门模块与侧栏</small>
          </div>
          <div>
            <span>候选池</span>
            <strong>{pendingCandidates.length}</strong>
            <small>全部候选 {candidates.length}</small>
          </div>
        </section>

        <section className="admin-switchboard" aria-label="后台模块切换">
          <button className={activeAdminSection === "tools" ? "active" : ""} type="button" onClick={() => setActiveAdminSection("tools")}>
            <strong>工具内容</strong>
            <span>详情页、Logo、分类和 SEO 内容</span>
          </button>
          <button className={activeAdminSection === "news" ? "active" : ""} type="button" onClick={() => setActiveAdminSection("news")}>
            <strong>每日资讯</strong>
            <span>快讯时间线、来源和封面内容</span>
          </button>
          <button className={activeAdminSection === "candidates" ? "active" : ""} type="button" onClick={() => setActiveAdminSection("candidates")}>
            <strong>候选审核</strong>
            <span>自动采集结果，确认后再入库</span>
          </button>
        </section>

        {activeAdminSection === "tools" ? (
          <section className="admin-grid admin-module">
            <SpotlightCard className="editor-panel" as="section">
              <div className="editor-heading">
                <span>Tool editor</span>
                <h2>{toolForm.id ? `编辑工具：${toolForm.name}` : "新增工具"}</h2>
                <p>{toolForm.id ? "已把前台默认详情带入表单；留空 Markdown 时，前台使用核心能力、使用场景和 FAQ 生成详情页。" : "先录入基础信息，再补充详情内容。重点工具建议写 Markdown 和配图。"}</p>
              </div>
              <form className="console-form admin-editor-form" onSubmit={saveTool}>
                <div className="form-cluster">
                  <h3>基础信息</h3>
                  <label>工具名称<input value={toolForm.name} onChange={(e) => updateTool("name", e.target.value)} required /></label>
                  <label>官网链接<input value={toolForm.url} onChange={(e) => updateTool("url", e.target.value)} required /></label>
                  <label>Logo 地址<input value={toolForm.logo} onChange={(e) => updateTool("logo", e.target.value)} /></label>
                  <div className="form-pair">
                    <label>分类<select value={toolForm.category} onChange={(e) => updateTool("category", e.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    <label>状态<select value={toolForm.status} onChange={(e) => updateTool("status", e.target.value)}><option value="published">发布</option><option value="draft">草稿</option></select></label>
                  </div>
                  <label>标签<input value={toolForm.tags} onChange={(e) => updateTool("tags", e.target.value)} placeholder="写作, 免费, 生成" /></label>
                  <label>简介<textarea value={toolForm.summary} onChange={(e) => updateTool("summary", e.target.value)} rows="4" /></label>
                </div>

                <div className="form-cluster detail-cluster">
                  <h3>详情页编排</h3>
                  <label>
                    详情 Markdown
                    <textarea
                      value={toolForm.detailMarkdown}
                      onChange={(e) => updateTool("detailMarkdown", e.target.value)}
                      rows="8"
                      placeholder={`## ${toolForm.name || "工具名称"} 是什么？\n支持 **加粗**、[链接](https://example.com)、列表和图片。\n\n- 核心能力一\n- 核心能力二\n\n![产品截图](https://example.com/screenshot.png)`}
                    />
                  </label>
                  <label>详情图片<textarea value={toolForm.galleryImages} onChange={(e) => updateTool("galleryImages", e.target.value)} rows="3" placeholder="每行一个图片 URL，可放产品截图、封面图或功能图" /></label>
                  <div className="form-pair">
                    <label>核心能力<textarea value={toolForm.features} onChange={(e) => updateTool("features", e.target.value)} rows="4" placeholder="每行一条，用于未填写 Markdown 时的详情页内容" /></label>
                    <label>使用场景<textarea value={toolForm.useCases} onChange={(e) => updateTool("useCases", e.target.value)} rows="4" placeholder="每行一条，适合人群或具体业务场景" /></label>
                  </div>
                  <label>FAQ<textarea value={toolForm.faq} onChange={(e) => updateTool("faq", e.target.value)} rows="4" placeholder="问题 | 回答，每行一条。例如：是否免费？ | 请以官网最新定价为准。" /></label>
                </div>

                <div className="form-cluster compact-cluster">
                  <h3>展示策略</h3>
                  <div className="form-pair">
                    <label>推荐<select value={toolForm.featured} onChange={(e) => updateTool("featured", e.target.value)}><option value="false">否</option><option value="true">是</option></select></label>
                    <label>新收录<select value={toolForm.isNew} onChange={(e) => updateTool("isNew", e.target.value)}><option value="true">是</option><option value="false">否</option></select></label>
                  </div>
                </div>

                <div className="form-actions"><button type="submit">保存工具</button><button type="button" onClick={() => setToolForm(emptyTool())}>清空</button></div>
              </form>
            </SpotlightCard>

            <SpotlightCard className="list-panel" as="section">
              <div className="panel-head"><div><span>Library</span><h2>工具库</h2></div><input value={toolQuery} onChange={(e) => setToolQuery(e.target.value)} placeholder="搜索工具、分类或简介" /></div>
              <div className="admin-list">
                {shownTools.slice(0, 160).map((tool) => (
                  <AdminRow
                    key={tool.id}
                    item={tool}
                    meta={`${categoryName(categories, tool.category)} · ${tool.status || "published"}`}
                    onEdit={() => {
                      setToolForm(toolToForm(tool, categories));
                      setActiveAdminSection("tools");
                    }}
                    onDelete={() => remove("tools", tool.id)}
                  />
                ))}
              </div>
            </SpotlightCard>
          </section>
        ) : activeAdminSection === "news" ? (
          <section className="admin-grid admin-module news-module">
            <SpotlightCard className="editor-panel" as="section">
              <div className="editor-heading">
                <span>Daily news</span>
                <h2>{newsForm.id ? `编辑资讯：${newsForm.title}` : "新增每日资讯"}</h2>
                <p>资讯会进入每日 AI 快讯页，建议标题短一些，摘要写完整事实和来源。</p>
              </div>
              <form className="console-form admin-editor-form" onSubmit={saveNews}>
                <div className="form-cluster">
                  <h3>资讯内容</h3>
                  <label>标题<input value={newsForm.title} onChange={(e) => updateNews("title", e.target.value)} required /></label>
                  <div className="form-pair">
                    <label>类型<select value={newsForm.kind} onChange={(e) => updateNews("kind", e.target.value)}><option value="资讯">资讯</option><option value="项目">项目</option><option value="教程">教程</option><option value="模型">模型</option></select></label>
                    <label>日期<input type="date" value={newsForm.publishedAt} onChange={(e) => updateNews("publishedAt", e.target.value)} /></label>
                  </div>
                  <div className="form-pair">
                    <label>来源名称<input value={newsForm.sourceName} onChange={(e) => updateNews("sourceName", e.target.value)} placeholder="机器之心 / AI工具集" /></label>
                    <label>来源链接<input value={newsForm.sourceUrl} onChange={(e) => updateNews("sourceUrl", e.target.value)} /></label>
                  </div>
                  <label>封面图地址<input value={newsForm.coverImage} onChange={(e) => updateNews("coverImage", e.target.value)} placeholder="用于每日快讯页头图，可留空" /></label>
                  <label>摘要 / 正文<textarea value={newsForm.summary} onChange={(e) => updateNews("summary", e.target.value)} rows="6" /></label>
                </div>
                <div className="form-cluster compact-cluster">
                  <h3>互动与状态</h3>
                  <div className="form-pair">
                    <label>评论数<input type="number" value={newsForm.comments} onChange={(e) => updateNews("comments", e.target.value)} /></label>
                    <label>点赞数<input type="number" value={newsForm.likes} onChange={(e) => updateNews("likes", e.target.value)} /></label>
                  </div>
                  <label>状态<select value={newsForm.status} onChange={(e) => updateNews("status", e.target.value)}><option value="published">发布</option><option value="draft">草稿</option></select></label>
                </div>
                <div className="form-actions"><button type="submit">保存资讯</button><button type="button" onClick={() => setNewsForm(emptyNews())}>清空</button></div>
              </form>
            </SpotlightCard>

            <SpotlightCard className="list-panel" as="section">
              <div className="panel-head"><div><span>Briefing</span><h2>每日资讯</h2></div><input value={newsQuery} onChange={(e) => setNewsQuery(e.target.value)} placeholder="搜索标题、来源或类型" /></div>
              <div className="admin-list">
                {shownNews.map((item) => (
                  <AdminRow
                    key={item.id}
                    item={{ ...item, name: item.title }}
                    meta={`${item.publishedAt || "未定日期"} · ${item.kind || "资讯"} · ${item.status || "published"}`}
                    onEdit={() => {
                      setNewsForm({ ...emptyNews(), ...item });
                      setActiveAdminSection("news");
                    }}
                    onDelete={() => remove("news", item.id)}
                  />
                ))}
              </div>
            </SpotlightCard>
          </section>
        ) : (
          <section className="admin-module candidate-module">
            <SpotlightCard className="list-panel candidate-panel" as="section">
              <div className="panel-head">
                <div>
                  <span>Review queue</span>
                  <h2>候选审核</h2>
                </div>
                <input value={candidateQuery} onChange={(e) => setCandidateQuery(e.target.value)} placeholder="搜索标题、来源、状态或推荐理由" />
              </div>
              <div className="candidate-list">
                {shownCandidates.map((candidate) => (
                  <article className={`candidate-card status-${candidate.status || "pending"}`} key={candidate.id}>
                    <div className="candidate-score">
                      <strong>{candidate.score || 60}</strong>
                      <span>{candidate.type === "tool" ? "工具" : "资讯"}</span>
                    </div>
                    <div className="candidate-body">
                      <div className="candidate-title">
                        <h3>{candidate.title || candidate.name}</h3>
                        <span>{candidate.status || "pending"}</span>
                      </div>
                      <p>{candidate.summary}</p>
                      <small>{candidate.sourceName || "自动采集"} · {candidate.reason || "待人工确认"}</small>
                      <div className="candidate-actions">
                        {candidate.url || candidate.sourceUrl ? <a href={candidate.url || candidate.sourceUrl} target="_blank" rel="noopener noreferrer">查看来源</a> : null}
                        <button type="button" onClick={() => { setToolForm(candidateToToolForm(candidate)); setActiveAdminSection("tools"); }}>编辑为工具</button>
                        <button type="button" onClick={() => { setNewsForm(candidateToNewsForm(candidate)); setActiveAdminSection("news"); }}>编辑为资讯</button>
                        <button type="button" onClick={() => acceptCandidate(candidate, "tool")}>采纳工具草稿</button>
                        <button type="button" onClick={() => acceptCandidate(candidate, "news")}>采纳资讯草稿</button>
                        <button type="button" className="danger" onClick={() => rejectCandidate(candidate)}>拒绝</button>
                        <button type="button" className="danger ghost" onClick={() => remove("candidates", candidate.id)}>删除</button>
                      </div>
                    </div>
                  </article>
                ))}
                {!shownCandidates.length ? <p className="empty-hint">暂无候选。可以运行采集脚本生成待审内容。</p> : null}
              </div>
            </SpotlightCard>
          </section>
        )}
        <p className="form-message">{message}</p>
      </main>
    </div>
  );
}

function toolToForm(tool, categories) {
  const category = categoryName(categories, tool.category);
  const features = splitLines(tool.features);
  const useCases = splitLines(tool.useCases);
  const faq = parseFaq(tool.faq);
  return {
    ...emptyTool(),
    ...tool,
    tags: (tool.tags || []).join(", "),
    featured: String(Boolean(tool.featured)),
    isNew: String(Boolean(tool.isNew)),
    features: (features.length ? features : defaultToolFeatures(tool, category)).join("\n"),
    useCases: (useCases.length ? useCases : defaultToolUseCases(tool, category)).join("\n"),
    galleryImages: splitLines(tool.galleryImages).join("\n"),
    faq: stringifyFaq(faq.length ? faq : defaultToolFaq(tool, category)),
    detailMarkdown: tool.detailMarkdown || "",
  };
}

function candidateToToolForm(candidate) {
  const title = candidate.name || candidate.title || "";
  const tags = Array.isArray(candidate.tags) ? candidate.tags : splitLines(candidate.tags);
  return {
    ...emptyTool(),
    id: "",
    name: title,
    url: candidate.url || candidate.sourceUrl || "",
    logo: candidate.logo || "",
    category: candidate.category || "chat",
    status: "draft",
    tags: tags.join(", "),
    summary: candidate.summary || "",
    detailMarkdown: candidate.detailMarkdown || `## ${title} 是什么？\n${candidate.summary || "这里补充工具定位、核心能力和适合人群。"}\n\n## 推荐理由\n${candidate.reason || "来自自动采集候选，建议人工确认后完善。"}\n\n## 来源\n[查看原始来源](${candidate.url || candidate.sourceUrl || "https://example.com"})`,
    galleryImages: splitLines(candidate.galleryImages).join("\n"),
    features: splitLines(candidate.features).join("\n"),
    useCases: splitLines(candidate.useCases).join("\n"),
    faq: stringifyFaq(candidate.faq),
    featured: "false",
    isNew: "true",
  };
}

function candidateToNewsForm(candidate) {
  return {
    ...emptyNews(),
    id: "",
    title: candidate.title || candidate.name || "",
    kind: candidate.kind || (candidate.type === "tool" ? "项目" : "资讯"),
    publishedAt: new Date().toISOString().slice(0, 10),
    sourceName: candidate.sourceName || "自动采集",
    sourceUrl: candidate.sourceUrl || candidate.url || "",
    coverImage: candidate.coverImage || "",
    summary: candidate.summary || candidate.reason || "",
    comments: 0,
    likes: 0,
    status: "draft",
  };
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
  return {
    id: "",
    name: "",
    url: "",
    logo: "",
    category: "chat",
    status: "published",
    tags: "",
    summary: "",
    detailMarkdown: "",
    galleryImages: "",
    features: "",
    useCases: "",
    faq: "",
    featured: "false",
    isNew: "true",
  };
}

function emptyNews() {
  return {
    id: "",
    title: "",
    kind: "资讯",
    publishedAt: new Date().toISOString().slice(0, 10),
    sourceName: "",
    sourceUrl: "",
    coverImage: "",
    summary: "",
    comments: 0,
    likes: 0,
    status: "published",
  };
}

function App() {
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return <AdminPage />;
  if (path.startsWith("/login")) return <LoginPage />;
  if (path.startsWith("/daily-ai-news")) return <DailyNewsPage />;
  if (path.startsWith("/sites/")) return <ToolDetailPage toolId={path.split("/sites/")[1]?.replace(/\.html$/i, "").replace(/\/$/, "")} />;
  if (path.startsWith("/category/")) return <CategoryPage categoryId={path.split("/category/")[1]?.replace(/\/$/, "")} />;
  return <HomePage />;
}

export { HomePage, CategoryPage, DailyNewsPage, ToolDetailPage, LoginPage, AdminPage };
export default App;
