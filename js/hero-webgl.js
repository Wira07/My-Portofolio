/* ==========================================================================
   hero-webgl.js — Medan Partikel & Orbit 3D Kosmik Seluruh Halaman (Three.js)
   - Partikel galaksi spiral + 3 cincin orbit giroskopik 3D
   - Menjauh halus dari kursor (repel di screen-space)
   - Menyebar & mengorbit secara elegan mengikuti scroll di seluruh section web
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
    // tetap hidup & elegan di seluruh halaman (1.0 di hero, ~0.58 di section konten)
    vAlpha = mix(1.0, 0.58, uHeroExit);
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
  dark:  { a: "#3DDC84", b: "#2F6BFF", opacity: 0.95, ringOpacity: 0.20, blending: THREE.AdditiveBlending },
  light: { a: "#059669", b: "#2563EB", opacity: 0.82, ringOpacity: 0.16, blending: THREE.NormalBlending }
};

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
  const R = 3.5, ARMS = 3;
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

  // --- 3 cincin orbit 3D giroskopik ---
  const ringsGroup = new THREE.Group();
  const ringDefs = [
    { r: 1.65, color: pal.a, opScale: 1.0, rx: 0.35, ry: 0.2, rz: -0.25, speedX: 0.14, speedY: 0.22, speedZ: -0.08 },
    { r: 2.55, color: pal.b, opScale: 0.85, rx: -0.42, ry: 0.1, rz: 0.45, speedX: -0.11, speedY: 0.18, speedZ: 0.12 },
    { r: 3.45, color: pal.a, opScale: 0.65, rx: 0.62, ry: -0.28, rz: 0.15, speedX: 0.08, speedY: -0.15, speedZ: 0.09 }
  ];
  const rings = ringDefs.map((d) => {
    const obj = createOrbitRing(d.r, 128, d.color, pal.ringOpacity * d.opScale, pal.blending);
    obj.line.rotation.set(d.rx, d.ry, d.rz);
    ringsGroup.add(obj.line);
    return { ...obj, def: d };
  });
  group.add(ringsGroup);

  group.rotation.x = 0.55;
  group.rotation.z = -0.18;
  scene.add(group);

  // --- state ---
  const mouse = { x: 9, y: 9, tx: 9, ty: 9 };
  const tilt = { x: 0, y: 0 };
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

  function resize() {
    const w = window.innerWidth || canvas.clientWidth || 1280;
    const h = window.innerHeight || canvas.clientHeight || 800;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    material.uniforms.uAspect.value = aspect;

    const wide = aspect > 1.15;
    baseHeroX = wide ? Math.min(2.05, aspect * 0.92) : 0;
    baseHeroY = wide ? 0 : 1.05;
    baseScale = wide ? 1 : Math.min(1, aspect * 1.25);

    material.uniforms.uSize.value = w < 768 ? 25 : 20;
    material.uniforms.uOpacity.value = (w < 768 ? 0.72 : 1) * (PALETTE[currentTheme] || PALETTE.dark).opacity;
  }

  function onPointer(e) {
    if (e.pointerType === "touch") return;
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  }
  function onLeave() { mouse.tx = 9; mouse.ty = 9; }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;

    // perhalus nilai scroll halaman & transisi keluar hero
    const lerpFactor = Math.min(1, dt * 6);
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

    group.rotation.x = 0.55 + Math.sin(smoothScroll * Math.PI * 2.0) * 0.26 * smoothHeroExit + tilt.x;
    group.rotation.y = smoothScroll * 1.35 + tilt.y;
    group.rotation.z = -0.18 + Math.cos(smoothScroll * Math.PI * 2.0) * 0.22 * smoothHeroExit;

    // rotasi cincin orbit giroskopik 3D
    rings.forEach(({ line, def }, idx) => {
      const scrollSpin = smoothScroll * (idx % 2 === 0 ? 2.4 : -2.1);
      line.rotation.x = def.rx + elapsed * def.speedX + scrollSpin * 0.45;
      line.rotation.y = def.ry + elapsed * def.speedY + scrollSpin;
      line.rotation.z = def.rz + elapsed * def.speedZ;
    });

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
    rings.forEach(({ mat, def }, idx) => {
      mat.color.set(idx === 1 ? p.b : p.a);
      mat.opacity = p.ringOpacity * def.opScale;
      mat.blending = p.blending;
      mat.needsUpdate = true;
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
      targetScroll = Math.min(Math.max(pageProgress, 0), 1);
      if (typeof heroProgress === "number") {
        targetHeroExit = Math.min(Math.max(heroProgress, 0), 1);
      } else {
        targetHeroExit = Math.min(Math.max(targetScroll * 5.0, 0), 1);
      }
    },
    setTheme,
    destroy() {
      stop();
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      geometry.dispose();
      material.dispose();
      rings.forEach(({ geo, mat }) => {
        geo.dispose();
        mat.dispose();
      });
      renderer.dispose();
    }
  };
}
