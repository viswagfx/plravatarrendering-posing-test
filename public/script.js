import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

// ======================
// Elements
// ======================
const statusCurrent = document.getElementById("statusCurrent");
const statusOutfits = document.getElementById("statusOutfits");

// this will point to whichever tab is open
let statusBox = statusCurrent;

// Tabs
const tabCurrent = document.getElementById("tabCurrent");
const tabOutfits = document.getElementById("tabOutfits");
const sectionCurrent = document.getElementById("sectionCurrent");
const sectionOutfits = document.getElementById("sectionOutfits");

// Current Avatar
const usernameInput = document.getElementById("usernameInput");
const downloadCurrentBtn = document.getElementById("downloadCurrentBtn");

// Outfits (username)
const outfitUsernameInput = document.getElementById("outfitUsernameInput");
const loadBtn = document.getElementById("loadBtn");
const outfitsGrid = document.getElementById("outfitsGrid");
const selectBtn = document.getElementById("selectBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const closeOutfitRender = document.getElementById("closeOutfitRender");

// Render Outputs
const currentRenderOutput = document.getElementById("currentRenderOutput");
const currentRenderImg = document.getElementById("currentRenderImg");
const currentRenderDownloadBtn = document.getElementById("currentRenderDownloadBtn");

const outfitRenderOutput = document.getElementById("outfitRenderOutput");
const outfitRenderImg = document.getElementById("outfitRenderImg");
const outfitRenderDownloadBtn = document.getElementById("outfitRenderDownloadBtn");

const FALLBACK_THUMB =
  "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-Png/420/420/AvatarHeadshot/Png/noFilter";

// prevent spam clicks while downloading an outfit
let outfitDownloadBusy = false;

// ======================
// Inline Render Logic
// ======================
function showCurrentRender(blob, filename) {
  const url = URL.createObjectURL(blob);
  currentRenderImg.src = url;
  currentRenderOutput.style.display = "block";

  // Setup download button
  currentRenderDownloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
}

function showOutfitRender(blob, filename) {
  const url = URL.createObjectURL(blob);
  outfitRenderImg.src = url;
  outfitRenderOutput.style.display = "block";

  // Setup download button
  outfitRenderDownloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Scroll to view
  outfitRenderOutput.scrollIntoView({ behavior: "smooth", block: "center" });
}

closeOutfitRender.onclick = () => {
  outfitRenderOutput.style.display = "none";
  outfitRenderImg.src = "";
};

// ======================
// Renderer Logic
// ======================
async function renderAvatarFromZip(zipBlob) {
  // 1. Unzip
  const zip = await JSZip.loadAsync(zipBlob);

  let objFile, mtlFile, metaFile;
  const textures = {};

  // Sort files
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const lower = path.toLowerCase();
    if (lower.endsWith(".obj")) objFile = file;
    else if (lower.endsWith(".mtl")) mtlFile = file;
    else if (lower.endsWith(".json")) metaFile = file;
    else if (lower.endsWith(".png") || lower.endsWith(".jpg")) {
      textures[path] = file; // path matches filename in MTL usually
    }
  }

  if (!objFile || !mtlFile) {
    throw new Error("ZIP missing .obj or .mtl files");
  }

  // 2. Prepare Resources (Blob URLs)
  const textureUrls = {};
  for (const [name, file] of Object.entries(textures)) {
    const blob = await file.async("blob");
    textureUrls[name] = URL.createObjectURL(blob);
  }

  const mtlString = await mtlFile.async("string");
  const objString = await objFile.async("string");

  // 3. Patch MTL to use Blob URLs
  // The backend replaces hash with 'texture_N.png'. 
  // We need to map those filenames to our blob URLs.
  let patchedMtl = mtlString;
  for (const [name, url] of Object.entries(textureUrls)) {
    // Regex to match exact filename usage in map_Kd
    // e.g. map_Kd texture_1.png
    const reg = new RegExp(`(map_Kd\\s+)(.*${name})`, 'gi');
    // Actually simplicity: global replace of filename
    patchedMtl = patchedMtl.replaceAll(name, url);
  }

  // 4. Setup Three.js Scene
  const scene = new THREE.Scene();
  // Transparent bg? Or minimal studio?
  // User wants a "nice render", maybe transparent PNG is best so they can compose it.

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
  backLight.position.set(-5, 5, -5);
  scene.add(backLight);

  // 5. Load Material & Object
  const mtlLoader = new MTLLoader();
  const materials = mtlLoader.parse(patchedMtl);
  materials.preload();

  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  const object = objLoader.parse(objString);

  scene.add(object);

  // 6. Camera Setup
  // Center object
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Move object to origin
  object.position.x += (object.position.x - center.x);
  object.position.y += (object.position.y - center.y);
  object.position.z += (object.position.z - center.z);

  // Rotate 180 deg around Y
  object.rotation.y = Math.PI;

  // Camera
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = 45;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 1000);
  const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov * Math.PI / 360));

  camera.position.set(0, size.y * 0.1, cameraZ * 3.5); // Moved back further
  camera.lookAt(0, 0, 0);

  // 7. Render
  const width = 1024;
  const height = 1024;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(2); // High DPI

  // Wait a tick for textures? Usually Three.js handles it, but texture load is async.
  // OBJLoader + MTLLoader sync parsing might not wait for image load.
  // We need to wait for texture images to be ready.
  // The Material Loader creates Texture objects. We can use loading manager?
  // Simplified: wait a bit or check.
  // Actually, createObjectURL is instant, but the image *decoding* by browser takes time.
  // Let's implement a LoadingManager to be safe.

  return new Promise((resolve, reject) => {
    // Re-do loading with manager if possible?
    // MTLLoader returns materials immediately, but textures load async.
    // Hack: Wait for all textures in materials to allow 'image' to load.
    // Or just wait 500ms...

    // Better:
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => {
      renderer.render(scene, camera);
      renderer.domElement.toBlob((blob) => {
        // Cleanup
        renderer.dispose();
        // Revoke urls
        for (const url of Object.values(textureUrls)) URL.revokeObjectURL(url);
        resolve(blob);
      });
    };

    // We need to pass manager to loaders, but we used .parse() which doesn't use manager for XHR,
    // BUT it uses manager for texture loading (ImageLoader).
    // So we need to re-instantiate loaders with manager.

    const mtlLoader2 = new MTLLoader(manager);
    const materials2 = mtlLoader2.parse(patchedMtl);
    materials2.preload();

    const objLoader2 = new OBJLoader(manager);
    objLoader2.setMaterials(materials2);
    const object2 = objLoader2.parse(objString);

    // Clear previous scene add
    scene.clear();
    scene.add(ambientLight);
    scene.add(dirLight);
    scene.add(backLight);

    // Re-center logic
    const box2 = new THREE.Box3().setFromObject(object2);
    const center2 = box2.getCenter(new THREE.Vector3());
    const size2 = box2.getSize(new THREE.Vector3());

    object2.position.sub(center2); // Standard centering

    // Rotate 180 deg
    object2.rotation.y = Math.PI;

    const maxDim2 = Math.max(size2.x, size2.y, size2.z);
    const cameraZ2 = Math.abs(maxDim2 / 2 / Math.tan(fov * Math.PI / 360));
    camera.position.set(0, size2.y * 0.1, cameraZ2 * 3.5);
    camera.lookAt(0, 0, 0);

    scene.add(object2);

    // If no textures, manager.onLoad might trigger immediately.
    // If textures, it waits.
    // Fallback if no textures found?
    if (Object.keys(textures).length === 0) {
      renderer.render(scene, camera);
      renderer.domElement.toBlob((blob) => {
        renderer.dispose();
        resolve(blob);
      });
    }
  });
}

