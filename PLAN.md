# PLAN.md: 3D AI Concepts Visualizer

This document serves as the master blueprint for a highly visual, interactive 3D static web application built with **Three.js** and **GSAP (GreenSock)**. The application's goal is to demystify complex Artificial Intelligence concepts through physical analogies, requiring zero mathematical or coding background from the viewer.

---

## 1. Project Overview & Target Audience

### Core Concept
The application is a single-page interactive 3D universe divided into three distinct conceptual zones. Instead of static text or abstract mathematical equations, users engage with dynamic, physical metaphors. They can manipulate parameters, type custom words to watch them undergo tokenization, shoot query vectors into semantic clouds, and trigger step-by-step agent loops.

### Target Audience
- **Non-Technical Audiences**: Business leaders, product managers, educators, and curious learners.
- **Goal**: Build physical, spatial intuition. The app replaces abstract terminology with visual representations—replacing tokenizers with "Language LEGOs," vectors with "Coordinate Maps," and agent structures with "Orbital Workflows."

### Visual Aesthetic & Theme
- **Theme**: Futuristic dark-mode command center ("Sci-Fi Dashboard" / "Cyber-Cosmos").
- **Core Palette**:
  - Dark Slate Background: `#0d0e15` (creates deep spatial contrast)
  - LLM Factory Zone: Neon Pink / Magenta (`#ec4899`)
  - RAG Library Zone: Electric Cyan / Teal (`#06b6d4`)
  - Agentic Lab Zone: Vibrant Lime / Radioactive Green (`#22c55e`)
- **UI Styling**: Glassmorphism dashboard cards (`backdrop-filter: blur()`, thin semi-transparent white borders) floating over a continuous 3D canvas.

---

## 2. Interactive Modules & Analogies

### Module 1: The LLM Factory
*Visual Theme: A vertical conveyor assembly showing word fragments processed through filtering layers.*

| Technical Concept | Non-Technical Analogy | 3D Visualization |
| :--- | :--- | :--- |
| **Tokenization** | **"Language LEGOs"**<br>AI cannot read full sentences directly. It must break text down into standardized, small blocks (tokens) before analyzing them. | A user types a sentence. When they click "Tokenize," the sentence splits into individual physical blocks labeled with their corresponding words. These blocks cascade down a chute. |
| **Parameters** | **"The Giant Tuning Board"**<br>Billions of internal dials and knobs adjusted during training that dictate how the AI generates text. | A vast background starfield or dense cloud of millions of tiny, interconnected floating glowing points. A slider allows users to switch between "7 Billion" (sparse) and "70 Billion" (dense) configurations. |
| **Transformer Layers** | **"The Processing Filters"**<br>Stacked transparent lenses. As a token passes through, these lenses analyze context and meaning. | A vertical stack of three semi-transparent, glowing pink glass plates. When token blocks fall, they pass through each plate, flashing colored laser lines that trace spatial associations. |

---

### Module 2: The Knowledge Library (RAG)
*Visual Theme: An interconnected cosmic coordinate system representing conceptual relationships.*

| Technical Concept | Non-Technical Analogy | 3D Visualization |
| :--- | :--- | :--- |
| **Embeddings** | **"The Semantic Atlas"**<br>Mapping concepts onto a physical coordinate system where similar ideas are placed closely together. | A 3D constellation of scattered star-like nodes grouped into colored clusters (e.g., Cyan stars for "Biology," Pink stars for "Technology," Green stars for "Finance"). |
| **Vector Search** | **"The Search Probe"**<br>Finding physical documentation by flying directly to its conceptual location. | The user inputs a query. A glowing blue light probe shoots from the camera into the constellation and hits a specific cluster. Nearby nodes light up with glowing connection lines. |
| **Augmentation** | **"Open-Book Reference"**<br>The AI reads the retrieved files directly to formulate a factual, accurate response, avoiding guesses. | Upon hitting the target cluster, matching nodes transform into tiny scroll or folder meshes. These documents fly into a collector, merging with the original prompt before output generation. |

---

### Module 3: The Autonomous Agent Lab
*Visual Theme: A central atomic core surrounded by orbital pathways and executing tool modules.*

