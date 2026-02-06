import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ======================
// R15 Body Part Configuration
// ======================
// Roblox API exports body parts as Player1-Player15 groups
// This mapping converts those to logical body part names
const PLAYER_TO_BODYPART = {
  'Player1': 'Head',
  'Player2': 'RightUpperLeg',
  'Player3': 'LowerTorso',
  'Player4': 'RightLowerLeg',
  'Player5': 'RightFoot',
  'Player6': 'LeftUpperLeg',
  'Player7': 'UpperTorso',
  'Player8': 'LeftLowerLeg',
  'Player9': 'LeftFoot',
  'Player10': 'RightUpperArm',
  'Player11': 'LeftUpperArm',
  'Player12': 'RightLowerArm',
  'Player13': 'LeftLowerArm',
  'Player14': 'RightHand',
  'Player15': 'LeftHand'
};

const R15_BODY_PARTS = Object.values(PLAYER_TO_BODYPART);

// Limb hierarchy: defines which parts are children of which
// Children inherit rotation from their parent
const LIMB_HIERARCHY = {
  'UpperTorso': { parent: 'LowerTorso', children: ['Head'] },
  'Head': { parent: 'UpperTorso', children: [] },

  // Right arm chain
  'RightUpperArm': { parent: 'UpperTorso', children: ['RightLowerArm'] },
  'RightLowerArm': { parent: 'RightUpperArm', children: ['RightHand'] },
  'RightHand': { parent: 'RightLowerArm', children: [] },

  // Left arm chain
  'LeftUpperArm': { parent: 'UpperTorso', children: ['LeftLowerArm'] },
  'LeftLowerArm': { parent: 'LeftUpperArm', children: ['LeftHand'] },
  'LeftHand': { parent: 'LeftLowerArm', children: [] },

  // Right leg chain
  'RightUpperLeg': { parent: 'LowerTorso', children: ['RightLowerLeg'] },
  'RightLowerLeg': { parent: 'RightUpperLeg', children: ['RightFoot'] },
  'RightFoot': { parent: 'RightLowerLeg', children: [] },

  // Left leg chain
  'LeftUpperLeg': { parent: 'LowerTorso', children: ['LeftLowerLeg'] },
  'LeftLowerLeg': { parent: 'LeftUpperLeg', children: ['LeftFoot'] },
  'LeftFoot': { parent: 'LeftLowerLeg', children: [] },

  // Root parts
  'LowerTorso': { parent: null, children: ['UpperTorso', 'LeftUpperLeg', 'RightUpperLeg'] }
};

// Preset poses (rotations in degrees for each body part)
const POSES = {
  default: {
    name: 'Default',
    rotations: {} // No rotations - T-pose
  },
  wave: {
    name: 'Wave',
    rotations: {
      'RightUpperArm': { x: 0, y: 0, z: -150 },
      'RightLowerArm': { x: 0, y: 30, z: 0 },
      'Head': { x: 0, y: 15, z: 5 }
    }
  },
  hero: {
    name: 'Hero',
    rotations: {
      'LeftUpperArm': { x: 0, y: 0, z: 25 },
      'RightUpperArm': { x: 0, y: 0, z: -25 },
      'LeftUpperLeg': { x: 0, y: 0, z: -8 },
      'RightUpperLeg': { x: 0, y: 0, z: 8 },
      'UpperTorso': { x: 5, y: 0, z: 0 },
      'Head': { x: -5, y: 0, z: 0 }
    }
  },
  relaxed: {
    name: 'Relaxed',
    rotations: {
      'LeftUpperArm': { x: 0, y: 15, z: 20 },
      'RightUpperArm': { x: 0, y: -15, z: -20 },
      'LeftLowerArm': { x: -30, y: 0, z: 0 },
      'RightLowerArm': { x: -30, y: 0, z: 0 },
      'Head': { x: 5, y: 10, z: 0 },
      'UpperTorso': { x: 3, y: 5, z: 0 }
    }
  },
  sitting: {
    name: 'Sitting',
    rotations: {
      'LeftUpperLeg': { x: -90, y: 0, z: 5 },
      'RightUpperLeg': { x: -90, y: 0, z: -5 },
      'LeftLowerLeg': { x: 90, y: 0, z: 0 },
      'RightLowerLeg': { x: 90, y: 0, z: 0 },
      'LeftUpperArm': { x: 0, y: 0, z: 30 },
      'RightUpperArm': { x: 0, y: 0, z: -30 },
      'LeftLowerArm': { x: -45, y: 0, z: 0 },
      'RightLowerArm': { x: -45, y: 0, z: 0 }
    }
  }
};

