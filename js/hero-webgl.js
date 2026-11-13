/* ==========================================================================
   hero-webgl.js — Medan Partikel, Cincin Orbit 3D & 13 Planet Logo Teknologi Resmi
   - Partikel galaksi spiral + 3 cincin orbit planet 3D
   - 13 logo teknologi resmi (HTML5, CSS3, JS, Kotlin, Flutter, Node.js, Laravel,
     Figma, Adobe XD, Vue.js, Git, GitHub, Linux) mengorbit seperti planet di Hero,
     menghilang mulus saat di-scroll ke bawah, dan muncul kembali saat ke atas
   - Medan bintang & cincin orbit kosmik tetap menyebar elegan di seluruh halaman
   ========================================================================== */
import * as THREE from "../vendor/three.module.min.js";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uScroll;
  uniform float uHeroExit;
  uniform float uAspect;
  uniform float uStrength;
  uniform vec2  uMouse;
  attribute vec3  aRandom;
  attribute float aScale;
  attribute float aMix;
  varying float vMix;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    // rotasi diferensial: inti berputar lebih cepat + bereaksi terhadap scroll halaman
    float ang = uTime * 0.075 * (1.0 - aMix * 0.55) + uScroll * 4.2 * (0.45 + aMix * 0.65);
    float c = cos(ang), s = sin(ang);
    p.xz = mat2(c, -s, s, c) * p.xz;

    // gerak napas halus + gelombang orbital sepanjang halaman
    p.y += sin(uTime * 0.65 + aRandom.x * 6.2831 + uScroll * 9.0) * (0.06 + uHeroExit * 0.22);

    // saat keluar dari hero menuju section lain, orbit melebar menyelimuti halaman secara elegan
    vec3 expandOffset = (aRandom - 0.5) * vec3(5.2, 3.8, 4.2);
    p += expandOffset * uHeroExit;
    p *= 1.0 + uHeroExit * 0.32;

    // pusaran heliks lembut saat menjelajahi section bawah
    float waveAng = uScroll * 6.28318 + aRandom.z * 6.28318;
    p.x += cos(waveAng) * 0.28 * uHeroExit;
    p.z += sin(waveAng) * 0.28 * uHeroExit;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * world;
    vec4 clip = projectionMatrix * mv;

    // repel dari kursor, dihitung di ruang layar (NDC)
    vec2 ndc = clip.xy / clip.w;
    vec2 d = ndc - uMouse;
    d.x *= uAspect;
    float dist = length(d);
    float f = smoothstep(0.38, 0.0, dist);
    vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
    dir.x /= uAspect;
    ndc += dir * f * uStrength;

    gl_Position = vec4(ndc * clip.w, clip.z, clip.w);
    gl_PointSize = uSize * aScale * uPixelRatio * (1.0 / max(-mv.z, 0.8));

    vMix = aMix;
    // tetap hidup & elegan di seluruh halaman (1.0 di hero, ~0.55 di section konten)
    vAlpha = mix(1.0, 0.55, uHeroExit);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uOpacity;
  varying float vMix;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(1.0 - d * 2.0, 1.8);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, vMix));
    gl_FragColor = vec4(col, a * uOpacity * vAlpha);
  }