// ======================
// Helpers
// ======================
function setStatus(type, title, msg) {
  if (!statusBox) return;

  statusBox.innerHTML = `<span class="badge ${type}">${title}</span>\n${msg}`;
}


function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearOutfits() {
  outfitsGrid.innerHTML = "";
}

function cleanUsername(name) {
  return String(name || "").trim();
}

function safeFileName(name) {
  return String(name || "Outfit").replace(/[^a-z0-9]/gi, "_").slice(0, 50);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ======================
// Warm-up
// ======================
async function warmUpOutfitApi() {
  try {
    await fetch("/api/outfit-download", { method: "OPTIONS" });
  } catch { }
}

// ======================
// Tabs
// ======================
function setTab(mode) {
  if (mode === "current") {
    tabCurrent.classList.add("active");
    tabOutfits.classList.remove("active");

    sectionCurrent.classList.remove("hidden");
    sectionOutfits.classList.add("hidden");

    statusBox = statusCurrent; // ✅ switch status target

    setStatus("warn", "Current Avatar", "Enter a username and download their current avatar render.");
  } else {
    tabOutfits.classList.add("active");
    tabCurrent.classList.remove("active");

    sectionOutfits.classList.remove("hidden");
    sectionCurrent.classList.add("hidden");

    statusBox = statusOutfits; // ✅ switch status target

    warmUpOutfitApi();
    setStatus("warn", "Saved Outfits", "Enter a username to load outfits, then click one to download render.");
  }
}


tabCurrent.addEventListener("click", () => setTab("current"));
tabOutfits.addEventListener("click", () => setTab("outfits"));

// ======================
// API: username -> userId (backend)
// ======================
async function usernameToUserId(username) {
  const r = await fetch("/api/userid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });

  if (!r.ok) {
    let msg = `Username lookup failed (HTTP ${r.status})`;
    try {
      const j = await r.json();
      msg = j?.error || j?.details || msg;
    } catch { }
    throw new Error(msg);
  }

  const j = await r.json();
  if (!j?.id) throw new Error("No userId returned for this username.");
  return String(j.id);
}

// ======================
// Current Avatar ZIP download (backend) -> RENDER
// ======================
async function downloadCurrentAvatarRender(username) {
  setStatus("warn", "Working", "Looking up username...");

  const userId = await usernameToUserId(username);

  setStatus("warn", "Downloading", `Fetching 3D assets...\nUsername: ${username}`);

  // Call the original ZIP backend
  const r = await fetch("/api/player-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, username })
  });

  if (!r.ok) {
    let msg = `Download failed (HTTP ${r.status})`;
    try {
      const j = await r.json();
      msg = j?.error || j?.details || msg;
    } catch {
      try {
        const t = await r.text();
        if (t) msg = t.slice(0, 200);
      } catch { }
    }
    throw new Error(msg);
  }

  const zipBlob = await r.blob();

  setStatus("warn", "Rendering", "Generating 3D render...");

  // CLIENT SIDE RENDER
  const pngBlob = await renderAvatarFromZip(zipBlob);
  const fileName = `Render_${username}_${userId}.png`;

  // Show Preview
  showCurrentRender(pngBlob, fileName);

  setStatus("ok", "Success", `Render complete!`);
}

downloadCurrentBtn.addEventListener("click", async () => {
  const username = cleanUsername(usernameInput.value);

  if (!username) {
    setStatus("err", "Error", "Enter a Roblox username.");
    return;
  }

  downloadCurrentBtn.disabled = true;
  downloadCurrentBtn.textContent = "Getting Render...";

  try {
    await downloadCurrentAvatarRender(username);
  } catch (e) {
    setStatus("err", "Error", e.message);
  } finally {
    downloadCurrentBtn.disabled = false;
    downloadCurrentBtn.textContent = "Get Render";
  }
});

usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") downloadCurrentBtn.click();
});

