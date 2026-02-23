const THEME_KEY = "techscope-theme";

const state = {
  company: "",
  topic: "",
  range: "all",
  allPosts: []
};

const els = {
  companyFilter: document.querySelector("#companyFilter"),
  topicFilter: document.querySelector("#topicFilter"),
  refreshBtn: document.querySelector("#refreshBtn"),
  themeToggle: document.querySelector("#themeToggle"),
  themeToggleText: document.querySelector(".theme-toggle-text"),
  rangeTabs: Array.from(document.querySelectorAll(".range-tab")),
  postGrid: document.querySelector("#postGrid"),
  emptyState: document.querySelector("#emptyState"),
  template: document.querySelector("#postCardTemplate"),
  totalCount: document.querySelector("#totalCount"),
  statusText: document.querySelector("#statusText"),
  lastLoadedAt: document.querySelector("#lastLoadedAt"),
  resultSummary: document.querySelector("#resultSummary"),
  activeFilters: document.querySelector("#activeFilters"),
  sourceList: document.querySelector("#sourceList")
};

function formatDate(value) {
  if (!value) return "날짜 없음";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

function formatDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function rebuildSelect(select, placeholder, values, selected) {
  clearChildren(select);
  const base = document.createElement("option");
  base.value = "";
  base.textContent = placeholder;
  select.append(base);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    if (value === selected) option.selected = true;
    select.append(option);
  }
}

function makePill(text) {
  const el = document.createElement("span");
  el.className = "pill";
  el.textContent = text;
  return el;
}

function renderPills() {
  clearChildren(els.activeFilters);

  if (state.company) els.activeFilters.append(makePill(`기업: ${state.company}`));
  if (state.topic) els.activeFilters.append(makePill(`분야: ${state.topic}`));
  if (state.range === "today") els.activeFilters.append(makePill("기간: 오늘"));
  if (state.range === "week") els.activeFilters.append(makePill("기간: 이번 주"));
}

function getDateBasis(post) {
  return post.publishedAt || post.fetchedAt || null;
}

function isSameLocalDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getStartOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
}

function applyRangeFilter(posts) {
  if (state.range === "all") return posts;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (state.range === "today") {
    return posts.filter((post) => {
      const raw = getDateBasis(post);
      if (!raw) return false;
      const d = new Date(raw);
      return !Number.isNaN(d.getTime()) && isSameLocalDate(d, now);
    });
  }

  if (state.range === "week") {
    const weekStart = getStartOfWeek(now);
    return posts.filter((post) => {
      const raw = getDateBasis(post);
      if (!raw) return false;
      const d = new Date(raw);
      return !Number.isNaN(d.getTime()) && d >= weekStart && d <= now;
    });
  }

  return posts;
}

function topicLabel(value) {
  return value || "other";
}

function avatarLabel(company) {
  if (!company) return "?";
  const compact = company.replace(/\s+/g, "");
  if (/^[A-Za-z]/.test(compact)) return compact.slice(0, 2).toUpperCase();
  return compact.slice(0, 1);
}

function avatarHue(seed) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

function applyAvatar(el, company) {
  const hue = avatarHue(company || "TechScope");
  el.textContent = avatarLabel(company);
  el.style.background = `linear-gradient(180deg, hsl(${hue} 75% 97%), hsl(${hue} 65% 92%))`;
  el.style.color = `hsl(${hue} 55% 28%)`;
  el.style.borderColor = `hsl(${hue} 35% 84%)`;
}

