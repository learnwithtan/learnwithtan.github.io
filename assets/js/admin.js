import { ADMIN_PASSWORD, CATEGORIES, SITE_CONFIG } from "./site-config.js";
import { parseYouTubeId } from "./youtube.js";
import { addVideoToGitHub, PublishError } from "./github.js";

const $ = (id) => document.getElementById(id);
const gateForm = $("gate-form");
const editor = $("editor-panel");
const videoForm = $("video-form");
const tokenInput = $("github-token");
const urlInput = $("video-url");
const titleInput = $("video-title");
const descriptionInput = $("video-description");
const categoryInput = $("video-category");
const publishButton = $("publish-button");
let unlocked = false;
let publishing = false;
let controller = null;

for (const category of CATEGORIES) {
  const option = document.createElement("option");
  option.value = category;
  option.textContent = category;
  categoryInput.append(option);
}

function setStatus(id, message, state = "") {
  const element = $(id);
  element.textContent = message;
  element.dataset.state = state;
}

function updatePreview() {
  const id = parseYouTubeId(urlInput.value);
  const image = $("preview-image");
  urlInput.setCustomValidity(
    urlInput.value && !id ? "Enter a valid YouTube video link." : "",
  );
  titleInput.setCustomValidity(
    titleInput.value && !titleInput.value.trim() ? "Enter a lesson title." : "",
  );
  image.hidden = !id;
  $("preview-placeholder").hidden = Boolean(id);
  if (id) {
    const source = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    if (image.src !== source) image.src = source;
  } else {
    image.removeAttribute("src");
  }
  $("preview-category").textContent = categoryInput.value;
  $("preview-title").textContent =
    titleInput.value.trim() || "Your next lesson";
  $("preview-description").textContent =
    descriptionInput.value.trim() || "A new idea. A clearer understanding.";
}

gateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("admin-password").value !== ADMIN_PASSWORD) {
    setStatus(
      "gate-status",
      "That password is not correct. Please try again.",
      "error",
    );
    $("admin-password").focus();
    return;
  }
  unlocked = true;
  $("admin-password").value = "";
  setStatus("gate-status", "");
  $("gate-panel").hidden = true;
  editor.hidden = false;
  $("editor-heading").focus();
});

function signOut() {
  unlocked = false;
  controller?.abort();
  controller = null;
  tokenInput.value = "";
  videoForm.reset();
  gateForm.reset();
  editor.hidden = true;
  $("gate-panel").hidden = false;
  setStatus("publish-status", "");
  updatePreview();
  $("admin-password").focus();
}

$("sign-out").addEventListener("click", signOut);
window.addEventListener("pagehide", () => {
  controller?.abort();
  tokenInput.value = "";
  $("admin-password").value = "";
  unlocked = false;
  editor.hidden = true;
  $("gate-panel").hidden = false;
});

for (const element of [urlInput, titleInput, descriptionInput, categoryInput])
  element.addEventListener("input", updatePreview);
$("preview-image").addEventListener("error", () => {
  $("preview-image").hidden = true;
  $("preview-placeholder").hidden = false;
});

videoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!unlocked || publishing) return;
  updatePreview();
  if (!videoForm.reportValidity()) return;

  const video = {
    id: parseYouTubeId(urlInput.value),
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    category: categoryInput.value,
    addedAt: new Date().toISOString(),
  };
  publishing = true;
  controller = new AbortController();
  for (const input of videoForm.querySelectorAll("input, select, textarea"))
    input.disabled = true;
  publishButton.disabled = true;
  publishButton.textContent = "Saving to GitHub…";
  videoForm.setAttribute("aria-busy", "true");
  setStatus(
    "publish-status",
    "Checking the latest lesson catalog and saving your video…",
  );

  try {
    await addVideoToGitHub({
      config: SITE_CONFIG,
      token: tokenInput.value,
      video,
      signal: controller.signal,
    });
    if (!unlocked) return;
    urlInput.value = "";
    titleInput.value = "";
    descriptionInput.value = "";
    updatePreview();
    setStatus(
      "publish-status",
      "Saved to GitHub. Your lesson will appear after deployment completes.",
      "success",
    );
  } catch (error) {
    if (unlocked)
      setStatus(
        "publish-status",
        error instanceof PublishError
          ? error.message
          : "The lesson could not be saved. Check the catalog before trying again.",
        "error",
      );
  } finally {
    publishing = false;
    controller = null;
    for (const input of videoForm.querySelectorAll("input, select, textarea"))
      input.disabled = false;
    publishButton.disabled = false;
    publishButton.textContent = "Add video ↗";
    videoForm.removeAttribute("aria-busy");
  }
});

updatePreview();