| Technical Concept | Non-Technical Analogy | 3D Visualization |
| :--- | :--- | :--- |
| **The Core Brain** | **"The Decision Maker"**<br>An LLM functioning as an active operations manager rather than a simple text generator. | A central, pulsing wireframe icosahedron (the Core Brain) hovering at the origin of the coordinate space. |
| **Planning & Loops** | **"The Active Checklist"**<br>Formulating a sequence of actions, executing them, and adjusting based on feedback. | A rotating glowing circular band orbiting the core. When the loop starts, stages light up sequentially (Planning ➔ Tool Call ➔ Memory Log). |
| **Tools & Actions** | **"The Swiss Army Knife"**<br>External utilities (calculators, web browsers, databases) the AI chooses to execute tasks. | Distinct satellite spheres orbiting the core on outer tracks, representing "Web Search," "Calculator," and "Code Runner." High-energy laser pulses travel from the brain to these nodes during execution. |
| **Memory** | **"The Clipboard & Filing Cabinet"**<br>Maintaining local variables (short-term) and semantic history (long-term) across iterations. | An orbital track labeled "Memory Core." Data packets travel between the central brain and this track to store execution feedback. |

---

## 3. Application Architecture

```
                      ┌────────────────────────────────────────┐
                      │              User Browser              │
                      └───────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
    ┌───────────────────────────┐                   ┌───────────────────────────┐
    │     HTML5 & Tailwind UI   │                   │    GSAP Animation Engine  │
    │  • User input fields      │                   │  • Camera position sweeps │
    │  • Trigger buttons        │                   │  • Group scaling (fades)  │
    │  • Contextual sidebars    │                   │  • Multi-stage timelines  │
    ┌─────────────┬─────────────┘                   └─────────────┬─────────────┘
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          ▼
                            ┌───────────────────────────┐
                            │    Three.js 3D Canvas     │
                            │  • Persistent Scene Groups│
                            │  • Lighting & Fog         │
                            │  • OrbitControls          │
                            └───────────────────────────┘
```

### Technical Blueprint & Transitions
To prevent jarring scene cuts, the application loads all three visualizer environments simultaneously inside their own independent `THREE.Group` instances (`llmGroup`, `ragGroup`, `agentGroup`). 

When switching scenes:
1. **Scene Fades**: The active group's 3D scale is smoothly shrunk to `0` using **GSAP**, and its visibility is set to `false`. The incoming group is made visible and scaled back to `1` using a springy back-out easing curve.
2. **Camera Sweeps**: The camera and target controls smoothly transition along a curved path to frame the active scene from a thematic angle, preventing rigid, instant camera jumps [2].
3. **Continuous Execution**: System animations (like spinning orbitals or flowing point systems) calculate passively, keeping the visualizer feeling alive and dynamic.

---

## 4. Complete Implementation Code

This codebase contains the complete static interface, with full 3D rendering configurations, responsive handling, GSAP transition timelines, and interactive input triggers.

### `index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Understanding AI: A 3D Journey</title>
  
  <!-- Tailwind CSS for Modern Interface Layout -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- GSAP Core for smooth camera transitions and sequential loops -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>

  <style>
    body {
      background-color: #0d0e15;
      color: #f3f4f6;
      overflow-x: hidden;
    }
    .glass-panel {
      background: rgba(13, 14, 21, 0.75);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
    }
    .pointer-events-none { pointer-events: none; }
    .pointer-events-auto { pointer-events: auto; }
  </style>