function renderPosts(posts) {
  clearChildren(els.postGrid);

  for (const post of posts) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".company-chip").textContent = post.company;
    node.querySelector(".topic-chip").textContent = topicLabel(post.primaryTopic);
    node.querySelector(".post-title").textContent = post.title;
    node.querySelector(".post-summary").textContent = post.summary || "요약 정보가 없습니다.";
    node.querySelector(".post-date").textContent = formatDate(getDateBasis(post));
    applyAvatar(node.querySelector(".company-avatar"), post.company);

    const link = node.querySelector(".post-link");
    link.href = post.url;
    link.setAttribute("aria-label", `${post.title} 원문 보기`);

    els.postGrid.append(node);
  }

  els.emptyState.classList.toggle("hidden", posts.length > 0);
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(value) {
  return String(value).replace(/"/g, "&quot;");
}

function renderSources(sources) {
  clearChildren(els.sourceList);

  for (const source of sources) {
    const card = document.createElement("div");
    card.className = "source-item";

    const hue = avatarHue(source.company || source.id);
    const avatarBg = `linear-gradient(180deg, hsl(${hue} 75% 97%), hsl(${hue} 65% 92%))`;
    const avatarColor = `hsl(${hue} 55% 28%)`;
    const avatarBorder = `hsl(${hue} 35% 84%)`;

    card.innerHTML = `
      <div class="source-top">
        <div class="source-brand">
          <span class="source-avatar" style="background:${avatarBg};color:${avatarColor};border-color:${avatarBorder}">${esc(avatarLabel(source.company))}</span>
          <span class="source-name">${esc(source.company)}</span>
        </div>
        <span class="badge ${source.feedReady ? "ready" : "pending"}">${source.feedReady ? "RSS 준비" : "확인 필요"}</span>
      </div>
      <small>${esc(source.note || (source.enabled ? "수집 활성화" : "비활성화"))}</small>
      <a href="${escAttr(source.homepageUrl)}" target="_blank" rel="noopener noreferrer">홈페이지 열기</a>
    `;

    els.sourceList.append(card);
  }
}

function getDisplayedPosts() {
  return applyRangeFilter(state.allPosts);
}

function rerenderPostArea() {
  const visible = getDisplayedPosts();
  renderPills();
  renderPosts(visible);
  els.resultSummary.textContent = `${visible.length}개 표시 / 전체 ${state.allPosts.length}개`;
}

function setRange(nextRange) {
  state.range = nextRange;
  for (const btn of els.rangeTabs) {
    const active = btn.dataset.range === nextRange;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  }
  rerenderPostArea();
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  if (els.themeToggleText) {
    els.themeToggleText.textContent = normalized === "dark" ? "라이트모드" : "다크모드";
  }
  try {
    localStorage.setItem(THEME_KEY, normalized);
  } catch {
    // Ignore storage errors
  }
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    saved = null;
  }

  if (saved === "light" || saved === "dark") {
    applyTheme(saved);
    return;
  }

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  applyTheme(prefersDark ? "dark" : "light");
}

async function loadPosts() {
  els.statusText.textContent = "불러오는 중";

  const params = new URLSearchParams({ limit: "120" });
  if (state.company) params.set("company", state.company);
  if (state.topic) params.set("topic", state.topic);

  try {
    const res = await fetch(`/api/posts?${params.toString()}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();

    rebuildSelect(els.companyFilter, "전체 기업", data.filters?.companies || [], state.company);
    rebuildSelect(els.topicFilter, "전체 분야", data.filters?.topics || [], state.topic);
    renderSources(data.sources || []);

    state.allPosts = Array.isArray(data.posts) ? data.posts : [];

    els.totalCount.textContent = String(data.pagination?.total ?? 0);
    els.lastLoadedAt.textContent = formatDateTime(new Date().toISOString());
    els.statusText.textContent = "정상";

    rerenderPostArea();
  } catch (err) {
    console.error(err);
    els.statusText.textContent = "오류";
    state.allPosts = [];
    els.resultSummary.textContent = "데이터를 불러오지 못했습니다.";
    renderPills();
    renderPosts([]);
  }
}

els.companyFilter.addEventListener("change", (e) => {
  state.company = e.target.value;
  loadPosts();
});

els.topicFilter.addEventListener("change", (e) => {
  state.topic = e.target.value;
  loadPosts();
});

els.refreshBtn.addEventListener("click", () => {
  loadPosts();
});

els.rangeTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    setRange(btn.dataset.range || "all");
  });
});

els.themeToggle?.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

initTheme();
setRange(state.range);
loadPosts();
