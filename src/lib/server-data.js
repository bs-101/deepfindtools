import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const seedPath = path.join(root, "data", "seed.json");
const dbPath = path.join(root, "data", "db.json");
const apiBase = process.env.API_INTERNAL_URL || "";

function isRemoteUrl(value = "") {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeExternalUrl(value = "") {
  if (!isRemoteUrl(value)) return value || "";
  const parsed = new URL(value);
  if (parsed.hostname.includes("ai-bot.cn")) return "";
  const trackingKeys = new Set([
    "aibot",
    "ai_bot",
    "campaign",
    "cgv",
    "channel",
    "channelid",
    "from",
    "fromid",
    "ic",
    "invite",
    "invite_code",
    "invite_ref",
    "invitecode",
    "invitesource",
    "invitationcode",
    "invitation",
    "medium",
    "pic",
    "ref",
    "refer",
    "referral",
    "referrer",
    "referrer_s",
    "share_token",
    "sid",
    "source",
    "sourceid",
    "souceid",
    "spm",
    "track",
    "utm",
    "usercode",
  ]);
  for (const key of Array.from(parsed.searchParams.keys())) {
    const marker = `${key}=${parsed.searchParams.get(key) || ""}`.toLowerCase();
    if (key.toLowerCase().startsWith("utm_") || trackingKeys.has(key.toLowerCase()) || marker.includes("ai-bot") || marker.includes("aibot")) {
      parsed.searchParams.delete(key);
    }
  }
  const hashMarker = parsed.hash.toLowerCase();
  if (hashMarker.includes("ai-bot") || hashMarker.includes("aibot") || Array.from(trackingKeys).some((key) => hashMarker.includes(key))) {
    parsed.hash = "";
  }
  return parsed.toString();
}

function publicTool(tool) {
  const item = { ...tool };
  const id = String(item.id || "");
  const officialUrl = sanitizeExternalUrl(item.url || "");
  item.url = officialUrl;
  item.officialUrl = officialUrl;
  item.detailUrl = id ? `/sites/${id}.html` : officialUrl;
  if (item.logo) item.logo = id ? `/api/logo/${id}` : item.logo;
  delete item.logoRemote;
  return item;
}

function publicNewsItem(news) {
  const item = { ...news };
  if (item.sourceUrl) item.sourceUrl = sanitizeExternalUrl(item.sourceUrl);
  if (item.coverImage && isRemoteUrl(item.coverImage)) item.coverImage = sanitizeExternalUrl(item.coverImage);
  return item;
}

async function readLocalData() {
  const file = await fs
    .readFile(dbPath, "utf8")
    .catch(() => fs.readFile(seedPath, "utf8"));
  const data = JSON.parse(file);
  return {
    categories: data.categories || [],
    tools: (data.tools || []).filter((item) => item.status !== "draft").map(publicTool),
    news: (data.news || []).filter((item) => item.status !== "draft").map(publicNewsItem),
  };
}

async function fetchApi(pathname) {
  if (!apiBase) throw new Error("API_INTERNAL_URL is not configured");
  const response = await fetch(`${apiBase}${pathname}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${pathname}: ${response.status}`);
  return response.json();
}

export async function getPublicData() {
  try {
    const [tools, categories, news] = await Promise.all([
      fetchApi("/api/tools"),
      fetchApi("/api/categories"),
      fetchApi("/api/news"),
    ]);
    return { tools, categories, news };
  } catch {
    return readLocalData();
  }
}

export async function getPublicPaths() {
  const data = await readLocalData();
  return data;
}

export function findTool(data, id) {
  return data.tools.find((tool) => String(tool.id) === String(id));
}

export function categoryName(categories, id) {
  return categories.find((category) => category.id === id)?.name || "AI工具";
}

export function siteBase() {
  return (process.env.PUBLIC_BASE_URL || "https://ai.deepfindtools.com").replace(/\/$/, "");
}

export function toolDescription(tool, categories) {
  return `${tool.name}：${tool.summary || categoryName(categories, tool.category)}。DeepFind Tools 收录的 AI 工具详情、分类、标签和官网入口。`;
}