</head>
<body class="font-sans select-none">

  <!-- Three.js Canvas -->
  <canvas id="three-canvas"></canvas>

  <!-- Interactive Control Dashboard UI Overlay -->
  <div class="relative z-20 min-h-screen flex flex-col justify-between pointer-events-none p-6 md:p-8">
    
    <!-- Top Navigation Header -->
    <header class="w-full flex flex-col md:flex-row justify-between items-center gap-4 glass-panel px-6 py-4 rounded-xl pointer-events-auto">
      <div class="flex items-center space-x-2">
        <div class="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
        <span class="font-bold tracking-wider text-sm uppercase text-gray-200">AI Dimension Visualizer</span>
      </div>
      <div class="flex space-x-3 text-xs md:text-sm font-medium">
        <button id="nav-llm" onclick="switchScene('llm')" class="px-4 py-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition">1. LLM Factory</button>
        <button id="nav-rag" onclick="switchScene('rag')" class="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition">2. Knowledge Library</button>
        <button id="nav-agents" onclick="switchScene('agents')" class="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition">3. Agent Lab</button>
      </div>
    </header>

    <!-- Bottom Interface Layout -->
    <div class="w-full flex flex-col md:flex-row gap-6 items-end mt-auto">
      
      <!-- Educational Description Overlay (Left Side) -->
      <section class="w-full md:w-5/12 glass-panel p-6 rounded-2xl pointer-events-auto shadow-2xl transition-all duration-300">
        <h2 id="panel-title" class="text-xl font-bold text-pink-400 mb-2">The LLM Factory</h2>
        <p id="panel-body" class="text-sm text-gray-300 leading-relaxed min-h-[90px]">
          Large Language Models process sentences as LEGO-like pieces called "tokens". They build sentences step-by-step by finding the most likely next block based on billions of parameters (internal settings).
        </p>
        <div class="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
          <span>➔ Left-click + drag to rotate space</span>
          <span id="active-scene-indicator" class="text-pink-400 font-bold uppercase tracking-wider">LLM Mode</span>
        </div>
      </section>

      <!-- Contextual Action Panel (Right Side) -->
      <section class="w-full md:w-7/12 glass-panel p-6 rounded-2xl pointer-events-auto shadow-2xl">
        
        <!-- LLM Concept Inputs -->
        <div id="controls-llm" class="space-y-4">
          <div class="flex justify-between items-center">
            <label class="block text-xs font-semibold text-pink-400 uppercase tracking-wider">Try Tokenizing a Sentence</label>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-gray-400">Parameters:</span>
              <button id="btn-param-scale" class="text-[10px] bg-pink-900/40 text-pink-300 px-2 py-1 rounded border border-pink-500/20">7B (Compact)</button>
            </div>
          </div>
          <div class="flex gap-2">
            <input type="text" id="llm-input" value="AI breaks sentences into chunks." placeholder="Type something..." class="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-pink-500">
            <button id="btn-tokenize" class="bg-pink-600 hover:bg-pink-500 text-white font-bold px-6 py-2 rounded-lg text-sm transition">Tokenize</button>
          </div>
          <p class="text-[11px] text-gray-400">Watch your words get sliced into colored blocks and processed through the glass layers.</p>
        </div>

        <!-- RAG Concept Inputs -->
        <div id="controls-rag" class="space-y-4 hidden">
          <label class="block text-xs font-semibold text-cyan-400 uppercase tracking-wider">Search the Vector Constellation</label>
          <div class="flex gap-2">
            <input type="text" id="rag-input" value="Tell me about biology." placeholder="Type search query... (e.g. 'biology', 'finance')" class="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
            <button id="btn-retrieve" class="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 py-2 rounded-lg text-sm transition">Search Space</button>
          </div>
          <p class="text-[11px] text-gray-400">Fires a coordinate probe into the network constellation to find similar clusters of data points.</p>
        </div>

        <!-- Agent Loop Inputs -->
        <div id="controls-agents" class="space-y-4 hidden">
          <label class="block text-xs font-semibold text-green-400 uppercase tracking-wider">Control Loop Simulation</label>
          <div class="flex justify-between items-center gap-4">
            <p class="text-xs text-gray-400">Animate a full, multi-stage task loop (Brain ➔ Planning ➔ Tool Call ➔ Memory Log ➔ Output Response).</p>
            <button id="btn-agent-loop" class="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-3 rounded-lg text-sm whitespace-nowrap transition">Trigger Run Loop</button>
          </div>
        </div>

      </section>
    </div>
  </div>

  <!-- Three.js ESM Configuration -->
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