// ======================
// Outfits: load list (backend) by userId
// ======================
async function loadOutfitsByUserId(userId) {
  setStatus("warn", "Loading", "Fetching outfits list...");
  clearOutfits();

  const r = await fetch(`/api/outfits?userId=${encodeURIComponent(userId)}`);

  let j;
  try {
    j = await r.json();
  } catch {
    throw new Error("Outfits API returned non-JSON response.");
  }

  if (!r.ok) {
    throw new Error(j?.error || j?.details || `Failed to load outfits (HTTP ${r.status})`);
  }

  if (!Array.isArray(j.outfits)) {
    throw new Error("Backend response missing outfits list.");
  }

  setStatus("ok", "Outfits Loaded", `Fetched: ${j.outfits.length}`);

  return j.outfits;
}

// ======================
// Outfits thumbnails (roproxy direct)
// ======================
async function fetchOutfitThumbnails(outfitIds) {
  const CHUNK_SIZE = 50;
  const map = new Map();

  for (let i = 0; i < outfitIds.length; i += CHUNK_SIZE) {
    const chunk = outfitIds.slice(i, i + CHUNK_SIZE);

    const url =
      `https://thumbnails.roproxy.com/v1/users/outfits` +
      `?userOutfitIds=${chunk.join(",")}` +
      `&size=420x420&format=Png&isCircular=false`;

    try {
      const r = await fetch(url);
      const j = await r.json();

      if (!Array.isArray(j.data)) continue;

      for (const item of j.data) {
        const id = String(item?.targetId ?? "");
        const state = String(item?.state ?? "").toLowerCase();

        if (!id) continue;

        if (state === "completed" && item?.imageUrl) {
          map.set(id, item.imageUrl);
        }
      }
    } catch {
      // ignore thumbnail chunk errors
    }
  }

  return map;
}

