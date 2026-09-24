import { normalizeVideos } from "./youtube.js";
import { SITE_CONFIG } from "./site-config.js";

const grid = document.querySelector("#lesson-grid");
const search = document.querySelector("#lesson-search");
const filters = [...document.querySelectorAll("[data-category]")];
const count = document.querySelector("#lesson-count");
const empty = document.querySelector("#library-empty");
const emptyTitle = document.querySelector("#empty-title");
const emptyDescription = document.querySelector("#empty-description");
const emptyEyebrow = document.querySelector("#empty-eyebrow");
const contact = document.querySelector("#empty-contact");
const reset = document.querySelector("#reset-filters");
const retry = document.querySelector("#retry-lessons");
let videos = [];
let activeCategory = "all";
let loadFailed = false;
let loading = true;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function videoCard(video) {
  const card = element("a", "video-card");
  card.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  card.setAttribute(
    "aria-label",
    `${video.title} — watch on YouTube (opens in a new tab)`,
  );
  const thumbnail = element("div", "video-thumbnail");
  const image = element("img");
  image.src = `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`;
  image.alt = "";
  image.loading = "lazy";
  image.width = 480;
  image.height = 360;
  image.addEventListener("error", () => {
    image.hidden = true;
  });
  const play = element("span", "play-circle", "▶");
  play.setAttribute("aria-hidden", "true");
  thumbnail.append(image, play);
  const body = element("div", "video-card-body");
  body.append(
    element("p", "eyebrow", video.category),
    element("h2", "", video.title),
  );
  if (video.description)
    body.append(element("p", "video-description", video.description));
  body.append(element("span", "text-link", "Watch on YouTube ↗"));
  card.append(thumbnail, body);
  return card;
}

function render() {
  if (loading) return;
  const query = search.value.trim().toLocaleLowerCase();
  const filtered = videos.filter(
    (video) =>
      (activeCategory === "all" || video.category === activeCategory) &&
      `${video.title} ${video.description || ""} ${video.category}`
        .toLocaleLowerCase()
        .includes(query),
  );
  grid.replaceChildren(...filtered.map(videoCard));
  const hasFilters = Boolean(query) || activeCategory !== "all";
  count.textContent = loadFailed
    ? "The library couldn’t be loaded."
    : `${filtered.length} ${filtered.length === 1 ? "lesson" : "lessons"}${hasFilters ? " found" : " to explore"}`;
  empty.hidden = filtered.length > 0;
  reset.hidden = !hasFilters || loadFailed;
  retry.hidden = !loadFailed;
  contact.hidden = loadFailed || (videos.length > 0 && hasFilters);
  if (loadFailed) {
    emptyEyebrow.textContent = "LET’S TRY THAT AGAIN";
    emptyTitle.textContent = "A small pause in the learning.";
    emptyDescription.textContent =
      "We couldn’t load the lesson library. Check your connection and try again.";
  } else if (videos.length > 0 && filtered.length === 0) {
    emptyEyebrow.textContent = "KEEP EXPLORING";
    emptyTitle.textContent = "No lessons found just yet.";
    emptyDescription.textContent =
      "Try a different search or clear the topic filter to see all lessons.";
  } else {
    emptyEyebrow.textContent = "GOOD THINGS TAKE A LITTLE CURIOSITY";
    emptyTitle.textContent = "The next chapter is on its way.";
    emptyDescription.textContent =
      "New video lessons will be shared here. Until then, bring your questions to a one-on-one consulting or tutoring session.";
  }
}

async function loadLessons() {
  loading = true;
  loadFailed = false;
  empty.hidden = true;
  count.textContent = "Loading the lesson library…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const siteRoot = new URL("../../", import.meta.url);
    const response = await fetch(new URL(SITE_CONFIG.videosPath, siteRoot), {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Unable to load lessons");
    videos = normalizeVideos(await response.json());
  } catch {
    loadFailed = true;
    videos = [];
  } finally {
    clearTimeout(timeout);
    loading = false;
    render();
  }
}

filters.forEach((button) =>
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    filters.forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    render();
  }),
);
search.addEventListener("input", render);
reset.addEventListener("click", () => {
  search.value = "";
  filters[0].click();
  search.focus();
});
retry.addEventListener("click", loadLessons);
loadLessons();