### `app.js`
```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Global Application State ---
let currentScene = 'llm';

// --- Three.js Environment Variables ---
let scene, camera, renderer, controls;

// Persistent Groups representing distinct conceptual locations in the 3D space
const llmGroup = new THREE.Group();
const ragGroup = new THREE.Group();
const agentGroup = new THREE.Group();

// --- Interactive Object Handles ---
const tokenBlocks = [];
const constellationPoints = [];
let parameterStarfield = null;
let parameterDensity = '7B'; // Toggle between 7B and 70B parameter representation
let queryProbe = null;

// Agent Core Objects
let agentBrain = null;
const agentToolSatellites = [];
let agentMemoryRing = null;
let agentConnectionLines = null;

// Object tracker for ambient idle updates
const rotators = [];

// --- Initialize Scene ---
function init() {
  const canvas = document.getElementById('three-canvas');
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0e15);
  scene.fog = new THREE.FogExp2(0x0d0e15, 0.012);

  // Setup main camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 14);

  // Setup WebGL rendering canvas
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Initialize interactive Orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxDistance = 25;
  controls.minDistance = 5;

  // Visualizing ambient background lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(5, 15, 5);
  scene.add(directionalLight);

  // Floor grid helper 
  const gridHelper = new THREE.GridHelper(60, 60, 0x1f2937, 0x111827);
  gridHelper.position.y = -4;
  scene.add(gridHelper);

  // Add the scene modules
  scene.add(llmGroup);
  scene.add(ragGroup);
  scene.add(agentGroup);

  // Build the structures inside each module group
  buildLLMScene();
  buildRAGScene();
  buildAgentScene();

  // Hide the inactive groups initially
  ragGroup.scale.set(0.001, 0.001, 0.001);
  ragGroup.visible = false;
  agentGroup.scale.set(0.001, 0.001, 0.001);
  agentGroup.visible = false;

  // Set up event listeners
  setupEventListeners();
  window.addEventListener('resize', onWindowResize);

  animate();
}

// ==========================================
// 3D SCENE GENERATION CODE (Built Once)
// ==========================================

function buildLLMScene() {
  // Transformer Glass Layers
  const plateGeo = new THREE.BoxGeometry(8, 0.1, 8);
  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0xec4899,
    transparent: true,
    opacity: 0.25,
    roughness: 0.1,
    transmission: 0.5,
    thickness: 1.0
  });

  for (let i = 0; i < 3; i++) {
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = i * 2.5 - 2;
    llmGroup.add(plate);
  }

  // Parameter Representation (Starfield particle cloud background)
  buildParameterStarfield(200); // Start with standard 7B density
}

function buildParameterStarfield(pointsCount) {
  if (parameterStarfield) llmGroup.remove(parameterStarfield);

  const starGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(pointsCount * 3);

  for (let i = 0; i < pointsCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 18;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xf472b6,
    size: 0.08,
    transparent: true,
    opacity: 0.4
  });

  parameterStarfield = new THREE.Points(starGeo, starMat);
  llmGroup.add(parameterStarfield);
}

function buildRAGScene() {
  // Constellation coordinate points representing document conceptual groups
  const pointGeo = new THREE.SphereGeometry(0.12, 16, 16);

  // Group coordinates clustered in Biology (Left) vs Tech/Finance (Right)
  for (let i = 0; i < 120; i++) {
    const isBiology = Math.random() > 0.5;
    const xOffset = isBiology ? -3 : 3;
    const clusterColor = isBiology ? 0x06b6d4 : 0xec4899;

    const pointMat = new THREE.MeshStandardMaterial({
      color: clusterColor,
      emissive: clusterColor,
      emissiveIntensity: 0.4,
      roughness: 0.2
    });

    const mesh = new THREE.Mesh(pointGeo, pointMat);
    mesh.position.set(
      xOffset + (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 4 + 1,
      (Math.random() - 0.5) * 3
    );

    ragGroup.add(mesh);
    constellationPoints.push(mesh);
  }

  // Base indexing platform representing the vector database structure
  const databaseBaseGeo = new THREE.CylinderGeometry(5.5, 5.5, 0.1, 32);
  const databaseBaseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
  const platform = new THREE.Mesh(databaseBaseGeo, databaseBaseMat);
  platform.position.y = -3.5;
  ragGroup.add(platform);
}

function buildAgentScene() {
  // Central core "LLM Brain"
  const brainGeo = new THREE.IcosahedronGeometry(1.5, 2);
  const brainMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    wireframe: true,
    emissive: 0x22c55e,
    emissiveIntensity: 0.4
  });
  agentBrain = new THREE.Mesh(brainGeo, brainMat);
  agentGroup.add(agentBrain);
  rotators.push(agentBrain);

  // Orbital Tool Satellite Systems
  const toolColors = [0x86efac, 0x4ade80, 0x22c55e];
  for (let i = 0; i < 3; i++) {
    const satelliteGroup = new THREE.Group();
    const toolGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const toolMat = new THREE.MeshStandardMaterial({
      color: toolColors[i],
      emissive: toolColors[i],
      emissiveIntensity: 0.8
    });
    const toolMesh = new THREE.Mesh(toolGeo, toolMat);
    
    const angle = (i / 3) * Math.PI * 2;
    toolMesh.position.set(Math.cos(angle) * 4.5, 0, Math.sin(angle) * 4.5);
    satelliteGroup.add(toolMesh);
    
    agentGroup.add(satelliteGroup);
    agentToolSatellites.push(satelliteGroup);
  }

  // Spatial memory boundary ring
  const ringGeo = new THREE.RingGeometry(5.4, 5.5, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x15803d, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
  agentMemoryRing = new THREE.Mesh(ringGeo, ringMat);
  agentMemoryRing.rotation.x = Math.PI / 2;
  agentGroup.add(agentMemoryRing);
}

// ==========================================
// GSAP SCENE SWAPPING & CAM SWEEP TRANSITIONS
// ==========================================

window.switchScene = function(targetScene) {
  if (targetScene === currentScene) return;

  const previousScene = currentScene;
  currentScene = targetScene;

  // Toggle visible interactive panels
  document.getElementById(`controls-${previousScene}`).classList.add('hidden');
  document.getElementById(`controls-${targetScene}`).classList.remove('hidden');

  // Update navigation items active colors
  document.getElementById(`nav-${previousScene}`).className = "px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700/50 transition";
  const accentColors = { llm: 'pink', rag: 'cyan', agents: 'green' };
  const targetColor = accentColors[targetScene];
  document.getElementById(`nav-${targetScene}`).className = `px-4 py-2 rounded-lg bg-${targetColor}-500/10 text-${targetColor}-400 border border-${targetColor}-500/20 transition`;

  // Scale down the outgoing group
  const groups = { llm: llmGroup, rag: ragGroup, agents: agentGroup };
  const outgoingGroup = groups[previousScene];
  const incomingGroup = groups[targetScene];

  gsap.to(outgoingGroup.scale, {
    x: 0.001, y: 0.001, z: 0.001,
    duration: 0.6,
    ease: "power2.inOut",
    onComplete: () => {
      outgoingGroup.visible = false;
      incomingGroup.visible = true;
      
      // Scale up the incoming group
      gsap.to(incomingGroup.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.8,
        ease: "back.out(1.2)"
      });
    }
  });

  // Camera settings per scene location
  const cameraPlacements = {
    llm: { pos: { x: 0, y: 5, z: 14 }, look: { x: 0, y: 0, z: 0 } },
    rag: { pos: { x: 9, y: 6, z: 9 }, look: { x: 0, y: -1, z: 0 } },
    agents: { pos: { x: -8, y: 8, z: 10 }, look: { x: 0, y: 0, z: 0 } }
  };

  const config = cameraPlacements[targetScene];
  
  gsap.to(camera.position, {
    x: config.pos.x,
    y: config.pos.y,
    z: config.pos.z,
    duration: 1.4,
    ease: "power3.inOut"
  });

  gsap.to(controls.target, {
    x: config.look.x,
    y: config.look.y,
    z: config.look.z,
    duration: 1.4,
    ease: "power3.inOut",
    onUpdate: () => controls.update()
  });

  updateTextCopy(targetScene);
};

function updateTextCopy(target) {
  const title = document.getElementById('panel-title');
  const body = document.getElementById('panel-body');
  const indicator = document.getElementById('active-scene-indicator');

  if (target === 'llm') {
    title.innerText = "The LLM Factory";
    body.innerText = "Large Language Models process sentences as LEGO-like pieces called 'tokens'. They build sentences step-by-step by finding the most likely next block based on billions of parameters (internal settings).";
    indicator.innerText = "LLM Mode";
    indicator.className = "text-pink-400 font-bold uppercase tracking-wider";
    title.className = "text-xl font-bold text-pink-400 mb-2";
  } else if (target === 'rag') {
    title.innerText = "The Knowledge Library (RAG)";
    body.innerText = "Retrieval-Augmented Generation bridges memory limitations. Rather than generating answers from memory, RAG searches an index and feeds matching data to the LLM for fact-grounded writing.";
    indicator.innerText = "RAG Mode";
    indicator.className = "text-cyan-400 font-bold uppercase tracking-wider";
    title.className = "text-xl font-bold text-cyan-400 mb-2";
  } else if (target === 'agents') {
    title.innerText = "Autonomous Agent Loops";
    body.innerText = "Agents go beyond standard generations by orchestrating multi-step workflows. They analyze goals, choose custom tools, check local execution feedback, and persist variables dynamically.";
    indicator.innerText = "Agent Mode";
    indicator.className = "text-green-400 font-bold uppercase tracking-wider";
    title.className = "text-xl font-bold text-green-400 mb-2";
  }
}

// ==========================================
// INTERACTIVE USER ACTION SETUP
// ==========================================

function setupEventListeners() {
  
  // 1. LLM: Interactive Tokenization Flow
  document.getElementById('btn-tokenize').addEventListener('click', () => {
    const input = document.getElementById('llm-input').value;
    const words = input.trim().split(/\s+/);
    
    // Clear old token meshes 
    tokenBlocks.forEach(box => llmGroup.remove(box));
    tokenBlocks.length = 0;

    const colors = [0xec4899, 0xf472b6, 0xdb2777];

    words.forEach((word, index) => {
      const boxGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
      const boxMat = new THREE.MeshStandardMaterial({
        color: colors[index % colors.length],
        emissive: colors[index % colors.length],
        emissiveIntensity: 0.6
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      
      // Position block high above the transformer layers
      box.position.set((Math.random() - 0.5) * 4, 11 + index * 1.5, (Math.random() - 0.5) * 4);
      llmGroup.add(box);
      tokenBlocks.push(box);

      // Drops the block down through the plates using a bouncing effect
      gsap.to(box.position, {
        y: -3,
        duration: 3 + index * 0.4,
        ease: "bounce.out",
        delay: index * 0.15
      });
    });
  });

  // 2. LLM: Toggle Parameter Sizes
  document.getElementById('btn-param-scale').addEventListener('click', () => {
    const btn = document.getElementById('btn-param-scale');
    if (parameterDensity === '7B') {
      parameterDensity = '70B';
      btn.innerText = "70B (Dense)";
      btn.className = "text-[10px] bg-pink-600 text-white px-2 py-1 rounded border border-pink-500/50";
      buildParameterStarfield(1000); // 1000 points represent denser configuration
    } else {
      parameterDensity = '7B';
      btn.innerText = "7B (Compact)";
      btn.className = "text-[10px] bg-pink-900/40 text-pink-300 px-2 py-1 rounded border border-pink-500/20";
      buildParameterStarfield(200); // Return back to 200 elements
    }
  });

  // 3. RAG: Search Vector Coordinate Probe Trigger
  document.getElementById('btn-retrieve').addEventListener('click', () => {
    if (queryProbe) ragGroup.remove(queryProbe);

    // Create a vector query search node
    const probeGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const probeMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.5
    });
    queryProbe = new THREE.Mesh(probeGeo, probeMat);
    queryProbe.position.set(0, 10, 0); // Drop in from high axis
    ragGroup.add(queryProbe);

    // Determine target location (simulate spatial coordinates matching query)
    const val = document.getElementById('rag-input').value.toLowerCase();
    const isLeftCluster = val.includes('bio') || val.length % 2 === 0;
    const targetX = isLeftCluster ? -2.5 : 2.5;

    // Direct trajectory using GSAP
    gsap.to(queryProbe.position, {
      x: targetX + (Math.random() - 0.5) * 1.5,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 1.5,
      duration: 1.2,
      ease: "power2.out",
      onComplete: () => {
        // Evaluate distances and highlight matching coordinate nodes
        constellationPoints.forEach(pt => {
          const dist = queryProbe.position.distanceTo(pt.position);
          if (dist < 2.5) {
            // Flash point scales and brightness properties
            gsap.to(pt.scale, { x: 2, y: 2, z: 2, duration: 0.35, yoyo: true, repeat: 1 });
            gsap.to(pt.material, {
              emissiveIntensity: 2.2,
              duration: 0.35,
              yoyo: true,
              repeat: 1,
              onComplete: () => { pt.material.emissiveIntensity = 0.4; }
            });
          }
        });
      }
    });
  });

  // 4. Agent: Multi-Stage Loop Simulator Flow
  document.getElementById('btn-agent-loop').addEventListener('click', () => {
    const timeline = gsap.timeline();
    const statusPanel = document.getElementById('panel-body');

    // Reset loop lines inside group
    if (agentConnectionLines) agentGroup.remove(agentConnectionLines);

    // Step 1: Planning (Brain lights up and expands)
    timeline.to(agentBrain.material.color, { r: 1, g: 0.9, b: 0, duration: 0.2, onStart: () => {
      statusPanel.innerHTML = "<strong>Step 1: Planning</strong><br>The Agent sets goals, reviews past context, and breaks the query into structured actions.";
    }});
    timeline.to(agentBrain.scale, { x: 1.4, y: 1.4, z: 1.4, duration: 0.4, yoyo: true, repeat: 1 });

    // Step 2: Tools (Trigger and animate satellite pathways sequentially)
    agentToolSatellites.forEach((sat, index) => {
      timeline.to(sat.position, {
        y: 2.5,
        duration: 0.35,
        yoyo: true,
        repeat: 1,
        onStart: () => {
          if (index === 0) {
            statusPanel.innerHTML = "<strong>Step 2: Activating External Tools</strong><br>The Brain invokes an API calling action, passing arguments to calculate and retrieve outside state parameters.";
          }
        }
      });
    });

    // Step 3: Local Scratchpad & Long-term Memory
    timeline.to(agentMemoryRing.scale, { x: 1.15, y: 1.15, duration: 0.5, onStart: () => {
      statusPanel.innerHTML = "<strong>Step 3: Variable Memory Persisting</strong><br>Intermediate variables and execution outputs write directly into contextual vector buffers.";
    }});
    timeline.to(agentMemoryRing.scale, { x: 1.0, y: 1.0, duration: 0.5 });

    // Step 4: Final Output Generation Return
    timeline.to(agentBrain.material.color, { r: 0.13, g: 0.77, b: 0.36, duration: 0.2, onComplete: () => {
      statusPanel.innerHTML = "<strong>Task Complete!</strong><br>Agent steps completed. The final response is compiled, validated, and returned back to the user.";
    }});
  });
}

// ==========================================
// UTILITIES & RENDERING LOOP
// ==========================================

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Ambient mesh continuous rotations
  rotators.forEach((obj, idx) => {
    obj.rotation.y += 0.003 * (idx + 1);
  });

  // Slow parameter dust movement when active
  if (currentScene === 'llm' && parameterStarfield) {
    parameterStarfield.rotation.y += 0.0005;
  }

  // Active satellite spin speeds
  agentToolSatellites.forEach((sat, idx) => {
    sat.rotation.y += 0.006 * (idx + 1);
  });

  renderer.render(scene, camera);
}

// Ensure execution begins after DOM tree parsed
window.addEventListener('DOMContentLoaded', init);
```

---

## 6. Implementation & Deployment Roadmap

### Phase 1: Scaffolding (Days 1–2)
- Set up directory structure containing `index.html` and `app.js`.
- Establish core dependencies via script tag elements and import maps.
- Ensure the canvas handles resizing and high-DPI displays.

### Phase 2: Module Construction & Materials (Days 3–5)
- Construct spatial meshes (e.g., translucent glass blocks, cluster point arrays, orbital trackers).
- Map colors, ambient lighting structures, and fog depths to define boundaries between active environments.

### Phase 3: Transition and Interaction Engineering (Days 6–8)
- Bind the sidebar elements to active state modifications.
- Build GSAP transition curves that sweep the camera viewpoint and scale environmental dimensions simultaneously, keeping operations non-jarring.
- Program action triggers to dynamically generate and drop token shapes, locate cluster paths, and animate agency system stages.

### Phase 4: Production Optimization & Deployment (Days 9–10)
- Audit particle counts to prevent rendering lags.
- Deploy the static build folder directly to standard static hosting pipelines like GitHub Pages, Vercel, or Netlify.