// ======================
// Outfit download ZIP (backend) -> RENDER
// ======================

async function fetchOutfitZipBlob(outfit) {
  const maxTries = 4;

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      const r = await fetch("/api/outfit-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outfitId: outfit.id,
          outfitName: outfit.name
        })
      });

      if (r.status === 404 && attempt < maxTries) {
        if (!isSelectionMode) {
          setStatus("warn", "Warming up server", `Outfit API not ready yet (404)\nRetrying... (${attempt}/${maxTries})`);
        }
        await sleep(800 * attempt);
        continue;
      }

      if (r.status === 429 && attempt < maxTries) {
        if (!isSelectionMode) {
          setStatus("warn", "Rate Limited", `Got 429 too many requests\nRetrying... (${attempt}/${maxTries})`);
        }
        await sleep(1200 * attempt);
        continue;
      }

      if (!r.ok) {
        let msg = `Download failed (HTTP ${r.status})`;
        try {
          const j = await r.json();
          msg = j?.error || j?.details || msg;
        } catch {
          try {
            const t = await r.text();
            if (t) msg = t.slice(0, 200);
          } catch { }
        }
        throw new Error(msg);
      }

      return await r.blob();
    } catch (e) {
      if (attempt < maxTries) {
        if (!isSelectionMode) {
          setStatus("warn", "Retrying", `${e.message}\nRetrying... (${attempt}/${maxTries})`);
        }
        await sleep(800 * attempt);
        continue;
      }
      throw e;
    }
  }
}

async function downloadOutfit(outfit) {
  setStatus("warn", "Fetching", `Getting 3D assets for: ${outfit.name}...`);

  const zipBlob = await fetchOutfitZipBlob(outfit);

  setStatus("warn", "Rendering", `Rendering ${outfit.name}...`);
  const pngBlob = await renderAvatarFromZip(zipBlob);
  const fileName = `Render_Outfit_${outfit.id}.png`;

  // Show Preview
  showOutfitRender(pngBlob, fileName);

  setStatus("ok", "Success", `Render complete!`);
}

// ======================
// Render outfits (big square cards)
// ======================
async function renderOutfits(outfits) {
  clearOutfits();
  setStatus("ok", "Outfits Loaded", `Fetched: ${outfits.length}`);

  for (const outfit of outfits) {
    const btn = document.createElement("button");
    btn.className = "outfit-btn";
    btn.dataset.outfitId = outfit.id;

    btn.innerHTML = `
      <div class="outfit-thumb-wrap">
        <img class="outfit-thumb" src="${FALLBACK_THUMB}" alt="">
        <div class="check-indicator"></div>
        <div class="outfit-loading-overlay">
          <div class="spinner"></div>
        </div>
      </div>

      <div>
        <div class="outfit-name">${escapeHtml(outfit.name)}</div>
        <div class="outfit-id">ID: ${escapeHtml(outfit.id)}</div>
      </div>
    `;

    btn.addEventListener("click", async () => {
      // ✅ Selection Mode Logic
      if (isSelectionMode) {
        const id = outfit.id;
        if (selectedOutfits.has(id)) {
          selectedOutfits.delete(id);
          btn.classList.remove("selected");
        } else {
          selectedOutfits.add(id);
          btn.classList.add("selected");
        }
        updateDownloadAllBtn();
        return;
      }

      // ✅ Normal Download Click
      if (outfitDownloadBusy) return;
      outfitDownloadBusy = true;

      const allBtns = outfitsGrid.querySelectorAll("button.outfit-btn");
      allBtns.forEach((b) => (b.disabled = true));

      btn.classList.add("is-loading");

      try {
        await downloadOutfit(outfit);
      } catch (e) {
        setStatus("err", "Error", e.message);
      } finally {
        btn.classList.remove("is-loading");
        allBtns.forEach((b) => (b.disabled = false));
        outfitDownloadBusy = false;
      }
    });

    outfitsGrid.appendChild(btn);
  }

  // thumbnails
  setStatus("warn", "Thumbnails", `Loading thumbnails...\nOutfits: ${outfits.length}`);
  const ids = outfits.map((o) => String(o.id));
  const thumbMap = await fetchOutfitThumbnails(ids);

  const buttons = outfitsGrid.querySelectorAll("button.outfit-btn");
  buttons.forEach((btn) => {
    const id = String(btn.dataset.outfitId);
    const url = thumbMap.get(id);

    if (url) {
      const img = btn.querySelector("img.outfit-thumb");
      if (img) img.src = url;
    }
  });

  setStatus("ok", "Ready", `Outfits ready: ${outfits.length}`);
  if (outfits.length > 0) {
    selectBtn.style.display = "block";
  }
}

