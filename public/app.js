const THEME_KEY = "techscope-theme";

const state = {
  selectedCompanies: [],
  selectedTopics: [],
  range: "all",
  currentPage: 1,
  pageSize: 60,
  allPosts: [],
  companies: [],
  topics: []
};

const els = {
  refreshBtn: document.querySelector("#refreshBtn"),
  themeToggle: document.querySelector("#themeToggle"),
  themeToggleText: document.querySelector(".theme-toggle-text"),
  rangeTabs: Array.from(document.querySelectorAll(".range-tab")),
  companyTabList: document.querySelector("#companyTabList"),
  topicChipList: document.querySelector("#topicChipList"),
  postGrid: document.querySelector("#postGrid"),
  emptyState: document.querySelector("#emptyState"),
  postPagination: document.querySelector("#postPagination"),
  template: document.querySelector("#postCardTemplate"),
  totalCount: document.querySelector("#totalCount"),
  statusText: document.querySelector("#statusText"),
  lastLoadedAt: document.querySelector("#lastLoadedAt"),
  resultSummary: document.querySelector("#resultSummary"),
  activeFilters: document.querySelector("#activeFilters"),
  sourceList: document.querySelector("#sourceList"),
  copyToast: document.querySelector("#copyToast"),
  sourceStatusToggle: document.querySelector("#sourceStatusToggle")
};