// Current pose state
let currentPose = 'default';

// ======================
// Missing Variable Declarations
// ======================
let isSelectionMode = false;
const selectedOutfits = new Set();

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
const currentRenderContainer = document.getElementById("currentRenderContainer");
const currentRenderDownloadBtn = document.getElementById("currentRenderDownloadBtn");

// Lighting Controls (Current)
const currLightAmbient = document.getElementById("currLightAmbient");
const currLightKey = document.getElementById("currLightKey");
const currLightFill = document.getElementById("currLightFill");
const currLightRim = document.getElementById("currLightRim");

const outfitRenderOutput = document.getElementById("outfitRenderOutput");
const outfitRenderContainer = document.getElementById("outfitRenderContainer");
const outfitRenderDownloadBtn = document.getElementById("outfitRenderDownloadBtn");

// Lighting Controls (Outfit)
const outfitLightAmbient = document.getElementById("outfitLightAmbient");
const outfitLightKey = document.getElementById("outfitLightKey");
const outfitLightFill = document.getElementById("outfitLightFill");
const outfitLightRim = document.getElementById("outfitLightRim");

// Snapshot Modal Elements
const snapshotModal = document.getElementById("snapshotModal");
const snapshotPreviewImg = document.getElementById("snapshotPreviewImg");
const snapshotSaveBtn = document.getElementById("snapshotSaveBtn");
const snapshotCancelBtn = document.getElementById("snapshotCancelBtn");
const snapshotBackdrop = document.getElementById("snapshotBackdrop");

// Helper to open snapshot modal
function openSnapshotModal(dataUrl, filename) {
  snapshotPreviewImg.src = dataUrl;
  snapshotModal.style.display = "flex";

  // Fade in
  requestAnimationFrame(() => {
    snapshotModal.style.opacity = "1";
  });

  // Save Action
  snapshotSaveBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    closeSnapshotModal();
  };

  // Close Actions
  const close = () => closeSnapshotModal();
  snapshotCancelBtn.onclick = close;
  snapshotBackdrop.onclick = close;
}

function closeSnapshotModal() {
  snapshotModal.style.opacity = "0";
  setTimeout(() => {
    snapshotModal.style.display = "none";
    snapshotPreviewImg.src = "";
  }, 200);
}

const FALLBACK_THUMB =
  "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-Png/420/420/AvatarHeadshot/Png/noFilter";

// prevent spam clicks while downloading an outfit
let outfitDownloadBusy = false;

// ======================
// Inline Render Logic
// ======================
let activeViewer = null;