// ======================
// Selection & Bulk Download
// ======================
function updateDownloadAllBtn() {
  const count = selectedOutfits.size;
  downloadAllBtn.textContent = `Download (${count})`;
  downloadAllBtn.style.display = isSelectionMode ? "block" : "none";
}

selectBtn.addEventListener("click", () => {
  isSelectionMode = !isSelectionMode;

  if (isSelectionMode) {
    selectBtn.textContent = "Cancel";
    outfitsGrid.classList.add("selection-active");
    outfitsGrid.querySelectorAll(".outfit-btn").forEach(b => b.classList.add("selection-mode"));
    updateDownloadAllBtn();
  } else {
    selectBtn.textContent = "Select";
    outfitsGrid.classList.remove("selection-active");
    selectedOutfits.clear();
    outfitsGrid.querySelectorAll(".outfit-btn").forEach(b => {
      b.classList.remove("selection-mode", "selected");
    });
    updateDownloadAllBtn();
    setStatus("ok", "Cancelled", "Selection cleared.");
  }
});

downloadAllBtn.addEventListener("click", async () => {
  if (selectedOutfits.size === 0) return;
  if (outfitDownloadBusy) return;

  outfitDownloadBusy = true;
  downloadAllBtn.disabled = true;
  selectBtn.disabled = true;
  loadBtn.disabled = true;

  try {
    setStatus("warn", "Preparing", `Starting bulk download for ${selectedOutfits.size} outfits...`);

    const tasks = [];
    const buttons = outfitsGrid.querySelectorAll(".outfit-btn.selected");

    buttons.forEach(btn => {
      const id = btn.dataset.outfitId;
      const name = btn.querySelector(".outfit-name").innerText;
      tasks.push({ id, name });
    });

    const masterZip = new JSZip();
    const BATCH_SIZE = 1; // Limit concurrency for rendering (GPU heavy)
    let completed = 0;

    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const chunk = tasks.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (task) => {
        try {
          const zipBlob = await fetchOutfitZipBlob(task);
          const pngBlob = await renderAvatarFromZip(zipBlob);

          const safeName = task.name.replace(/[^a-z0-9]/gi, "_").slice(0, 50);
          masterZip.file(`Render_${task.id}_${safeName}.png`, pngBlob);
        } catch (e) {
          console.error(`Failed to download ${task.name}:`, e);
          masterZip.file(`FAILED_${task.id}.txt`, `Error: ${e.message}`);
        }
        completed++;
        setStatus("warn", "Downloading", `Progress: ${completed}/${tasks.length}\n(Rendering & Zipping)`);
      }));
    }

    setStatus("warn", "Zipping", "Compressing final bundle...");
    const content = await masterZip.generateAsync({ type: "blob" });
    const bundleName = `Renders_Bundle_${Date.now()}.zip`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = bundleName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);

    setStatus("ok", "Done", `Downloaded ${tasks.length} renders in\n${bundleName}`);
    selectBtn.click(); // Toggle off

  } catch (e) {
    setStatus("err", "Error", "Bulk download failed:\n" + e.message);
  } finally {
    outfitDownloadBusy = false;
    downloadAllBtn.disabled = false;
    selectBtn.disabled = false;
    loadBtn.disabled = false;
  }
});

// ======================
// Init
// ======================
setTab("current");