`;

const PALETTE = {
  dark:  { a: "#3DDC84", b: "#2F6BFF", opacity: 0.95, ringOpacity: 0.26, blending: THREE.AdditiveBlending },
  light: { a: "#059669", b: "#2563EB", opacity: 0.82, ringOpacity: 0.20, blending: THREE.NormalBlending }
};

/** 13 Logo Teknologi Resmi (Devicon Original SVG) yang mengorbit di 3 cincin planet */
const TECH_PLANETS = [
  // Cincin Dalam (Ring 0 — Mobile & UI/UX Core): 4 planet
  { id: "kotlin",     label: "Kotlin",     icon: "assets/icons/tech/kotlin.svg",     color: "#7F52FF", ring: 0, slot: 0, totalInRing: 4 },
  { id: "flutter",    label: "Flutter",    icon: "assets/icons/tech/flutter.svg",    color: "#38BDF8", ring: 0, slot: 1, totalInRing: 4 },
  { id: "figma",      label: "Figma",      icon: "assets/icons/tech/figma.svg",      color: "#F24E1E", ring: 0, slot: 2, totalInRing: 4 },
  { id: "adobexd",    label: "Adobe XD",   icon: "assets/icons/tech/adobexd.svg",    color: "#FF61F6", ring: 0, slot: 3, totalInRing: 4 },

  // Cincin Tengah (Ring 1 — Front-End Web): 4 planet
  { id: "html5",      label: "HTML5",      icon: "assets/icons/tech/html5.svg",      color: "#E34F26", ring: 1, slot: 0, totalInRing: 4 },
  { id: "css3",       label: "CSS3",       icon: "assets/icons/tech/css3.svg",       color: "#1572B6", ring: 1, slot: 1, totalInRing: 4 },
  { id: "javascript", label: "JavaScript", icon: "assets/icons/tech/javascript.svg", color: "#F7DF1E", ring: 1, slot: 2, totalInRing: 4 },
  { id: "vuejs",      label: "Vue.js",     icon: "assets/icons/tech/vuejs.svg",      color: "#4FC08D", ring: 1, slot: 3, totalInRing: 4 },

  // Cincin Luar (Ring 2 — Back-End, DevOps & OS): 5 planet
  { id: "nodejs",     label: "Node.js",    icon: "assets/icons/tech/nodejs.svg",     color: "#5FA04E", ring: 2, slot: 0, totalInRing: 5 },
  { id: "laravel",    label: "Laravel",    icon: "assets/icons/tech/laravel.svg",    color: "#FF2D20", ring: 2, slot: 1, totalInRing: 5 },
  { id: "git",        label: "Git",        icon: "assets/icons/tech/git.svg",        color: "#F05032", ring: 2, slot: 2, totalInRing: 5 },
  { id: "github",     label: "GitHub",     icon: "assets/icons/tech/github.svg",     color: "#A8B3CF", ring: 2, slot: 3, totalInRing: 5 },
  { id: "linux",      label: "Linux",      icon: "assets/icons/tech/linux.svg",      color: "#FCC624", ring: 2, slot: 4, totalInRing: 5 }
];

/** true jika WebGL tersedia */
export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

function createOrbitRing(radius, segments, colorHex, opacity, blending) {
  const pts = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pts[i * 3] = Math.cos(theta) * radius;
    pts[i * 3 + 1] = 0;
    pts[i * 3 + 2] = Math.sin(theta) * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity,
    blending,
    depthWrite: false
  });
  return { line: new THREE.LineLoop(geo, mat), geo, mat };
}

/* ---------- Ekor cahaya (comet trail) yang meluncur di setiap cincin orbit ---------- */
const TRAIL_N = 30;
const TRAIL_STEP = 0.04;

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.28, "rgba(255,255,255,.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function createTrail(colorHex, texture, blending) {
  const positions = new Float32Array(TRAIL_N * 3);
  const colors = new Float32Array(TRAIL_N * 3);
  const base = new THREE.Color(colorHex).lerp(new THREE.Color("#FFFFFF"), 0.25);
  for (let k = 0; k < TRAIL_N; k++) {
    const f = Math.pow(1 - k / TRAIL_N, 2.2);
    colors[k * 3] = base.r * f;
    colors[k * 3 + 1] = base.g * f;
    colors[k * 3 + 2] = base.b * f;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.13,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, geo, mat, positions };
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => {
  const c1 = 1.5, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ count: number, theme: 'dark'|'light' }} opts
 */
export function createHero(canvas, { count = 3000, theme = "dark" } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0.2, 6.6);

  // --- geometri galaksi spiral ---
  const R = 3.4, ARMS = 3;
  const position = new Float32Array(count * 3);
  const random = new Float32Array(count * 3);
  const scale = new Float32Array(count);
  const mix = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 1.45) * R;
    const branch = ((i % ARMS) / ARMS) * Math.PI * 2;
    const spin = r * 1.15;
    const spread = (v) => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.38 * (0.35 + r * 0.45) * v;
    position[i * 3]     = Math.cos(branch + spin) * r + spread(1);
    position[i * 3 + 1] = spread(0.55);
    position[i * 3 + 2] = Math.sin(branch + spin) * r + spread(1);
    random[i * 3] = Math.random();
    random[i * 3 + 1] = Math.random();
    random[i * 3 + 2] = Math.random();
    scale[i] = 0.5 + Math.random() * 1.3;
    mix[i] = r / R;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(random, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
  geometry.setAttribute("aMix", new THREE.BufferAttribute(mix, 1));

  const pal = PALETTE[theme] || PALETTE.dark;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: pal.blending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 20 },
      uPixelRatio: { value: pixelRatio },
      uScroll: { value: 0 },
      uHeroExit: { value: 0 },
      uAspect: { value: 1 },
      uStrength: { value: 0.22 },
      uMouse: { value: new THREE.Vector2(9, 9) },
      uColorA: { value: new THREE.Color(pal.a) },
      uColorB: { value: new THREE.Color(pal.b) },
      uOpacity: { value: pal.opacity }
    }
  });

  const points = new THREE.Points(geometry, material);
  const group = new THREE.Group();
  group.add(points);

  // --- 3 cincin orbit tata surya 3D (sebidang dengan kemiringan planet realistis) ---
  const ringsGroup = new THREE.Group();
  // Setiap cincin: kemiringan berbeda + bentuk elips (ex/ez) agar orbit terasa hidup, bukan lingkaran kaku
  const ringDefs = [
    { r: 1.28, color: pal.a, opScale: 1.05, rx: 0.22,  ry: 0.0, rz: -0.26, ex: 1.14, ez: 1.0,  orbitSpeed: 0.30,  headSpeed: 0.95 },
    { r: 2.02, color: pal.b, opScale: 0.90, rx: -0.34, ry: 0.0, rz: 0.24,  ex: 1.0,  ez: 1.12, orbitSpeed: -0.21, headSpeed: -0.72 },
    { r: 2.78, color: pal.a, opScale: 0.75, rx: 0.15,  ry: 0.0, rz: -0.13, ex: 1.10, ez: 0.94, orbitSpeed: 0.15,  headSpeed: 0.52 }
  ];
  const glowTex = makeGlowTexture();
  const rings = ringDefs.map((d, idx) => {
    const obj = createOrbitRing(d.r, 160, d.color, pal.ringOpacity * d.opScale, pal.blending);
    obj.line.rotation.set(d.rx, d.ry, d.rz);
    obj.line.scale.set(d.ex, 1, d.ez);
    const trail = createTrail(idx === 1 ? pal.b : pal.a, glowTex, pal.blending);
    trail.points.visible = pal.blending === THREE.AdditiveBlending;
    obj.line.add(trail.points);
    ringsGroup.add(obj.line);
    return { ...obj, def: d, trail };
  });
  group.add(ringsGroup);

  group.rotation.x = 0.62;
  group.rotation.z = -0.16;
  scene.add(group);

  // --- 13 Planet Logo Teknologi (DOM terproyeksi 3D langsung dari cincin Three.js) ---
  const planetsContainer = document.getElementById("hero-planets");
  const planetNodes = [];
  if (planetsContainer) {
    planetsContainer.innerHTML = TECH_PLANETS.map(
      (p, idx) => `
      <div class="hero-planet hero-planet--${p.id}" data-tech="${p.id}" style="--planet-color: ${p.color}; --d: ${(-idx * 0.83).toFixed(2)}s">
        <span class="hero-planet__halo"></span>
        <span class="hero-planet__core">
          <img src="${p.icon}" alt="${p.label}" width="24" height="24" decoding="async">
        </span>
        <span class="hero-planet__label">${p.label}</span>
      </div>`
    ).join("");

    const els = planetsContainer.querySelectorAll(".hero-planet");
    TECH_PLANETS.forEach((p, idx) => {
      const baseAngle = (p.slot / p.totalInRing) * Math.PI * 2 + p.ring * 0.55;
      const dir = p.ring % 2 === 0 ? 1 : -1;
      planetNodes.push({
        ...p,
        el: els[idx],
        coreEl: els[idx].querySelector(".hero-planet__core"),
        baseAngle,
        // tiap planet punya kecepatan & fase sendiri -> jarak antar planet "bernapas", tidak kaku
        driftSpeed: dir * (0.035 + p.ring * 0.012 + (p.slot % 3) * 0.013),
        phase: idx * 1.73,
        blurBin: -1
      });
    });
  }

  // --- state ---
  const mouse = { x: 9, y: 9, tx: 9, ty: 9 };
  const tilt = { x: 0, y: 0 };
  const par = { x: 0, y: 0 };
  const tmpVec = new THREE.Vector3();
  const mvVec = new THREE.Vector3();
  const centerVec = new THREE.Vector3();
  let introStart = 0.35;

  let viewW = window.innerWidth || 1280;
  let viewH = window.innerHeight || 800;
  let targetScroll = 0;
  let smoothScroll = 0;
  let targetHeroExit = 0;
  let smoothHeroExit = 0;
  let baseHeroX = 1.8;
  let baseHeroY = 0;
  let baseScale = 1;
  let raf = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 0;
  let currentTheme = theme;
  let swarmFreeze = false;

  function resize() {
    viewW = window.innerWidth || canvas.clientWidth || 1280;
    viewH = window.innerHeight || canvas.clientHeight || 800;
    if (!viewW || !viewH) return;
    renderer.setSize(viewW, viewH, false);
    const aspect = viewW / viewH;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    material.uniforms.uAspect.value = aspect;

    const wide = aspect > 1.15;
    baseHeroX = wide ? Math.min(2.12, aspect * 1.0) : 0;
    baseHeroY = wide ? -0.04 : 0.95;
    baseScale = wide ? 0.96 : Math.min(0.88, aspect * 1.15);

    material.uniforms.uSize.value = viewW < 768 ? 25 : 20;
    material.uniforms.uOpacity.value = (viewW < 768 ? 0.72 : 1) * (PALETTE[currentTheme] || PALETTE.dark).opacity;
  }

  function onPointer(e) {
    if (e.pointerType === "touch") return;
    mouse.tx = (e.clientX / viewW) * 2 - 1;
    mouse.ty = -((e.clientY / viewH) * 2 - 1);
  }
  function onLeave() { mouse.tx = 9; mouse.ty = 9; }

  function frame(now) {
    if (!swarmFreeze) raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    elapsed += dt;

    if (swarmFreeze) {
      targetScroll = 0;
      smoothScroll = 0;
      targetHeroExit = 0;
      smoothHeroExit = 0;
      elapsed = Math.max(elapsed, introStart + 2.5);
    }

    // perhalus nilai scroll halaman & transisi keluar hero
    const lerpFactor = Math.min(1, dt * 7);
    smoothScroll += (targetScroll - smoothScroll) * lerpFactor;
    smoothHeroExit += (targetHeroExit - smoothHeroExit) * lerpFactor;

    // kursor mulus (lerp)
    if (mouse.tx > 5) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    else {
      if (mouse.x > 5) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 10);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 10);
    }

    material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uScroll.value = smoothScroll;
    material.uniforms.uHeroExit.value = smoothHeroExit;

    // miring halus mengikuti kursor
    const tx = mouse.tx > 5 ? 0 : mouse.ty * 0.14;
    const ty = mouse.tx > 5 ? 0 : mouse.tx * 0.20;
    tilt.x += (tx - tilt.x) * Math.min(1, dt * 3);
    tilt.y += (ty - tilt.y) * Math.min(1, dt * 3);

    // lintasan 3D elegan melintasi seluruh halaman saat di-scroll
    const wanderX = Math.sin(smoothScroll * Math.PI * 3.0) * 1.35;
    const wanderY = Math.cos(smoothScroll * Math.PI * 2.5) * 0.38;
    group.position.x = baseHeroX * (1 - smoothHeroExit) + wanderX * smoothHeroExit;
    group.position.y = baseHeroY * (1 - smoothHeroExit) + wanderY * smoothHeroExit;
    group.scale.setScalar(baseScale * (1 + smoothHeroExit * 0.14));

    group.rotation.x = 0.62 + Math.sin(smoothScroll * Math.PI * 2.0) * 0.22 * smoothHeroExit + tilt.x;
    group.rotation.y = smoothScroll * 1.15 + tilt.y;
    group.rotation.z = -0.16 + Math.cos(smoothScroll * Math.PI * 2.0) * 0.18 * smoothHeroExit;

    // rotasi cincin orbit + ekor cahaya komet yang meluncur di tiap cincin
    const ringTime = swarmFreeze ? 0.35 : elapsed;
    rings.forEach(({ line, def, trail }, idx) => {
      const scrollSpin = smoothScroll * (idx % 2 === 0 ? 1.8 : -1.6);
      line.rotation.x = def.rx + Math.sin(ringTime * 0.25 + idx) * 0.07 + smoothHeroExit * 0.35 * (idx - 1);
      line.rotation.y = def.ry + ringTime * def.orbitSpeed + scrollSpin;
      line.rotation.z = def.rz + Math.cos(ringTime * 0.22 + idx) * 0.07;

      const dir = def.headSpeed >= 0 ? 1 : -1;
      const head = ringTime * def.headSpeed + idx * 2.1;
      const arr = trail.positions;
      for (let k = 0; k < TRAIL_N; k++) {
        const th = head - dir * k * TRAIL_STEP;
        arr[k * 3] = Math.cos(th) * def.r;
        arr[k * 3 + 1] = 0;
        arr[k * 3 + 2] = Math.sin(th) * def.r;
      }
      trail.geo.attributes.position.needsUpdate = true;
      trail.mat.opacity = 0.95 - 0.45 * smoothHeroExit;
    });

    scene.updateMatrixWorld();

    // --- Proyeksi 3D -> 2D untuk 13 Planet Logo (khusus saat di Hero) ---
    if (planetsContainer && planetNodes.length) {
      // Terlihat penuh di Hero (smoothHeroExit = 0), menghilang mulus saat di-scroll ke bawah
      const baseVis = clamp01(1 - smoothHeroExit * 1.85);
      // Animasi masuk (intro / saat kembali ke atas): planet muncul bergantian (stagger)
      const intro = clamp01((elapsed - introStart) / 1.9);

      if (baseVis <= 0.005 || intro <= 0.001) {
        planetsContainer.style.opacity = "0";
        planetsContainer.style.visibility = "hidden";
      } else {
        planetsContainer.style.visibility = "visible";
        planetsContainer.style.opacity = "1";

        const isMobile = viewW < 768;
        const mobileScale = isMobile ? 0.76 : 1.0;
        const total = planetNodes.length;

        // paralaks kursor yang dihaluskan
        par.x += ((mouse.tx > 5 ? 0 : mouse.tx) - par.x) * Math.min(1, dt * 3.2);
        par.y += ((mouse.tx > 5 ? 0 : mouse.ty) - par.y) * Math.min(1, dt * 3.2);

        // titik pusat orbit di layar (untuk efek planet "tersedot" masuk/keluar)
        centerVec.set(0, 0, 0).applyMatrix4(ringsGroup.matrixWorld).project(camera);
        const cx = (centerVec.x * 0.5 + 0.5) * viewW;
        const cy = (-centerVec.y * 0.5 + 0.5) * viewH;

        for (let i = 0; i < total; i++) {
          const p = planetNodes[i];
          const ringObj = rings[p.ring];
          const stag = i / total;

          // visibilitas per planet (bertahap), lalu easing masuk dengan sedikit "pantulan"
          const v = clamp01(baseVis * 1.45 - stag * 0.45) * clamp01(intro * 1.5 - stag * 0.5);
          const e = easeOutCubic(v);
          const s = Math.max(0.0001, easeOutBack(v));

          // radius "bernapas" + melayang naik-turun, kecepatan geser tiap planet berbeda
          const orbitTime = swarmFreeze ? 0.35 : elapsed;
          const breathe = 1 + Math.sin(orbitTime * 0.8 + p.phase) * 0.035;
          const r = ringObj.def.r * (1 + smoothHeroExit * 0.65) * breathe;
          const theta = p.baseAngle + orbitTime * p.driftSpeed + smoothHeroExit * (p.ring % 2 === 0 ? 1.6 : -1.6);
          const lift = Math.sin(orbitTime * 1.1 + p.phase) * 0.09;

          // Posisi lokal pada cincin XZ (cincin berputar & miring terhadap waktu)
          tmpVec.set(Math.cos(theta) * r, lift, Math.sin(theta) * r);
          tmpVec.applyMatrix4(ringObj.line.matrixWorld);

          // Kedalaman Z terhadap kamera untuk skala perspektif & urutan depan/belakang
          mvVec.copy(tmpVec).applyMatrix4(camera.matrixWorldInverse);
          const depth = -mvVec.z;
          const normDepth = clamp01((depth - 4.0) / 5.2);

          // Proyeksi ke koordinat layar
          tmpVec.project(camera);
          const ndcX = tmpVec.x;
          const ndcY = tmpVec.y;
          let sx = (ndcX * 0.5 + 0.5) * viewW;
          let sy = (-ndcY * 0.5 + 0.5) * viewH;

          // paralaks kursor (planet depan bergeser lebih jauh) + ayunan halus
          const near = 1 - normDepth;
          sx += par.x * near * 18 + Math.cos(elapsed * 1.05 + p.phase) * 1.8;
          sy += -par.y * near * 12 + Math.sin(elapsed * 1.3 + p.phase) * 3.2 * (0.5 + near * 0.5);

          // tersedot ke pusat orbit saat muncul / menghilang
          const pull = 0.35 + 0.65 * e;
          sx = cx + (sx - cx) * pull;
          sy = cy + (sy - cy) * pull;

          const depthScale = (1.16 - normDepth * 0.44) * mobileScale;
          const finalScale = depthScale * s;
          const finalAlpha = (1.0 - normDepth * 0.42) * e;
          const zIdx = Math.round(near * 30);

          p.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${finalScale.toFixed(3)})`;
          p.el.style.opacity = finalAlpha.toFixed(3);
          p.el.style.zIndex = String(zIdx);

          // kemiringan 3D logo mengikuti posisinya di orbit (seperti bola kaca yang berputar)
          const rx = -ndcY * 18 + Math.sin(elapsed * 0.9 + p.phase) * 6;
          const ry = ndcX * 24 + Math.cos(elapsed * 0.8 + p.phase) * 7;
          p.coreEl.style.setProperty("--rx", `${rx.toFixed(1)}deg`);
          p.coreEl.style.setProperty("--ry", `${ry.toFixed(1)}deg`);

          // label hanya jelas pada planet di depan (mengurangi tumpang tindih)
          p.el.style.setProperty("--lab", (normDepth < 0.5 ? 1 : Math.max(0, 1 - (normDepth - 0.5) * 4)).toFixed(2));

          // planet di belakang sedikit blur -> kesan kedalaman (hanya diubah saat berganti tingkat)
          const bin = normDepth > 0.72 ? 2 : normDepth > 0.45 ? 1 : 0;
          if (bin !== p.blurBin) {
            p.blurBin = bin;
            p.el.style.filter = bin === 2 ? "blur(1.1px)" : bin === 1 ? "blur(.45px)" : "none";
          }
        }
      }
    }

    renderer.render(scene, camera);
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("mouseleave", onLeave);

  function setTheme(next) {
    currentTheme = next;
    const p = PALETTE[next] || PALETTE.dark;
    material.uniforms.uColorA.value.set(p.a);
    material.uniforms.uColorB.value.set(p.b);
    material.blending = p.blending;
    material.needsUpdate = true;
    rings.forEach(({ mat, def, trail }, idx) => {
      mat.color.set(idx === 1 ? p.b : p.a);
      mat.opacity = p.ringOpacity * def.opScale;
      mat.blending = p.blending;
      mat.needsUpdate = true;
      // ekor komet memakai blending additive: hanya tampil di tema gelap
      trail.points.visible = p.blending === THREE.AdditiveBlending;
      trail.mat.blending = p.blending;
      trail.mat.needsUpdate = true;
    });
    resize();
  }

  resize();
  renderer.render(scene, camera);
  start();

  return {
    /**
     * @param {number} pageProgress 0..1 sepanjang dokumen
     * @param {number} [heroProgress] 0..1 sepanjang section hero
     */
    setScroll(pageProgress, heroProgress) {
      if (swarmFreeze) return;
      targetScroll = Math.min(Math.max(pageProgress, 0), 1);
      if (typeof heroProgress === "number") {
        targetHeroExit = Math.min(Math.max(heroProgress, 0), 1);
      } else {
        targetHeroExit = Math.min(Math.max(targetScroll * 5.0, 0), 1);
      }
    },
    setTheme,
    /** Putar ulang animasi masuk 13 planet (dipanggil saat preloader terbuka) */
    replayPlanets() {
      introStart = elapsed + 0.15;
    },
    /** Kunci posisi orbit & planet di Hero saat ekstensi Swarm Rebuild memindai halaman */
    setSwarmMode(active) {
      swarmFreeze = !!active;
      if (swarmFreeze) {
        stop();
        frame(performance.now());
      } else {
        start();
      }
    },
    /** Tangkap snapshot PNG transparan dari galaksi & cincin orbit 3D */
    captureSnapshot() {
      renderer.render(scene, camera);
      try {
        return canvas.toDataURL("image/png");
      } catch (_) {
        return "";
      }
    },
    destroy() {
      stop();
      if (planetsContainer) planetsContainer.innerHTML = "";
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      geometry.dispose();
      material.dispose();
      glowTex.dispose();
      rings.forEach(({ geo, mat, trail }) => {
        geo.dispose();
        mat.dispose();
        trail.geo.dispose();
        trail.mat.dispose();
      });
      renderer.dispose();
    }
  };
}