// ======================
// Inline Render Logic
// ======================
function showCurrentRender(zipBlob, filename) {
  if (activeViewer) {
    activeViewer.dispose();
    activeViewer = null;
  }

  currentRenderOutput.style.display = "block";

  // Light controls map
  const controls = {
    ambient: currLightAmbient,
    key: currLightKey,
    fill: currLightFill,
    rim: currLightRim
  };

  createAvatarViewer(zipBlob, currentRenderContainer, controls).then(viewer => {
    activeViewer = viewer;

    // Setup download button
    currentRenderDownloadBtn.onclick = () => {
      const url = viewer.capture();
      openSnapshotModal(url, filename);
    };

    // Setup pose buttons
    const poseContainer = document.getElementById('currPoseButtons');
    if (poseContainer) {
      poseContainer.innerHTML = '';

      if (viewer.hasBodyParts()) {
        const poses = viewer.getAvailablePoses();
        poses.forEach(poseKey => {
          const btn = document.createElement('button');
          btn.className = 'pose-btn' + (poseKey === 'default' ? ' active' : '');
          btn.textContent = POSES[poseKey]?.name || poseKey;
          btn.onclick = () => {
            viewer.setPose(poseKey);
            // Update active state
            poseContainer.querySelectorAll('.pose-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          };
          poseContainer.appendChild(btn);
        });
      } else {
        poseContainer.innerHTML = '<span class="pose-unavailable">Poses unavailable for this avatar</span>';
      }
    }
  });
}

function showOutfitRender(zipBlob, filename) {
  if (activeViewer) {
    activeViewer.dispose();
    activeViewer = null;
  }

  outfitRenderOutput.style.display = "block";

  const controls = {
    ambient: outfitLightAmbient,
    key: outfitLightKey,
    fill: outfitLightFill,
    rim: outfitLightRim
  };

  createAvatarViewer(zipBlob, outfitRenderContainer, controls).then(viewer => {
    activeViewer = viewer;

    // Setup download button
    outfitRenderDownloadBtn.onclick = () => {
      const url = viewer.capture();
      openSnapshotModal(url, filename);
    };

    // Setup pose buttons
    const poseContainer = document.getElementById('outfitPoseButtons');
    if (poseContainer) {
      poseContainer.innerHTML = '';

      if (viewer.hasBodyParts()) {
        const poses = viewer.getAvailablePoses();
        poses.forEach(poseKey => {
          const btn = document.createElement('button');
          btn.className = 'pose-btn' + (poseKey === 'default' ? ' active' : '');
          btn.textContent = POSES[poseKey]?.name || poseKey;
          btn.onclick = () => {
            viewer.setPose(poseKey);
            // Update active state
            poseContainer.querySelectorAll('.pose-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          };
          poseContainer.appendChild(btn);
        });
      } else {
        poseContainer.innerHTML = '<span class="pose-unavailable">Poses unavailable for this outfit</span>';
      }
    }

    // Scroll to view
    outfitRenderOutput.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

closeOutfitRender.onclick = () => {
  outfitRenderOutput.style.display = "none";
  if (activeViewer) {
    activeViewer.dispose();
    activeViewer = null;
  }
};

// ======================
// Core 3D Logic
// ======================

// Helper: Apply pose to body parts
function applyPose(bodyParts, poseKey, originalRotations) {
  const pose = POSES[poseKey];
  if (!pose) return;

  // Reset all parts to original rotation first
  for (const [partName, mesh] of bodyParts) {
    const original = originalRotations.get(partName);
    if (original) {
      mesh.rotation.set(original.x, original.y, original.z);
    }
  }

  // Apply pose rotations
  for (const [partName, rotation] of Object.entries(pose.rotations)) {
    const mesh = bodyParts.get(partName);
    if (mesh) {
      const original = originalRotations.get(partName) || { x: 0, y: 0, z: 0 };
      // Convert degrees to radians and add to original rotation
      mesh.rotation.x = original.x + THREE.MathUtils.degToRad(rotation.x || 0);
      mesh.rotation.y = original.y + THREE.MathUtils.degToRad(rotation.y || 0);
      mesh.rotation.z = original.z + THREE.MathUtils.degToRad(rotation.z || 0);
    }
  }
}

// Helper: Build Scene (Common for both Interactive & Batch)
async function buildSceneFromZip(zipBlob) {
  const zip = await JSZip.loadAsync(zipBlob);

  let objFile, mtlFile;
  const textures = {};

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const lower = path.toLowerCase();
    if (lower.endsWith(".obj")) objFile = file;
    else if (lower.endsWith(".mtl")) mtlFile = file;
    else if (lower.endsWith(".png") || lower.endsWith(".jpg")) {
      textures[path] = file;
    }
  }

  if (!objFile || !mtlFile) throw new Error("ZIP missing .obj or .mtl files");

  const textureUrls = {};
  for (const [name, file] of Object.entries(textures)) {
    const blob = await file.async("blob");
    textureUrls[name] = URL.createObjectURL(blob);
  }

  let mtlString = await mtlFile.async("string");
  const objString = await objFile.async("string");

  // Patch MTL
  for (const [name, url] of Object.entries(textureUrls)) {
    mtlString = mtlString.replaceAll(name, url);
  }

  const manager = new THREE.LoadingManager();

  return new Promise((resolve) => {
    const mtlLoader = new MTLLoader(manager);
    const materials = mtlLoader.parse(mtlString);
    materials.preload();

    // Material Fixes
    for (const name in materials.materials) {
      const mat = materials.materials[name];
      const hasDissolve = mat.opacity !== undefined && mat.opacity < 1.0;

      if (hasDissolve || mat.alphaTest > 0) {
        mat.transparent = true;
        mat.alphaTest = 0.5; // Higher threshold for cleaner edges
        mat.depthWrite = true; // Use alphaTest so we CAN write depth
      } else {
        mat.transparent = false;
        mat.alphaTest = 0;
        mat.depthWrite = true;
      }
      mat.side = THREE.DoubleSide;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    }

    const objLoader = new OBJLoader(manager);
    objLoader.setMaterials(materials);
    const object = objLoader.parse(objString);

    // Parse body parts from OBJ groups
    const bodyParts = new Map();
    const originalRotations = new Map();

    object.traverse((child) => {
      if (child.isMesh || child.isGroup) {
        const name = child.name || '';

        // Check for Player1-Player15 format (Roblox API export)
        if (PLAYER_TO_BODYPART[name]) {
          const partName = PLAYER_TO_BODYPART[name];
          bodyParts.set(partName, child);
          // Store original rotation
          originalRotations.set(partName, {
            x: child.rotation.x,
            y: child.rotation.y,
            z: child.rotation.z
          });
        }
        // Also check for R15 body part names (with or without _geo suffix) as fallback
        else {
          for (const partName of R15_BODY_PARTS) {
            if (name.includes(partName) || name.toLowerCase().includes(partName.toLowerCase())) {
              bodyParts.set(partName, child);
              originalRotations.set(partName, {
                x: child.rotation.x,
                y: child.rotation.y,
                z: child.rotation.z
              });
              break;
            }
          }
        }
      }
    });

    console.log(`[Posing] Found ${bodyParts.size} body parts:`, [...bodyParts.keys()]);

    // Set up pivot points for each body part at joint locations
    if (bodyParts.size > 0) {
      for (const [partName, mesh] of bodyParts) {
        if (!mesh.isMesh && !mesh.isGroup) continue;

        // Get the bounding box to find pivot point
        const bbox = new THREE.Box3().setFromObject(mesh);
        const meshCenter = bbox.getCenter(new THREE.Vector3());
        const meshSize = bbox.getSize(new THREE.Vector3());

        // Determine pivot point based on body part type
        let pivotPoint = new THREE.Vector3();
        mesh.getWorldPosition(pivotPoint);

        // Arms pivot from shoulder/elbow side (towards torso)
        if (partName.includes('Arm') || partName.includes('Hand')) {
          if (partName.includes('Right')) {
            pivotPoint.x = bbox.min.x; // Left side (towards torso)
          } else {
            pivotPoint.x = bbox.max.x; // Right side (towards torso)
          }
          pivotPoint.y = meshCenter.y;
          pivotPoint.z = meshCenter.z;
        }
        // Legs pivot from hip/knee (top of mesh)
        else if (partName.includes('Leg') || partName.includes('Foot')) {
          pivotPoint.x = meshCenter.x;
          pivotPoint.y = bbox.max.y; // Top
          pivotPoint.z = meshCenter.z;
        }
        // Head pivots from bottom (neck)
        else if (partName === 'Head') {
          pivotPoint.x = meshCenter.x;
          pivotPoint.y = bbox.min.y; // Bottom (neck)
          pivotPoint.z = meshCenter.z;
        }
        // Torso parts pivot from center
        else {
          pivotPoint.copy(meshCenter);
        }

        // Create wrapper group at pivot point
        const wrapper = new THREE.Group();
        wrapper.name = `${partName}_wrapper`;

        // Get mesh's current parent and world position
        const parent = mesh.parent;
        const meshWorldPos = new THREE.Vector3();
        mesh.getWorldPosition(meshWorldPos);

        // Position wrapper at pivot point in parent's local space
        if (parent) {
          const parentWorldPos = new THREE.Vector3();
          parent.getWorldPosition(parentWorldPos);
          wrapper.position.copy(pivotPoint).sub(parentWorldPos);

          // Add wrapper to parent, then mesh to wrapper
          parent.add(wrapper);
          wrapper.attach(mesh);

          // Offset mesh so it appears in original position
          mesh.position.sub(pivotPoint.clone().sub(meshWorldPos));
        }

        // Update bodyParts map to point to wrapper for rotation
        bodyParts.set(partName, wrapper);
        originalRotations.set(partName, { x: 0, y: 0, z: 0 });
      }

      console.log(`[Posing] Set up pivot points for ${bodyParts.size} body parts`);
    }

    // Center Object
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    object.position.sub(center);
    object.rotation.y = Math.PI;

    // Scene
    const scene = new THREE.Scene();
    scene.add(object);

    // Camera
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = 45;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 1000);
    const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov * Math.PI / 360));

    // Closer zoom (was 2.0)
    camera.position.set(0, size.y * 0.1, cameraZ * 1.4);
    camera.lookAt(0, 0, 0);

    // Lights (Base Setup)
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(5, 10, 7);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-5, 5, 5);
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 5, -10);

    scene.add(ambient, key, fill, rim);

    // Resolve when textures ready
    manager.onLoad = () => {
      resolve({
        scene, camera,
        lights: { ambient, key, fill, rim },
        textureUrls,
        bodyParts,
        originalRotations
      });
    };

    // Fallback
    if (Object.keys(textures).length === 0) {
      resolve({
        scene, camera,
        lights: { ambient, key, fill, rim },
        textureUrls,
        bodyParts,
        originalRotations
      });
    }
  }); // End Promise
}

// Interactive Viewer (updated for sliders)
async function createAvatarViewer(zipBlob, container, controls) {
  // Clear container
  container.innerHTML = "";

  const { scene, camera, lights, textureUrls, bodyParts, originalRotations } = await buildSceneFromZip(zipBlob);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    logarithmicDepthBuffer: true
  });

  // Use container size
  const width = container.clientWidth || 500;
  const height = container.clientHeight || 500;
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // FIX: aspect ratio immediately
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  container.appendChild(renderer.domElement);

  // Orbit Controls
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.05;
  orbit.minDistance = 2;
  orbit.maxDistance = 20;

  // Resize handler
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  // Lighting & Loop
  let running = true;
  const animate = () => {
    if (!running) return;

    orbit.update(); // Update controls

    // Update lights from sliders
    if (controls) {
      lights.ambient.intensity = parseFloat(controls.ambient.value);
      lights.key.intensity = parseFloat(controls.key.value);
      lights.fill.intensity = parseFloat(controls.fill.value);
      lights.rim.intensity = parseFloat(controls.rim.value);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();

  return {
    dispose: () => {
      running = false;
      window.removeEventListener("resize", onResize);
      orbit.dispose();
      renderer.dispose();
      container.innerHTML = "";
      for (const url of Object.values(textureUrls)) URL.revokeObjectURL(url);
    },
    capture: () => {
      // Force render to ensure latest state
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
    setPose: (poseKey) => {
      if (bodyParts.size > 0) {
        applyPose(bodyParts, poseKey, originalRotations);
        currentPose = poseKey;
        console.log(`[Posing] Applied pose: ${poseKey}`);
      } else {
        console.warn('[Posing] No body parts found - cannot apply pose');
      }
    },
    getAvailablePoses: () => Object.keys(POSES),
    hasBodyParts: () => bodyParts.size > 0
  };
}

// Batch Renderer (for bulk download) - headless-ish
async function renderAvatarFromZip(zipBlob) {
  const { scene, camera, textureUrls } = await buildSceneFromZip(zipBlob);

  const width = 1024;
  const height = 1024;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    logarithmicDepthBuffer: true
  });

  renderer.setSize(width, height);
  renderer.setPixelRatio(1); // Keep 1024x1024 strictly
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  renderer.render(scene, camera);

  return new Promise(resolve => {
    renderer.domElement.toBlob(blob => {
      renderer.dispose();
      for (const url of Object.values(textureUrls)) URL.revokeObjectURL(url);
      resolve(blob);
    });
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

    statusBox = statusCurrent;

    setStatus("warn", "Current Avatar", "Enter a username and download their current avatar render.");
  } else {
    tabOutfits.classList.add("active");
    tabCurrent.classList.remove("active");

    sectionOutfits.classList.remove("hidden");
    sectionCurrent.classList.add("hidden");

    statusBox = statusOutfits;

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

  setStatus("warn", "Rendering", "Generating 3D render...");

  // Pass ZIP blob to viewer
  const fileName = `Render_${username}_${userId}.png`;
  showCurrentRender(zipBlob, fileName);

  setStatus("ok", "Success", `Render ready!`);
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
  setStatus("warn", "Rendering", `Rendering ${outfit.name}...`);
  // Pass ZIP to viewer
  const fileName = `Render_Outfit_${outfit.id}.png`;
  showOutfitRender(zipBlob, fileName);

  setStatus("ok", "Success", `Render ready!`);
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
// Missing Load Button Handler
// ======================
loadBtn.addEventListener("click", async () => {
  const username = cleanUsername(outfitUsernameInput.value);

  if (!username) {
    setStatus("err", "Error", "Enter a Roblox username.");
    return;
  }

  loadBtn.disabled = true;
  loadBtn.textContent = "Loading...";

  try {
    const userId = await usernameToUserId(username);
    const outfits = await loadOutfitsByUserId(userId);
    await renderOutfits(outfits);
  } catch (e) {
    setStatus("err", "Error", e.message);
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "Load Outfits";
  }
});

outfitUsernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadBtn.click();
});

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
    const BATCH_SIZE = 1;
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
    selectBtn.click();

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