let copyToastTimer = null;

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

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(value) {
  return String(value).replace(/"/g, "&quot;");
}

function makePill(text) {
  const el = document.createElement("span");
  el.className = "pill";
  el.textContent = text;
  return el;
}

function renderPills() {
  clearChildren(els.activeFilters);

  for (const company of state.selectedCompanies) {
    els.activeFilters.append(makePill(`기업: ${company}`));
  }

  for (const topic of state.selectedTopics) {
    els.activeFilters.append(makePill(`분야: ${topic}`));
  }

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
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
}

function applySelectionFilters(posts) {
  return posts.filter((post) => {
    const companyMatch =
      state.selectedCompanies.length === 0 || state.selectedCompanies.includes(post.company);
    const topicMatch =
      state.selectedTopics.length === 0 || state.selectedTopics.includes(post.primaryTopic);
    return companyMatch && topicMatch;
  });
}

function applyRangeFilter(posts) {
  if (state.range === "all") return posts;
  const now = new Date();

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

function resetToFirstPage() {
  state.currentPage = 1;
}

function getTotalPages(totalItems) {
  return Math.max(1, Math.ceil(totalItems / state.pageSize));
}

function getPagedPosts(posts) {
  const totalItems = posts.length;
  const totalPages = getTotalPages(totalItems);
  state.currentPage = Math.min(Math.max(state.currentPage, 1), totalPages);

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;

  return {
    items: posts.slice(start, end),
    totalItems,
    totalPages,
    startIndex: totalItems === 0 ? 0 : start + 1,
    endIndex: Math.min(end, totalItems)
  };
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

function renderCompanyTabs(companies) {
  clearChildren(els.companyTabList);

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `company-tab ${state.selectedCompanies.length === 0 ? "is-active" : ""}`;
  allBtn.textContent = "전체 기업";
  allBtn.setAttribute("aria-selected", String(state.selectedCompanies.length === 0));
  allBtn.addEventListener("click", () => {
    if (state.selectedCompanies.length === 0) return;
    state.selectedCompanies = [];
    renderCompanyTabs(state.companies);
    resetToFirstPage();
    rerenderPostArea();
  });
  els.companyTabList.append(allBtn);

  for (const company of companies) {
    const active = state.selectedCompanies.includes(company);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `company-tab ${active ? "is-active" : ""}`;
    btn.setAttribute("aria-selected", String(active));
    btn.innerHTML = `
      <span class="company-tab-avatar" aria-hidden="true"></span>
      <span class="company-tab-name">${esc(company)}</span>
    `;
    applyAvatar(btn.querySelector(".company-tab-avatar"), company);
    btn.addEventListener("click", () => {
      if (active) {
        state.selectedCompanies = state.selectedCompanies.filter((c) => c !== company);
      } else {
        state.selectedCompanies = [...state.selectedCompanies, company];
      }
      renderCompanyTabs(state.companies);
      resetToFirstPage();
      rerenderPostArea();
    });
    els.companyTabList.append(btn);
  }
}

function renderTopicChips(topics) {
  clearChildren(els.topicChipList);

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = `topic-filter-chip ${state.selectedTopics.length === 0 ? "is-active" : ""}`;
  allChip.textContent = "전체";
  allChip.addEventListener("click", () => {
    if (state.selectedTopics.length === 0) return;
    state.selectedTopics = [];
    renderTopicChips(state.topics);
    resetToFirstPage();
    rerenderPostArea();
  });
  els.topicChipList.append(allChip);

  for (const topic of topics) {
    const active = state.selectedTopics.includes(topic);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `topic-filter-chip ${active ? "is-active" : ""}`;
    chip.textContent = topic;
    chip.addEventListener("click", () => {
      if (active) {
        state.selectedTopics = state.selectedTopics.filter((t) => t !== topic);
      } else {
        state.selectedTopics = [...state.selectedTopics, topic];
      }
      renderTopicChips(state.topics);
      resetToFirstPage();
      rerenderPostArea();
    });
    els.topicChipList.append(chip);
  }
}

function renderPosts(posts) {
  clearChildren(els.postGrid);

  for (const post of posts) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".company-chip").textContent = post.company;
    node.querySelector(".topic-chip").textContent = topicLabel(post.primaryTopic);

    const titleLink = node.querySelector(".post-title-link");
    titleLink.textContent = post.title;
    titleLink.href = post.url;

    node.querySelector(".post-summary").textContent = post.summary || "요약 정보가 없습니다.";
    node.querySelector(".post-date").textContent = formatDate(getDateBasis(post));
    applyAvatar(node.querySelector(".company-avatar"), post.company);

    const copyBtn = node.querySelector(".copy-link-btn");
    copyBtn.title = "링크 복사";
    copyBtn.setAttribute("aria-label", `${post.title} 링크 복사`);
    copyBtn.addEventListener("click", async () => {
      const copied = await copyText(post.url);
      copyBtn.classList.add("is-copied");
      copyBtn.title = copied ? "복사됨" : "복사 실패";
      copyBtn.setAttribute("aria-label", copied ? "복사됨" : "복사 실패");
      showCopyToast(copied ? "링크가 복사되었습니다." : "링크 복사에 실패했습니다.");
      setTimeout(() => {
        copyBtn.classList.remove("is-copied");
        copyBtn.title = "링크 복사";
        copyBtn.setAttribute("aria-label", `${post.title} 링크 복사`);
      }, 900);
    });

    els.postGrid.append(node);
  }

  els.emptyState.classList.toggle("hidden", posts.length > 0);
}

function renderPagination(totalItems) {
  if (!els.postPagination) return;

  clearChildren(els.postPagination);
  const totalPages = getTotalPages(totalItems);
  const visible = totalItems > 0 && totalPages > 1;
  els.postPagination.classList.toggle("hidden", !visible);
  if (!visible) return;

  const createButton = (label, page, { active = false, disabled = false } = {}) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pagination-btn ${active ? "is-active" : ""}`;
    btn.textContent = label;
    btn.disabled = disabled;
    if (active) btn.setAttribute("aria-current", "page");

    btn.addEventListener("click", () => {
      if (disabled || page === state.currentPage) return;
      state.currentPage = page;
      rerenderPostArea();
      els.postPagination.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return btn;
  };

  els.postPagination.append(
    createButton("이전", Math.max(1, state.currentPage - 1), {
      disabled: state.currentPage === 1
    })
  );

  const windowSize = 5;
  let startPage = Math.max(1, state.currentPage - 2);
  let endPage = Math.min(totalPages, startPage + windowSize - 1);
  startPage = Math.max(1, endPage - windowSize + 1);

  if (startPage > 1) {
    els.postPagination.append(createButton("1", 1));
    if (startPage > 2) {
      const gap = document.createElement("span");
      gap.className = "pagination-gap";
      gap.textContent = "…";
      els.postPagination.append(gap);
    }
  }

  for (let page = startPage; page <= endPage; page += 1) {
    els.postPagination.append(
      createButton(String(page), page, { active: page === state.currentPage })
    );
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const gap = document.createElement("span");
      gap.className = "pagination-gap";
      gap.textContent = "…";
      els.postPagination.append(gap);
    }
    els.postPagination.append(createButton(String(totalPages), totalPages));
  }

  els.postPagination.append(
    createButton("다음", Math.min(totalPages, state.currentPage + 1), {
      disabled: state.currentPage === totalPages
    })
  );
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

function rerenderPostArea() {
  const visible = applyRangeFilter(applySelectionFilters(state.allPosts));
  const paged = getPagedPosts(visible);
  renderPills();
  renderPosts(paged.items);
  renderPagination(paged.totalItems);
  if (paged.totalItems === 0) {
    els.resultSummary.textContent = `0개 표시 / 전체 ${state.allPosts.length}개`;
    return;
  }
  els.resultSummary.textContent = `${paged.startIndex}-${paged.endIndex} / ${paged.totalItems}개 (페이지 ${state.currentPage}/${paged.totalPages}) · 전체 ${state.allPosts.length}개`;
}

function setRange(nextRange) {
  state.range = nextRange;
  resetToFirstPage();
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

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function showCopyToast(message) {
  if (!els.copyToast) return;
  els.copyToast.textContent = message;
  els.copyToast.classList.add("is-visible");

  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(() => {
    els.copyToast.classList.remove("is-visible");
  }, 1400);
}

async function loadPosts() {
  els.statusText.textContent = "불러오는 중";
  const params = new URLSearchParams({ limit: "120" });

  try {
    const [postsRes, runsRes] = await Promise.all([
      fetch(`/api/posts?${params.toString()}`),
      fetch("/api/crawl-runs?limit=1")
    ]);
    if (!postsRes.ok) throw new Error(`API ${postsRes.status}`);

    const data = await postsRes.json();
    const runsData = runsRes.ok ? await runsRes.json() : { runs: [] };

    state.companies = Array.isArray(data.filters?.companies) ? data.filters.companies : [];
    state.topics = Array.isArray(data.filters?.topics) ? data.filters.topics : [];
    state.allPosts = Array.isArray(data.posts) ? data.posts : [];
    resetToFirstPage();

    renderCompanyTabs(state.companies);
    renderTopicChips(state.topics);
    renderSources(Array.isArray(data.sources) ? data.sources : []);

    els.totalCount.textContent = String(data.pagination?.total ?? 0);
    const latestRun = Array.isArray(runsData.runs) ? runsData.runs[0] : null;
    const lastUpdatedAt = latestRun?.finished_at || latestRun?.started_at || null;
    els.lastLoadedAt.textContent = lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "-";
    els.statusText.textContent = "정상";

    rerenderPostArea();
  } catch (error) {
    console.error(error);
    els.statusText.textContent = "오류";
    state.allPosts = [];
    els.resultSummary.textContent = "데이터를 불러오지 못했습니다.";
    renderPills();
    renderPosts([]);
    renderPagination(0);
  }
}

els.refreshBtn?.addEventListener("click", () => {
  state.selectedCompanies = [];
  state.selectedTopics = [];
  setRange("all");
  loadPosts();
});

els.rangeTabs.forEach((btn) => {
  btn.addEventListener("click", () => setRange(btn.dataset.range || "all"));
});

els.themeToggle?.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

els.sourceStatusToggle?.addEventListener("click", () => {
  const isHidden = els.sourceList.classList.toggle("hidden");
  els.sourceStatusToggle.textContent = isHidden ? "보기" : "숨기기";
  els.sourceStatusToggle.setAttribute("aria-expanded", String(!isHidden));
});

initTheme();
setRange(state.range);
loadPosts();
