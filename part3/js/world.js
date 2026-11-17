// ════════════════════════════════════════════════════════════════════════════
// PULAU RAJAWALI — VISUAL UPGRADE (World · WorldFlora · WorldDetail)
// Drop-in pengganti blok `World` dan `WorldFlora` lama. WorldBuildings & NavGrid
// TIDAK diubah (WorldBuildings tetap dipakai apa adanya). API publik sama.
// Load SETELAH world file asli (karena butuh WorldBuildings untuk hook di bawah).
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// VK — helper visual bersama: noise, tekstur daun prosedural, angin, CSM
// ════════════════════════════════════════════════════════════════════════════
const VK = (() => {
  const hash3 = (x, y, z) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
  const sm = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
    return lerp(
      lerp(lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), fx), lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), fx), fy),
      lerp(lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), fx), lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), fx), fy),
      fz
    );
  }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  const GLSL_NOISE = `
    float vkHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vkNoise(vec2 p){
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(vkHash(i), vkHash(i + vec2(1.0, 0.0)), f.x), mix(vkHash(i + vec2(0.0, 1.0)), vkHash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float vkFbm(vec2 p){
      float a = 0.5; float s = 0.0;
      for (int i = 0; i < 4; i++) { s += a * vkNoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
      return s;
    }
  `;

  // Pasang onBeforeCompile + (opsional) CSM, dengan pola yang sama seperti terrain lama.
  function withCSM(mat, compileFn, csm, cacheKey) {
    mat.onBeforeCompile = compileFn;
    if (cacheKey) mat.customProgramCacheKey = () => cacheKey;
    if (csm && typeof csm.setupMaterial === 'function' && !(mat.defines && mat.defines.USE_CSM)) {
      const base = mat.onBeforeCompile;
      csm.setupMaterial(mat);
      const csmCompile = mat.onBeforeCompile;
      if (csmCompile && csmCompile !== base) {
        mat.onBeforeCompile = (shader, renderer) => { base(shader, renderer); csmCompile(shader, renderer); };
      }
    }
    return mat;
  }

  // Angin bersama: satu uniform untuk semua pohon/semak/rumput
  const wind = { uTime: { value: 0 }, uWind: { value: 1 } };
  function injectWind(shader, H, flutter) {
    shader.uniforms.uTime = wind.uTime;
    shader.uniforms.uWind = wind.uWind;
    shader.uniforms.uWindH = { value: H };
    shader.uniforms.uFlutter = { value: flutter };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;\nuniform float uWindH;\nuniform float uFlutter;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
          vec4 vkIw = instanceMatrix * vec4(transformed, 1.0);
          #else
          vec4 vkIw = vec4(transformed, 1.0);
          #endif
          float vkHw = clamp(transformed.y / uWindH, 0.0, 1.0);
          vkHw *= vkHw;
          float vkPh = uTime * 1.6 + vkIw.x * 0.085 + vkIw.z * 0.071;
          vec2 vkSw = vec2(sin(vkPh) + 0.45 * sin(vkPh * 2.3 + 1.3), 0.7 * cos(vkPh * 0.83 + 0.4));
          transformed.xz += vkSw * (0.017 * uWindH * vkHw * uWind);
          transformed += vec3(
            sin(uTime * 5.1 + vkIw.x * 1.7 + transformed.y * 3.1),
            0.5 * cos(uTime * 4.3 + vkIw.z * 1.9 + transformed.x * 2.7),
            sin(uTime * 4.7 + vkIw.z * 1.3 + transformed.z * 3.3)
          ) * (0.03 * uFlutter * uWind);
        }`);
  }

  // ── Geometri ──────────────────────────────────────────────────────────────
  function toGeo(raw) {
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    raw.dispose();
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  }
  function ensureColor(g) {
    if (!g.attributes.color) {
      const a = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    return g;
  }
  function merge(list) {
    list.forEach(ensureColor);
    const m = BufferGeometryUtils.mergeGeometries(list, false);
    list.forEach(c => c.dispose());
    return m;
  }
  function paint(g, r, gr, b) {
    ensureColor(g);
    const c = g.attributes.color;
    for (let i = 0; i < c.count; i++) c.setXYZ(i, r, gr, b);
    return g;
  }
  function setUV(g, u, v) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
    return g;
  }
  // Deformasi organik berbasis posisi (bebas retak antar-segitiga)
  function displace(g, amp, freq, seed = 0) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setXYZ(i,
        x + (noise3(x * freq + seed, y * freq, z * freq) - 0.5) * amp,
        y + (noise3(x * freq, y * freq + seed + 11.1, z * freq) - 0.5) * amp * 0.7,
        z + (noise3(x * freq, y * freq, z * freq + seed + 23.7) - 0.5) * amp);
    }
    p.needsUpdate = true;
    return g;
  }
  // Normal "berbulu": radial dari pusat kanopi → bayangan lembut seperti dedaunan sungguhan
  function fluff(g, cx, cy, cz, upBlend, column) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) - cx, dy = p.getY(i) - cy, dz = p.getZ(i) - cz;
      let vx = dx, vy = dy, vz = dz;
      if (column) { vy = Math.hypot(dx, dz) * upBlend; }
      else { const l = Math.hypot(dx, dy, dz) || 1; vy = dy + l * upBlend; }
      const l2 = Math.hypot(vx, vy, vz) || 1;
      n.setXYZ(i, vx / l2, vy / l2, vz / l2);
    }
    n.needsUpdate = true;
    return g;
  }
  // AO palsu: bagian dalam & bawah kanopi lebih gelap, pucuk lebih terang
  function shadeCanopy(g, cx, cy, cz, rad, yLow, yHigh) {
    ensureColor(g);
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const d = Math.min(1, Math.hypot(x - cx, y - cy, z - cz) / rad);
      const ys = smooth(yLow, yHigh, y);
      let k = 0.44 + 0.34 * ys + 0.34 * d;
      k *= 0.9 + 0.2 * noise3(x * 1.7, y * 1.7, z * 1.7);
      c.setXYZ(i, k * 1.04, k, k * 0.88);
    }
    c.needsUpdate = true;
    return g;
  }
  function darkenBase(g, h) {
    ensureColor(g);
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = (0.55 + 0.45 * smooth(0, h, y)) * (0.88 + 0.24 * noise3(p.getX(i) * 3, y * 2, p.getZ(i) * 3));
      c.setXYZ(i, k, k * 0.98, k * 0.94);
    }
    return g;
  }
  const _o = new THREE.Object3D();
  function card(w, h, pos, dir, roll) {
    const g = toGeo(new THREE.PlaneGeometry(w, h));
    _o.position.copy(pos);
    _o.lookAt(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
    _o.rotateZ(roll);
    _o.updateMatrix();
    g.applyMatrix4(_o.matrix);
    return g;
  }

  // ── Tekstur daun prosedural (alpha, tanpa tepi hitam) ─────────────────────
  function dataTexFromCanvas(cv, bleed) {
    const w = cv.width, h = cv.height;
    const id = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const sy = h - 1 - y;
      for (let x = 0; x < w; x++) {
        const si = (sy * w + x) * 4, di = (y * w + x) * 4;
        const a = id[si + 3];
        if (a < 8) { out[di] = bleed[0]; out[di + 1] = bleed[1]; out[di + 2] = bleed[2]; out[di + 3] = a; }
        else { out[di] = id[si]; out[di + 1] = id[si + 1]; out[di + 2] = id[si + 2]; out[di + 3] = a; }
      }
    }
    const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }
  const rgb = (r, g, b) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  function leafShape(ctx, x, y, len, wid, ang, col, rib) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.75, 0, -len);
    ctx.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.25, 0, 0);
    ctx.fill();
    if (rib) { ctx.strokeStyle = rib; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * 0.92); ctx.stroke(); }
    ctx.restore();
  }
  function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }

  function makeFoliageTex(kind) {
    const rnd = Util.mulberry32({ broad: 1337, needle: 4242, frond: 777, reed: 9090 }[kind] || 1);
    const W = kind === 'frond' ? 128 : kind === 'reed' ? 64 : 256;
    const H = kind === 'frond' ? 512 : kind === 'reed' ? 256 : 256;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    let bleed = [60, 96, 40];
    if (kind === 'broad') {
      ctx.fillStyle = rgb(30, 54, 24);
      ctx.beginPath(); ctx.arc(128, 128, 48, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 140; k++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 84;
        const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
        const t = Math.min(1, (r / 84) * 0.7 + rnd() * 0.35);
        leafShape(ctx, x, y, 20 + rnd() * 14, 5 + rnd() * 4, a + Math.PI * 0.5 + (rnd() - 0.5) * 1.3,
          rgb(40 + t * 92, 80 + t * 90, 28 + t * 40), rgb(150 + t * 40, 185 + t * 30, 90));
      }
    } else if (kind === 'needle') {
      bleed = [40, 70, 44];
      ctx.fillStyle = rgb(26, 48, 30);
      ctx.beginPath(); ctx.arc(128, 128, 20, 0, Math.PI * 2); ctx.fill();
      for (let b = 0; b < 36; b++) {
        const a = rnd() * Math.PI * 2, L = 44 + rnd() * 66;
        const dx = Math.cos(a), dy = Math.sin(a);
        ctx.strokeStyle = rgb(70, 52, 34); ctx.lineWidth = 1.6;
        line(ctx, 128, 128, 128 + dx * L, 128 + dy * L);
        for (let s = 10; s < L; s += 3.2) {
          const t = s / L, nl = (10 + rnd() * 8) * (1 - t * 0.45);
          for (const side of [-1, 1]) {
            const na = a + side * (0.95 + rnd() * 0.3);
            ctx.strokeStyle = rgb(28 + t * 52, 58 + t * 62, 36 + t * 30); ctx.lineWidth = 1.3;
            line(ctx, 128 + dx * s, 128 + dy * s, 128 + dx * s + Math.cos(na) * nl, 128 + dy * s + Math.sin(na) * nl);
          }
        }
      }
    } else if (kind === 'frond') {
      bleed = [70, 110, 48];
      ctx.strokeStyle = rgb(120, 132, 70); ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(64, H - 2); ctx.quadraticCurveTo(66, H * 0.5, 64, 14); ctx.stroke();
      for (let i = 0; i < 48; i++) {
        const t = i / 47, y = H - 10 - t * (H - 30);
        const len = 52 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.04)), 0.7) + 4;
        for (const side of [-1, 1]) {
          const x1 = 64 + side * len, y1 = y - len * 0.5;
          ctx.fillStyle = rgb(44 + t * 40 + rnd() * 14, 90 + t * 50 + rnd() * 16, 32 + t * 20);
          ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(x1, y1); ctx.lineTo(x1 - side * 2, y1 + 3.4); ctx.lineTo(64, y + 4); ctx.closePath(); ctx.fill();
        }
      }
    } else if (kind === 'reed') {
      bleed = [100, 130, 60];
      for (let k = 0; k < 10; k++) {
        const x = 8 + k * 5.2 + rnd() * 3, h = 150 + rnd() * 100, lean = (rnd() - 0.5) * 14;
        ctx.fillStyle = rgb(86 + rnd() * 30, 118 + rnd() * 30, 52 + rnd() * 16);
        ctx.beginPath(); ctx.moveTo(x - 1.8, H); ctx.quadraticCurveTo(x + lean * 0.3, H - h * 0.5, x + lean, H - h); ctx.quadraticCurveTo(x + lean * 0.3 + 1, H - h * 0.5, x + 1.8, H); ctx.fill();
        if (k % 3 === 1) { ctx.fillStyle = rgb(92, 60, 34); ctx.beginPath(); ctx.ellipse(x + lean * 0.85, H - h * 0.85, 3.2, 12, 0, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    return dataTexFromCanvas(cv, bleed);
  }

  return { hash3, noise3, smooth, lerp, GLSL_NOISE, withCSM, wind, injectWind, toGeo, ensureColor, merge, paint, setUV, displace, fluff, shadeCanopy, darkenBase, card, dataTexFromCanvas, makeFoliageTex, rgb };
})();

// ════════════════════════════════════════════════════════════════════════════
// WORLD — Heightmap Pulau Rajawali, sungai, jalan, 16x16 LOD chunk, laut realistis
//   + terrain shader baru (breakup noise, pasir basah, kerikil jalan, bump mikro)
//   + tinggi permukaan interpolasi kubik (tanpa faceting) & relief mikro
//   + air berbasis kedalaman (shallow→deep, busa pantai, fresnel, riak)
// ════════════════════════════════════════════════════════════════════════════
const World = (() => {
  let currentSeed = CONFIG.seedDefault;
  const SIZE = CONFIG.world.size;
  const HALF = CONFIG.world.halfSize;
  const CHUNK = CONFIG.world.chunk;
  const GRID = CONFIG.world.chunksPerSide;
  const HM_RES = 257;
  const SEGS0 = 32;               // segmen LOD0 per chunk (LOD1/2 = subsample → tanpa popping normal)
  const SMOOTH_TERRAIN = true;    // false → kembali ke bilinear lama
  const MICRO_RELIEF = 1.1;       // amplitudo gundukan kecil (m). 0 = medan persis seperti sebelumnya
  const heightCache = new Float32Array(HM_RES * HM_RES);
  const roadDistCache = new Float32Array(HM_RES * HM_RES);
  const riverDistCache = new Float32Array(HM_RES * HM_RES);

  let group = null;
  let terrainChunks = [];
  const craters = [];
  const dirtyTerrainChunks = new Set();
  let terrainMat = null;
  let waterMesh = null;
  let poiMarkers = null;
  let depthTex = null;
  let todKey = 'siang';

  const RIVER_PTS = [
    [-580, -520], [-360, -280], [-220, -120], [-80, 40], [60, 140], [280, 180], [540, 20], [820, -60]
  ];

  const ROAD_SEGMENTS = [
    [[-440, 540], [-110, 280]],
    [[-110, 326], [-110, 280]],
    [[-110, 280], [100, 610]],
    [[-110, 280], [160, 90]],
    [[160, 90], [430, 420]],
    [[-420, 40], [-110, 280]],
    [[-420, 40], [-220, -120]],
    [[-220, -120], [-80, -20]],
    [[-80, -20], [160, 90]],
    [[-80, -20], [-20, -240]],
    [[-220, -120], [-430, -380]],
    [[-20, -240], [470, -380]],
    [[160, 90], [560, -20]],
    [[470, -380], [560, -20]]
  ];

  function computeRawElevation(x, z, seed) {
    const nx = x / HALF;
    const nz = z / HALF;
    const distort = Util.fbm2D(x * 0.0022, z * 0.0022, 3, 2.0, 0.5, seed + 5) * 0.18;
    const r = Math.hypot(nx, nz) + distort;
    const islandMask = 1.0 - Util.smoothstep(0.68, 0.99, r);
    const seaFloor = -14.0 * Util.smoothstep(0.78, 1.08, r);

    const macro = (Util.fbm2D(x * 0.0014, z * 0.0014, 5, 2.05, 0.52, seed + 13) * 0.5 + 0.5) * 44.0;
    const ridge = Util.ridged2D(x * 0.0022, z * 0.0022, 4, seed + 29) * 32.0;
    const detail = Util.fbm2D(x * 0.012, z * 0.012, 3, 2.0, 0.45, seed + 47) * 3.2;
    // Gundukan & cekungan skala 20–40 m: memecah kesan "permukaan plastik"
    const micro = MICRO_RELIEF > 0 ? Util.fbm2D(x * 0.034, z * 0.034, 3, 2.1, 0.5, seed + 71) * MICRO_RELIEF : 0;

    const peakDist = Math.hypot(x + 20, z + 240);
    const centralPeak = Math.exp(-(peakDist * peakDist) / (260 * 260)) * 52.0;

    let h = seaFloor + islandMask * (2.5 + macro + ridge * 0.65 + detail + micro * Util.smoothstep(0.1, 0.5, islandMask) + centralPeak);

    for (let i = 0; i < CONFIG.pois.length; i++) {
      const p = CONFIG.pois[i];
      const rad = p.id === 'kotamini' ? 165 : Math.max(p.w, p.h) * 0.48;
      const flatR = p.id === 'kotamini' ? 74 : rad * 0.45;
      const blendR = p.id === 'kotamini' ? 195 : rad * 1.4;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < blendR) {
        const w = 1.0 - Util.smoothstep(flatR, blendR, d);
        h = Util.lerp(h, p.targetH, w);
      }
    }

    const lake1 = Math.hypot(x - 240, z - -220);
    if (lake1 < 85) h = Util.lerp(h, -3.2, 1.0 - Util.smoothstep(25, 85, lake1));
    const lake2 = Math.hypot(x + 260, z - 280);
    if (lake2 < 65) h = Util.lerp(h, -2.6, 1.0 - Util.smoothstep(18, 65, lake2));

    let rMinSq = 1e9;
    for (let i = 0; i < RIVER_PTS.length - 1; i++) {
      const sq = Util.distToSegmentSq(x, z, RIVER_PTS[i][0], RIVER_PTS[i][1], RIVER_PTS[i + 1][0], RIVER_PTS[i + 1][1]);
      if (sq < rMinSq) rMinSq = sq;
    }
    const rDist = Math.sqrt(rMinSq);
    if (rDist < 28 && islandMask > 0.15) {
      const depthFactor = 1.0 - Util.smoothstep(4, 28, rDist);
      h = Util.lerp(h, -2.2, depthFactor);
    }

    return Util.clamp(h, -15, CONFIG.world.maxHeight);
  }

  function computeMinDistToRiver(x, z) {
    let minSq = 1e9;
    for (let i = 0; i < RIVER_PTS.length - 1; i++) {
      const sq = Util.distToSegmentSq(x, z, RIVER_PTS[i][0], RIVER_PTS[i][1], RIVER_PTS[i + 1][0], RIVER_PTS[i + 1][1]);
      if (sq < minSq) minSq = sq;
    }
    return Math.sqrt(minSq);
  }

  function computeMinDistToRoad(x, z) {
    let minSq = 1e9;
    for (let i = 0; i < ROAD_SEGMENTS.length; i++) {
      const s = ROAD_SEGMENTS[i];
      const sq = Util.distToSegmentSq(x, z, s[0][0], s[0][1], s[1][0], s[1][1]);
      if (sq < minSq) minSq = sq;
    }
    return Math.sqrt(minSq);
  }

  // Texture tinggi → GPU (half float) supaya shader air tahu kedalaman di setiap titik
  function buildDepthTexture() {
    if (!THREE.DataUtils || typeof THREE.DataUtils.toHalfFloat !== 'function') return null;
    const data = new Uint16Array(HM_RES * HM_RES);
    for (let i = 0; i < data.length; i++) data[i] = THREE.DataUtils.toHalfFloat(heightCache[i]);
    const t = new THREE.DataTexture(data, HM_RES, HM_RES, THREE.RedFormat, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  async function buildHeightCache(seed, onProgress) {
    currentSeed = seed;
    craters.length = 0;
    dirtyTerrainChunks.clear();
    for (let j = 0; j < HM_RES; j++) {
      const z = -HALF + (j / (HM_RES - 1)) * SIZE;
      for (let i = 0; i < HM_RES; i++) {
        const x = -HALF + (i / (HM_RES - 1)) * SIZE;
        const idx = j * HM_RES + i;
        heightCache[idx] = computeRawElevation(x, z, seed);
        roadDistCache[idx] = computeMinDistToRoad(x, z);
        riverDistCache[idx] = computeMinDistToRiver(x, z);
      }
      if ((j & 15) === 15 && onProgress) {
        onProgress(j / HM_RES);
        await Util.nextFrame();
      }
    }
    if (depthTex) depthTex.dispose();
    depthTex = buildDepthTexture();
  }

  function sampleCache(buf, x, z) {
    const u = Util.clamp((x + HALF) / SIZE, 0, 1) * (HM_RES - 1);
    const v = Util.clamp((z + HALF) / SIZE, 0, 1) * (HM_RES - 1);
    const x0 = Math.min(HM_RES - 2, Math.floor(u));
    const y0 = Math.min(HM_RES - 2, Math.floor(v));
    const tx = u - x0, ty = v - y0;
    const i00 = y0 * HM_RES + x0;
    const h0 = Util.lerp(buf[i00], buf[i00 + 1], tx);
    const h1 = Util.lerp(buf[i00 + HM_RES], buf[i00 + HM_RES + 1], tx);
    return Util.lerp(h0, h1, ty);
  }

  // Catmull-Rom bikubik (tanpa alokasi) — permukaan halus, tidak berfaset
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function sampleCubic(buf, x, z) {
    const u = Util.clamp((x + HALF) / SIZE, 0, 1) * (HM_RES - 1);
    const v = Util.clamp((z + HALF) / SIZE, 0, 1) * (HM_RES - 1);
    const x1 = Math.min(HM_RES - 2, Math.floor(u)), y1 = Math.min(HM_RES - 2, Math.floor(v));
    const tx = u - x1, ty = v - y1;
    const xa = Math.max(0, x1 - 1), xc = x1 + 1, xd = Math.min(HM_RES - 1, x1 + 2);
    const ya = Math.max(0, y1 - 1), yd = Math.min(HM_RES - 1, y1 + 2);
    const oa = ya * HM_RES, ob = y1 * HM_RES, oc = (y1 + 1) * HM_RES, od = yd * HM_RES;
    const ra = cr(buf[oa + xa], buf[oa + x1], buf[oa + xc], buf[oa + xd], tx);
    const rb = cr(buf[ob + xa], buf[ob + x1], buf[ob + xc], buf[ob + xd], tx);
    const rc = cr(buf[oc + xa], buf[oc + x1], buf[oc + xc], buf[oc + xd], tx);
    const rd = cr(buf[od + xa], buf[od + x1], buf[od + xc], buf[od + xd], tx);
    const h = cr(ra, rb, rc, rd, ty);
    return h < -15 ? -15 : (h > CONFIG.world.maxHeight ? CONFIG.world.maxHeight : h);
  }

  function getHeight(x, z) {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return -14.0;
    let h = SMOOTH_TERRAIN ? sampleCubic(heightCache, x, z) : sampleCache(heightCache, x, z);
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      const dx = x - c.x, dz = z - c.z;
      const d2 = dx * dx + dz * dz;
      const rMax = c.r * 1.4;
      if (d2 < rMax * rMax) {
        const d = Math.sqrt(d2);
        if (d < c.r) {
          const t = 1 - (d / c.r) * (d / c.r);
          h -= c.depth * t * t;
        }
        const rimT = (d - c.r * 0.94) / (c.r * 0.24);
        h += c.depth * 0.24 * Math.exp(-rimT * rimT);
      }
    }
    return h < -15 ? -15 : h;
  }

  function getNormal(x, z, out = new THREE.Vector3()) {
    const e = 1.5;
    const hL = getHeight(x - e, z);
    const hR = getHeight(x + e, z);
    const hD = getHeight(x, z - e);
    const hU = getHeight(x, z + e);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  // Cache jarak (bilinear) — jauh lebih murah untuk rumput/semak yang dipanggil ribuan kali
  const getRoadDistFast = (x, z) => sampleCache(roadDistCache, x, z);
  const getRiverDistFast = (x, z) => sampleCache(riverDistCache, x, z);

  // Normal khusus render (lebih lebar → shading halus, tidak mengubah normal gameplay)
  function renderNormal(x, z, e, out) {
    const hL = getHeight(x - e, z), hR = getHeight(x + e, z);
    const hD = getHeight(x, z - e), hU = getHeight(x, z + e);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  // Hitung data vertex SEKALI per chunk (LOD0); LOD1/2 hanya subsample → 3.6x lebih cepat & seam-free
  function computeChunkData(cx, cz) {
    const vc = SEGS0 + 1, step = CHUNK / SEGS0;
    const ox = -HALF + cx * CHUNK, oz = -HALF + cz * CHUNK;
    const n = vc * vc;
    const d = {
      vc,
      pos: new Float32Array(n * 3), norm: new Float32Array(n * 3), uv: new Float32Array(n * 2),
      splat: new Float32Array(n * 4), misc: new Float32Array(n * 4)
    };
    const nTmp = new THREE.Vector3();
    for (let j = 0; j < vc; j++) {
      for (let i = 0; i < vc; i++) {
        const wx = ox + i * step, wz = oz + j * step;
        const wy = getHeight(wx, wz);
        renderNormal(wx, wz, 2.2, nTmp);
        const idx = j * vc + i;
        d.pos[idx * 3] = wx; d.pos[idx * 3 + 1] = wy; d.pos[idx * 3 + 2] = wz;
        d.norm[idx * 3] = nTmp.x; d.norm[idx * 3 + 1] = nTmp.y; d.norm[idx * 3 + 2] = nTmp.z;
        d.uv[idx * 2] = wx * 0.08; d.uv[idx * 2 + 1] = wz * 0.08;

        const slope = 1.0 - nTmp.y;
        const roadD = sampleCache(roadDistCache, wx, wz);
        const riverD = sampleCache(riverDistCache, wx, wz);
        const isBeach = Util.smoothstep(4.0, -0.5, wy);
        const isRock = Util.smoothstep(0.18, 0.45, slope) + Util.smoothstep(52, 78, wy) * 0.45;
        const isRoad = 1.0 - Util.smoothstep(2.6, 5.4, roadD);
        let sSand = isBeach;
        let sRock = Util.clamp(isRock, 0, 1);
        let sDirt = Util.clamp(isRoad + Util.smoothstep(0.08, 0.22, slope) * 0.5, 0, 1);
        let sGrass = Math.max(0.05, 1.0 - Math.max(sSand, sRock, sDirt));
        let craterAO = 1.0;
        for (let ci = 0; ci < craters.length; ci++) {
          const c = craters[ci];
          const cdx = wx - c.x, cdz = wz - c.z;
          const cd2 = cdx * cdx + cdz * cdz;
          const crOuter = c.r * 1.38;
          if (cd2 < crOuter * crOuter) {
            const cd = Math.sqrt(cd2);
            const blend = Util.clamp(1.0 - (cd - c.r * 0.62) / (c.r * 0.76), 0, 1);
            sGrass *= (1.0 - blend);
            sSand *= (1.0 - blend);
            sDirt = Util.lerp(sDirt, 0.62, blend);
            sRock = Util.lerp(sRock, 0.38, blend);
            craterAO = Math.min(craterAO, Util.lerp(1.0, 0.28, blend));
          }
        }
        const invSum = 1.0 / (sSand + sGrass + sDirt + sRock + 1e-5);
        d.splat[idx * 4] = sSand * invSum;
        d.splat[idx * 4 + 1] = sGrass * invSum;
        d.splat[idx * 4 + 2] = sDirt * invSum;
        d.splat[idx * 4 + 3] = sRock * invSum;

        // misc: x=inti jalan, y=AO cekungan, z=kelembapan dekat sungai
        const cav = (sampleCache(heightCache, wx - 6, wz) + sampleCache(heightCache, wx + 6, wz) + sampleCache(heightCache, wx, wz - 6) + sampleCache(heightCache, wx, wz + 6)) * 0.25 - wy;
        d.misc[idx * 4] = 1.0 - Util.smoothstep(1.8, 4.8, roadD);
        d.misc[idx * 4 + 1] = Util.clamp(1.0 - cav * 0.12, 0.62, 1.06) * craterAO;
        d.misc[idx * 4 + 2] = 1.0 - Util.smoothstep(4, 55, riverD);
        d.misc[idx * 4 + 3] = 0;
      }
    }
    return d;
  }

  function buildGeoFromData(d, stride) {
    const segs = SEGS0 / stride, vo = segs + 1, vc = d.vc;
    const mainV = vo * vo, total = mainV + vo * 4;
    const out = {
      pos: new Float32Array(total * 3), norm: new Float32Array(total * 3), uv: new Float32Array(total * 2),
      splat: new Float32Array(total * 4), misc: new Float32Array(total * 4)
    };
    const copy = (dst, di, src, si, drop) => {
      dst.pos[di * 3] = src.pos[si * 3]; dst.pos[di * 3 + 1] = src.pos[si * 3 + 1] - drop; dst.pos[di * 3 + 2] = src.pos[si * 3 + 2];
      dst.norm[di * 3] = src.norm[si * 3]; dst.norm[di * 3 + 1] = src.norm[si * 3 + 1]; dst.norm[di * 3 + 2] = src.norm[si * 3 + 2];
      dst.uv[di * 2] = src.uv[si * 2]; dst.uv[di * 2 + 1] = src.uv[si * 2 + 1];
      for (let k = 0; k < 4; k++) { dst.splat[di * 4 + k] = src.splat[si * 4 + k]; dst.misc[di * 4 + k] = src.misc[si * 4 + k]; }
    };
    for (let j = 0; j < vo; j++) for (let i = 0; i < vo; i++) copy(out, j * vo + i, d, (j * stride) * vc + i * stride, 0);

    // Skirt 5 m menutup celah antar-LOD
    const skirtDrop = 5.0, sk = mainV;
    for (let k = 0; k < vo; k++) {
      copy(out, sk + k, out, k, skirtDrop);
      copy(out, sk + vo + k, out, segs * vo + k, skirtDrop);
      copy(out, sk + vo * 2 + k, out, k * vo, skirtDrop);
      copy(out, sk + vo * 3 + k, out, k * vo + segs, skirtDrop);
    }

    const indices = [];
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * vo + i, b = a + 1, c = a + vo, e = c + 1;
        indices.push(a, c, b, b, c, e);
      }
    }
    for (let k = 0; k < segs; k++) {
      const topA = k, topB = k + 1, skA = sk + k, skB = sk + k + 1;
      indices.push(topA, topB, skA, topB, skB, skA);
      const botA = segs * vo + k, botB = botA + 1, bSkA = sk + vo + k, bSkB = bSkA + 1;
      indices.push(botA, bSkA, botB, botB, bSkA, bSkB);
      const lA = k * vo, lB = (k + 1) * vo, lSkA = sk + vo * 2 + k, lSkB = lSkA + 1;
      indices.push(lA, lSkA, lB, lB, lSkA, lSkB);
      const rA = k * vo + segs, rB = (k + 1) * vo + segs, rSkA = sk + vo * 3 + k, rSkB = rSkA + 1;
      indices.push(rA, rB, rSkA, rB, rSkB, rSkA);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(out.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(out.norm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(out.uv, 2));
    geo.setAttribute('aSplat', new THREE.BufferAttribute(out.splat, 4));
    geo.setAttribute('aMisc', new THREE.BufferAttribute(out.misc, 4));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  function rebuildChunk(ch) {
    const data = computeChunkData(ch.userData.cx, ch.userData.cz);
    const strides = [1, 2, 4];
    for (let lv = 0; lv < ch.levels.length && lv < strides.length; lv++) {
      const mesh = ch.levels[lv].object;
      const oldGeo = mesh.geometry;
      mesh.geometry = buildGeoFromData(data, strides[lv]);
      if (oldGeo) oldGeo.dispose();
    }
  }

  function rebuildChunksInBox(minX, maxX, minZ, maxZ) {
    for (let i = 0; i < terrainChunks.length; i++) {
      const ch = terrainChunks[i];
      if (ch.userData.centerX + CHUNK * 0.5 >= minX && ch.userData.centerX - CHUNK * 0.5 <= maxX &&
          ch.userData.centerZ + CHUNK * 0.5 >= minZ && ch.userData.centerZ - CHUNK * 0.5 <= maxZ) {
        rebuildChunk(ch);
      }
    }
  }

  function stampRoadPath(x0, z0, x1, z1, halfWidth = 2.4) {
    const pad = halfWidth + 8;
    const minX = Math.min(x0, x1) - pad, maxX = Math.max(x0, x1) + pad;
    const minZ = Math.min(z0, z1) - pad, maxZ = Math.max(z0, z1) + pad;
    const iMin = Math.max(0, Math.floor(((minX + HALF) / SIZE) * (HM_RES - 1)));
    const iMax = Math.min(HM_RES - 1, Math.ceil(((maxX + HALF) / SIZE) * (HM_RES - 1)));
    const jMin = Math.max(0, Math.floor(((minZ + HALF) / SIZE) * (HM_RES - 1)));
    const jMax = Math.min(HM_RES - 1, Math.ceil(((maxZ + HALF) / SIZE) * (HM_RES - 1)));
    for (let j = jMin; j <= jMax; j++) {
      const wz = -HALF + (j / (HM_RES - 1)) * SIZE;
      for (let i = iMin; i <= iMax; i++) {
        const wx = -HALF + (i / (HM_RES - 1)) * SIZE;
        const d = Math.sqrt(Util.distToSegmentSq(wx, wz, x0, z0, x1, z1));
        const rIdx = j * HM_RES + i;
        roadDistCache[rIdx] = Math.min(roadDistCache[rIdx], Math.max(0, d - halfWidth * 0.35));
      }
    }
    for (let k = 0; k < terrainChunks.length; k++) {
      const ch = terrainChunks[k];
      if (ch.userData.centerX + CHUNK * 0.5 >= minX && ch.userData.centerX - CHUNK * 0.5 <= maxX &&
          ch.userData.centerZ + CHUNK * 0.5 >= minZ && ch.userData.centerZ - CHUNK * 0.5 <= maxZ) {
        dirtyTerrainChunks.add(k);
      }
    }
  }

  function flushDirtyTerrain() {
    if (!dirtyTerrainChunks.size) return;
    dirtyTerrainChunks.forEach((idx) => {
      if (terrainChunks[idx]) rebuildChunk(terrainChunks[idx]);
    });
    dirtyTerrainChunks.clear();
  }

  function carveTerrainCrater(x, z, radius = 5.4, depth = 2.65) {
    craters.push({ x, z, r: radius, depth });
    const rPad = radius * 1.65 + 2.5;
    rebuildChunksInBox(x - rPad, x + rPad, z - rPad, z + rPad);
    if (typeof WorldFlora !== 'undefined' && WorldFlora.refreshGrass) WorldFlora.refreshGrass();
  }

  function createTerrainMaterial() {
    const sandTex = Assets.get('sand').map;
    const grassTex = Assets.get('grass').map;
    const dirtTex = Assets.get('dirt').map;
    const rockTex = Assets.get('rock').map;

    const mat = new THREE.MeshStandardMaterial({ name: 'terrainSplat', roughness: 0.92, metalness: 0.02 });
    mat.userData.wetUniform = { value: 0.0 };
    mat.userData.splatBaseCompile = (shader) => {
      shader.uniforms.uTexSand = { value: sandTex };
      shader.uniforms.uTexGrass = { value: grassTex };
      shader.uniforms.uTexDirt = { value: dirtTex };
      shader.uniforms.uTexRock = { value: rockTex };
      shader.uniforms.uWetness = mat.userData.wetUniform;
      shader.uniforms.uSea = { value: CONFIG.world.seaLevel };

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aSplat;\nattribute vec4 aMisc;\nvarying vec4 vSplat;\nvarying vec4 vMisc;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = aSplat;\nvMisc = aMisc;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uTexSand;
          uniform sampler2D uTexGrass;
          uniform sampler2D uTexDirt;
          uniform sampler2D uTexRock;
          uniform float uWetness;
          uniform float uSea;
          varying vec4 vSplat;
          varying vec4 vMisc;
          varying vec3 vWPos;
          varying vec3 vWNorm;
          ${VK.GLSL_NOISE}
          vec3 sampleAntiTile(sampler2D tex, vec2 wp, float freqA, float freqB) {
            vec2 uvA = wp * freqA;
            vec2 uvB = vec2(wp.x * 0.866 - wp.y * 0.5, wp.x * 0.5 + wp.y * 0.866) * freqB;
            float w = 0.5 + 0.5 * sin(wp.x * 0.051 + cos(wp.y * 0.047));
            return mix(texture2D(tex, uvA).rgb, texture2D(tex, uvB).rgb, w * 0.65);
          }
          vec3 sampleTriplanarRock(vec3 p, vec3 n) {
            vec3 blend = pow(abs(n), vec3(4.0));
            blend /= (blend.x + blend.y + blend.z + 0.0001);
            vec3 cx = texture2D(uTexRock, p.zy * 0.09).rgb;
            vec3 cy = texture2D(uTexRock, p.xz * 0.09).rgb;
            vec3 cz = texture2D(uTexRock, p.xy * 0.09).rgb;
            return cx * blend.x + cy * blend.y + cz * blend.z;
          }
        `)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 vkP = vWPos;
          float vkNA = vkNoise(vkP.xz * 0.21);
          float vkNB = vkNoise(vkP.xz * 0.93 + 7.3);
          float vkNC = vkFbm(vkP.xz * 0.022 + 3.1);
          // transisi material dipecah noise → tepi pasir/rumput/batu tidak lagi "gradasi mulus"
          vec4 vkSp = vSplat;
          vkSp.r *= 0.78 + 0.44 * vkNB;
          vkSp.g *= 0.70 + 0.60 * vkNA;
          vkSp.b *= 0.80 + 0.40 * vkNB;
          vkSp.a *= 0.86 + 0.28 * vkNA;
          vkSp = pow(max(vkSp, vec4(0.0001)), vec4(1.55));
          vkSp /= (vkSp.r + vkSp.g + vkSp.b + vkSp.a);
          float vkRoad = clamp(vMisc.x, 0.0, 1.0);
          float vkWetShore = (1.0 - smoothstep(0.0, 1.15, vkP.y - uSea + (vkNB - 0.5) * 0.5)) * vkSp.r;

          vec3 cSand  = sampleAntiTile(uTexSand,  vkP.xz, 0.14, 0.053);
          vec3 cGrass = sampleAntiTile(uTexGrass, vkP.xz, 0.22, 0.059);
          vec3 cDirt  = sampleAntiTile(uTexDirt,  vkP.xz, 0.14, 0.061);
          vec3 cRock  = sampleTriplanarRock(vkP, vWNorm);

          float macroPatch = 0.90 + 0.16 * sin(vkP.x * 0.032 + 0.6) * cos(vkP.z * 0.029);
          float turf = 0.90 + 0.20 * vkNoise(vkP.xz * 3.3);
          float vkDry = clamp(vkNC * 1.5 - 0.35 - vMisc.z * 0.5 + smoothstep(22.0, 58.0, vkP.y) * 0.25, 0.0, 1.0);

          vec3 vkGrass = mix(cGrass, cDirt * vec3(0.88, 1.02, 0.72), 0.14 * (1.0 - macroPatch));
          vkGrass *= mix(vec3(0.86, 1.04, 0.80), vec3(1.14, 1.04, 0.70), vkDry * 0.75);
          cSand *= mix(1.0, 0.50, vkWetShore);
          vec3 vkRoadCol = mix(cDirt * vec3(0.95, 0.90, 0.84), cRock * 0.95, 0.30 * vkNB);
          vkRoadCol *= mix(1.04, 0.74, vkRoad * vkRoad);
          vec3 vkDirt = mix(cDirt, vkRoadCol, vkRoad);

          vec3 albedoMix = (cSand * vkSp.r + vkGrass * vkSp.g + vkDirt * vkSp.b + cRock * vkSp.a) * macroPatch * turf * mix(0.66, 1.04, vMisc.y);
          diffuseColor.rgb *= albedoMix * (1.0 - 0.28 * uWetness);
        `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor * (1.0 - 0.35 * uWetness) * (1.0 - 0.5 * vkWetShore), 0.12, 0.98);
        `)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            float vkE = 0.1;
            vec2 vkq = vWPos.xz;
            float vkH0 = vkNoise(vkq * 1.9) * 0.6 + vkNoise(vkq * 7.1) * 0.25 + vkNoise(vkq * 0.45) * 1.2;
            float vkHx = vkNoise((vkq + vec2(vkE, 0.0)) * 1.9) * 0.6 + vkNoise((vkq + vec2(vkE, 0.0)) * 7.1) * 0.25 + vkNoise((vkq + vec2(vkE, 0.0)) * 0.45) * 1.2;
            float vkHz = vkNoise((vkq + vec2(0.0, vkE)) * 1.9) * 0.6 + vkNoise((vkq + vec2(0.0, vkE)) * 7.1) * 0.25 + vkNoise((vkq + vec2(0.0, vkE)) * 0.45) * 1.2;
            vec2 vkG = vec2(vkHx - vkH0, vkHz - vkH0) / vkE;
            float vkStr = dot(vkSp, vec4(0.05, 0.09, 0.16, 0.30));
            vkStr *= 1.0 - smoothstep(50.0, 200.0, length(vViewPosition));
            vec3 vkN = normalize(normalize(vWNorm) + vec3(-vkG.x, 0.0, -vkG.y) * vkStr);
            normal = normalize((viewMatrix * vec4(vkN, 0.0)).xyz);
          }
        `);
    };
    mat.onBeforeCompile = mat.userData.splatBaseCompile;
    mat.customProgramCacheKey = () => 'terrainSplat_v2';
    return mat;
  }

  const TOD = {
    pagi: { sky: [0.80, 0.72, 0.66], amt: 0.38 },
    siang: { sky: [0.52, 0.72, 0.92], amt: 0.42 },
    sore: { sky: [0.96, 0.60, 0.38], amt: 0.46 },
    malam: { sky: [0.05, 0.08, 0.17], amt: 0.30 }
  };
  function applyTod() {
    if (!waterMesh) return;
    const t = TOD[todKey] || TOD.siang;
    const u = waterMesh.material.userData;
    u.uSkyCol.value.setRGB(t.sky[0], t.sky[1], t.sky[2]);
    u.uSkyAmt.value = t.amt;
  }
  function setTimeOfDay(key) { todKey = key; applyTod(); }

  function createWaterMesh() {
    const totalSize = SIZE + CONFIG.world.oceanBorder * 2;
    const geo = new THREE.PlaneGeometry(totalSize, totalSize, 96, 96);
    geo.rotateX(-Math.PI / 2);

    const dummyTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    dummyTex.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      name: 'oceanWater', color: 0xffffff, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 1.0
    });
    mat.userData.uTime = { value: 0 };
    mat.userData.uSkyCol = { value: new THREE.Color(0.52, 0.72, 0.92) };
    mat.userData.uSkyAmt = { value: 0.42 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = mat.userData.uTime;
      shader.uniforms.uSkyCol = mat.userData.uSkyCol;
      shader.uniforms.uSkyAmt = mat.userData.uSkyAmt;
      shader.uniforms.uHeightTex = { value: depthTex || dummyTex };
      shader.uniforms.uHasDepth = { value: depthTex ? 1.0 : 0.0 };
      shader.uniforms.uHalfW = { value: HALF };
      shader.uniforms.uSizeW = { value: SIZE };
      shader.uniforms.uRes = { value: HM_RES };
      shader.uniforms.uSea = { value: CONFIG.world.seaLevel };

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWaterWorld;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float w1 = sin(position.x * 0.07 + uTime * 1.6) * cos(position.z * 0.06 + uTime * 1.2) * 0.10;
          float w2 = sin((position.x + position.z) * 0.14 - uTime * 2.1) * 0.04;
          transformed.y += w1 + w2;
          vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `);

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          uniform sampler2D uHeightTex;
          uniform float uHasDepth;
          uniform float uHalfW;
          uniform float uSizeW;
          uniform float uRes;
          uniform float uSea;
          uniform vec3 uSkyCol;
          uniform float uSkyAmt;
          varying vec3 vWaterWorld;
          ${VK.GLSL_NOISE}
          vec2 vkWv(vec2 d, vec2 p, float f, float a, float s, float t) {
            return d * (cos(dot(d, p) * f + t * s) * f * a);
          }
          vec2 vkWaveGrad(vec2 p, float t) {
            vec2 g = vec2(0.0);
            g += vkWv(vec2(0.80, 0.60), p, 0.21, 0.35, 1.10, t);
            g += vkWv(vec2(-0.50, 0.87), p, 0.37, 0.22, 1.50, t);
            g += vkWv(vec2(0.95, -0.31), p, 0.71, 0.12, 2.10, t);
            g += vkWv(vec2(-0.20, -0.98), p, 1.30, 0.07, 2.90, t);
            vec2 q = p * 1.1 + vec2(t * 0.30, -t * 0.20);
            float n0 = vkNoise(q);
            g += vec2(vkNoise(q + vec2(0.1, 0.0)) - n0, vkNoise(q + vec2(0.0, 0.1)) - n0) * 0.5;
            return g;
          }
        `)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 vkHuv = ((vWaterWorld.xz + vec2(uHalfW)) / uSizeW * (uRes - 1.0) + 0.5) / uRes;
          float vkTerr = (uHasDepth > 0.5) ? texture2D(uHeightTex, vkHuv).r : (uSea - 6.0);
          float vkDepth = max(uSea - vkTerr, 0.0);
          vec3 vkWC = mix(vec3(0.34, 0.66, 0.60), vec3(0.05, 0.36, 0.46), smoothstep(0.0, 3.2, vkDepth));
          vkWC = mix(vkWC, vec3(0.012, 0.09, 0.19), smoothstep(2.5, 15.0, vkDepth));
          float vkFn = vkFbm(vWaterWorld.xz * 0.7 + vec2(uTime * 0.12, -uTime * 0.09));
          float vkShoreD = vkDepth + (vkFn - 0.5) * 0.45 + 0.09 * sin(uTime * 1.25 + vWaterWorld.x * 0.45 + vWaterWorld.z * 0.38);
          float vkFoam = clamp((1.0 - smoothstep(0.04, 0.5, vkShoreD)) * (0.45 + vkFn), 0.0, 1.0);
          vkFoam = max(vkFoam, smoothstep(0.72, 0.95, vkFn) * smoothstep(1.5, 6.0, vkDepth) * 0.25);
          diffuseColor.rgb = mix(vkWC, vec3(0.90, 0.95, 0.96), vkFoam);
          diffuseColor.a = clamp(mix(0.30, 0.96, 1.0 - exp(-vkDepth * 0.85)) + vkFoam * 0.5, 0.0, 1.0);
        `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(0.09, 0.55, vkFoam);
        `)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec2 vkG = vkWaveGrad(vWaterWorld.xz, uTime) * (1.0 - 0.55 * vkFoam);
            vec3 vkNw = normalize(vec3(-vkG.x, 1.0, -vkG.y));
            normal = normalize((viewMatrix * vec4(vkNw, 0.0)).xyz);
          }
        `)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            float vkF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 4.0);
            totalEmissiveRadiance += uSkyCol * uSkyAmt * (0.05 + 0.95 * vkF) * (1.0 - vkFoam);
          }
        `);
    };
    mat.customProgramCacheKey = () => 'oceanWater_v2';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = CONFIG.world.seaLevel;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    return mesh;
  }

  function createPoiLandmarks() {
    const g = new THREE.Group();
    g.name = 'PoiBeaconsAndSilhouettes';
    const rustMat = Assets.get('rust');

    const stackH = getHeight(-420, 40);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 26, 12), Assets.get('brick'));
    stack.position.set(-420, stackH + 13, 40);
    stack.castShadow = true; stack.receiveShadow = true;
    g.add(stack);

    const mH = getHeight(-20, -240);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 2.2, 42, 4), rustMat);
    mast.position.set(-20, mH + 21, -240);
    mast.castShadow = true;
    g.add(mast);

    const airH = getHeight(430, 420);
    const runway = new THREE.Mesh(new THREE.BoxGeometry(240, 0.25, 22), Assets.get('asphalt'));
    runway.position.set(430, airH + 0.12, 420);
    runway.receiveShadow = true;
    g.add(runway);
    return g;
  }

  async function buildWorld(scene, seed, csmInstance, onStage) {
    dispose(scene);
    Physics.clear();
    group = new THREE.Group();
    group.name = 'PulauRajawaliWorld';

    if (onStage) onStage('Menghitung heightmap & sungai Pulau Rajawali...', 30);
    await buildHeightCache(seed, (p) => {
      if (onStage) onStage('Menghitung heightmap & sungai Pulau Rajawali...', 30 + p * 24);
    });

    if (onStage) onStage('Membuat mesh 256 chunk terrain (4 LOD + skirt)...', 55);
    terrainMat = createTerrainMaterial();
    if (csmInstance) {
      const baseCompile = terrainMat.onBeforeCompile;
      csmInstance.setupMaterial(terrainMat);
      const csmCompile = terrainMat.onBeforeCompile;
      terrainMat.onBeforeCompile = (shader, renderer) => {
        if (baseCompile) baseCompile(shader, renderer);
        if (csmCompile) csmCompile(shader, renderer);
      };
    }

    terrainChunks = [];
    for (let cz = 0; cz < GRID; cz++) {
      for (let cx = 0; cx < GRID; cx++) {
        const lod = new THREE.LOD();
        lod.userData = { cx, cz, centerX: -HALF + (cx + 0.5) * CHUNK, centerZ: -HALF + (cz + 0.5) * CHUNK };
        const data = computeChunkData(cx, cz);
        const m0 = new THREE.Mesh(buildGeoFromData(data, 1), terrainMat);
        const m1 = new THREE.Mesh(buildGeoFromData(data, 2), terrainMat);
        const m2 = new THREE.Mesh(buildGeoFromData(data, 4), terrainMat);
        m0.receiveShadow = m1.receiveShadow = m2.receiveShadow = true;
        lod.addLevel(m0, 0);
        lod.addLevel(m1, 220);
        lod.addLevel(m2, 520);
        group.add(lod);
        terrainChunks.push(lod);
      }
      if ((cz & 3) === 3) {
        if (onStage) onStage(`Membuat chunk terrain (${cz + 1}/${GRID})...`, 55 + ((cz + 1) / GRID) * 20);
        await Util.nextFrame();
      }
    }

    if (onStage) onStage('Menempatkan lautan, 5 jembatan, dan 12 POI bangunan...', 78);
    waterMesh = createWaterMesh();
    applyTod();
    group.add(waterMesh);
    poiMarkers = createPoiLandmarks();
    group.add(poiMarkers);
    scene.add(group);

    if (typeof WorldBuildings !== 'undefined') {
      await WorldBuildings.build(scene, seed, csmInstance);
    }
    if (onStage) onStage('Menanam 5 spesies flora tropis, buluh, bebatuan & kendaraan...', 86);
    if (typeof WorldFlora !== 'undefined') {
      await WorldFlora.build(scene, seed, csmInstance, UI.settings.grassDist);
    }
    if (onStage) onStage('Menambah detail bangunan, pelapukan & properti...', 90);
    if (typeof WorldDetail !== 'undefined') {
      await WorldDetail.build(scene, seed, csmInstance);
    }
    if (onStage) onStage('Membangun NavGrid A* & menebar item taktis...', 92);
    if (typeof NavGrid !== 'undefined') {
      NavGrid.build();
    }
    if (typeof Loot !== 'undefined' && typeof WorldBuildings !== 'undefined') {
      Loot.spawnWorldLoot(scene, WorldBuildings.lootPads, seed);
    }
    if (onStage) onStage('Membuat peta topografi taktis 2D...', 97);
    if (typeof MapUI !== 'undefined') {
      MapUI.bakeBaseMap(seed);
    }
  }

  function update(elapsedTime, camera, weatherState, dt = 0.016, playerPos = null) {
    if (waterMesh && waterMesh.material.userData.uTime) {
      waterMesh.material.userData.uTime.value = elapsedTime;
    }
    if (terrainMat && terrainMat.userData.wetUniform) {
      terrainMat.userData.wetUniform.value = weatherState?.wet || 0;
    }
    if (camera) {
      for (let i = 0; i < terrainChunks.length; i++) {
        terrainChunks[i].update(camera);
      }
    }
    if (typeof WorldBuildings !== 'undefined') WorldBuildings.update(dt, elapsedTime);
    if (typeof WorldFlora !== 'undefined') WorldFlora.update(elapsedTime, playerPos || camera?.position, weatherState, UI.settings.grassDist);
    if (typeof Loot !== 'undefined' && playerPos) Loot.updateVisuals(playerPos);
  }

  function dispose(scene) {
    if (typeof WorldDetail !== 'undefined') WorldDetail.dispose(scene);
    if (typeof WorldBuildings !== 'undefined') WorldBuildings.dispose(scene);
    if (typeof WorldFlora !== 'undefined') WorldFlora.dispose(scene);
    if (typeof Loot !== 'undefined') Loot.dispose(scene);
    if (!group) return;
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    if (terrainMat) { terrainMat.dispose(); terrainMat = null; }
    if (waterMesh) { waterMesh.material.dispose(); waterMesh = null; }
    if (depthTex) { depthTex.dispose(); depthTex = null; }
    scene.remove(group);
    terrainChunks = [];
    craters.length = 0;
    dirtyTerrainChunks.clear();
    group = null;
  }

  function isShootRangeCorridor(x, z) {
    return x >= -138 && x <= -82 && z >= -45 && z <= 335;
  }

  function isUrbanPlaza(x, z) {
    return x >= 84 && x <= 236 && z >= 12 && z <= 148;
  }

  function getClosestPoiName(x, z) {
    let best = 'Pulau Rajawali', bestD = 260;
    for (let i = 0; i < CONFIG.pois.length; i++) {
      const p = CONFIG.pois[i];
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bestD) { bestD = d; best = p.name; }
    }
    return best;
  }

  return {
    buildWorld, update, dispose, getHeight, getNormal, getClosestPoiName,
    getRiverDist: computeMinDistToRiver,
    getRoadDist: computeMinDistToRoad,
    getRiverDistFast, getRoadDistFast,
    setTimeOfDay,
    isShootRangeCorridor,
    isUrbanPlaza,
    carveTerrainCrater,
    stampRoadPath,
    flushDirtyTerrain,
    RIVER_PTS,
    ROAD_SEGMENTS,
    get craters() { return craters; },
    get chunks() { return terrainChunks.length; },
    get seed() { return currentSeed; }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// WORLDBUILDINGS — 6 Walkable Modular Archetypes, 12 POIs, 5 Bridges, Doors & Glass
// ════════════════════════════════════════════════════════════════════════════
const WorldBuildings = (() => {
  let rootGroup = null;
  let radarMesh = null;
  let beaconMesh = null;
  const footprints = [];
  const lootPads = [];
  const doors = [];
  const glassPanes = [];
  const bridges = [];
  let buckets = new Map();
  let sharedDoorGeo = null;
  let sharedGlassGeo = null;

  function makeBoxRaw(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const raw = new THREE.BoxGeometry(w, h, d);
    const g = raw.toNonIndexed();
    raw.dispose();
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return g;
  }

  function makeGablePrismRaw(spanW, peakH, thick, x, y, z, ry = 0) {
    const hw = spanW * 0.5, hd = thick * 0.5;
    const verts = new Float32Array([
      // Front face (+Z)
      -hw, 0, hd,   hw, 0, hd,   0, peakH, hd,
      // Back face (-Z)
      hw, 0, -hd,  -hw, 0, -hd,  0, peakH, -hd,
      // Bottom
      -hw, 0, -hd,  hw, 0, -hd,  hw, 0, hd,
      -hw, 0, -hd,  hw, 0, hd,  -hw, 0, hd,
      // Left slope
      -hw, 0, -hd, -hw, 0, hd,   0, peakH, hd,
      -hw, 0, -hd,  0, peakH, hd, 0, peakH, -hd,
      // Right slope
       hw, 0, hd,   hw, 0, -hd,  0, peakH, -hd,
       hw, 0, hd,   0, peakH, -hd, 0, peakH, hd
    ]);
    const uvs = new Float32Array((verts.length / 3) * 2);
    for (let i = 0, vi = 0; i < verts.length; i += 3, vi += 2) {
      uvs[vi] = (verts[i] + hw) * 0.25;
      uvs[vi + 1] = verts[i + 1] * 0.25;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)));
    return g;
  }

  function makeCylRaw(rt, rb, h, segs, x, y, z, rx = 0, ry = 0, rz = 0) {
    const raw = new THREE.CylinderGeometry(rt, rb, h, segs);
    const g = raw.toNonIndexed();
    raw.dispose();
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return g;
  }

  function pushGeo(x, z, matKey, g) {
    const cx = Math.floor((x + 800) / 200);
    const cz = Math.floor((z + 800) / 200);
    const key = `${cx},${cz}|${matKey}`;
    let arr = buckets.get(key);
    if (!arr) { arr = []; buckets.set(key, arr); }
    arr.push(g);
  }

  // Axis-aligned rotated helper for 90-deg snapped modular buildings
  function addBuildingPart(bx, by, bz, rotIdx, lx, ly, lz, w, h, d, matKey, opts = {}) {
    const ang = rotIdx * Math.PI * 0.5;
    const c = Math.round(Math.cos(ang));
    const s = Math.round(Math.sin(ang));
    const wx = bx + lx * c + lz * s;
    const wz = bz - lx * s + lz * c;
    const wy = by + ly;
    const swap = (rotIdx & 1) === 1;
    const ww = swap ? d : w;
    const dd = swap ? w : d;

    const pitch = opts.pitch || 0;
    const roll = opts.roll || 0;
    const g = makeBoxRaw(w, h, d, wx, wy, wz, pitch, ang, roll);
    pushGeo(wx, wz, matKey, g);

    if (!opts.noCol) {
      Physics.addCollider({
        minX: wx - ww * 0.5, maxX: wx + ww * 0.5,
        minY: wy - h * 0.5, maxY: wy + h * 0.5,
        minZ: wz - dd * 0.5, maxZ: wz + dd * 0.5,
        mat: opts.colMat || matKey,
        penetrable: !!opts.penetrable,
        tag: opts.tag || 'world'
      });
    }
  }

  function addDoor(bx, by, bz, rotIdx, lx, lz, localYaw = 0, tag = 'door') {
    const ang = rotIdx * Math.PI * 0.5;
    const c = Math.round(Math.cos(ang));
    const s = Math.round(Math.sin(ang));
    const wx = bx + lx * c + lz * s;
    const wz = bz - lx * s + lz * c;
    const totalYaw = ang + localYaw;

    // Hinge sits at -0.65 along door's local X
    const hc = Math.cos(totalYaw), hs = Math.sin(totalYaw);
    const hx = wx - 0.65 * hc;
    const hz = wz + 0.65 * hs;

    const pivot = new THREE.Group();
    pivot.position.set(hx, by + 1.14, hz);
    pivot.rotation.y = totalYaw;
    const leaf = new THREE.Mesh(sharedDoorGeo, Assets.get('wood'));
    leaf.castShadow = true; leaf.receiveShadow = true;
    pivot.add(leaf);
    rootGroup.add(pivot);

    const swap = (Math.round(totalYaw / (Math.PI * 0.5)) & 1) !== 0;
    const hw = swap ? 0.08 : 0.66;
    const hd = swap ? 0.66 : 0.08;
    const col = Physics.addCollider({
      minX: wx - hw, maxX: wx + hw,
      minY: by, maxY: by + 2.32,
      minZ: wz - hd, maxZ: wz + hd,
      mat: 'wood', penetrable: true, tag
    });

    const doorObj = {
      pivot, cx: wx, cy: by + 1.14, cz: wz,
      baseYaw: totalYaw, isOpen: false, animT: 0,
      collider: col,
      toggle(byActor = true) {
        this.isOpen = !this.isOpen;
        this.collider.disabled = this.isOpen;
        if (byActor) AudioSys.playMechanical('reload_mag');
      }
    };
    col.doorRef = doorObj;
    doors.push(doorObj);
  }

  function addWindowPane(bx, by, bz, rotIdx, lx, ly, lz, w, h, localYaw = 0) {
    const ang = rotIdx * Math.PI * 0.5;
    const c = Math.round(Math.cos(ang));
    const s = Math.round(Math.sin(ang));
    const wx = bx + lx * c + lz * s;
    const wz = bz - lx * s + lz * c;
    const wy = by + ly;
    const totalYaw = ang + localYaw;

    const mesh = new THREE.Mesh(sharedGlassGeo, Assets.get('glass'));
    mesh.position.set(wx, wy, wz);
    mesh.rotation.y = totalYaw;
    mesh.scale.set(w / 1.4, h / 1.1, 1);
    rootGroup.add(mesh);

    const swap = (Math.round(totalYaw / (Math.PI * 0.5)) & 1) !== 0;
    const hw = swap ? 0.06 : w * 0.5;
    const hd = swap ? w * 0.5 : 0.06;
    const col = Physics.addCollider({
      minX: wx - hw, maxX: wx + hw,
      minY: wy - h * 0.5, maxY: wy + h * 0.5,
      minZ: wz - hd, maxZ: wz + hd,
      mat: 'glass', penetrable: true, tag: 'window'
    });
    const ref = {
      shattered: false, mesh, collider: col, x: wx, y: wy, z: wz,
      shatter() {
        if (this.shattered) return;
        this.shattered = true;
        mesh.visible = false;
        col.disabled = true;
        AudioSys.playImpact('glass', mesh.position);
        for (let k = 0; k < 8; k++) {
          Ballistics.spawnParticle(
            mesh.position,
            new THREE.Vector3((Math.random() - 0.5) * 5, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 5),
            0xBEE8FF, 0.9, 0.45, 11
          );
        }
      }
    };
    col.glassRef = ref;
    glassPanes.push(ref);
  }

  function addPad(bx, by, bz, rotIdx, lx, ly, lz, tier, poiId, bId) {
    const ang = rotIdx * Math.PI * 0.5;
    const c = Math.round(Math.cos(ang));
    const s = Math.round(Math.sin(ang));
    lootPads.push({
      x: bx + lx * c + lz * s,
      y: by + ly,
      z: bz - lx * s + lz * c,
      tier, poiId, bId
    });
  }

  function addWallWithWindow(bx, by, bz, rotIdx, xMid, yBot, zPos, wallLen, wallH, thick, mat, isZWall = false) {
    // 1.5m centered window opening with darkWood frame (kusen), cross mullions, sill & rain awning (tritisan)
    const winW = Math.min(1.5, wallLen * 0.45);
    const sideW = (wallLen - winW) * 0.5;
    if (!isZWall) {
      if (sideW > 0.1) {
        addBuildingPart(bx, by, bz, rotIdx, xMid - (winW + sideW) * 0.5, yBot + wallH * 0.5, zPos, sideW, wallH, thick, mat);
        addBuildingPart(bx, by, bz, rotIdx, xMid + (winW + sideW) * 0.5, yBot + wallH * 0.5, zPos, sideW, wallH, thick, mat);
      }
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 0.48, zPos, winW, 0.96, thick, mat);
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 2.65, zPos, winW, Math.max(0.3, wallH - 2.15), thick, mat);
      // Kusen & sill & center mullion
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 0.97, zPos, winW + 0.16, 0.08, thick + 0.14, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 2.13, zPos, winW + 0.16, 0.08, thick + 0.10, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid - winW * 0.5 + 0.03, yBot + 1.55, zPos, 0.07, 1.15, thick + 0.06, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid + winW * 0.5 - 0.03, yBot + 1.55, zPos, 0.07, 1.15, thick + 0.06, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 1.55, zPos, 0.04, 1.12, 0.06, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 1.58, zPos, winW - 0.04, 0.04, 0.06, 'darkWood', { noCol: true });
      addWindowPane(bx, by, bz, rotIdx, xMid, yBot + 1.55, zPos, winW, 1.15, 0);
    } else {
      if (sideW > 0.1) {
        addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + wallH * 0.5, zPos - (winW + sideW) * 0.5, thick, wallH, sideW, mat);
        addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + wallH * 0.5, zPos + (winW + sideW) * 0.5, thick, wallH, sideW, mat);
      }
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 0.48, zPos, thick, 0.96, winW, mat);
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 2.65, zPos, thick, Math.max(0.3, wallH - 2.15), winW, mat);
      // Kusen & sill & center mullion
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 0.97, zPos, thick + 0.14, 0.08, winW + 0.16, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 2.13, zPos, thick + 0.10, 0.08, winW + 0.16, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 1.55, zPos - winW * 0.5 + 0.03, thick + 0.06, 1.15, 0.07, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 1.55, zPos + winW * 0.5 - 0.03, thick + 0.06, 1.15, 0.07, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 1.55, zPos, 0.06, 1.12, 0.04, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + 1.58, zPos, 0.06, 0.04, winW - 0.04, 'darkWood', { noCol: true });
      addWindowPane(bx, by, bz, rotIdx, xMid, yBot + 1.55, zPos, winW, 1.15, Math.PI * 0.5);
    }
  }

  function addWallWithDoor(bx, by, bz, rotIdx, xMid, yBot, zPos, wallLen, wallH, thick, mat, isZWall = false, withLeaf = true) {
    const dw = 1.4, dh = 2.32;
    const sideW = (wallLen - dw) * 0.5;
    if (!isZWall) {
      if (sideW > 0.1) {
        addBuildingPart(bx, by, bz, rotIdx, xMid - (dw + sideW) * 0.5, yBot + wallH * 0.5, zPos, sideW, wallH, thick, mat);
        addBuildingPart(bx, by, bz, rotIdx, xMid + (dw + sideW) * 0.5, yBot + wallH * 0.5, zPos, sideW, wallH, thick, mat);
      }
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + dh + (wallH - dh) * 0.5, zPos, dw, wallH - dh, thick, mat);
      addBuildingPart(bx, by, bz, rotIdx, xMid - dw * 0.5 - 0.03, yBot + dh * 0.5, zPos, 0.08, dh, thick + 0.08, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid + dw * 0.5 + 0.03, yBot + dh * 0.5, zPos, 0.08, dh, thick + 0.08, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + dh + 0.03, zPos, dw + 0.14, 0.08, thick + 0.08, 'darkWood', { noCol: true });
      if (withLeaf) addDoor(bx, by + yBot, bz, rotIdx, xMid, zPos, 0);
    } else {
      if (sideW > 0.1) {
        addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + wallH * 0.5, zPos - (dw + sideW) * 0.5, thick, wallH, sideW, mat);
        addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + wallH * 0.5, zPos + (dw + sideW) * 0.5, thick, wallH, sideW, mat);
      }
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + dh + (wallH - dh) * 0.5, zPos, thick, wallH - dh, dw, mat);
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + dh * 0.5, zPos - dw * 0.5 - 0.03, thick + 0.08, dh, 0.08, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + dh * 0.5, zPos + dw * 0.5 + 0.03, thick + 0.08, dh, 0.08, 'darkWood', { noCol: true });
      addBuildingPart(bx, by, bz, rotIdx, xMid, yBot + dh + 0.03, zPos, thick + 0.08, 0.08, dw + 0.14, 'darkWood', { noCol: true });
      if (withLeaf) addDoor(bx, by + yBot, bz, rotIdx, xMid, zPos, Math.PI * 0.5);
    }
  }

  function addGableWall(bx, by, bz, rotIdx, lx, ly, lz, spanW, peakH, thick, matKey) {
    const ang = rotIdx * Math.PI * 0.5;
    const c = Math.round(Math.cos(ang)), s = Math.round(Math.sin(ang));
    const wx = bx + lx * c + lz * s;
    const wz = bz - lx * s + lz * c;
    pushGeo(wx, wz, matKey, makeGablePrismRaw(spanW, peakH, thick, wx, by + ly, wz, ang));
  }

  function addStaircase(bx, by, bz, rotIdx, sx, yStart, zStart, zEnd, width, riseTotal, steps = 12) {
    const runTotal = zEnd - zStart;
    const stepD = Math.abs(runTotal) / steps;
    const stepH = riseTotal / steps;
    const dirZ = Math.sign(runTotal);
    for (let i = 0; i < steps; i++) {
      const sz = zStart + dirZ * (i + 0.5) * stepD;
      const sh = stepH * (i + 1);
      addBuildingPart(bx, by, bz, rotIdx, sx, yStart + sh * 0.5, sz, width, sh, stepD + 0.04, 'concrete');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DETAIL FASAD REALISTIS — lis plint, sudut berundak (quoin), kusen+ambang+daun jendela,
  // talang & pipa air hujan, meteran listrik, lampu dinding, unit AC, papan toko, parapet,
  // cerobong pabrik & skylight. Semua bagian tanpa collider (tidak mengubah gameplay/NavGrid).
  // ════════════════════════════════════════════════════════════════════════════
  const DECO = { noCol: true };
  function decorateBuilding(arch, bx, baseY, bz, rotIdx, w, d, wallH) {
    if (arch !== 'house1f' && arch !== 'house2f' && arch !== 'ruko2f' && arch !== 'factory') return;
    const P = (lx, ly, lz, pw, ph, pd, mat, o) => addBuildingPart(bx, baseY, bz, rotIdx, lx, ly, lz, pw, ph, pd, mat, o || DECO);
    const rr = Math.abs((Math.sin(bx * 12.9898 + bz * 78.233) * 43758.5453) % 1);
    const y2 = 3.45;
    const twoStory = arch === 'house2f' || arch === 'ruko2f';
    const H = arch === 'factory' ? 5.4 : (twoStory ? y2 + wallH : wallH);

    // Jendela terbuka (untuk jendela dinding samping/belakang yang sudah dilubangi)
    const dressWindow = (lx, lz, isZ, yBot, out) => {
      const part = (u, v, y, du, dy, dv, mat) => isZ
        ? P(lx + out * v, yBot + y, lz + u, dv, dy, du, mat)
        : P(lx + u, yBot + y, lz + out * v, du, dy, dv, mat);
      part(0, 0.18, 0.93, 1.80, 0.08, 0.36, 'concrete');
      part(0, 0.16, 2.21, 1.84, 0.12, 0.30, 'concrete');
      for (const sU of [-1, 1]) {
        part(sU * 1.13, 0.15, 1.55, 0.68, 1.20, 0.05, 'darkWood');
        for (let k = 0; k < 4; k++) part(sU * 1.13, 0.18, 1.08 + k * 0.30, 0.62, 0.035, 0.025, 'wood');
      }
    };

    // Jendela fasad depan lengkap (kusen kayu, kaca reflektif, teralis silang, ambang beton & daun jendela krepyak)
    const addFacadeWindow = (lx, yBot, lz, winW = 1.28, winH = 1.18, out = 1) => {
      const yc = yBot + 1.56;
      P(lx, yc, lz + out * 0.115, winW, winH, 0.04, 'glass');
      P(lx, yc - winH * 0.5 - 0.04, lz + out * 0.17, winW + 0.28, 0.08, 0.28, 'limestone'); // ambang bawah
      P(lx, yc + winH * 0.5 + 0.06, lz + out * 0.16, winW + 0.32, 0.11, 0.26, 'concrete');  // topi/lintel atas
      P(lx - winW * 0.5 - 0.04, yc, lz + out * 0.13, 0.08, winH + 0.08, 0.10, 'darkWood');
      P(lx + winW * 0.5 + 0.04, yc, lz + out * 0.13, 0.08, winH + 0.08, 0.10, 'darkWood');
      P(lx, yc, lz + out * 0.135, 0.05, winH, 0.06, 'darkWood');                            // tiang tengah kusen
      P(lx, yc + 0.04, lz + out * 0.135, winW, 0.045, 0.06, 'darkWood');                    // palang kusen
      const shW = Math.min(0.48, winW * 0.38);
      for (const sU of [-1, 1]) {
        const sx = lx + sU * (winW * 0.5 + shW * 0.5 + 0.06);
        P(sx, yc, lz + out * 0.13, shW, winH, 0.045, 'darkWood');
        for (let k = 0; k < 4; k++) {
          P(sx, yc - winH * 0.36 + k * (winH * 0.24), lz + out * 0.155, shW - 0.06, 0.035, 0.025, 'wood');
        }
      }
    };

    // Pagar teras & balkon berjeruji (terlihat tembus pandang, jauh lebih nyata dari tembok kotak padat)
    const addBalustradeSpan = (x0, x1, yBot, lz, railH = 0.88, postMat = 'limestone', barMat = 'darkWood') => {
      const span = Math.abs(x1 - x0);
      if (span < 0.25) return;
      const xc = (x0 + x1) * 0.5;
      P(xc, yBot + railH, lz, span, 0.075, 0.11, barMat);
      P(xc, yBot + 0.14, lz, span, 0.06, 0.09, barMat);
      const nBars = Math.max(2, Math.floor(span / 0.28));
      for (let i = 1; i < nBars; i++) {
        const bxBar = x0 + (i / nBars) * (x1 - x0);
        P(bxBar, yBot + railH * 0.52, lz, 0.042, railH - 0.14, 0.042, barMat);
      }
      P(x0, yBot + railH * 0.52, lz, 0.18, railH + 0.08, 0.18, postMat);
      P(x1, yBot + railH * 0.52, lz, 0.18, railH + 0.08, 0.18, postMat);
    };

    if (arch === 'factory') {
      const fH = 5.4;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(sx * (w / 2), fH / 2, sz * (d / 2), 0.56, fH + 0.1, 0.56, 'concrete');
      for (const sx of [-1, 1]) P(sx * (w / 2 + 0.03), 0.3, 0, 0.36, 0.6, d + 0.4, 'concrete');
      for (const sx of [-1, 1]) P(sx * (w / 2 + 0.03), fH - 0.35, 0, 0.36, 0.30, d + 0.4, 'concrete');
      P(0, fH + 0.65 + Math.sin(0.18) * w * 0.275 + 0.12, 0, 0.7, 0.4, d + 0.9, 'rust');
      for (const s of [-1, 1]) for (const k of [-1, 1]) {
        P(s * w * 0.26, fH + 0.76, k * d * 0.22, w * 0.34, 0.04, d * 0.22, 'glass', { noCol: true, roll: -s * 0.18 });
      }
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
        P(sx * 2.75, 3.7, sz * (d / 2 + 0.2), 0.26, 0.18, 0.16, 'warmGlow');
        P(sx * 2.75, 3.83, sz * (d / 2 + 0.14), 0.08, 0.06, 0.14, 'gunmetal');
      }
      P(-(w / 2 + 1.7), 3.5, d / 2 - 1.6, 1.7, 7.0, 1.7, 'brick', {});
      P(-(w / 2 + 1.7), 10.5, d / 2 - 1.6, 1.25, 7.0, 1.25, 'brick');
      P(-(w / 2 + 1.7), 14.2, d / 2 - 1.6, 1.55, 0.35, 1.55, 'concrete');
      P(-(w / 2 + 1.7), 12.9, d / 2 - 1.6, 1.30, 0.7, 1.30, 'containerRed');
      P(-(w / 2 + 1.7), 11.3, d / 2 - 1.6, 1.30, 0.7, 1.30, 'containerRed');
      return;
    }

    // Lis plint batu kapur/beton keliling dasar dinding
    for (const sx of [-1, 1]) P(sx * (w / 2 + 0.03), 0.28, 0, 0.30, 0.56, d + 0.34, 'concrete');
    const skirtFace = (zs, gapC, gapW) => {
      const zz = zs * (d / 2 + 0.03);
      if (gapC === null) { P(0, 0.28, zz, w + 0.34, 0.56, 0.30, 'concrete'); return; }
      const a0 = -w / 2 - 0.17, a1 = gapC - gapW / 2, b0 = gapC + gapW / 2, b1 = w / 2 + 0.17;
      if (a1 - a0 > 0.2) P((a0 + a1) / 2, 0.28, zz, a1 - a0, 0.56, 0.30, 'concrete');
      if (b1 - b0 > 0.2) P((b0 + b1) / 2, 0.28, zz, b1 - b0, 0.56, 0.30, 'concrete');
    };

    // Sudut berundak (quoin) batu alam
    const nQ = Math.max(1, Math.floor((H - 0.5) / 0.46));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (let k = 0; k < nQ; k++) {
        const longX = (k % 2) === 0;
        P(sx * (w / 2 - 0.05), 0.73 + k * 0.46, sz * (d / 2 - 0.05), longX ? 0.50 : 0.34, 0.44, longX ? 0.34 : 0.50, 'limestone');
      }
    }

    // Kotak tangga putih kapur di rumput dihapus & diganti jalan aspal di placeBuilding

    if (arch === 'house1f') {
      skirtFace(1, 0, 1.9); skirtFace(-1, 0, 1.9);
      dressWindow(-w / 2, 0, true, 0, -1); dressWindow(w / 2, 0, true, 0, 1);
      // 2 Jendela fasad depan di kiri & kanan pintu utama
      addFacadeWindow(-2.35, 0, d * 0.5, 1.18, 1.15, 1);
      addFacadeWindow( 2.35, 0, d * 0.5, 1.18, 1.15, 1);
      // Umpak batu tiang teras & pagar teras depan
      for (const sx of [-2.25, 2.25]) {
        P(sx, 0.35, d * 0.5 + 1.65, 0.34, 0.70, 0.34, 'brick');
        P(sx, 0.72, d * 0.5 + 1.65, 0.40, 0.08, 0.40, 'limestone');
      }
      addBalustradeSpan(-2.50, -0.95, 0, d * 0.5 + 1.65, 0.78, 'limestone', 'darkWood');
      addBalustradeSpan( 0.95,  2.50, 0, d * 0.5 + 1.65, 0.78, 'limestone', 'darkWood');
    } else if (arch === 'house2f') {
      skirtFace(1, -1.2, 1.9); skirtFace(-1, -1.2, 1.9);
      dressWindow(-w / 2, 0, true, 0, -1); dressWindow(w / 2, 0, true, 0, 1);
      dressWindow(-w / 2, 0, true, y2, -1); dressWindow(w / 2, 0, true, y2, 1);
      dressWindow(-1.0, -d / 2, false, y2, -1);
      // Jendela fasad depan lantai 1 (kanan pintu) & lantai 2 (kiri & kanan pintu balkon)
      addFacadeWindow(2.15, 0, d * 0.5, 1.45, 1.22, 1);
      addFacadeWindow(-3.35, y2, d * 0.5, 1.15, 1.18, 1);
      addFacadeWindow( 2.15, y2, d * 0.5, 1.45, 1.18, 1);
      // Umpak tiang teras lantai 1 & pagar teras bawah
      for (const sx of [-2.8, 2.8]) {
        P(sx, 0.42, d * 0.5 + 1.5, 0.38, 0.84, 0.38, 'brick');
        P(sx, 0.86, d * 0.5 + 1.5, 0.44, 0.08, 0.44, 'limestone');
      }
      addBalustradeSpan(0.35, 2.80, 0, d * 0.5 + 1.5, 0.80, 'limestone', 'darkWood');
      // Pagar balkon lantai 2 berjeruji (depan & samping balkon) + kanopi balkon atas
      addBalustradeSpan(-3.0, 0.0, y2, d * 0.5 + 1.62, 0.92, 'limestone', 'darkWood');
      addBalustradeSpan( 0.0, 3.0, y2, d * 0.5 + 1.62, 0.92, 'limestone', 'darkWood');
      for (const sx of [-2.95, 2.95]) {
        P(sx, y2 + 1.35, d * 0.5 + 1.55, 0.16, 2.7, 0.16, 'darkWood');
      }
      P(0, y2 + 2.72, d * 0.5 + 0.92, 6.5, 0.12, 1.95, 'terracotta', { pitch: 0.18, noCol: true });
      // Unit AC luar ruangan + braket di lantai 2
      P(-(w / 2 + 0.27), y2 + 0.52, -d * 0.25, 0.34, 0.55, 0.80, 'concrete');
      P(-(w / 2 + 0.445), y2 + 0.52, -d * 0.25, 0.02, 0.42, 0.62, 'gunmetal');
      P(-(w / 2 + 0.20), y2 + 0.20, -d * 0.25, 0.20, 0.04, 0.70, 'gunmetal');
    } else if (arch === 'ruko2f') {
      skirtFace(-1, -1.0, 1.9);
      dressWindow(0, d / 2, false, y2, 1); dressWindow(0, -d / 2, false, y2, -1);
      addFacadeWindow(-2.65, y2, d * 0.5, 1.05, 1.15, 1);
      addFacadeWindow( 2.65, y2, d * 0.5, 1.05, 1.15, 1);
      const signMat = rr < 0.5 ? 'containerRed' : 'containerBlue';
      P(0, 2.84, d / 2 + 0.16, 4.3, 0.56, 0.07, signMat);
      P(0, 3.15, d / 2 + 0.17, 4.4, 0.05, 0.09, 'goldTrim');
      P(0, 2.53, d / 2 + 0.17, 4.4, 0.05, 0.09, 'goldTrim');
      P(0, 2.36, d / 2 - 0.02, 4.0, 0.24, 0.30, 'gunmetal');
      const py = y2 + wallH + 0.46;
      P(0, py, d / 2 + 0.10, w + 0.55, 0.45, 0.16, 'concrete');
      P(0, py, -d / 2 - 0.10, w + 0.55, 0.45, 0.16, 'concrete');
      for (const sx of [-1, 1]) P(sx * (w / 2 + 0.10), py, 0, 0.16, 0.45, d + 0.55, 'concrete');
    }

    if (arch === 'house1f' || arch === 'house2f') {
      const roll = arch === 'house1f' ? 0.29 : 0.27;
      const topWallY = arch === 'house1f' ? wallH : y2 + wallH;
      const baseRoofY = arch === 'house1f' ? wallH + 0.62 : y2 + wallH + 0.68;
      // Lisplang segitiga depan & belakang + ventilasi udara loteng (attic louver) + balok kaso atap
      for (const sz of [-1, 1]) {
        const fz = sz * (d * 0.5 + 0.56);
        P(-w * 0.27, baseRoofY - 0.03, fz, w * 0.60, 0.22, 0.06, 'limestone', { roll, noCol: true });
        P( w * 0.27, baseRoofY - 0.03, fz, w * 0.60, 0.22, 0.06, 'limestone', { roll: -roll, noCol: true });
        P(0, topWallY + 0.58, sz * (d * 0.5 + 0.02), 0.68, 0.52, 0.08, 'darkWood');
        for (let v = 0; v < 4; v++) {
          P(0, topWallY + 0.40 + v * 0.12, sz * (d * 0.5 + 0.05), 0.56, 0.03, 0.04, 'wood');
        }
      }
      // Kaso/usuk kayu di bawah tritisan atap
      for (let rz = -d * 0.45; rz <= d * 0.45; rz += 1.15) {
        P(-w * 0.52, topWallY - 0.04, rz, 0.35, 0.08, 0.08, 'darkWood');
        P( w * 0.52, topWallY - 0.04, rz, 0.35, 0.08, 0.08, 'darkWood');
      }
      // Talang & pipa air hujan di kedua sisi atap pelana
      const gx = w * 0.27 + w * 0.295 * Math.cos(roll) + 0.05;
      const gy = baseRoofY - Math.sin(roll) * w * 0.295 - 0.07;
      const px = w / 2 + 0.17, pz = -d / 2 + 0.55;
      for (const s of [-1, 1]) {
        P(s * gx, gy, 0, 0.10, 0.11, d + 1.12, 'gunmetal');
        const lenX = Math.max(0.1, gx - px);
        P(s * (px + lenX / 2), gy - 0.04, pz, lenX, 0.07, 0.07, 'gunmetal');
        P(s * px, (gy - 0.04) / 2, pz, 0.07, gy - 0.04, 0.07, 'gunmetal');
      }
      // Meteran listrik + kabel konduit + lampu teras
      const mx = arch === 'house1f' ? 1.05 : 0.45;
      P(mx, 1.5, d / 2 + 0.12, 0.28, 0.40, 0.12, 'gunmetal');
      P(mx, 1.56, d / 2 + 0.185, 0.20, 0.16, 0.012, 'limestone');
      P(mx, 2.1, d / 2 + 0.07, 0.04, 0.8, 0.04, 'gunmetal');
      const lampX = arch === 'house1f' ? -1.05 : -0.35;
      P(lampX, 2.05, d / 2 + 0.16, 0.14, 0.24, 0.14, 'warmGlow');
      P(lampX, 2.20, d / 2 + 0.12, 0.05, 0.05, 0.14, 'gunmetal');
    }
  }
  function placeBuilding(arch, bx, bz, rotIdx, tier, poiId, rng) {
    if (World.isShootRangeCorridor(bx, bz)) return;
    let w = 8, d = 7;
    if (arch === 'house2f') { w = 10; d = 8; }
    else if (arch === 'ruko2f') { w = 9; d = 10; }
    else if (arch === 'factory') { w = 18; d = 12; }
    else if (arch === 'tower') { w = 4.8; d = 4.8; }
    else if (arch === 'bunker') { w = 8; d = 8; }

    const swap = (rotIdx & 1) === 1;
    const hw = (swap ? d : w) * 0.5, hd = (swap ? w : d) * 0.5;
    const h0 = World.getHeight(bx - hw, bz - hd);
    const h1 = World.getHeight(bx + hw, bz - hd);
    const h2 = World.getHeight(bx - hw, bz + hd);
    const h3 = World.getHeight(bx + hw, bz + hd);
    const hC = World.getHeight(bx, bz);
    const minH = Math.min(h0, h1, h2, h3, hC);
    const maxH = Math.max(h0, h1, h2, h3, hC);
    if (minH < -2.2) return;
    const baseY = Math.max(1.2, maxH + 0.12);
    const plinthH = baseY - (minH - 2.0);
    const bId = footprints.length;

    // Ground-anchored concrete foundation slab + natural asphalt front road/walkway path (jalan)
    addBuildingPart(bx, baseY, bz, rotIdx, 0, -plinthH * 0.5, 0, w + 0.3, plinthH, d + 0.3, 'concrete');
    if (arch !== 'tower') {
      const angR = rotIdx * Math.PI * 0.5;
      const cosR = Math.round(Math.cos(angR));
      const sinR = Math.round(Math.sin(angR));
      const roadW = arch === 'factory' ? 4.4 : arch === 'ruko2f' ? 4.0 : 3.2;
      const segLen = 2.0;
      const startZ = (arch === 'house1f' || arch === 'house2f') ? d * 0.5 + 1.55 : d * 0.5 + 0.25;
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const zA = startZ + sIdx * segLen;
        const zB = zA + segLen;
        const xA = bx + zA * sinR, pzA = bz + zA * cosR;
        const xB = bx + zB * sinR, pzB = bz + zB * cosR;
        const yA = (sIdx === 0 && (arch === 'house1f' || arch === 'house2f' || arch === 'ruko2f'))
          ? Math.max(baseY - 0.12, World.getHeight(xA, pzA))
          : World.getHeight(xA, pzA);
        const yB = World.getHeight(xB, pzB);
        const midX = (xA + xB) * 0.5, midZ = (pzA + pzB) * 0.5, midY = (yA + yB) * 0.5;
        const dy = yB - yA;
        const pitchAngle = -Math.atan2(dy, segLen);
        const segHyp = Math.hypot(segLen, dy) + 0.12;
        pushGeo(midX, midZ, 'asphalt', makeBoxRaw(roadW, 0.20, segHyp, midX, midY - 0.08, midZ, pitchAngle, angR, 0));
      }
      if (World.stampRoadPath) {
        const z0 = startZ - 0.3, z1 = startZ + segLen * 4 + 1.5;
        World.stampRoadPath(bx + z0 * sinR, bz + z0 * cosR, bx + z1 * sinR, bz + z1 * cosR, roadW * 0.65);
      }
    }

    const wallMat = (arch === 'bunker' || arch === 'factory') ? 'concrete' : rng() > 0.42 ? 'plasterWarm' : 'brick';
    const wallH = 3.2;

    if (arch === 'house1f') {
      addWallWithDoor(bx, baseY, bz, rotIdx, 0, 0, d * 0.5, w, wallH, 0.22, wallMat, false, true);
      addWallWithDoor(bx, baseY, bz, rotIdx, 0, 0, -d * 0.5, w, wallH, 0.22, wallMat, false, true);
      addWallWithWindow(bx, baseY, bz, rotIdx, -w * 0.5, 0, 0, d, wallH, 0.22, wallMat, true);
      addWallWithWindow(bx, baseY, bz, rotIdx, w * 0.5, 0, 0, d, wallH, 0.22, wallMat, true);
      // Interior partition + table & bed
      addBuildingPart(bx, baseY, bz, rotIdx, -1.6, 1.6, 0.2, 3.6, wallH, 0.16, 'plaster');
      addBuildingPart(bx, baseY, bz, rotIdx, -2.5, 0.42, -2.0, 1.6, 0.84, 0.9, 'wood');
      addBuildingPart(bx, baseY, bz, rotIdx, 2.4, 0.3, -1.8, 1.2, 0.6, 2.0, 'cloth');
      // Tropical front veranda (teras depan) with timber pillars, sloped terracotta canopy & bench
      addBuildingPart(bx, baseY, bz, rotIdx, 0, -0.1, d * 0.5 + 0.95, 5.2, 0.2, 1.9, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, -2.25, 1.25, d * 0.5 + 1.65, 0.16, 2.5, 0.16, 'darkWood');
      addBuildingPart(bx, baseY, bz, rotIdx, 2.25, 1.25, d * 0.5 + 1.65, 0.16, 2.5, 0.16, 'darkWood');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 2.58, d * 0.5 + 0.98, 5.6, 0.12, 2.1, 'terracotta', { pitch: 0.18, noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, -1.55, 0.28, d * 0.5 + 0.95, 1.35, 0.42, 0.45, 'wood');
      // Enclosed triangular gables (gevel), overhanging terracotta tiled roof, ridge cap & lisplang trim
      addGableWall(bx, baseY, bz, rotIdx, 0, wallH, d * 0.5 - 0.11, w, 1.25, 0.22, wallMat);
      addGableWall(bx, baseY, bz, rotIdx, 0, wallH, -d * 0.5 + 0.11, w, 1.25, 0.22, wallMat);
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.27, wallH + 0.62, 0, w * 0.59, 0.14, d + 1.1, 'terracotta', { roll: 0.29, noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.27, wallH + 0.62, 0, w * 0.59, 0.14, d + 1.1, 'terracotta', { roll: -0.29, noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, 0, wallH + 1.26, 0, 0.28, 0.18, d + 1.15, 'terracotta', { noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.54, wallH - 0.08, 0, 0.08, 0.22, d + 1.12, 'darkWood', { noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.54, wallH - 0.08, 0, 0.08, 0.22, d + 1.12, 'darkWood', { noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, 0, wallH + 0.08, 0, w + 0.25, 0.18, d + 0.25, 'wood');
      addPad(bx, baseY, bz, rotIdx, -2.5, 0.88, -2.0, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 2.4, 0.64, -1.8, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, -2.2, 0.08, 1.8, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 2.1, 0.08, 1.9, tier, poiId, bId);
    } else if (arch === 'house2f') {
      // Floor 1 exterior walls
      addWallWithDoor(bx, baseY, bz, rotIdx, -1.2, 0, d * 0.5, w, wallH, 0.22, wallMat, false, true);
      addWallWithDoor(bx, baseY, bz, rotIdx, -1.2, 0, -d * 0.5, w, wallH, 0.22, wallMat, false, true);
      addWallWithWindow(bx, baseY, bz, rotIdx, -w * 0.5, 0, 0, d, wallH, 0.22, wallMat, true);
      addWallWithWindow(bx, baseY, bz, rotIdx, w * 0.5, 0, 0, d, wallH, 0.22, wallMat, true);
      // 1F Veranda deck & columns
      addBuildingPart(bx, baseY, bz, rotIdx, 0, -0.1, d * 0.5 + 0.85, 6.2, 0.2, 1.7, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, -2.8, 1.55, d * 0.5 + 1.5, 0.22, 3.1, 0.22, 'darkWood');
      addBuildingPart(bx, baseY, bz, rotIdx, 2.8, 1.55, d * 0.5 + 1.5, 0.22, 3.1, 0.22, 'darkWood');
      // 1F furniture & Interior 12-step staircase on East inner side (X: 3.3..4.75, Z: +2.6..-1.5)
      addBuildingPart(bx, baseY, bz, rotIdx, -2.8, 0.42, -2.0, 1.8, 0.84, 1.0, 'wood');
      addStaircase(bx, baseY, bz, rotIdx, 3.95, 0, 2.7, -1.4, 1.35, 3.45, 12);
      // 2F Floor slab + front balcony extension
      addBuildingPart(bx, baseY, bz, rotIdx, -0.89, 3.32, 0, 8.22, 0.25, d, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 4.11, 3.32, -2.7, 1.78, 0.25, 2.6, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 3.32, d * 0.5 + 0.85, 6.2, 0.22, 1.7, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 3.50, d * 0.5 + 1.62, 6.2, 0.12, 0.16, 'limestone');
      // 2F exterior walls + balcony railing
      const y2 = 3.45;
      addWallWithWindow(bx, baseY, bz, rotIdx, -1.0, y2, -d * 0.5, w, wallH, 0.22, wallMat, false);
      addWallWithWindow(bx, baseY, bz, rotIdx, -w * 0.5, y2, 0, d, wallH, 0.22, wallMat, true);
      addWallWithWindow(bx, baseY, bz, rotIdx, w * 0.5, y2, 0, d, wallH, 0.22, wallMat, true);
      addWallWithDoor(bx, baseY, bz, rotIdx, -1.2, y2, d * 0.5, w, wallH, 0.22, wallMat, false, true);
      // 2F Table + Enclosed Gables + Terracotta Roof + Ridge Cap & Lisplang
      addBuildingPart(bx, baseY, bz, rotIdx, -2.5, y2 + 0.42, 0.5, 1.6, 0.84, 0.9, 'wood');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, y2 + wallH + 0.1, 0, w + 0.35, 0.22, d + 0.35, 'wood');
      addGableWall(bx, baseY, bz, rotIdx, 0, y2 + wallH, d * 0.5 - 0.11, w, 1.42, 0.22, wallMat);
      addGableWall(bx, baseY, bz, rotIdx, 0, y2 + wallH, -d * 0.5 + 0.11, w, 1.42, 0.22, wallMat);
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.27, y2 + wallH + 0.68, 0, w * 0.59, 0.14, d + 1.1, 'terracotta', { roll: 0.27, noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.27, y2 + wallH + 0.68, 0, w * 0.59, 0.14, d + 1.1, 'terracotta', { roll: -0.27, noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, 0, y2 + wallH + 1.42, 0, 0.28, 0.18, d + 1.15, 'terracotta', { noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.54, y2 + wallH - 0.06, 0, 0.08, 0.22, d + 1.12, 'darkWood', { noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.54, y2 + wallH - 0.06, 0, 0.08, 0.22, d + 1.12, 'darkWood', { noCol: true });
      addPad(bx, baseY, bz, rotIdx, -2.8, 0.88, -2.0, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, -2.5, 0.08, 2.2, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 0.5, 0.08, -2.2, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, -2.5, y2 + 0.88, 0.5, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, -2.8, y2 + 0.08, -2.4, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 1.2, y2 + 0.08, 1.8, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 4.0, y2 + 0.08, -2.7, tier, poiId, bId);
    } else if (arch === 'ruko2f') {
      // Wide shopfront entrance (+Z) with concrete columns, awning, signage & back door (-Z)
      addBuildingPart(bx, baseY, bz, rotIdx, -3.25, 1.6, d * 0.5, 2.5, wallH, 0.24, 'brick');
      addBuildingPart(bx, baseY, bz, rotIdx, 3.25, 1.6, d * 0.5, 2.5, wallH, 0.24, 'brick');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 2.85, d * 0.5, 4.0, 0.7, 0.24, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 2.52, d * 0.5 + 0.85, w + 0.5, 0.14, 1.7, 'terracotta', { pitch: 0.14, noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, -4.1, 1.25, d * 0.5 + 1.45, 0.22, 2.5, 0.22, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 4.1, 1.25, d * 0.5 + 1.45, 0.22, 2.5, 0.22, 'concrete');
      addWallWithDoor(bx, baseY, bz, rotIdx, -1.0, 0, -d * 0.5, w, wallH, 0.22, wallMat, false, true);
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.5, 1.6, 0, 0.24, wallH, d, wallMat);
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.5, 1.6, 0, 0.24, wallH, d, wallMat);
      addBuildingPart(bx, baseY, bz, rotIdx, -2.2, 0.48, 0.4, 2.4, 0.96, 0.7, 'wood');
      addStaircase(bx, baseY, bz, rotIdx, 3.55, 0, 3.2, -1.2, 1.35, 3.45, 12);
      const y2 = 3.45;
      addBuildingPart(bx, baseY, bz, rotIdx, -0.8, 3.32, 0, 7.4, 0.25, d, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 3.6, 3.32, -3.1, 1.8, 0.25, 3.8, 'concrete');
      addWallWithWindow(bx, baseY, bz, rotIdx, 0, y2, d * 0.5, w, wallH, 0.22, wallMat, false);
      addWallWithWindow(bx, baseY, bz, rotIdx, 0, y2, -d * 0.5, w, wallH, 0.22, wallMat, false);
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.5, y2 + 1.6, 0, 0.22, wallH, d, wallMat);
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.5, y2 + 1.6, 0, 0.22, wallH, d, wallMat);
      addBuildingPart(bx, baseY, bz, rotIdx, 0, y2 + wallH + 0.12, 0, w + 0.35, 0.24, d + 0.35, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, y2 + wallH + 0.36, 0, w + 0.6, 0.16, d + 0.6, 'terracotta', { pitch: 0.08, noCol: true });
      addPad(bx, baseY, bz, rotIdx, -2.2, 1.0, 0.4, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, -2.5, 0.08, -2.6, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 0.8, 0.08, 2.5, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, -2.4, y2 + 0.08, 1.8, tier, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 0.8, y2 + 0.08, -2.5, tier, poiId, bId);
    } else if (arch === 'factory') {
      const fH = 5.4;
      // Front/back wide bay entrances (4.4m clear)
      const sideF = (w - 4.4) * 0.5;
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.5 + sideF * 0.5, fH * 0.5, d * 0.5, sideF, fH, 0.28, 'brick');
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.5 - sideF * 0.5, fH * 0.5, d * 0.5, sideF, fH, 0.28, 'brick');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 4.6, d * 0.5, 4.4, 1.6, 0.28, 'zincRoof');
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.5 + sideF * 0.5, fH * 0.5, -d * 0.5, sideF, fH, 0.28, 'brick');
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.5 - sideF * 0.5, fH * 0.5, -d * 0.5, sideF, fH, 0.28, 'brick');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 4.6, -d * 0.5, 4.4, 1.6, 0.28, 'zincRoof');
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.5, fH * 0.5, 0, 0.28, fH, d, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.5, fH * 0.5, 0, 0.28, fH, d, 'concrete');
      // Interior crates & elevated catwalk
      addBuildingPart(bx, baseY, bz, rotIdx, -4.5, 0.8, -1.8, 2.2, 1.6, 2.0, 'wood');
      addBuildingPart(bx, baseY, bz, rotIdx, 3.8, 0.7, 1.2, 1.8, 1.4, 1.8, 'rust');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 2.75, -d * 0.5 + 1.5, w - 0.8, 0.22, 2.4, 'rust');
      addStaircase(bx, baseY, bz, rotIdx, -w * 0.5 + 1.1, 0, 2.2, -2.5, 1.35, 2.86, 10);
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.26, fH + 0.65, 0, w * 0.55, 0.16, d + 0.8, 'zincRoof', { roll: 0.18, noCol: true });
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.26, fH + 0.65, 0, w * 0.55, 0.16, d + 0.8, 'zincRoof', { roll: -0.18, noCol: true });
      for (const [px, py, pz] of [[-5, 0.08, 3], [4.5, 0.08, -2.2], [-4.5, 1.65, -1.8], [3.8, 1.45, 1.2], [0, 2.9, -d * 0.5 + 1.5], [4.5, 2.9, -d * 0.5 + 1.5]]) {
        addPad(bx, baseY, bz, rotIdx, px, py, pz, tier, poiId, bId);
      }
    } else if (arch === 'tower') {
      const topY = 6.2;
      // 4 reinforced concrete corner legs + helical/switchback ramp flights
      for (const sx of [-2.1, 2.1]) {
        for (const sz of [-2.1, 2.1]) {
          addBuildingPart(bx, baseY, bz, rotIdx, sx, topY * 0.5, sz, 0.45, topY, 0.45, 'concrete');
        }
      }
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 3.1, 0, 4.4, 0.24, 4.4, 'concrete'); // Mid landing? Leave stair opening: split half!
      addStaircase(bx, baseY, bz, rotIdx, -1.35, 0, 2.2, -1.8, 1.2, 3.1, 10);
      addStaircase(bx, baseY, bz, rotIdx, 1.35, 3.1, -1.8, 2.0, 1.2, 3.1, 10);
      // Observation deck slab at topY (split around east stair landing)
      addBuildingPart(bx, baseY, bz, rotIdx, -0.9, topY - 0.12, 0, 2.8, 0.24, d, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 1.35, topY - 0.12, 1.5, 1.8, 0.24, 1.6, 'concrete');
      // Perimeter waist rail + roof canopy
      addBuildingPart(bx, baseY, bz, rotIdx, 0, topY + 0.52, -d * 0.5 + 0.12, w, 1.04, 0.2, 'rust');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, topY + 0.52, d * 0.5 - 0.12, w, 1.04, 0.2, 'rust');
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.5 + 0.12, topY + 0.52, 0, 0.2, 1.04, d, 'rust');
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.5 - 0.12, topY + 0.52, 0, 0.2, 1.04, d, 'rust');
      for (const sx of [-2.1, 2.1]) for (const sz of [-2.1, 2.1]) addBuildingPart(bx, baseY, bz, rotIdx, sx, topY + 1.5, sz, 0.25, 2.8, 0.25, 'rust');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, topY + 2.95, 0, w + 0.9, 0.2, d + 0.9, 'zincRoof');
      addPad(bx, baseY, bz, rotIdx, -1.2, topY + 0.06, -1.0, 3, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 0.2, topY + 0.06, 1.2, 3, poiId, bId);
      addPad(bx, baseY, bz, rotIdx, 0, 0.08, -1.2, tier, poiId, bId);
    } else if (arch === 'bunker') {
      const bH = 3.0;
      addWallWithDoor(bx, baseY, bz, rotIdx, 0, 0, d * 0.5, w, bH, 0.45, 'concrete', false, false);
      addWallWithDoor(bx, baseY, bz, rotIdx, 0, 0, -d * 0.5, w, bH, 0.45, 'concrete', false, false);
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.5, 0.55, 0, 0.45, 1.1, d, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, -w * 0.5, 2.45, 0, 0.45, 1.1, d, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.5, 0.55, 0, 0.45, 1.1, d, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, w * 0.5, 2.45, 0, 0.45, 1.1, d, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, 0, bH + 0.2, 0, w + 0.5, 0.4, d + 0.5, 'concrete');
      addBuildingPart(bx, baseY, bz, rotIdx, -1.8, 0.55, 0, 1.6, 1.1, 1.4, 'rust');
      for (const [px, py, pz] of [[-1.8, 1.15, 0], [2.2, 0.08, 1.8], [-2.2, 0.08, -2.0], [1.8, 0.08, -1.8]]) {
        addPad(bx, baseY, bz, rotIdx, px, py, pz, 3, poiId, bId);
      }
    }

    decorateBuilding(arch, bx, baseY, bz, rotIdx, w, d, wallH);
    footprints.push({
      cx: bx, cz: bz, w: swap ? d : w, d: swap ? w : d, rotIdx,
      minX: bx - hw, maxX: bx + hw, minZ: bz - hd, maxZ: bz + hd, arch
    });
  }

  function buildBridge(bx, bz, ang) {
    const len = 34, width = 7.4;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const e1H = World.getHeight(bx - ca * 19, bz - sa * 19);
    const e2H = World.getHeight(bx + ca * 19, bz + sa * 19);
    const deckY = Math.max(3.8, e1H + 0.65, e2H + 0.65);

    // Visual central span + 2 sloped approach ramps
    pushGeo(bx, bz, 'concrete', makeBoxRaw(len, 0.45, width, bx, deckY - 0.22, bz, 0, -ang, 0));
    pushGeo(bx, bz, 'rust', makeBoxRaw(len, 1.05, 0.25, bx - sa * (width * 0.46), deckY + 0.52, bz + ca * (width * 0.46), 0, -ang, 0));
    pushGeo(bx, bz, 'rust', makeBoxRaw(len, 1.05, 0.25, bx + sa * (width * 0.46), deckY + 0.52, bz - ca * (width * 0.46), 0, -ang, 0));
    // River piers
    for (const tOff of [-10, 0, 10]) {
      pushGeo(bx, bz, 'concrete', makeBoxRaw(1.4, deckY + 5, width - 0.8, bx + ca * tOff, (deckY - 5) * 0.5, bz + sa * tOff, 0, -ang, 0));
    }
    // End ramps down to bank ground
    for (const dir of [-1, 1]) {
      for (let s = 0; s < 7; s++) {
        const dist = (len * 0.5) + s * 1.15;
        const rx = bx + ca * dir * dist, rz = bz + sa * dir * dist;
        const groundH = World.getHeight(rx, rz);
        const topY = Util.lerp(deckY, Math.max(groundH + 0.05, 0.4), (s + 0.5) / 7);
        const dropH = Math.max(0.4, topY - groundH + 1.5);
        pushGeo(rx, rz, 'asphalt', makeBoxRaw(1.4, dropH, width, rx, topY - dropH * 0.5, rz, 0, -ang, 0));
        Physics.addCollider({ minX: rx - 1.4, maxX: rx + 1.4, minY: groundH - 1.5, maxY: topY, minZ: rz - 1.4, maxZ: rz + 1.4, mat: 'asphalt', tag: 'world' });
      }
    }
    // Subdivided tight AABB colliders along the main deck + railings
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const off = -len * 0.5 + ((i + 0.5) / steps) * len;
      const sx = bx + ca * off, sz = bz + sa * off;
      Physics.addCollider({ minX: sx - 2.6, maxX: sx + 2.6, minY: deckY - 0.6, maxY: deckY, minZ: sz - 2.6, maxZ: sz + 2.6, mat: 'concrete', tag: 'world' });
      const r1x = sx - sa * (width * 0.47), r1z = sz + ca * (width * 0.47);
      const r2x = sx + sa * (width * 0.47), r2z = sz - ca * (width * 0.47);
      Physics.addCollider({ minX: r1x - 0.85, maxX: r1x + 0.85, minY: deckY, maxY: deckY + 1.05, minZ: r1z - 0.85, maxZ: r1z + 0.85, mat: 'metal', tag: 'world' });
      Physics.addCollider({ minX: r2x - 0.85, maxX: r2x + 0.85, minY: deckY, maxY: deckY + 1.05, minZ: r2z - 0.85, maxZ: r2z + 0.85, mat: 'metal', tag: 'world' });
    }
    bridges.push({
      bx, bz, ang, len: len + 16, width, deckY,
      x1: bx - ca * (len * 0.5 + 8), z1: bz - sa * (len * 0.5 + 8),
      x2: bx + ca * (len * 0.5 + 8), z2: bz + sa * (len * 0.5 + 8)
    });
  }

  function buildSpecialLandmark(poiId, px, pz) {
    const baseH = World.getHeight(px, pz);
    if (poiId === 'pangkalan') {
      // Runway 180m x 22m
      const rwY = baseH + 0.08;
      pushGeo(px, pz, 'asphalt', makeBoxRaw(180, 0.3, 22, px, rwY, pz));
      Physics.addCollider({ minX: px - 90, maxX: px + 90, minY: rwY - 1, maxY: rwY + 0.15, minZ: pz - 11, maxZ: pz + 11, mat: 'asphalt', tag: 'world' });
      for (let rx = -76; rx <= 76; rx += 16) {
        pushGeo(px + rx, pz, 'plaster', makeBoxRaw(7.5, 0.04, 0.8, px + rx, rwY + 0.16, pz));
      }
      // Spinning ATC radar atop tall tower next to runway
      const dishGrp = new THREE.Group();
      dishGrp.position.set(px - 62, baseH + 10.6, pz - 32);
      const dish = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.9, 0.28), Assets.get('rust'));
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.4, 8), Assets.get('gunmetal'));
      mast.position.y = -0.6;
      dishGrp.add(dish, mast);
      rootGroup.add(dishGrp);
      radarMesh = dishGrp;
    } else if (poiId === 'menara') {
      // 42m Tapered Communications Tower + Red Aircraft Beacon
      const tH = 42;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const g = makeBoxRaw(0.32, tH, 0.32, px + sx * 1.4, baseH + tH * 0.5, pz + sz * 1.4, sz * 0.048, 0, -sx * 0.048);
          pushGeo(px, pz, 'rust', g);
        }
      }
      for (let h = 5; h < tH - 3; h += 5.5) {
        const w = 3.8 * (1 - h / (tH * 1.35));
        pushGeo(px, pz, 'rust', makeBoxRaw(w, 0.2, 0.2, px, baseH + h, pz + w * 0.5));
        pushGeo(px, pz, 'rust', makeBoxRaw(w, 0.2, 0.2, px, baseH + h, pz - w * 0.5));
        pushGeo(px, pz, 'rust', makeBoxRaw(0.2, 0.2, w, px + w * 0.5, baseH + h, pz));
        pushGeo(px, pz, 'rust', makeBoxRaw(0.2, 0.2, w, px - w * 0.5, baseH + h, pz));
      }
      pushGeo(px, pz, 'concrete', makeBoxRaw(3.2, 0.24, 3.2, px, baseH + tH - 1.5, pz));
      Physics.addCollider({ minX: px - 2.4, maxX: px + 2.4, minY: baseH, maxY: baseH + 8, minZ: pz - 2.4, maxZ: pz + 2.4, mat: 'metal', tag: 'world' });
      const bMat = new THREE.MeshBasicMaterial({ color: 0xFF2828 });
      beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), bMat);
      beaconMesh.position.set(px, baseH + tH + 0.4, pz);
      rootGroup.add(beaconMesh);
    } else if (poiId === 'pelabuhan') {
      // Harbour Quay wall + Pier Docks + 2 Shipping Cranes + Stacked Cargo Containers
      pushGeo(px, pz + 35, 'concrete', makeBoxRaw(150, 4.5, 42, px, 1.1, pz + 32));
      Physics.addCollider({ minX: px - 75, maxX: px + 75, minY: -2, maxY: 3.35, minZ: pz + 11, maxZ: pz + 53, mat: 'concrete', tag: 'world' });
      // Pier fingers jutting south
      for (const ox of [-42, 42]) {
        pushGeo(px + ox, pz + 72, 'concrete', makeBoxRaw(14, 1.2, 44, px + ox, 2.75, pz + 74));
        Physics.addCollider({ minX: px + ox - 7, maxX: px + ox + 7, minY: 1, maxY: 3.35, minZ: pz + 52, maxZ: pz + 96, mat: 'concrete', tag: 'world' });
      }
      // 2 Harbour Gantry Cranes + Containers
      for (const cx of [-38, 36]) {
        const cy = 3.35;
        pushGeo(px + cx, pz + 38, 'rust', makeBoxRaw(0.9, 18, 0.9, px + cx - 4, cy + 9, pz + 38));
        pushGeo(px + cx, pz + 38, 'rust', makeBoxRaw(0.9, 18, 0.9, px + cx + 4, cy + 9, pz + 38));
        pushGeo(px + cx, pz + 38, 'rust', makeBoxRaw(10, 1.2, 22, px + cx, cy + 17.5, pz + 44));
        Physics.addCollider({ minX: px + cx - 4.6, maxX: px + cx - 3.4, minY: cy, maxY: cy + 8, minZ: pz + 37.4, maxZ: pz + 38.6, mat: 'metal', tag: 'world' });
        Physics.addCollider({ minX: px + cx + 3.4, maxX: px + cx + 4.6, minY: cy, maxY: cy + 8, minZ: pz + 37.4, maxZ: pz + 38.6, mat: 'metal', tag: 'world' });
      }
      const cMats = ['containerRed', 'containerBlue', 'containerOlive', 'rust'];
      [[-20, 22, 0], [-10, 22, 0], [12, 26, 0], [22, 26, 0], [-15, 22, 2.8], [5, 42, 0], [-52, 24, 0]].forEach(([dx, dz, dy], idx) => {
        const cy = 3.35 + dy;
        pushGeo(px + dx, pz + dz, cMats[idx % 4], makeBoxRaw(6.2, 2.6, 2.5, px + dx, cy + 1.3, pz + dz));
        Physics.addCollider({ minX: px + dx - 3.1, maxX: px + dx + 3.1, minY: cy, maxY: cy + 2.6, minZ: pz + dz - 1.25, maxZ: pz + dz + 1.25, mat: 'metal', tag: 'world' });
      });
    } else if (poiId === 'pompa') {
      // 2 cylindrical fluid storage tanks + pipe bridge
      for (const ox of [-22, 22]) {
        const ty = World.getHeight(px + ox, pz);
        pushGeo(px + ox, pz, 'rust', makeCylRaw(6.5, 6.5, 9, 16, px + ox, ty + 4.5, pz));
        Physics.addCollider({ minX: px + ox - 6.5, maxX: px + ox + 6.5, minY: ty, maxY: ty + 9, minZ: pz - 6.5, maxZ: pz + 6.5, mat: 'metal', tag: 'world' });
      }
      pushGeo(px, pz, 'gunmetal', makeBoxRaw(44, 0.7, 0.7, px, baseH + 7.5, pz));
    } else if (poiId === 'nelayan' || poiId === 'pantai') {
      // Timber fishing docks over shallows
      for (const ox of [-28, 28]) {
        const yD = 2.0;
        const dx = px + ox, dz = poiId === 'nelayan' ? pz + 18 : pz + 28;
        pushGeo(dx, dz, 'wood', makeBoxRaw(3.8, 0.3, 28, dx, yD, dz));
        Physics.addCollider({ minX: dx - 1.9, maxX: dx + 1.9, minY: yD - 0.5, maxY: yD + 0.16, minZ: dz - 14, maxZ: dz + 14, mat: 'wood', tag: 'world' });
        for (let py = -12; py <= 12; py += 6) {
          pushGeo(dx, dz + py, 'wood', makeBoxRaw(0.32, 4.5, 0.32, dx - 1.5, 0, dz + py));
          pushGeo(dx, dz + py, 'wood', makeBoxRaw(0.32, 4.5, 0.32, dx + 1.5, 0, dz + py));
        }
      }
    } else if (poiId === 'kotamini') {
      buildPiccadillyMetropolis(px, pz);
    }
  }

  function buildPiccadillyMetropolis(px, pz) {
    const baseH = World.getHeight(px, pz);
    const scaleGeoUV = (g, rx, ry) => {
      if (!rx && !ry) return g;
      const uv = g.attributes.uv;
      if (uv) {
        const sx = rx || 1, sy = ry || 1;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
        }
        uv.needsUpdate = true;
      }
      return g;
    };
    const cityPushBox = (x, y, z, w, h, d, matKey, rx = 0, ry = 0, rz = 0, withCol = false, colMat = matKey, uvSx = 1, uvSy = 1) => {
      const g = scaleGeoUV(makeBoxRaw(w, h, d, x, y, z, rx, ry, rz), uvSx, uvSy);
      pushGeo(x, z, matKey, g);
      if (withCol) {
        Physics.addCollider({
          minX: x - w * 0.5, maxX: x + w * 0.5,
          minY: y - h * 0.5, maxY: y + h * 0.5,
          minZ: z - d * 0.5, maxZ: z + d * 0.5,
          mat: colMat === 'darkIron' || colMat === 'busBlue' ? 'metal' : 'concrete',
          tag: 'world'
        });
      }
    };
    const cityPushCyl = (x, y, z, rt, rb, h, segs, matKey, rx = 0, ry = 0, rz = 0, colRad = 0) => {
      pushGeo(x, z, matKey, makeCylRaw(rt, rb, h, segs, x, y, z, rx, ry, rz));
      if (colRad > 0) {
        Physics.addCollider({
          minX: x - colRad, maxX: x + colRad,
          minY: y - h * 0.5, maxY: y + h * 0.5,
          minZ: z - colRad, maxZ: z + colRad,
          mat: matKey === 'darkIron' || matKey === 'bronzeStatue' ? 'metal' : 'concrete',
          tag: 'world'
        });
      }
    };

    // 1. Wet Granite Cobble Plaza, Roadway & Crosswalks (human-scale tiled UVs!)
    cityPushBox(px - 2, baseH - 0.10, pz - 8, 146, 0.24, 118, 'pavingStone', 0, 0, 0, false, 'concrete', 18, 15);
    // Western curving asphalt transit lane + crosswalk zebra markings
    cityPushBox(px - 22, baseH + 0.028, pz + 4, 15.5, 0.025, 86, 'asphalt', 0, -0.06, 0, false, 'concrete', 2, 10);
    for (let cx = -13; cx >= -23; cx -= 1.6) {
      cityPushBox(px + cx, baseH + 0.042, pz + 17.5, 0.72, 0.02, 3.2, 'plaster');
    }
    // North avenue continuation
    cityPushBox(px - 4, baseH + 0.028, pz - 46, 13.5, 0.025, 42, 'asphalt', 0, 0, 0, false, 'concrete', 2, 6);
    for (let cx = -9; cx <= 1; cx += 1.6) {
      cityPushBox(px + cx, baseH + 0.042, pz - 32, 0.72, 0.02, 2.8, 'plaster');
    }

    // 2. Centerpiece: Shaftesbury Memorial Fountain & Winged Eros Statue
    const fx = px - 0.5, fz = pz - 1.0;
    const stepRadii = [12.8, 11.4, 10.0, 8.6, 7.2];
    const stepH = 0.28;
    for (let i = 0; i < stepRadii.length; i++) {
      const r = stepRadii[i];
      const cy = baseH + stepH * 0.5 + i * stepH;
      cityPushCyl(fx, cy, fz, r, r + 0.1, stepH, 8, 'pavingStone', 0, Math.PI / 8, 0);
      // Walkable octagonal stair collider inscribed square + axial arms
      const sq = r * 0.72;
      Physics.addCollider({ minX: fx - sq, maxX: fx + sq, minY: cy - 0.2, maxY: cy + stepH * 0.5, minZ: fz - sq, maxZ: fz + sq, mat: 'concrete', tag: 'world' });
      Physics.addCollider({ minX: fx - r * 0.92, maxX: fx + r * 0.92, minY: cy - 0.2, maxY: cy + stepH * 0.5, minZ: fz - r * 0.38, maxZ: fz + r * 0.38, mat: 'concrete', tag: 'world' });
      Physics.addCollider({ minX: fx - r * 0.38, maxX: fx + r * 0.38, minY: cy - 0.2, maxY: cy + stepH * 0.5, minZ: fz - r * 0.92, maxZ: fz + r * 0.92, mat: 'concrete', tag: 'world' });
    }
    const fTop = baseH + stepRadii.length * stepH;
    // Octagonal bronze fountain basin rim + reflective pool
    for (let k = 0; k < 8; k++) {
      const a = k * (Math.PI / 4) + Math.PI / 8;
      cityPushBox(fx + Math.cos(a) * 4.5, fTop + 0.44, fz + Math.sin(a) * 4.5, 3.85, 0.88, 0.46, 'bronzeStatue', 0, -a + Math.PI * 0.5, 0);
    }
    cityPushCyl(fx, fTop + 0.56, fz, 4.35, 4.35, 0.08, 12, 'glass');
    // Multi-tiered sculpted bronze plinth
    cityPushCyl(fx, fTop + 0.35, fz, 3.05, 3.35, 0.70, 8, 'bronzeStatue', 0, Math.PI / 8, 0, 2.9);
    cityPushCyl(fx, fTop + 1.65, fz, 2.05, 2.55, 1.95, 8, 'bronzeStatue', 0, Math.PI / 8, 0, 2.3);
    for (let k = 0; k < 8; k++) {
      const a = k * (Math.PI / 4);
      cityPushBox(fx + Math.cos(a) * 2.28, fTop + 1.65, fz + Math.sin(a) * 2.28, 0.42, 1.85, 0.75, 'bronzeStatue', 0, -a, 0);
    }
    // Mid cantilevered octagonal fountain bowl + delicate lantern shrine tier
    cityPushCyl(fx, fTop + 2.84, fz, 2.92, 2.65, 0.46, 8, 'bronzeStatue', 0, Math.PI / 8, 0);
    cityPushCyl(fx, fTop + 4.10, fz, 1.25, 1.48, 2.10, 8, 'bronzeStatue', 0, Math.PI / 8, 0);
    for (let k = 0; k < 8; k++) {
      const a = k * (Math.PI / 4) + Math.PI / 8;
      cityPushCyl(fx + Math.cos(a) * 1.56, fTop + 4.10, fz + Math.sin(a) * 1.56, 0.14, 0.16, 2.05, 6, 'bronzeStatue');
    }
    cityPushCyl(fx, fTop + 5.32, fz, 1.88, 1.45, 0.38, 8, 'bronzeStatue', 0, Math.PI / 8, 0);
    // Upper urn cupola + slender shaft + Eros pedestal sphere
    cityPushCyl(fx, fTop + 6.08, fz, 0.56, 1.32, 1.15, 8, 'bronzeStatue', 0, Math.PI / 8, 0);
    cityPushCyl(fx, fTop + 7.25, fz, 0.38, 0.54, 1.30, 8, 'bronzeStatue');
    cityPushCyl(fx, fTop + 8.05, fz, 0.44, 0.44, 0.42, 10, 'bronzeStatue');
    // Winged Eros / Anteros archer statue poised high atop monument facing SW-W
    const sy = fTop + 8.26;
    cityPushBox(fx - 0.04, sy + 0.52, fz - 0.04, 0.22, 1.08, 0.22, 'bronzeStatue', 0.12, 0.4, 0.10);
    cityPushBox(fx + 0.34, sy + 0.78, fz + 0.28, 0.18, 1.02, 0.18, 'bronzeStatue', -0.45, 0.4, -0.58);
    cityPushBox(fx - 0.12, sy + 1.38, fz - 0.10, 0.44, 0.88, 0.30, 'bronzeStatue', 0.26, 0.55, 0.08);
    cityPushCyl(fx - 0.22, sy + 1.98, fz - 0.20, 0.17, 0.18, 0.32, 8, 'bronzeStatue');
    cityPushBox(fx - 0.58, sy + 1.62, fz - 0.32, 0.14, 0.86, 0.14, 'bronzeStatue', 0.30, 0.55, 1.15);
    cityPushBox(fx + 0.22, sy + 1.56, fz + 0.12, 0.13, 0.68, 0.13, 'bronzeStatue', -0.25, 0.55, -0.85);
    // Bow arc held forward
    cityPushBox(fx - 0.94, sy + 1.75, fz - 0.46, 0.07, 1.35, 0.09, 'bronzeStatue', 0.18, 0.55, 0.22);
    // Swept dual winged archer silhouette
    cityPushBox(fx + 0.38, sy + 1.98, fz - 0.06, 0.95, 0.42, 0.09, 'bronzeStatue', 0.22, 0.82, 0.62);
    cityPushBox(fx + 0.12, sy + 1.98, fz + 0.42, 0.95, 0.42, 0.09, 'bronzeStatue', -0.22, 0.18, 0.62);
    cityPushBox(fx + 0.55, sy + 2.26, fz - 0.14, 0.78, 0.24, 0.08, 'bronzeStatue', 0.22, 0.82, 0.76);
    cityPushBox(fx + 0.18, sy + 2.26, fz + 0.56, 0.78, 0.24, 0.08, 'bronzeStatue', -0.22, 0.18, 0.76);

    // 3. Foreground Left-Center Cast-Iron Streetlamp, Black & Gold Litter Bin & Utility Cabinet
    const lx = px - 5.2, lz = fz + 14.2;
    cityPushBox(lx, baseH + 0.62, lz, 0.58, 1.24, 0.58, 'darkIron', 0, 0, 0, true);
    cityPushCyl(lx, baseH + 4.45, lz, 0.08, 0.15, 6.6, 10, 'darkIron', 0, 0, 0, 0.22);
    cityPushBox(lx, baseH + 7.25, lz, 1.35, 0.08, 0.09, 'darkIron');
    // Lantern round plaque badge on shaft + bright glowing lantern globe + finial cap
    cityPushCyl(lx - 0.36, baseH + 6.90, lz + 0.10, 0.24, 0.24, 0.08, 12, 'darkIron', Math.PI * 0.5, 0, 0);
    cityPushBox(lx, baseH + 8.05, lz, 0.46, 0.68, 0.46, 'warmGlow');
    cityPushCyl(lx, baseH + 8.58, lz, 0.02, 0.34, 0.44, 8, 'darkIron');
    // Utility switch box right next to lamp base
    cityPushBox(lx + 1.18, baseH + 0.70, lz + 0.08, 1.02, 1.40, 0.82, 'darkIron', 0, 0, 0, true);
    // Cylindrical black British bin with twin gold rings to the left of lamp
    const bxBin = lx - 1.95, bzBin = lz + 0.45;
    cityPushCyl(bxBin, baseH + 0.56, bzBin, 0.42, 0.42, 1.12, 14, 'darkIron', 0, 0, 0, 0.45);
    cityPushCyl(bxBin, baseH + 1.18, bzBin, 0.16, 0.41, 0.18, 14, 'darkIron');
    cityPushCyl(bxBin, baseH + 0.44, bzBin, 0.432, 0.432, 0.055, 14, 'goldTrim');
    cityPushCyl(bxBin, baseH + 0.76, bzBin, 0.432, 0.432, 0.055, 14, 'goldTrim');
    cityPushBox(bxBin + 0.05, baseH + 0.60, bzBin + 0.41, 0.14, 0.20, 0.04, 'goldTrim');
    // Second lamp near left bus crossing + traffic light signal pole + bollards
    cityPushCyl(px - 17.6, baseH + 4.1, pz + 13.5, 0.08, 0.14, 8.2, 8, 'darkIron', 0, 0, 0, 0.2);
    cityPushBox(px - 17.6, baseH + 8.35, pz + 13.5, 0.42, 0.58, 0.42, 'warmGlow');
    cityPushCyl(px - 14.6, baseH + 2.6, pz + 14.2, 0.07, 0.10, 5.2, 8, 'darkIron', 0, 0, 0, 0.16);
    cityPushBox(px - 14.6, baseH + 4.35, pz + 14.2, 0.34, 0.92, 0.34, 'darkIron');
    cityPushBox(px - 14.6, baseH + 4.55, pz + 14.38, 0.18, 0.18, 0.06, 'redSignal');
    cityPushBox(px - 18.4, baseH + 0.42, pz + 14.0, 0.72, 0.84, 0.72, 'pavingStone', 0, 0, 0, true);
    cityPushBox(px - 16.9, baseH + 0.42, pz + 14.1, 0.72, 0.84, 0.72, 'pavingStone', 0, 0, 0, true);

    // 4. Navy-Blue London Double-Decker Bus + Yellow & Navy Taxi on Western Roadway
    const busX = px - 18.2, busZ = pz + 5.6, busYaw = -0.26;
    const busPart = (ox, oy, oz, w, h, d, matKey) => {
      const ca = Math.cos(busYaw), sa = Math.sin(busYaw);
      const wx = busX + ox * ca + oz * sa;
      const wz = busZ - ox * sa + oz * ca;
      pushGeo(wx, wz, matKey, makeBoxRaw(w, h, d, wx, baseH + oy, wz, 0, busYaw, 0));
    };
    busPart(0, 1.15, 0, 2.55, 1.9, 10.8, 'busBlue');
    busPart(0, 3.25, 0, 2.50, 1.95, 10.6, 'busBlue');
    busPart(0, 4.32, 0, 2.46, 0.24, 10.4, 'busBlue');
    // Side cream advertisement banner + warm glowing passenger deck windows
    busPart(1.29, 2.15, 0.3, 0.05, 0.56, 7.6, 'plaster');
    busPart(-1.29, 2.15, 0.3, 0.05, 0.56, 7.6, 'plaster');
    busPart(0, 3.22, 0.1, 2.54, 0.92, 9.6, 'glass');
    busPart(0, 1.38, -0.3, 2.58, 0.82, 8.8, 'glass');
    busPart(0, 3.20, 0.1, 2.05, 0.65, 9.0, 'warmGlow');
    busPart(0, 1.38, -0.3, 2.05, 0.55, 8.2, 'warmGlow');
    // Front windshield, neon blue-cyan destination blind & warm headlights facing south
    busPart(0, 1.45, 5.42, 2.28, 1.1, 0.06, 'glass');
    busPart(0, 3.32, 5.32, 2.28, 1.05, 0.06, 'glass');
    busPart(0, 2.38, 5.44, 1.6, 0.26, 0.05, 'neonCyan');
    busPart(-0.85, 0.58, 5.43, 0.34, 0.22, 0.05, 'warmGlow');
    busPart(0.85, 0.58, 5.43, 0.34, 0.22, 0.05, 'warmGlow');
    for (const wzOff of [-3.6, 0.2, 3.7]) {
      for (const wxOff of [-1.22, 1.22]) {
        const ca = Math.cos(busYaw), sa = Math.sin(busYaw);
        const wxx = busX + wxOff * ca + wzOff * sa;
        const wzz = busZ - wxOff * sa + wzOff * ca;
        cityPushCyl(wxx, baseH + 0.52, wzz, 0.52, 0.52, 0.32, 12, 'darkIron', 0, busYaw, Math.PI * 0.5);
      }
    }
    for (const k of [-3.4, 0, 3.4]) {
      const ca = Math.cos(busYaw), sa = Math.sin(busYaw);
      const cx = busX + k * sa, cz = busZ + k * ca;
      Physics.addCollider({ minX: cx - 1.48, maxX: cx + 1.48, minY: baseH, maxY: baseH + 4.4, minZ: cz - 1.95, maxZ: cz + 1.95, mat: 'metal', tag: 'world' });
    }
    // Yellow & Blue Taxi behind left curve
    const txX = px - 28.5, txZ = pz + 14.5;
    cityPushBox(txX, baseH + 0.58, txZ, 4.5, 0.72, 1.85, 'busBlue', 0, 0.24, 0, true);
    cityPushBox(txX - 0.15, baseH + 1.18, txZ, 2.5, 0.62, 1.66, 'craneYellow', 0, 0.24, 0);
    cityPushBox(txX - 0.15, baseH + 1.18, txZ, 2.1, 0.44, 1.70, 'glass', 0, 0.24, 0);
    cityPushBox(txX + 2.22, baseH + 0.62, txZ + 0.45, 0.08, 0.22, 0.35, 'warmGlow', 0, 0.24, 0);
    cityPushBox(txX + 2.22, baseH + 0.62, txZ - 0.45, 0.08, 0.22, 0.35, 'warmGlow', 0, 0.24, 0);

    // 5. Left Neoclassical Corner Building (Hero West Block) + Twin Yellow Tower Cranes
    const lCx = px - 36.5, lCz = pz - 6.0;
    // Left sidewalk apron
    cityPushBox(px - 39.5, baseH + 0.07, pz - 4.0, 29, 0.14, 48, 'pavingStone', 0, 0, 0, false, 'concrete', 4, 7);
    // Main corner neoclassical block: walkable ground arcade lobby + 3 grand limestone floors + slate mansard
    cityPushBox(lCx - 2, baseH + 0.06, lCz, 21.5, 0.12, 34, 'pavingStone', 0, 0, 0, false, 'concrete', 4, 5);
    // Ground floor outer piers & recessed lobby walls with East entrance doors
    cityPushBox(lCx - 9.8, baseH + 2.25, lCz, 0.65, 4.5, 34, 'limestone', 0, 0, 0, true, 'concrete', 5, 1);
    cityPushBox(lCx, baseH + 2.25, lCz - 16.7, 20, 4.5, 0.65, 'limestone', 0, 0, 0, true, 'concrete', 3, 1);
    cityPushBox(lCx, baseH + 2.25, lCz + 16.7, 20, 4.5, 0.65, 'limestone', 0, 0, 0, true, 'concrete', 3, 1);
    // East plaza-facing facade with 2m doorway gap into walkable corner building interior
    cityPushBox(px - 26.2, baseH + 2.25, lCz - 9.5, 0.65, 4.5, 14.5, 'limestone', 0, 0, 0, true, 'concrete', 2, 1);
    cityPushBox(px - 26.2, baseH + 2.25, lCz + 8.5, 0.65, 4.5, 15.5, 'limestone', 0, 0, 0, true, 'concrete', 2, 1);
    cityPushBox(px - 26.2, baseH + 3.45, lCz - 0.8, 0.65, 2.1, 3.2, 'limestone', 0, 0, 0, true);
    addDoor(px - 26.2, baseH, lCz - 0.8, 0, 0, 0, Math.PI * 0.5, 'door');
    footprints.push({ cx: lCx, cz: lCz, w: 21, d: 34, rotIdx: 1, minX: lCx - 10.5, maxX: lCx + 10.5, minZ: lCz - 17, maxZ: lCz + 17, arch: 'city_corner' });
    // Upper 3 limestone floors + continuous horizontal entablature ledges & mansard roof
    cityPushBox(lCx - 1.2, baseH + 10.4, lCz, 18.8, 11.8, 33.4, 'limestone', 0, 0, 0, true, 'concrete', 6, 3);
    cityPushBox(px - 25.9, baseH + 4.65, lCz, 0.9, 0.38, 34.2, 'limestone', 0, 0, 0, false, 'concrete', 5, 1);
    cityPushBox(px - 25.9, baseH + 15.7, lCz, 1.1, 0.52, 34.2, 'limestone', 0, 0, 0, false, 'concrete', 5, 1);
    // Sculptural pilasters, dark recessed window bays & subtle dusk cornice uplights
    for (let kz = -14; kz <= 14; kz += 4.6) {
      cityPushBox(px - 25.9, baseH + 10.1, lCz + kz, 0.72, 10.8, 0.88, 'limestone');
      cityPushBox(px - 26.08, baseH + 10.5, lCz + kz + 2.3, 0.22, 2.3, 2.0, 'glass');
      cityPushBox(px - 26.02, baseH + 6.8, lCz + kz + 2.3, 0.22, 2.1, 2.0, 'glass');
      if (Math.abs(kz) <= 10) cityPushBox(px - 25.68, baseH + 4.92, lCz + kz + 2.3, 0.24, 0.14, 2.8, 'warmGlow');
    }
    // Chamfered south-east corner bay + South wing curved bays facing camera
    cityPushBox(px - 33.5, baseH + 8.2, pz + 11.2, 15.5, 16.0, 9.2, 'limestone', 0, 0.38, 0, false, 'concrete', 3, 3);
    cityPushBox(px - 33.5, baseH + 4.82, pz + 15.0, 12.2, 0.16, 0.35, 'warmGlow', 0, 0.38, 0);
    // Triangular Classical Pediment on left corner building facing SE toward camera/fountain
    pushGeo(px - 27.4, lCz + 3.5, 'limestone', makeGablePrismRaw(14.5, 3.0, 1.8, px - 27.4, baseH + 15.8, lCz + 3.5, Math.PI * 0.44));
    pushGeo(px - 27.1, lCz + 3.5, 'warmGlow', makeBoxRaw(0.24, 0.20, 13.4, px - 27.1, baseH + 15.5, lCz + 3.5, 0, -Math.PI * 0.06, 0));
    // Steep Slate Mansard Roof + dormers crowning left corner block
    cityPushBox(lCx - 1.5, baseH + 17.8, lCz, 17.2, 3.4, 32.0, 'slateRoof', 0, 0, 0, false, 'concrete', 6, 2);
    cityPushBox(px - 33.2, baseH + 17.6, pz + 10.8, 14.0, 3.2, 8.2, 'slateRoof', 0, 0.38, 0, false, 'concrete', 3, 2);
    for (let kz = -12; kz <= 12; kz += 6) {
      cityPushBox(px - 28.4, baseH + 17.5, lCz + kz, 1.4, 1.7, 1.6, 'limestone');
      cityPushBox(px - 27.6, baseH + 17.5, lCz + kz, 0.14, 1.0, 1.0, 'glass');
    }

    // Twin Yellow Tower Cranes clearly silhouetted in upper-left sky above corner building roof
    const buildTowerCrane = (tx, tz, topH, jibLen, yaw) => {
      const ca = Math.cos(yaw), sa = Math.sin(yaw);
      cityPushBox(tx, baseH + topH * 0.5, tz, 0.78, topH, 0.78, 'craneYellow');
      cityPushBox(tx, baseH + topH + 1.5, tz, 0.92, 1.6, 0.92, 'craneYellow');
      // A-frame cathead tip + slender horizontal jib + counterweight
      cityPushCyl(tx, baseH + topH + 2.8, tz, 0.05, 0.48, 2.2, 4, 'craneYellow');
      const fwdX = tx + sa * (jibLen * 0.34), fwdZ = tz + ca * (jibLen * 0.34);
      const backX = tx - sa * 4.8, backZ = tz - ca * 4.8;
      cityPushBox(fwdX, baseH + topH + 0.55, fwdZ, 0.65, 0.72, jibLen, 'craneYellow', 0, yaw, 0);
      cityPushBox(backX, baseH + topH + 0.28, backZ, 1.3, 1.1, 2.8, 'darkIron', 0, yaw, 0);
      const hookX = tx + sa * (jibLen * 0.58), hookZ = tz + ca * (jibLen * 0.58);
      cityPushCyl(hookX, baseH + topH - 2.6, hookZ, 0.035, 0.035, 5.8, 6, 'darkIron');
    };
    buildTowerCrane(px - 40.5, pz - 12.0, 22.8, 23.0, 1.44);
    buildTowerCrane(px - 47.0, pz - 20.5, 20.2, 20.5, 1.68);

    // 6. Right Grand 4-Story DANOVO Heritage Terrace (6 Bays from z = pz - 38 to pz + 34)
    const rxFront = px + 16.5;
    const rxCenter = px + 25.0;
    // Continuous east granite sidewalk & walkable ground-floor arcade shell
    cityPushBox(px + 14.8, baseH + 0.07, pz - 4, 3.6, 0.14, 74, 'pavingStone', 0, 0, 0, false, 'concrete', 1, 14);
    cityPushBox(rxCenter, baseH + 0.06, pz - 4, 17.5, 0.12, 72, 'pavingStone', 0, 0, 0, false, 'concrete', 4, 14);
    // Rear & end structural walls enclosing interior Danovo arcade
    cityPushBox(px + 34.0, baseH + 2.3, pz - 4, 0.65, 4.6, 72, 'limestone', 0, 0, 0, true, 'concrete', 12, 1);
    cityPushBox(rxCenter, baseH + 2.3, pz - 40, 17.5, 4.6, 0.65, 'limestone', 0, 0, 0, true, 'concrete', 4, 1);
    cityPushBox(rxCenter, baseH + 2.3, pz + 32, 17.5, 4.6, 0.65, 'limestone', 0, 0, 0, true, 'concrete', 4, 1);
    footprints.push({ cx: rxCenter, cz: pz - 4, w: 18, d: 72, rotIdx: 3, minX: rxFront, maxX: px + 34, minZ: pz - 40, maxZ: pz + 32, arch: 'city_danovo' });

    // Continuous 2nd, 3rd, 4th-floor stone mass (west face flush at px + 16.65) & Mansard slate skyline roof
    cityPushBox(rxCenter + 0.05, baseH + 10.6, pz - 4, 16.8, 12.2, 72, 'limestone', 0, 0, 0, true, 'concrete', 12, 4);
    cityPushBox(rxCenter + 0.9, baseH + 18.6, pz - 4, 15.6, 4.0, 71, 'slateRoof', 0, 0, 0, false, 'concrete', 12, 2);
    // Heavy classical dentil cornice, carved stone balustrade & 2nd-floor string course
    cityPushBox(rxFront + 0.1, baseH + 15.9, pz - 4, 1.35, 0.72, 73.2, 'limestone', 0, 0, 0, false, 'concrete', 10, 1);
    cityPushBox(rxFront + 0.05, baseH + 16.55, pz - 4, 0.55, 0.68, 72.8, 'limestone', 0, 0, 0, false, 'concrete', 10, 1);
    cityPushBox(rxFront, baseH + 9.2, pz - 4, 0.95, 0.46, 73.0, 'limestone', 0, 0, 0, false, 'concrete', 10, 1);

    const bayCentersZ = [pz + 25, pz + 13, pz + 1, pz - 11, pz - 23, pz - 35];
    for (let b = 0; b < bayCentersZ.length; b++) {
      const bz = bayCentersZ[b];
      const isDanovoHero = (b === 1); // Foreground-right flagship entrance!
      const isCyanCanopy = (b === 1 || b === 2);

      // Ground-floor limestone rusticated bay piers + sleek dark iron shopfronts + openable doors
      cityPushBox(rxFront, baseH + 2.3, bz - 5.2, 0.75, 4.6, 1.6, 'limestone', 0, 0, 0, true);
      cityPushBox(rxFront, baseH + 2.3, bz + 5.2, 0.75, 4.6, 1.6, 'limestone', 0, 0, 0, true);
      cityPushBox(rxFront, baseH + 3.95, bz, 0.75, 1.3, 9.0, 'darkIron', 0, 0, 0, true);
      if (b === 1 || b === 2 || b === 4) {
        cityPushBox(rxFront + 0.1, baseH + 2.2, bz - 2.6, 0.25, 4.4, 3.6, 'glass');
        cityPushBox(rxFront + 0.1, baseH + 2.2, bz + 2.6, 0.25, 4.4, 3.6, 'glass');
        cityPushBox(rxFront + 0.1, baseH + 3.45, bz, 0.45, 2.1, 1.8, 'darkIron', 0, 0, 0, true);
        addDoor(rxFront, baseH, bz, 0, 0, 0, Math.PI * 0.5, 'door');
      } else {
        cityPushBox(rxFront, baseH + 2.2, bz, 0.38, 4.4, 8.8, 'darkIron', 0, 0, 0, true);
        cityPushBox(rxFront - 0.16, baseH + 2.2, bz, 0.10, 3.6, 7.6, 'glass');
      }

      // Signature Glowing Cyan Neon Canopy + Warm DANOVO Entrance Portal
      if (isCyanCanopy) {
        cityPushBox(rxFront - 1.05, baseH + 3.38, bz, 2.2, 0.24, 8.6, 'darkIron');
        cityPushBox(rxFront - 2.16, baseH + 3.38, bz, 0.14, 0.16, 8.68, 'neonCyan');
        cityPushBox(rxFront - 1.08, baseH + 3.38, bz - 4.32, 2.22, 0.16, 0.12, 'neonCyan');
        cityPushBox(rxFront - 1.08, baseH + 3.38, bz + 4.32, 2.22, 0.16, 0.12, 'neonCyan');
      }
      if (isDanovoHero) {
        cityPushBox(rxFront - 0.26, baseH + 2.86, bz, 0.14, 0.42, 3.2, 'warmGlow');
        cityPushBox(rxFront - 0.32, baseH + 2.86, bz, 0.08, 0.12, 2.4, 'goldTrim');
        cityPushBox(rxFront + 1.8, baseH + 2.9, bz, 2.4, 0.18, 4.2, 'warmGlow');
      }

      // 2nd Floor: Recessed multi-pane retail display windows + proud limestone frames & niches
      cityPushBox(rxFront - 0.02, baseH + 6.75, bz - 4.5, 0.55, 4.2, 2.6, 'limestone');
      cityPushBox(rxFront - 0.02, baseH + 6.75, bz + 4.5, 0.55, 4.2, 2.6, 'limestone');
      cityPushBox(rxFront + 0.14, baseH + 6.75, bz, 0.14, 3.2, 6.0, 'glass');
      cityPushBox(rxFront + 0.05, baseH + 6.75, bz, 0.12, 3.2, 0.14, 'darkIron');
      cityPushBox(rxFront + 0.05, baseH + 6.75, bz, 0.12, 0.14, 6.0, 'darkIron');
      if (b === 1) {
        // Subtle warm shop placard inside foreground Danovo 2nd-floor window only
        cityPushBox(rxFront + 0.24, baseH + 6.2, bz, 0.12, 0.85, 2.4, 'warmGlow');
      }
      cityPushCyl(rxFront - 0.22, baseH + 6.7, bz + 5.6, 0.22, 0.26, 2.5, 8, 'limestone');

      // 3rd Floor: Signature Palladian Arched Window Bays + Paired Classical Ionic Columns
      cityPushBox(rxFront - 0.05, baseH + 12.1, bz - 4.7, 0.65, 5.2, 2.6, 'limestone');
      cityPushBox(rxFront - 0.05, baseH + 12.1, bz + 4.7, 0.65, 5.2, 2.6, 'limestone');
      for (const colOff of [-4.45, -3.55, 3.55, 4.45]) {
        cityPushCyl(rxFront - 0.36, baseH + 12.1, bz + colOff, 0.23, 0.26, 4.5, 10, 'limestone');
        cityPushBox(rxFront - 0.36, baseH + 14.35, bz + colOff, 0.62, 0.28, 0.62, 'limestone');
      }
      // Tripartite dark Palladian glass + iron mullions + sculpted semicircular stone arch header
      cityPushBox(rxFront + 0.14, baseH + 12.1, bz, 0.14, 3.6, 5.4, 'glass');
      cityPushBox(rxFront + 0.06, baseH + 12.1, bz - 1.25, 0.14, 3.6, 0.18, 'darkIron');
      cityPushBox(rxFront + 0.06, baseH + 12.1, bz + 1.25, 0.14, 3.6, 0.18, 'darkIron');
      cityPushBox(rxFront + 0.06, baseH + 12.5, bz, 0.14, 0.14, 5.4, 'darkIron');
      if (b === 3 || b === 4) {
        cityPushBox(rxFront + 0.24, baseH + 12.1, bz, 0.10, 2.8, 2.2, 'warmGlow');
      }
      // Sculpted limestone Palladian arch surround + subtle warm cove architectural wash
      cityPushBox(rxFront - 0.22, baseH + 14.15, bz - 2.1, 0.56, 0.58, 2.2, 'limestone', 0, 0, 0);
      cityPushBox(rxFront - 0.22, baseH + 14.15, bz + 2.1, 0.56, 0.58, 2.2, 'limestone', 0, 0, 0);
      cityPushBox(rxFront - 0.24, baseH + 14.78, bz, 0.58, 0.68, 3.2, 'limestone');
      cityPushBox(rxFront - 0.14, baseH + 15.18, bz, 0.20, 0.18, 5.6, 'warmGlow');

      // 4th Floor Dormer Window + European Chimney Stack along Skyline
      cityPushBox(rxFront + 1.3, baseH + 18.2, bz, 1.8, 2.1, 2.2, 'limestone');
      cityPushBox(rxFront + 0.38, baseH + 18.2, bz, 0.14, 1.45, 1.5, 'glass');
      if (b % 2 === 0) {
        cityPushBox(rxCenter + 2.4, baseH + 21.4, bz + 3.0, 2.2, 2.6, 2.6, 'limestone');
        cityPushCyl(rxCenter + 2.4, baseH + 22.9, bz + 2.5, 0.16, 0.18, 0.65, 6, 'terracotta');
        cityPushCyl(rxCenter + 2.4, baseH + 22.9, bz + 3.5, 0.16, 0.18, 0.65, 6, 'terracotta');
      }
    }

    // 7. Background Northern Vista Buildings (flanking the north exit street behind Eros fountain)
    const addBgBlock = (bx, bz, w, d, flH, matWall, glowCount) => {
      cityPushBox(bx, baseH + flH * 0.5, bz, w, flH, d, matWall, 0, 0, 0, true);
      cityPushBox(bx, baseH + flH + 1.6, bz, w - 0.8, 3.2, d - 0.8, 'slateRoof');
      for (let iy = 3.2; iy < flH - 1.2; iy += 3.6) {
        for (let ix = -w * 0.36; ix <= w * 0.36; ix += 3.2) {
          const isWarm = Math.abs(Math.floor(ix + iy)) % 3 < glowCount;
          cityPushBox(bx + ix, baseH + iy, bz + d * 0.5 + 0.06, 1.5, 2.0, 0.12, isWarm ? 'warmGlow' : 'glass');
        }
      }
      footprints.push({ cx: bx, cz: bz, w, d, rotIdx: 0, minX: bx - w * 0.5, maxX: bx + w * 0.5, minZ: bz - d * 0.5, maxZ: bz + d * 0.5, arch: 'city_bg' });
    };
    addBgBlock(px - 22.5, pz - 48.0, 21, 16, 14.8, 'limestone', 2);
    addBgBlock(px + 13.5, pz - 50.0, 18, 16, 15.6, 'brick', 2);
    addBgBlock(px - 4.0, pz - 66.0, 20, 14, 16.5, 'limestone', 2);

    // 8. Urban Loot Pads (inside Danovo Arcade, Left Corner Lobby, Bus Shelter & Fountain Plinth)
    const addCityLoot = (lx, lyOff, lz, bIdx) => {
      lootPads.push({ x: lx, y: baseH + lyOff, z: lz, tier: 3, poiId: 'kotamini', bId: bIdx });
    };
    const lootPts = [
      [px + 20.5, 0.14, pz + 24, 0], [px + 22.5, 0.14, pz + 13, 1], [px + 21.0, 0.14, pz + 2, 2],
      [px + 23.0, 0.14, pz - 10, 3], [px + 20.5, 0.14, pz - 22, 4], [px + 15.0, 0.16, pz + 13, 5],
      [px + 15.0, 0.16, pz + 1, 6],  [lCx + 3.0, 0.14, lCz - 1, 7],  [lCx - 2.0, 0.14, lCz - 8, 8],
      [lCx - 1.5, 0.14, lCz + 8, 9], [px - 15.0, 0.08, pz + 11, 10],[px - 14.5, 0.08, pz - 2, 11],
      [fx - 5.5, 1.46, fz + 1.5, 12],[fx + 5.5, 1.46, fz - 1.5, 13],[fx, 1.46, fz + 5.6, 14],
      [px - 2.0, 0.06, pz + 20, 15], [px + 6.5, 0.06, pz + 22, 16], [px - 10.0, 0.06, pz - 22, 17],
      [px + 3.0, 0.06, pz - 24, 18], [px - 6.0, 0.06, pz - 38, 19]
    ];
    for (let i = 0; i < lootPts.length; i++) addCityLoot(lootPts[i][0], lootPts[i][1], lootPts[i][2], i);
  }

  async function build(scene, seed, csmInstance) {
    dispose(scene);
    rootGroup = new THREE.Group();
    rootGroup.name = 'PulauRajawaliBuildings';
    buckets = new Map();
    footprints.length = 0;
    lootPads.length = 0;
    doors.length = 0;
    glassPanes.length = 0;
    bridges.length = 0;

    sharedDoorGeo = new THREE.BoxGeometry(1.3, 2.28, 0.07);
    sharedDoorGeo.translate(0.65, 0, 0);
    sharedGlassGeo = new THREE.BoxGeometry(1.4, 1.1, 0.05);

    const rng = Util.mulberry32(seed + 4101);

    // 1. Place modular buildings in all 12 POIs (keeping Shooting Range Corridor clean!)
    const poiLayouts = {
      pelabuhan: [['factory', -55, -24, 0], ['factory', 42, -24, 0], ['ruko2f', -12, -16, 0], ['tower', -78, 8, 1], ['tower', 74, 8, 3], ['house1f', 16, -28, 2]],
      sukamaju:  [['house2f', -52, 8, 1], ['house1f', -50, -28, 1], ['ruko2f', -54, 44, 1], ['house1f', -22, 66, 0], ['house2f', 52, 16, 3], ['house1f', 48, -22, 3], ['ruko2f', 54, -56, 3], ['house1f', 18, 66, 0]],
      pabrik:    [['factory', -26, 0, 1], ['factory', 24, -12, 3], ['tower', -48, 34, 0], ['bunker', 46, 28, 2], ['house1f', -8, 36, 0]],
      pangkalan: [['factory', -48, -32, 0], ['factory', 18, -32, 0], ['tower', -62, -32, 0], ['bunker', 72, -22, 3], ['bunker', -72, 24, 1], ['house2f', 64, 24, 3], ['house1f', -12, 32, 2]],
      kotamini:  [],
      bukitpinus:[['house1f', -28, -18, 0], ['house1f', 26, 14, 2], ['house2f', -10, 34, 1], ['tower', 34, -28, 3]],
      menara:    [['bunker', 16, 12, 3], ['tower', -18, -14, 1], ['house1f', -22, 18, 0]],
      pantai:    [['house1f', -65, -18, 0], ['house1f', -18, -22, 0], ['house1f', 32, -16, 0], ['house1f', 75, -20, 0]],
      benteng:   [['bunker', -34, -30, 0], ['bunker', 34, -30, 0], ['bunker', 0, 36, 2], ['factory', 0, -4, 0], ['tower', -46, 22, 1], ['tower', 46, 22, 3]],
      pompa:     [['factory', 0, 26, 0], ['house1f', -42, 22, 1], ['tower', 42, -20, 3]],
      nelayan:   [['house1f', -36, -18, 0], ['house1f', -12, -24, 0], ['house1f', 16, -22, 0], ['house1f', 42, -14, 3], ['house2f', -56, 8, 1]],
      ladang:    [['factory', 24, -18, 3], ['house2f', -26, 18, 1], ['house1f', -54, -20, 0], ['house1f', 52, 22, 2]]
    };

    for (let i = 0; i < CONFIG.pois.length; i++) {
      const p = CONFIG.pois[i];
      const list = poiLayouts[p.id] || [];
      for (let j = 0; j < list.length; j++) {
        const [arch, ox, oz, rot] = list[j];
        placeBuilding(arch, p.x + ox, p.z + oz, rot, p.tier, p.id, rng);
      }
      buildSpecialLandmark(p.id, p.x, p.z);
    }

    // Giant Hollywood-style "CREATED GAME BY WIRA" landmarks overlooking Range, City & Pelabuhan
    buildHollywoodSign(-110, Math.max(World.getHeight(-110, -38) + 12, 46), -38, 0, 1.65);
    buildHollywoodSign(156, Math.max(World.getHeight(156, -52) + 14, 54), -52, 0, 1.40);
    buildHollywoodSign(-435, Math.max(World.getHeight(-435, 390) + 14, 30), 390, 0, 1.35);

    // 2. Build 5 River Bridges at main island road-river crossings
    const bridgeSpecs = [
      [-285, -188, -Math.PI * 0.25],
      [-155, -38,  Math.PI * 0.22],
      [-10,  105,  -Math.PI * 0.3],
      [175,  160,  Math.PI * 0.44],
      [420,  94,   -Math.PI * 0.34]
    ];
    for (let i = 0; i < bridgeSpecs.length; i++) {
      buildBridge(bridgeSpecs[i][0], bridgeSpecs[i][1], bridgeSpecs[i][2]);
    }

    // 3. Scatter ~26 Sporadic Rural Compounds across wilderness flats
    let placedRural = 0, tries = 0;
    while (placedRural < 26 && tries < 220) {
      tries++;
      const rx = (rng() - 0.5) * 1240;
      const rz = (rng() - 0.5) * 1240;
      if (World.isShootRangeCorridor(rx, rz) || World.isUrbanPlaza(rx, rz)) continue;
      if (World.getRiverDist(rx, rz) < 34 || World.getRoadDist(rx, rz) < 13) continue;
      const h = World.getHeight(rx, rz);
      if (h < 3.5 || h > 58) continue;
      const n = World.getNormal(rx, rz, Util.v1);
      if (1 - n.y > 0.13) continue;
      let tooClose = false;
      for (let k = 0; k < footprints.length; k++) {
        if (Math.hypot(rx - footprints[k].cx, rz - footprints[k].cz) < 28) { tooClose = true; break; }
      }
      if (tooClose) continue;
      placeBuilding(rng() > 0.72 ? 'house2f' : 'house1f', rx, rz, Math.floor(rng() * 4), 1, 'rural', rng);
      placedRural++;
    }

    World.flushDirtyTerrain?.();
    getExplosionTextures();

    // 4. Merge each (200x200 cell, material) bucket via BufferGeometryUtils.mergeGeometries
    let mergedDrawCalls = 0;
    for (const [key, geos] of buckets.entries()) {
      const matKey = key.split('|')[1];
      const mat = Assets.get(matKey);
      if (!mat || !geos.length) continue;
      const merged = BufferGeometryUtils.mergeGeometries(geos, false);
      geos.forEach(g => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      const isFX = (matKey === 'glass' || matKey === 'warmGlow' || matKey === 'neonCyan' || matKey === 'redSignal');
      mesh.castShadow = !isFX;
      mesh.receiveShadow = !isFX;
      rootGroup.add(mesh);
      mergedDrawCalls++;
    }
    buckets.clear();
    scene.add(rootGroup);
    return { drawCalls: mergedDrawCalls, buildings: footprints.length, doors: doors.length, pads: lootPads.length };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOLLYWOOD-STYLE 3D LANDMARK SIGN ("CREATED GAME BY WIRA")
  // ════════════════════════════════════════════════════════════════════════════
  const SIGN_GLYPHS = {
    C: [[0,0,1,4.5],[0,3.7,2.4,0.8],[0,0,2.4,0.8]],
    R: [[0,0,0.8,4.5],[0,3.7,2.2,0.8],[0,1.9,2.2,0.8],[1.7,2.0,0.8,2.4],[1.1,0,0.8,2.1]],
    E: [[0,0,0.8,4.5],[0,3.7,2.4,0.8],[0,1.9,2.0,0.8],[0,0,2.4,0.8]],
    A: [[0,0,0.8,4.5],[1.8,0,0.8,4.5],[0,3.7,2.6,0.8],[0,1.8,2.6,0.8]],
    T: [[0,3.7,2.8,0.8],[1.0,0,0.8,4.5]],
    D: [[0,0,0.8,4.5],[0,3.7,2.1,0.8],[0,0,2.1,0.8],[1.7,0.4,0.8,3.7]],
    G: [[0,0,0.8,4.5],[0,3.7,2.5,0.8],[0,0,2.5,0.8],[1.7,0,0.8,2.2],[1.1,1.7,1.4,0.75]],
    M: [[0,0,0.8,4.5],[2.4,0,0.8,4.5],[1.2,1.6,0.8,2.9],[0.5,3.4,1.0,1.0],[1.7,3.4,1.0,1.0]],
    B: [[0,0,0.8,4.5],[0,3.7,2.1,0.8],[0,1.9,2.0,0.8],[0,0,2.1,0.8],[1.7,2.1,0.8,2.2],[1.7,0,0.8,2.1]],
    Y: [[0,2.2,0.8,2.3],[1.8,2.2,0.8,2.3],[0.4,1.9,1.8,0.8],[0.9,0,0.8,2.1]],
    W: [[0,0,0.8,4.5],[2.4,0,0.8,4.5],[1.2,0,0.8,3.0],[0.6,0,0.9,1.0],[1.7,0,0.9,1.0]],
    I: [[0.4,0,0.85,4.5],[0,3.7,1.65,0.75],[0,0,1.65,0.75]]
  };

  function buildHollywoodSign(cx, baseY, cz, yaw = 0, scale = 1.0) {
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    const L2W = (lx, ly, lz) => [cx + lx * ca + lz * sa, baseY + ly, cz - lx * sa + lz * ca];

    const addLine = (text, yOff, sMult) => {
      const s = scale * sMult;
      const charAdv = 3.75 * s;
      const startX = -((text.length - 1) * charAdv + 2.6 * s) * 0.5;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const strokes = SIGN_GLYPHS[ch];
        if (!strokes) continue;
        const ox = startX + i * charAdv;
        for (let k = 0; k < strokes.length; k++) {
          const [sx, sy, sw, sh] = strokes[k];
          const [wx, wy, wz] = L2W(ox + (sx + sw * 0.5) * s, yOff + (sy + sh * 0.5) * s, 0);
          pushGeo(wx, wz, 'hollywoodWhite', makeBoxRaw(sw * s, sh * s, 0.9 * s, wx, wy, wz, 0, yaw, 0));
        }
        // Steel rear scaffolding tower + ground anchor strut behind each letter
        const [bx, by, bz] = L2W(ox + 1.2 * s, yOff - 1.5 * s, -1.2 * s);
        const legH = Math.max(8 * s, (baseY + yOff + 3.5 * s) - World.getHeight(bx, bz));
        pushGeo(bx, bz, 'darkIron', makeBoxRaw(0.38 * s, legH, 0.38 * s, bx, (baseY + yOff + 3.5 * s) - legH * 0.5, bz, 0, yaw, 0));
        const [rx, ry, rz] = L2W(ox + 1.2 * s, yOff + 1.8 * s, -2.0 * s);
        pushGeo(rx, rz, 'darkIron', makeBoxRaw(0.28 * s, 4.2 * s, 0.28 * s, rx, ry, rz, 0.45, yaw, 0));
        // Warm upward floodlight bar at letter base
        const [fx, fy, fz] = L2W(ox + 1.2 * s, yOff - 0.5 * s, 1.15 * s);
        pushGeo(fx, fz, 'warmGlow', makeBoxRaw(1.8 * s, 0.25 * s, 0.35 * s, fx, fy, fz, 0, yaw, 0));
      }
    };

    // Main hillside truss frame + floodlit sign face
    addLine('CREATED GAME', 9.2 * scale, 0.92);
    addLine('BY WIRA', 1.2 * scale, 1.15);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BAZOOKA DESTRUCTION — Real 3D Holes, Terrain Craters, Volumetric Fire & 3D Lightning
  // ════════════════════════════════════════════════════════════════════════════
  const activeExplosions = [];
  const LIGHTNING_SEGS = 10;
  let cachedExpTex = null;
  let sharedBreachBoxGeo = null;
  let sharedBreachRodGeo = null;
  const _expU = new THREE.Vector3();
  const _expV = new THREE.Vector3();
  const _expT = new THREE.Vector3();
  const _expUp = new THREE.Vector3();

  function getExplosionTextures() {
    if (cachedExpTex) return cachedExpTex;
    const makeNoiseTex = (size, octaves, colorFn) => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(size, size);
      const d = img.data;
      const half = size * 0.5;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = (x - half) / half;
          const dy = (y - half) / half;
          const r = Math.hypot(dx, dy);
          if (r >= 1.0) continue;
          const nx = x / size, ny = y / size;
          let f = 0, amp = 0.55, freq = 4.2;
          for (let o = 0; o < octaves; o++) {
            const v1 = Math.sin(nx * freq * Math.PI * 2 + o * 1.7) * Math.cos(ny * freq * Math.PI * 2 - o * 2.3);
            const v2 = Math.sin((nx * 0.7 + ny * 0.7) * freq * 3.14 + o);
            const v3 = VK.noise3 ? VK.noise3(nx * freq * 1.4, o * 3.7, ny * freq * 1.4) * 2 - 1 : (v1 + v2) * 0.5;
            f += v3 * amp;
            freq *= 2.05; amp *= 0.5;
          }
          const falloff = Math.pow(Math.max(0, 1 - r), 1.45);
          const turb = Util.clamp(falloff * (0.72 + f * 0.65), 0, 1);
          const [cr, cg, cb, ca] = colorFn(r, turb, f);
          const p = (y * size + x) * 4;
          d[p] = cr; d[p + 1] = cg; d[p + 2] = cb; d[p + 3] = ca;
        }
      }
      ctx.putImageData(img, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    };

    const fireTex = makeNoiseTex(96, 4, (r, turb, f) => {
      const heat = Util.clamp(turb * 1.25 - r * 0.25, 0, 1);
      const cr = Math.min(255, Math.round(255 * Math.pow(heat, 0.35)));
      const cg = Math.min(255, Math.round(255 * Math.pow(heat, 1.35) * 0.92));
      const cb = Math.min(255, Math.round(255 * Math.pow(heat, 3.2) * 0.85));
      const ca = Math.min(255, Math.round(255 * Math.pow(turb, 1.1)));
      return [cr, cg, cb, ca];
    });
    const smokeTex = makeNoiseTex(96, 4, (r, turb, f) => {
      const shade = Util.clamp(0.45 + f * 0.35 + (1 - r) * 0.25, 0.15, 0.95);
      const base = Math.round(42 * shade);
      const ca = Math.min(255, Math.round(235 * Math.pow(turb, 0.95)));
      return [base + 4, base + 2, base, ca];
    });
    const flashTex = makeNoiseTex(64, 2, (r, turb) => {
      const core = Math.pow(Math.max(0, 1 - r), 2.2);
      const glow = Math.pow(Math.max(0, 1 - r), 1.15);
      return [255, Math.round(215 + 40 * core), Math.round(110 + 145 * core), Math.round(255 * glow)];
    });
    cachedExpTex = { fireTex, smokeTex, flashTex };
    return cachedExpTex;
  }

  function generateBoltPath(bolt, ptsOut) {
    _expUp.set(Math.abs(bolt.dir.y) < 0.88 ? 0 : 1, Math.abs(bolt.dir.y) < 0.88 ? 1 : 0, 0);
    _expU.crossVectors(_expUp, bolt.dir).normalize();
    _expV.crossVectors(bolt.dir, _expU).normalize();
    let prev = null;
    for (let s = 0; s <= LIGHTNING_SEGS; s++) {
      const t = s / LIGHTNING_SEGS;
      const env = Math.sin(t * Math.PI);
      const j = bolt.jitter * env;
      const pu = (Math.random() - 0.5) * 2 * j;
      const pv = (Math.random() - 0.5) * 2 * j;
      const px = bolt.origin.x + bolt.dir.x * (bolt.len * t) + _expU.x * pu + _expV.x * pv;
      const py = bolt.origin.y + bolt.dir.y * (bolt.len * t) + _expU.y * pu + _expV.y * pv;
      const pz = bolt.origin.z + bolt.dir.z * (bolt.len * t) + _expU.z * pu + _expV.z * pv;
      ptsOut[s].set(px, py, pz);
      prev = ptsOut[s];
    }
    return prev;
  }

  function writeRibbonQuadSeg(arr, offset, p0, p1, w) {
    _expT.subVectors(p1, p0);
    const len = _expT.length();
    if (len < 1e-5) { _expT.set(0, 1, 0); } else { _expT.divideScalar(len); }
    _expUp.set(Math.abs(_expT.y) < 0.9 ? 0 : 1, Math.abs(_expT.y) < 0.9 ? 1 : 0, 0);
    _expU.crossVectors(_expUp, _expT).normalize().multiplyScalar(w);
    _expV.crossVectors(_expT, _expU).normalize().multiplyScalar(w);

    const writeTri = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      arr[offset++] = ax; arr[offset++] = ay; arr[offset++] = az;
      arr[offset++] = bx; arr[offset++] = by; arr[offset++] = bz;
      arr[offset++] = cx; arr[offset++] = cy; arr[offset++] = cz;
    };
    // Cross-quad 1 (along _expU)
    const a1x = p0.x - _expU.x, a1y = p0.y - _expU.y, a1z = p0.z - _expU.z;
    const b1x = p0.x + _expU.x, b1y = p0.y + _expU.y, b1z = p0.z + _expU.z;
    const c1x = p1.x + _expU.x, c1y = p1.y + _expU.y, c1z = p1.z + _expU.z;
    const d1x = p1.x - _expU.x, d1y = p1.y - _expU.y, d1z = p1.z - _expU.z;
    writeTri(a1x, a1y, a1z, b1x, b1y, b1z, c1x, c1y, c1z);
    writeTri(a1x, a1y, a1z, c1x, c1y, c1z, d1x, d1y, d1z);
    // Cross-quad 2 (along _expV)
    const a2x = p0.x - _expV.x, a2y = p0.y - _expV.y, a2z = p0.z - _expV.z;
    const b2x = p0.x + _expV.x, b2y = p0.y + _expV.y, b2z = p0.z + _expV.z;
    const c2x = p1.x + _expV.x, c2y = p1.y + _expV.y, c2z = p1.z + _expV.z;
    const d2x = p1.x - _expV.x, d2y = p1.y - _expV.y, d2z = p1.z - _expV.z;
    writeTri(a2x, a2y, a2z, b2x, b2y, b2z, c2x, c2y, c2z);
    writeTri(a2x, a2y, a2z, c2x, c2y, c2z, d2x, d2y, d2z);
    return offset;
  }

  function updateExplosionLightning(exp) {
    let offCore = 0, offHalo = 0;
    const tmpPts = exp.tmpPts;
    const branchBase = exp.primaryCount;
    for (let bi = 0; bi < exp.bolts.length; bi++) {
      const b = exp.bolts[bi];
      if (b.parentIdx >= 0 && exp.forkOrigins[b.parentIdx]) {
        b.origin.copy(exp.forkOrigins[b.parentIdx]);
      }
      generateBoltPath(b, tmpPts);
      if (bi < branchBase && exp.forkOrigins[bi]) {
        exp.forkOrigins[bi].copy(tmpPts[4]);
      }
      for (let s = 0; s < LIGHTNING_SEGS; s++) {
        const taper = 1.0 - (s / LIGHTNING_SEGS) * 0.72;
        const wC = b.baseWidth * taper;
        const wH = wC * 3.1;
        offCore = writeRibbonQuadSeg(exp.coreArr, offCore, tmpPts[s], tmpPts[s + 1], wC);
        offHalo = writeRibbonQuadSeg(exp.haloArr, offHalo, tmpPts[s], tmpPts[s + 1], wH);
      }
    }
    exp.coreGeo.attributes.position.needsUpdate = true;
    exp.haloGeo.attributes.position.needsUpdate = true;
  }

  function carveMeshHole(mesh, hitPos, holeR, groundFloorY, allowGroundCarve = false) {
    const geo = mesh?.geometry;
    if (!geo || geo.index || !geo.attributes?.position) return false;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    if (geo.boundingSphere && geo.boundingSphere.center.distanceTo(hitPos) > geo.boundingSphere.radius + holeR + 1.5) return false;
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (geo.boundingBox && geo.boundingBox.distanceToPoint(hitPos) > holeR + 0.6) return false;

    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal || null;
    const uvAttr = geo.attributes.uv || null;
    const colAttr = geo.attributes.color || null;
    const posArr = posAttr.array;
    const normArr = normAttr ? normAttr.array : null;
    const uvArr = uvAttr ? uvAttr.array : null;
    const colArr = colAttr ? colAttr.array : null;
    const colSize = colAttr ? colAttr.itemSize : 0;

    const outPos = [];
    const outNorm = normArr ? [] : null;
    const outUv = uvArr ? [] : null;
    const outCol = colArr ? [] : null;
    let carved = false;
    const checkR = holeR + 1.2;
    const hxMin = hitPos.x - checkR, hxMax = hitPos.x + checkR;
    const hyMin = hitPos.y - checkR, hyMax = hitPos.y + checkR;
    const hzMin = hitPos.z - checkR, hzMax = hitPos.z + checkR;

    const pushVert = (v) => {
      outPos.push(v[0], v[1], v[2]);
      if (outNorm) outNorm.push(v[3], v[4], v[5]);
      if (outUv) outUv.push(v[6], v[7]);
      if (outCol) {
        outCol.push(v[8], v[9], v[10]);
        if (colSize === 4) outCol.push(v[11]);
      }
    };
    const lerpVert = (a, b) => {
      const m = [
        (a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5,
        (a[3] + b[3]) * 0.5, (a[4] + b[4]) * 0.5, (a[5] + b[5]) * 0.5,
        (a[6] + b[6]) * 0.5, (a[7] + b[7]) * 0.5
      ];
      if (outCol) {
        m.push((a[8] + b[8]) * 0.5, (a[9] + b[9]) * 0.5, (a[10] + b[10]) * 0.5);
        if (colSize === 4) m.push((a[11] + b[11]) * 0.5);
      }
      return m;
    };

    const emitTri = (a, b, c, depth) => {
      const minX = Math.min(a[0], b[0], c[0]), maxX = Math.max(a[0], b[0], c[0]);
      const minY = Math.min(a[1], b[1], c[1]), maxY = Math.max(a[1], b[1], c[1]);
      const minZ = Math.min(a[2], b[2], c[2]), maxZ = Math.max(a[2], b[2], c[2]);
      if (maxX < hxMin || minX > hxMax ||
          maxY < hyMin || minY > hyMax ||
          maxZ < hzMin || minZ > hzMax) {
        pushVert(a); pushVert(b); pushVert(c);
        return;
      }

      const d01 = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const d12 = Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]);
      const d20 = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      const maxEdge = Math.max(d01, d12, d20);

      if (maxEdge > 1.35 && depth < 4) {
        const m01 = lerpVert(a, b);
        const m12 = lerpVert(b, c);
        const m20 = lerpVert(c, a);
        emitTri(a, m01, m20, depth + 1);
        emitTri(m01, b, m12, depth + 1);
        emitTri(m20, m12, c, depth + 1);
        emitTri(m01, m12, m20, depth + 1);
        return;
      }

      const cx = (a[0] + b[0] + c[0]) / 3;
      const cy = (a[1] + b[1] + c[1]) / 3;
      const cz = (a[2] + b[2] + c[2]) / 3;
      const nyAbs = Math.abs((a[4] + b[4] + c[4]) / 3);
      const isGroundSlab = (nyAbs > 0.72 && cy < groundFloorY + 0.30);
      const dist = Math.hypot(cx - hitPos.x, cy - hitPos.y, cz - hitPos.z);

      if ((allowGroundCarve || (!isGroundSlab && cy > groundFloorY)) && dist < holeR) {
        carved = true;
        return;
      }
      pushVert(a); pushVert(b); pushVert(c);
    };

    const readV = (vi) => {
      const p = vi * 3, u = vi * 2;
      const v = [
        posArr[p], posArr[p + 1], posArr[p + 2],
        normArr ? normArr[p] : 0, normArr ? normArr[p + 1] : 1, normArr ? normArr[p + 2] : 0,
        uvArr ? uvArr[u] : 0, uvArr ? uvArr[u + 1] : 0
      ];
      if (colArr) {
        const k = vi * colSize;
        v.push(colArr[k], colArr[k + 1], colArr[k + 2]);
        if (colSize === 4) v.push(colArr[k + 3]);
      }
      return v;
    };

    const pushRawTri = (vi0, vi1, vi2) => {
      const p0 = vi0 * 3, p1 = vi1 * 3, p2 = vi2 * 3;
      outPos.push(
        posArr[p0], posArr[p0 + 1], posArr[p0 + 2],
        posArr[p1], posArr[p1 + 1], posArr[p1 + 2],
        posArr[p2], posArr[p2 + 1], posArr[p2 + 2]
      );
      if (outNorm) {
        outNorm.push(
          normArr[p0], normArr[p0 + 1], normArr[p0 + 2],
          normArr[p1], normArr[p1 + 1], normArr[p1 + 2],
          normArr[p2], normArr[p2 + 1], normArr[p2 + 2]
        );
      }
      if (outUv) {
        const u0 = vi0 * 2, u1 = vi1 * 2, u2 = vi2 * 2;
        outUv.push(uvArr[u0], uvArr[u0 + 1], uvArr[u1], uvArr[u1 + 1], uvArr[u2], uvArr[u2 + 1]);
      }
      if (outCol) {
        const c0 = vi0 * colSize, c1 = vi1 * colSize, c2 = vi2 * colSize;
        for (const ck of [c0, c1, c2]) {
          outCol.push(colArr[ck], colArr[ck + 1], colArr[ck + 2]);
          if (colSize === 4) outCol.push(colArr[ck + 3]);
        }
      }
    };

    const vCount = posAttr.count;
    for (let i = 0; i + 2 < vCount; i += 3) {
      const p0 = i * 3, p1 = p0 + 3, p2 = p0 + 6;
      const ax = posArr[p0], bx = posArr[p1], cx = posArr[p2];
      if ((ax < hxMin && bx < hxMin && cx < hxMin) || (ax > hxMax && bx > hxMax && cx > hxMax)) { pushRawTri(i, i + 1, i + 2); continue; }
      const ay = posArr[p0 + 1], by = posArr[p1 + 1], cy = posArr[p2 + 1];
      if ((ay < hyMin && by < hyMin && cy < hyMin) || (ay > hyMax && by > hyMax && cy > hyMax)) { pushRawTri(i, i + 1, i + 2); continue; }
      const az = posArr[p0 + 2], bz = posArr[p1 + 2], cz = posArr[p2 + 2];
      if ((az < hzMin && bz < hzMin && cz < hzMin) || (az > hzMax && bz > hzMax && cz > hzMax)) { pushRawTri(i, i + 1, i + 2); continue; }
      emitTri(readV(i), readV(i + 1), readV(i + 2), 0);
    }

    if (!carved) return false;
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
    if (outNorm) ng.setAttribute('normal', new THREE.Float32BufferAttribute(outNorm, 3));
    if (outUv) ng.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2));
    if (outCol) ng.setAttribute('color', new THREE.Float32BufferAttribute(outCol, colSize));
    ng.computeBoundingSphere();
    ng.computeBoundingBox();
    mesh.geometry = ng;
    geo.dispose();
    return true;
  }

  function spawnRealisticExplosionFX(hitPos) {
    if (!rootGroup) return;
    while (activeExplosions.length >= 3) {
      disposeExplosion(activeExplosions.shift());
    }
    const tex = getExplosionTextures();
    const expGrp = new THREE.Group();
    expGrp.position.copy(hitPos);
    expGrp.userData.isBreachDebris = true;

    const ringGeo = new THREE.TorusGeometry(1, 0.085, 8, 36);
    ringGeo.rotateX(Math.PI * 0.5);

    // Use pooled blast light so NUM_POINT_LIGHTS never changes & forces synchronous shader recompilation
    Render.spawnBlastLight?.(hitPos, 0xFF922E, 32, 52, 1.45);

    // 0. Intense Initial Plasma Flash Sprite (0..0.32s)
    const flashMat = new THREE.SpriteMaterial({
      map: tex.flashTex, color: 0xFFF8D6, transparent: true, opacity: 1.0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const flashSprite = new THREE.Sprite(flashMat);
    flashSprite.position.set(0, 1.0, 0);
    flashSprite.scale.setScalar(1.8);
    expGrp.add(flashSprite);

    // 1. 8 Well-Spaced Volumetric Turbulent Fireball Sprites (crisp fire without heavy overdraw)
    const fireTints = [0xFFFFFF, 0xFFE699, 0xFFAA33, 0xFF6B1A, 0xFF4500];
    const fireLobes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.3;
      const rad = i < 2 ? 0.35 + i * 0.25 : (1.1 + (i % 3) * 0.6);
      const isAdditive = i < 4;
      const mat = new THREE.SpriteMaterial({
        map: tex.fireTex,
        color: fireTints[i < 2 ? 0 : (1 + (i % (fireTints.length - 1)))],
        transparent: true,
        opacity: isAdditive ? 0.92 : 0.88,
        blending: isAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
        rotation: (i * 0.91) % (Math.PI * 2),
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      const oy = 0.55 + (i % 4) * 0.75;
      sp.position.set(Math.cos(a) * rad, oy, Math.sin(a) * rad);
      sp.scale.setScalar(1.0);
      expGrp.add(sp);
      fireLobes.push({
        mesh: sp, mat,
        isAdditive,
        maxScale: 2.8 + (i % 4) * 0.45,
        riseSpeed: 2.0 + (i % 4) * 0.95,
        rotSpeed: (i % 2 === 0 ? 1 : -1) * (0.45 + (i % 3) * 0.2),
        radialDrift: new THREE.Vector3(Math.cos(a) * (0.75 + (i % 3) * 0.45), 0, Math.sin(a) * (0.75 + (i % 3) * 0.45)),
        delay: i < 3 ? 0 : (i - 2) * 0.02
      });
    }

    // 2. 8 Rising Cauliflower Mushroom Smoke Plumes
    const smokeLobes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const rr = i < 3 ? 0.7 + i * 0.35 : 1.7 + (i % 3) * 0.65;
      const mat = new THREE.SpriteMaterial({
        map: tex.smokeTex,
        color: i < 2 ? 0x6B4535 : (i % 2 === 0 ? 0x26211E : 0x352F2B),
        transparent: true,
        opacity: 0.0,
        rotation: (i * 1.13) % (Math.PI * 2),
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      sp.position.set(Math.cos(a) * rr * 0.45, 1.0 + i * 0.45, Math.sin(a) * rr * 0.45);
      expGrp.add(sp);
      smokeLobes.push({
        mesh: sp, mat,
        baseX: Math.cos(a) * rr,
        baseZ: Math.sin(a) * rr,
        startY: 1.0 + (i % 4) * 0.7,
        riseSpeed: 2.5 + (i % 4) * 0.65,
        rotSpeed: (i % 2 === 0 ? -1 : 1) * (0.28 + (i % 3) * 0.14),
        maxScale: 3.2 + (i % 4) * 0.55
      });
    }

    // 3. 6 Lingering Crater/Breach Flame Sprites burning in the hole/crater
    const lingeringFlames = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.2;
      const d = i < 2 ? 0.5 + i * 0.35 : 1.5 + (i % 3) * 0.75;
      const fx = Math.cos(a) * d, fz = Math.sin(a) * d;
      const ghLocal = World.getHeight(hitPos.x + fx, hitPos.z + fz) - hitPos.y;
      const mat = new THREE.SpriteMaterial({
        map: tex.fireTex,
        color: i % 2 === 0 ? 0xFF9422 : 0xFFD24D,
        transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending,
        rotation: (i * 0.9) % (Math.PI * 2),
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      sp.position.set(fx, Math.max(-3.0, Math.min(2.2, ghLocal + 0.55)), fz);
      sp.scale.set(1.1, 1.5, 1);
      expGrp.add(sp);
      lingeringFlames.push({ mesh: sp, mat, phase: i * 1.37, baseScale: 1.15 + (i % 3) * 0.32 });
    }

    // 4. Supersonic expanding shockwave torus ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xFFE3A8, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const shockRing = new THREE.Mesh(ringGeo, ringMat);
    shockRing.position.set(0, 0.45, 0);
    expGrp.add(shockRing);

    // 5. 14 Primary + 10 Forked Razor-Sharp 3D Lightning Bolts (petir)
    const primaryCount = 14;
    const forkCount = 10;
    const bolts = [];
    const forkOrigins = Array.from({ length: primaryCount }, () => new THREE.Vector3());
    for (let i = 0; i < primaryCount; i++) {
      const az = (i / primaryCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
      const el = i < 4 ? (-0.05 + (i % 2) * 0.12) : (0.28 + (i % 4) * 0.24);
      const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
      bolts.push({
        origin: new THREE.Vector3(0, i < 4 ? 0.5 : 1.1, 0),
        dir, len: i < 4 ? (6.5 + i * 0.8) : (10.0 + (i % 4) * 1.9),
        jitter: i < 4 ? 0.85 : 1.25,
        baseWidth: 0.032, parentIdx: -1
      });
    }
    for (let fi = 0; fi < forkCount; fi++) {
      const parent = bolts[fi];
      const forkDir = parent.dir.clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.22 + Math.random() * 0.55, (Math.random() - 0.5) * 0.9))
        .normalize();
      bolts.push({
        origin: new THREE.Vector3(0, 1.5, 0),
        dir: forkDir, len: 5.2 + (fi % 3) * 1.3, jitter: 0.80,
        baseWidth: 0.020, parentIdx: fi
      });
    }

    const totalFloats = bolts.length * LIGHTNING_SEGS * 36;
    const coreArr = new Float32Array(totalFloats);
    const haloArr = new Float32Array(totalFloats);
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.BufferAttribute(coreArr, 3));
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.BufferAttribute(haloArr, 3));
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF, side: THREE.DoubleSide, transparent: true, opacity: 0.98,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38E8FF, side: THREE.DoubleSide, transparent: true, opacity: 0.36,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const lightningCoreMesh = new THREE.Mesh(coreGeo, coreMat);
    const lightningHaloMesh = new THREE.Mesh(haloGeo, haloMat);
    lightningCoreMesh.frustumCulled = false;
    lightningHaloMesh.frustumCulled = false;
    expGrp.add(lightningHaloMesh, lightningCoreMesh);

    const exp = {
      group: expGrp,
      age: 0,
      maxAge: 4.0,
      boltTimer: 0,
      flashSprite,
      flashMat,
      fireLobes,
      smokeLobes,
      lingeringFlames,
      shockRing,
      ringMat,
      bolts,
      primaryCount,
      forkOrigins,
      tmpPts: Array.from({ length: LIGHTNING_SEGS + 1 }, () => new THREE.Vector3()),
      coreArr, haloArr, coreGeo, haloGeo, coreMat, haloMat,
      sharedUnitGeos: [ringGeo]
    };
    updateExplosionLightning(exp);
    rootGroup.add(expGrp);
    activeExplosions.push(exp);
    return exp;
  }

  function detonateRocket(hitPos, hitNormal, radius = 8.5, owner = 'player', targets = [], onHitTarget = null) {
    const holeR = 3.2;
    const preHitGroundH = World.getHeight(hitPos.x, hitPos.z);
    const groundFloorY = preHitGroundH + 0.25;
    const isGroundHit = ((hitNormal && hitNormal.y > 0.55) && hitPos.y <= preHitGroundH + 1.5) || hitPos.y <= preHitGroundH + 0.55;
    let holeCarved = false;
    let craterCarved = false;

    if (isGroundHit && World.carveTerrainCrater) {
      World.carveTerrainCrater(hitPos.x, hitPos.z, Math.max(5.4, radius * 0.65), 2.65);
      craterCarved = true;
    }

    const tryCarveRoot = (container) => {
      if (!container) return;
      container.traverse((o) => {
        if (o.isMesh && o.geometry && !o.geometry.index && !o.userData.isBreachDebris) {
          if (carveMeshHole(o, hitPos, holeR, groundFloorY, isGroundHit)) holeCarved = true;
        }
      });
    };
    tryCarveRoot(rootGroup);
    tryCarveRoot(Render.scene?.getObjectByName('PulauRajawaliDetail'));

    // Spawn lightweight shared 3D charred breach rim & twisted rebar + fallen masonry rubble
    if (rootGroup) {
      if (!sharedBreachBoxGeo) sharedBreachBoxGeo = new THREE.BoxGeometry(0.55, 0.40, 0.38);
      if (!sharedBreachRodGeo) sharedBreachRodGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6);
      const breachGrp = new THREE.Group();
      breachGrp.position.copy(hitPos);
      const n = (hitNormal && hitNormal.lengthSq() > 0.1) ? hitNormal.clone().normalize() : new THREE.Vector3(0, 1, 0);
      const t1 = new THREE.Vector3().crossVectors(Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), n).normalize();
      const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
      const scorchMat = Assets.get('charredScorch') || Assets.get('concrete');
      const brickMat = Assets.get('brick') || scorchMat;
      const rustMat = Assets.get('rust') || scorchMat;
      const ringChunks = 8;
      for (let i = 0; i < ringChunks; i++) {
        const a = (i / ringChunks) * Math.PI * 2 + (i % 2) * 0.18;
        const rr = holeR * 1.05 + (i % 3) * 0.14;
        const cx = t1.x * Math.cos(a) * rr + t2.x * Math.sin(a) * rr;
        const cy = t1.y * Math.cos(a) * rr + t2.y * Math.sin(a) * rr;
        const cz = t1.z * Math.cos(a) * rr + t2.z * Math.sin(a) * rr;
        if (hitPos.y + cy < groundFloorY + 0.05) continue;
        const chunk = new THREE.Mesh(sharedBreachBoxGeo, i % 3 === 0 ? brickMat : scorchMat);
        chunk.scale.set(0.85 + (i % 3) * 0.25, 0.85 + (i % 2) * 0.3, 0.9);
        chunk.position.set(cx, cy, cz);
        chunk.rotation.set(a * 0.7, a * 1.1, i * 0.5);
        chunk.userData.isBreachDebris = true;
        chunk.castShadow = false;
        breachGrp.add(chunk);
        if (i % 2 === 0) {
          const rod = new THREE.Mesh(sharedBreachRodGeo, rustMat);
          rod.position.set(cx * 0.94, cy * 0.94, cz * 0.94);
          rod.rotation.set(0.4 + a, a, 0.3);
          rod.userData.isBreachDebris = true;
          breachGrp.add(rod);
        }
      }
      // Scatter charred blasted rocks around terrain crater rim or scorch disc on elevated structural floors
      const postGh = World.getHeight(hitPos.x, hitPos.z);
      if (craterCarved) {
        for (let rb = 0; rb < 6; rb++) {
          const ang = (rb / 6) * Math.PI * 2 + 0.3;
          const distR = rb < 3 ? 2.0 + rb * 0.55 : 4.2 + (rb % 2) * 0.9;
          const rx = Math.cos(ang) * distR, rz = Math.sin(ang) * distR;
          const ry = World.getHeight(hitPos.x + rx, hitPos.z + rz) - hitPos.y;
          const bld = new THREE.Mesh(sharedBreachBoxGeo, scorchMat);
          bld.scale.set(1.0 + (rb % 2) * 0.35, 0.85, 1.1);
          bld.position.set(rx, ry + 0.12, rz);
          bld.rotation.set(rb * 0.4, ang, rb * 0.6);
          bld.userData.isBreachDebris = true;
          breachGrp.add(bld);
        }
      } else if (hitPos.y - postGh < 4.5) {
        const crater = new THREE.Mesh(new THREE.CylinderGeometry(holeR * 0.85, holeR * 1.05, 0.12, 16), scorchMat);
        crater.position.set(0, postGh - hitPos.y + 0.06, 0);
        crater.userData.isBreachDebris = true;
        breachGrp.add(crater);
      }
      rootGroup.add(breachGrp);
      spawnRealisticExplosionFX(hitPos);
    }

    // Carve physical collision so player & bots can walk or shoot right through the hole
    Physics.carveExplosionHole?.(hitPos, holeR * 0.95);
    for (let i = 0; i < glassPanes.length; i++) {
      const gp = glassPanes[i];
      if (!gp.shattered && Math.hypot(gp.x - hitPos.x, gp.y - hitPos.y, gp.z - hitPos.z) < radius * 1.1) {
        gp.shatter();
      }
    }
    for (let i = 0; i < doors.length; i++) {
      const dr = doors[i];
      const dDoor = Math.hypot(dr.cx - hitPos.x, dr.cy - hitPos.y, dr.cz - hitPos.z);
      if (dDoor < holeR * 1.15) {
        dr.isOpen = true;
        dr.animT = 1;
        dr.pivot.visible = false;
        dr.collider.disabled = true;
      } else if (!dr.isOpen && dDoor < radius * 0.85) {
        dr.toggle(false);
      }
    }

    // Explosive thunder + Chidori lightning sound + debris particles (no redundant sphere flashes)
    AudioSys.playExplosion?.(hitPos, false);
    AudioSys.playChidori?.('burst', hitPos);
    for (let p = 0; p < 36; p++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 5 + Math.random() * 17;
      const col = p < 18 ? 0xFF7A1A : p < 28 ? 0x80F5FF : p < 42 ? 0x6B3E26 : 0x26282B;
      Ballistics.spawnParticle?.(
        hitPos,
        new THREE.Vector3(Math.cos(a) * spd, 3.0 + Math.random() * 13, Math.sin(a) * spd),
        col,
        3.0 + Math.random() * 2.8,
        0.65 + Math.random() * 0.75,
        p < 28 ? 3.5 : 15
      );
    }

    // Splash damage to AI bots & range targets
    if (Array.isArray(targets)) {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t || !t.alive) continue;
        const d = Math.hypot(t.pos.x - hitPos.x, (t.pos.y + 1.0) - hitPos.y, t.pos.z - hitPos.z);
        if (d < radius) {
          const dmg = 280 * (1 - d / radius);
          const dir = new THREE.Vector3(t.pos.x - hitPos.x, 0.5, t.pos.z - hitPos.z).normalize();
          if (onHitTarget) onHitTarget(t, dmg, 'chest', d, hitPos, dir, owner);
          else if (t.isBot) AI.applyBotDamage?.(t, dmg, 'chest', d, hitPos, dir, owner);
        }
      }
    }

    if (typeof UI !== 'undefined' && owner === 'player' && (holeCarved || craterCarved)) {
      UI.showAlertBanner?.(
        holeCarved
          ? 'LEDAKAN BASOKA! Dinding Hancur Berlubang + Api & Petir!'
          : 'TANAH HANCUR BERKUBANG! Ledakan Api & Petir Menggelegar!',
        2.4
      );
    }
    return { holeCarved, craterCarved };
  }

  function findNearestDoor(pos, maxDist = 2.6) {
    let best = null, bestD = maxDist;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      const dist = Math.hypot(pos.x - d.cx, pos.z - d.cz);
      if (dist < bestD && Math.abs((pos.y + 1.1) - d.cy) < 2.1) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  function disposeExplosion(exp) {
    if (!exp || !exp.group) return;
    if (exp.group.parent) exp.group.parent.remove(exp.group);
    exp.coreGeo?.dispose();
    exp.haloGeo?.dispose();
    exp.coreMat?.dispose();
    exp.haloMat?.dispose();
    exp.ringMat?.dispose();
    exp.flashMat?.dispose();
    if (exp.sharedUnitGeos) exp.sharedUnitGeos.forEach(g => g.dispose());
    for (let i = 0; i < exp.fireLobes.length; i++) exp.fireLobes[i].mat.dispose();
    for (let i = 0; i < exp.smokeLobes.length; i++) exp.smokeLobes[i].mat.dispose();
    for (let i = 0; i < exp.lingeringFlames.length; i++) exp.lingeringFlames[i].mat.dispose();
  }

  function update(dt, elapsed) {
    if (radarMesh) radarMesh.rotation.y += dt * 0.9;
    if (beaconMesh) beaconMesh.visible = Math.sin(elapsed * 4.2) > 0.1;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      const target = d.isOpen ? 1 : 0;
      if (Math.abs(d.animT - target) > 0.002) {
        d.animT = Util.lerp(d.animT, target, Math.min(1, dt * 11));
        d.pivot.rotation.y = d.baseYaw + d.animT * Math.PI * 0.54;
      }
    }

    const adt = Math.min(0.05, Math.max(0.001, dt || 0.016));
    for (let ei = activeExplosions.length - 1; ei >= 0; ei--) {
      const exp = activeExplosions[ei];
      exp.age += adt;
      const age = exp.age;

      // 0. Rapid Initial Plasma Flash (0..0.28s, capped scale 5.2 to limit overdraw)
      if (exp.flashSprite && exp.flashMat) {
        const flT = Util.clamp(age / 0.28, 0, 1);
        exp.flashSprite.visible = flT < 1;
        if (flT < 1) {
          exp.flashSprite.scale.setScalar(1.6 + Math.sin(flT * Math.PI * 0.5) * 3.6);
          exp.flashMat.opacity = (1 - flT) * (1 - flT);
        }
      }

      // 1. Shockwave torus ring (0..0.44s)
      const ringT = Util.clamp(age / 0.44, 0, 1);
      exp.shockRing.visible = ringT < 1;
      if (ringT < 1) {
        const rs = 0.8 + ringT * 17.5;
        exp.shockRing.scale.set(rs, rs, 1);
        exp.ringMat.opacity = (1 - ringT) * 0.8;
      }

      // 2. Volumetric Turbulent Fireball Sprites (0..1.45s)
      for (let i = 0; i < exp.fireLobes.length; i++) {
        const fl = exp.fireLobes[i];
        const fAge = Math.max(0, age - fl.delay);
        const ft = Util.clamp(fAge / 1.45, 0, 1);
        fl.mesh.visible = ft < 1;
        if (ft < 1) {
          const grow = Math.min(1, Math.pow(ft * 4.8, 0.48));
          const fadeOut = ft > 0.32 ? 1 - Util.smoothstep(0.32, 1.0, ft) : 1.0;
          const sc = fl.maxScale * grow * (0.90 + 0.12 * Math.sin(elapsed * 22 + i));
          fl.mesh.scale.set(sc, sc * 1.12, 1);
          fl.mesh.position.y += fl.riseSpeed * adt * (1 - ft * 0.45);
          fl.mesh.position.x += fl.radialDrift.x * adt * (1 - ft * 0.65);
          fl.mesh.position.z += fl.radialDrift.z * adt * (1 - ft * 0.65);
          fl.mat.rotation += fl.rotSpeed * adt;
          fl.mat.opacity = (fl.isAdditive ? 0.92 : 0.88) * fadeOut;
        }
      }

      // 3. Billowing Mushroom Smoke Plume (0.04..4.0s)
      for (let i = 0; i < exp.smokeLobes.length; i++) {
        const sm = exp.smokeLobes[i];
        const st = Util.clamp(age / 4.0, 0, 1);
        sm.mesh.visible = st < 1;
        if (st < 1) {
          const expand = Util.clamp(0.2 + st * 1.65, 0.2, 1.4);
          const sc = sm.maxScale * expand;
          sm.mesh.scale.set(sc, sc * 0.92, 1);
          const mushroomSpread = 0.8 + st * 1.45;
          sm.mesh.position.set(
            sm.baseX * mushroomSpread,
            sm.startY + st * sm.riseSpeed * 3.4,
            sm.baseZ * mushroomSpread
          );
          sm.mat.rotation += sm.rotSpeed * adt;
          sm.mat.opacity = st < 0.14 ? (st / 0.14) * 0.82 : (1 - Util.smoothstep(0.45, 1.0, st)) * 0.82;
        }
      }

      // 4. Razor-Sharp Branching Lightning Bolts / Petir (0..1.25s)
      const ltT = Util.clamp(age / 1.25, 0, 1);
      const showBolts = ltT < 1;
      exp.coreMat.visible = showBolts;
      exp.haloMat.visible = showBolts;
      if (showBolts) {
        exp.boltTimer += adt;
        if (exp.boltTimer >= 0.04) {
          exp.boltTimer = 0;
          updateExplosionLightning(exp);
        }
        const flicker = 0.6 + 0.4 * Math.sin(age * 74.0);
        const fade = 1 - Util.smoothstep(0.48, 1.0, ltT);
        exp.coreMat.opacity = 0.98 * fade * flicker;
        exp.haloMat.opacity = 0.38 * fade * flicker;
      }

      // 5. Lingering Turbulent Crater/Wall Flames (0..maxAge)
      const flameFade = age > exp.maxAge - 1.1 ? Math.max(0, (exp.maxAge - age) / 1.1) : 1.0;
      for (let i = 0; i < exp.lingeringFlames.length; i++) {
        const lf = exp.lingeringFlames[i];
        const flickerY = 0.78 + 0.38 * Math.sin(elapsed * 20 + lf.phase);
        const flickerX = 0.86 + 0.2 * Math.cos(elapsed * 16 + lf.phase);
        lf.mesh.scale.set(lf.baseScale * flickerX, lf.baseScale * flickerY * flameFade, 1);
        lf.mat.rotation = Math.sin(elapsed * 8 + lf.phase) * 0.25;
        lf.mat.opacity = 0.78 * flameFade;
      }

      if (age >= exp.maxAge) {
        disposeExplosion(exp);
        activeExplosions.splice(ei, 1);
      }
    }
  }

  function dispose(scene) {
    for (let i = 0; i < activeExplosions.length; i++) {
      disposeExplosion(activeExplosions[i]);
    }
    activeExplosions.length = 0;
    if (cachedExpTex) {
      cachedExpTex.fireTex?.dispose();
      cachedExpTex.smokeTex?.dispose();
      cachedExpTex.flashTex?.dispose();
      cachedExpTex = null;
    }
    if (rootGroup) {
      rootGroup.traverse((o) => { if (o.geometry && o.geometry !== sharedDoorGeo && o.geometry !== sharedGlassGeo && o.geometry !== sharedBreachBoxGeo && o.geometry !== sharedBreachRodGeo) o.geometry.dispose(); });
      scene.remove(rootGroup);
      rootGroup = null;
    }
    if (sharedDoorGeo) { sharedDoorGeo.dispose(); sharedDoorGeo = null; }
    if (sharedGlassGeo) { sharedGlassGeo.dispose(); sharedGlassGeo = null; }
    if (sharedBreachBoxGeo) { sharedBreachBoxGeo.dispose(); sharedBreachBoxGeo = null; }
    if (sharedBreachRodGeo) { sharedBreachRodGeo.dispose(); sharedBreachRodGeo = null; }
    radarMesh = null; beaconMesh = null;
  }

  function setTimeOfDay(todKey) {
    const isNight = todKey === 'malam';
    const isDusk = todKey === 'sore';
    const gMat = Assets.get('glass');
    if (gMat) {
      gMat.emissive?.setHex(isNight ? 0x5D7CA6 : (isDusk ? 0x6B82A8 : 0x000000));
      gMat.emissiveIntensity = isNight ? 0.22 : (isDusk ? 0.12 : 0.0);
      gMat.opacity = isNight ? 0.62 : 0.54;
    }
    const wg = Assets.get('warmGlow');
    if (wg) wg.emissiveIntensity = isNight ? 1.55 : (isDusk ? 1.28 : (todKey === 'pagi' ? 0.16 : 0.08));
    const nc = Assets.get('neonCyan');
    if (nc) nc.emissiveIntensity = isNight ? 2.15 : (isDusk ? 1.75 : (todKey === 'pagi' ? 0.90 : 0.65));
    const rs = Assets.get('redSignal');
    if (rs) rs.emissiveIntensity = isNight || isDusk ? 1.85 : 1.05;
  }

  function setNightMode(isNight) {
    setTimeOfDay(isNight ? 'malam' : 'siang');
  }

  return {
    build, update, dispose, findNearestDoor, setNightMode, setTimeOfDay, detonateRocket,
    get footprints() { return footprints; },
    get lootPads() { return lootPads; },
    get doors() { return doors; },
    get glassPanes() { return glassPanes; },
    get bridges() { return bridges; },
    get activeExplosions() { return activeExplosions; }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// WORLDFLORA — pohon berdaun kartu-alpha + angin, hutan berkelompok, semak,
//              batu berlumut, buluh tepi sungai, kabel listrik, mobil karat,
//              padang rumput yang hidup (pudar jarak, kepadatan berbintik)
// ════════════════════════════════════════════════════════════════════════════
const WorldFlora = (() => {
  let floraGroup = null;
  let grassMesh = null;
  let grassMat = null;
  let semakGeo = null, semakMat = null;
  const grassSlots = [];
  const lastGrassCenter = new THREE.Vector3(9999, 0, 9999);
  const floraPositions = [];
  let owned = [];
  const dummy = new THREE.Object3D();
  const tmpCol = new THREE.Color();

  // ── penyusun kanopi ───────────────────────────────────────────────────────
  function cardsEllipsoid(parts, rng, n, c, r, size) {
    for (let k = 0; k < n; k++) {
      let ux, uy, uz, l;
      do { ux = rng() * 2 - 1; uy = rng() * 2 - 1; uz = rng() * 2 - 1; l = ux * ux + uy * uy + uz * uz; } while (l > 1 || l < 0.05);
      l = Math.sqrt(l); ux /= l; uy /= l; uz /= l;
      if (uy < -0.45) uy = -0.45 + rng() * 0.2;
      const k2 = 0.82 + rng() * 0.22;
      const pos = new THREE.Vector3(c.x + ux * r.x * k2, c.y + uy * r.y * k2, c.z + uz * r.z * k2);
      const dir = new THREE.Vector3(ux, uy + 0.2, uz).normalize();
      parts.push(VK.card(size * (0.8 + rng() * 0.5), size * (0.8 + rng() * 0.5), pos, dir, rng() * Math.PI * 2));
    }
  }
  function cardsRing(parts, rng, n, y, radius, size) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng() * 0.5;
      const r = radius * (0.75 + rng() * 0.3);
      const pos = new THREE.Vector3(Math.cos(a) * r, y + (rng() - 0.5) * 0.5, Math.sin(a) * r);
      const dir = new THREE.Vector3(Math.cos(a), -0.25 + rng() * 0.2, Math.sin(a)).normalize();
      parts.push(VK.card(size * (0.85 + rng() * 0.4), size * (0.85 + rng() * 0.4), pos, dir, (rng() - 0.5) * 1.2));
    }
  }
  function blob(r, sx, sy, sz, x, y, z, disp, freq, seed) {
    const g = VK.toGeo(new THREE.IcosahedronGeometry(r, 1).scale(sx, sy, sz).translate(x, y, z));
    VK.displace(g, disp, freq, seed);
    return VK.setUV(g, 0.5, 0.5);
  }
  function frondGeo(L, W, rise, droop, yaw, at) {
    const g = new THREE.PlaneGeometry(W, L, 2, 9);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + L * 0.5) / L;
      const x = p.getX(i);
      const wf = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.05)), 0.65);
      const outD = t * L * Math.cos(rise);
      const up = t * L * Math.sin(rise) - droop * t * t * L * 0.6;
      p.setXYZ(i, x * wf, up + Math.abs(x) * 0.5 * (1 - t * 0.5), outD);
    }
    g.rotateY(yaw);
    g.translate(at.x, at.y, at.z);
    g.computeVertexNormals();
    const out = VK.toGeo(g);
    const uv = out.attributes.uv, c = VK.ensureColor(out).attributes.color;
    for (let i = 0; i < c.count; i++) { const k = 0.58 + 0.5 * uv.getY(i); c.setXYZ(i, k, k, k * 0.92); }
    return out;
  }

  function buildSpecies(csm) {
    const rng = Util.mulberry32(5150);
    const tex = { broad: VK.makeFoliageTex('broad'), needle: VK.makeFoliageTex('needle'), frond: VK.makeFoliageTex('frond'), reed: VK.makeFoliageTex('reed') };
    owned.push(...Object.values(tex));
    const mkLeaf = (map, tint, H, flutter) => {
      const m = new THREE.MeshStandardMaterial({ map, color: tint, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.86, metalness: 0, vertexColors: true });
      VK.withCSM(m, (s) => VK.injectWind(s, H, flutter), csm, 'vkLeafWind');
      owned.push(m);
      return m;
    };
    const barkBase = Assets.get('bark');
    const mkBark = (H) => {
      const m = barkBase.clone();
      m.vertexColors = true;
      VK.withCSM(m, (s) => VK.injectWind(s, H, 0), csm, 'vkBarkWind');
      owned.push(m);
      return m;
    };
    const cyl = (rt, rb, h, seg, tx, ty, tz, rz = 0) => VK.toGeo(new THREE.CylinderGeometry(rt, rb, h, seg).rotateZ(rz).translate(tx, ty, tz));

    // 1. PINUS — batang lurus + 4 tingkat jarum
    const pTrunk = VK.merge([cyl(0.12, 0.34, 9.8, 8, 0, 4.9, 0), cyl(0.34, 0.52, 0.55, 8, 0, 0.27, 0)]);
    VK.displace(pTrunk, 0.05, 2.2, 1.3); VK.darkenBase(pTrunk, 2.2);
    const pParts = [];
    [[2.3, 3.2, 5.2], [1.9, 2.9, 7.1], [1.4, 2.6, 8.9], [0.85, 2.0, 10.5]].forEach(([r, h, y], ti) => {
      const g = VK.toGeo(new THREE.ConeGeometry(r * 0.92, h, 9, 2).translate(0, y, 0));
      VK.displace(g, 0.28, 1.4, ti * 3.1);
      pParts.push(VK.setUV(g, 0.5, 0.5));
      cardsRing(pParts, rng, [14, 12, 9, 6][ti], y - h * 0.32, r * 0.88, 1.7 - ti * 0.18);
    });
    const pCan = VK.merge(pParts);
    VK.fluff(pCan, 0, 7.2, 0, 0.55, true);
    VK.shadeCanopy(pCan, 0, 7.4, 0, 3.4, 3.6, 11.5);

    // 2. JATI — batang bercabang + kanopi lebar
    const jTrunk = VK.merge([
      cyl(0.26, 0.42, 4.8, 7, 0, 2.4, 0), cyl(0.40, 0.55, 0.5, 7, 0, 0.25, 0),
      cyl(0.14, 0.22, 2.4, 6, -0.55, 5.2, 0, 0.42), cyl(0.14, 0.22, 2.4, 6, 0.55, 5.2, 0, -0.42)
    ]);
    VK.displace(jTrunk, 0.06, 2.0, 4.1); VK.darkenBase(jTrunk, 2.0);
    const jParts = [blob(2.2, 1.25, 0.72, 1.15, 0, 6.8, 0, 0.5, 0.9, 1), blob(1.6, 1.1, 0.7, 1.1, -1.3, 5.9, 0.4, 0.4, 0.9, 2), blob(1.6, 1.1, 0.7, 1.1, 1.2, 6.0, -0.5, 0.4, 0.9, 3)];
    cardsEllipsoid(jParts, rng, 64, { x: 0, y: 6.3, z: 0 }, { x: 2.9, y: 1.7, z: 2.6 }, 1.35);
    const jCan = VK.merge(jParts);
    VK.fluff(jCan, 0, 6.2, 0, 0.3, false);
    VK.shadeCanopy(jCan, 0, 6.2, 0, 3.4, 4.4, 8.4);

    // 3. KELAPA — batang melengkung + mahkota pelepah
    const kSegs = [];
    for (let s = 0; s < 6; s++) {
      kSegs.push(VK.toGeo(new THREE.CylinderGeometry(0.2 - s * 0.015, 0.23 - s * 0.015, 1.65, 7).rotateZ(-0.04 * s).translate(s * s * 0.04, 0.8 + s * 1.48, 0)));
    }
    kSegs.push(cyl(0.3, 0.42, 0.5, 7, 0, 0.25, 0));
    const kTrunk = VK.merge(kSegs);
    VK.displace(kTrunk, 0.04, 2.5, 6.6); VK.darkenBase(kTrunk, 1.6);
    const kParts = [];
    const crown = new THREE.Vector3(1.0, 9.15, 0);
    for (let f = 0; f < 10; f++) kParts.push(frondGeo(3.4 + rng() * 0.9, 1.6, 0.45 + rng() * 0.35 - (f % 2) * 0.25, 0.55 + rng() * 0.35, (f / 10) * Math.PI * 2 + rng() * 0.3, crown));
    for (let f = 0; f < 4; f++) kParts.push(frondGeo(2.4, 1.1, 1.15, 0.1, rng() * Math.PI * 2, crown));
    const kCan = VK.merge(kParts);

    // 4. MANGGA — kubah rimbun
    const mTrunk = VK.merge([cyl(0.28, 0.46, 3.4, 8, 0, 1.7, 0), cyl(0.46, 0.64, 0.5, 8, 0, 0.25, 0)]);
    VK.displace(mTrunk, 0.06, 2.0, 8.2); VK.darkenBase(mTrunk, 1.8);
    const mParts = [blob(2.5, 1.2, 0.88, 1.2, 0, 4.7, 0, 0.55, 0.8, 4), blob(1.6, 1, 1, 1, 1.3, 4.1, 0.8, 0.4, 0.9, 5), blob(1.6, 1, 1, 1, -1.2, 4.2, -0.8, 0.4, 0.9, 6)];
    cardsEllipsoid(mParts, rng, 64, { x: 0, y: 4.6, z: 0 }, { x: 3.0, y: 2.1, z: 3.0 }, 1.25);
    const mCan = VK.merge(mParts);
    VK.fluff(mCan, 0, 4.5, 0, 0.3, false);
    VK.shadeCanopy(mCan, 0, 4.5, 0, 3.4, 2.4, 6.6);

    // 5. SEMAK
    const sParts = [blob(0.8, 1.35, 0.9, 1.2, 0, 0.65, 0, 0.3, 1.6, 7), blob(0.55, 1, 1, 1, 0.55, 0.5, 0.3, 0.2, 1.6, 8), blob(0.55, 1, 1, 1, -0.5, 0.5, -0.3, 0.2, 1.6, 9)];
    cardsEllipsoid(sParts, rng, 16, { x: 0, y: 0.7, z: 0 }, { x: 1.1, y: 0.6, z: 1.0 }, 0.72);
    const sCan = VK.merge(sParts);
    VK.fluff(sCan, 0, 0.6, 0, 0.3, false);
    VK.shadeCanopy(sCan, 0, 0.6, 0, 1.3, 0.1, 1.3);

    const sp = {
      pinus: { trunk: pTrunk, canopy: pCan, bark: mkBark(11.5), leaf: mkLeaf(tex.needle, 0xA9C79A, 11.5, 1) },
      jati: { trunk: jTrunk, canopy: jCan, bark: mkBark(9), leaf: mkLeaf(tex.broad, 0xE6F2B8, 9, 1) },
      kelapa: { trunk: kTrunk, canopy: kCan, bark: mkBark(10), leaf: mkLeaf(tex.frond, 0xDCEFA4, 10, 1) },
      mangga: { trunk: mTrunk, canopy: mCan, bark: mkBark(7.5), leaf: mkLeaf(tex.broad, 0xC9E6A0, 7.5, 1) },
      semak: { canopy: sCan, leaf: mkLeaf(tex.broad, 0xD6EEAA, 1.4, 1) },
      reedTex: tex.reed
    };
    return sp;
  }

  function makeRockGeos() {
    const out = [];
    [[0, 1.15, 1], [1, 1.0, 2], [2, 1.25, 3]].forEach(([k, r, seed]) => {
      const raw = k === 1 ? new THREE.DodecahedronGeometry(r, 1) : new THREE.IcosahedronGeometry(r, 1);
      const g = VK.toGeo(raw);
      VK.displace(g, 0.75, 0.9, seed * 5.3);
      VK.displace(g, 0.22, 3.1, seed * 9.1);
      g.computeVertexNormals(); // non-indexed → facet datar = batu bersudut
      VK.ensureColor(g);
      const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        const moss = VK.smooth(0.55, 0.92, n.getY(i));
        const base = (0.72 + 0.4 * VK.noise3(p.getX(i) * 2, p.getY(i) * 2, p.getZ(i) * 2)) * (0.7 + 0.3 * VK.smooth(-0.8, 0.6, p.getY(i)));
        c.setXYZ(i, base * (1 - moss * 0.38), base * (1 + moss * 0.12), base * (1 - moss * 0.5));
      }
      out.push(g);
    });
    return out;
  }

  function isClearOfStructures(x, z, margin = 3.5) {
    if (World.isShootRangeCorridor(x, z) || World.isUrbanPlaza(x, z)) return false;
    if (World.getRoadDist(x, z) < 5.5) return false;
    const fps = WorldBuildings.footprints;
    for (let i = 0; i < fps.length; i++) {
      const f = fps[i];
      if (x >= f.minX - margin && x <= f.maxX + margin && z >= f.minZ - margin && z <= f.maxZ + margin) return false;
    }
    return true;
  }

  function tintFor(mode, cv) {
    if (mode === 'leaf') {
      let r = 0.92 + (cv[0] - 0.5) * 0.24 + (cv[2] - 0.5) * 0.08, g = 0.97 + (cv[1] - 0.5) * 0.22, b = 0.84 + (cv[2] - 0.5) * 0.26;
      if (cv[0] > 0.94) { r *= 1.28; g *= 0.94; b *= 0.55; } // sesekali daun menguning
      return [r, g, b];
    }
    if (mode === 'bark') { const v = 0.82 + cv[1] * 0.32; return [v * 1.02, v, v * 0.96]; }
    const v = 0.84 + cv[1] * 0.3; return [v, v, v * 1.02];
  }

  function spawnInstanced(geo, mat, items, o = {}) {
    if (!items.length || !floraGroup) return null;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    im.castShadow = o.cast !== false; im.receiveShadow = true;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(it.lx || 0, it.rot || 0, it.lz || 0);
      const s = it.scale || 1;
      dummy.scale.set(it.sx || s, it.sy || s, it.sz || s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (o.tint && it.cv) { const t = tintFor(o.tint, it.cv); im.setColorAt(i, tmpCol.setRGB(t[0], t[1], t[2])); }
      if (o.colRad > 0) {
        const r = o.colRad * (it.sx || s);
        Physics.addCollider({ minX: it.x - r, maxX: it.x + r, minY: it.y, maxY: it.y + o.colH * s, minZ: it.z - r, maxZ: it.z + r, mat: o.colMat || 'wood', tag: 'world' });
      }
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    floraGroup.add(im);
    return im;
  }

  function makeTuftTex() {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const tctx = cv.getContext('2d');
    tctx.clearRect(0, 0, 256, 128);
    const tRng = Util.mulberry32(99123);
    for (let bi = 0; bi < 38; bi++) {
      const bx = 10 + (bi / 37) * 236 + (tRng() - 0.5) * 6;
      const h = 56 + tRng() * 68;
      const lean = (tRng() - 0.5) * 44;
      const bw = 3.0 + tRng() * 2.8;
      const tx = bx + lean, ty = 128 - h;
      const cx = bx + lean * 0.38, cy = 128 - h * 0.55;
      const grad = tctx.createLinearGradient(bx, 128, tx, ty);
      grad.addColorStop(0, '#34501F');
      grad.addColorStop(0.45, '#5D8135');
      grad.addColorStop(0.85, '#86AD4C');
      grad.addColorStop(1, '#B3C97A');
      tctx.fillStyle = grad;
      tctx.beginPath();
      tctx.moveTo(bx - bw, 128);
      tctx.quadraticCurveTo(cx - bw * 0.4, cy, tx, ty);
      tctx.quadraticCurveTo(cx + bw * 0.4, cy, bx + bw, 128);
      tctx.closePath();
      tctx.fill();
      if (bi % 8 === 3) {
        tctx.fillStyle = ['#F2E27A', '#F4F0DA', '#E9A6C4', '#C9B8F0'][(bi >> 3) % 4];
        tctx.beginPath(); tctx.arc(tx, ty + 2, 2.9, 0, Math.PI * 2); tctx.fill();
      }
    }
    return VK.dataTexFromCanvas(cv, [80, 120, 50]);
  }

  async function build(scene, seed, csmInstance, grassDist) {
    dispose(scene);
    floraGroup = new THREE.Group();
    floraGroup.name = 'PulauRajawaliFlora';
    floraPositions.length = 0;
    const rng = Util.mulberry32(seed + 7711);

    const S = buildSpecies(csmInstance);
    semakGeo = S.semak.canopy; semakMat = S.semak.leaf;
    await Util.nextFrame();

    const pools = { pinus: [], jati: [], kelapa: [], mangga: [], semak: [], rocks: [], poles: [], cars: [], reeds: [], logs: [], stumps: [] };
    const mk = (x, y, z, scale, extra) => Object.assign({ x, y, z, rot: rng() * Math.PI * 2, scale, lx: (rng() - 0.5) * 0.07, lz: (rng() - 0.5) * 0.07, cv: [rng(), rng(), rng()] }, extra);
    const seedOff = (seed % 997) * 0.13;
    const forestAt = (x, z) => VK.noise3(x * 0.0065 + seedOff, 0.5, z * 0.0065) * 0.65 + VK.noise3(x * 0.021, 3.7 + seedOff, z * 0.021) * 0.35;

    // Pohon & semak berkelompok: hutan lebat ↔ padang terbuka
    for (let i = 0; i < 9000; i++) {
      const x = (rng() - 0.5) * 1420;
      const z = (rng() - 0.5) * 1420;
      const h = World.getHeight(x, z);
      if (h < 1.0) continue;
      if (World.getRiverDistFast(x, z) < 20) continue;
      const n = World.getNormal(x, z, Util.v1);
      if (1 - n.y > 0.36) continue;
      if (!isClearOfStructures(x, z, 4.2)) continue;

      const fd = VK.smooth(0.36, 0.62, forestAt(x, z));
      const pTree = 0.10 + fd * 0.9;
      const scale = 0.82 + rng() * 0.45;
      if (h < 7.0 && pools.kelapa.length < 260) {
        if (rng() < 0.35 + fd * 0.4) pools.kelapa.push(mk(x, h - 0.15, z, scale));
      } else if (h >= 28 && pools.pinus.length < 400) {
        if (rng() < pTree) pools.pinus.push(mk(x, h - 0.15, z, scale));
      } else if (h >= 5 && h < 42 && rng() < 0.30 && pools.jati.length < 340 && rng() < pTree) {
        pools.jati.push(mk(x, h - 0.15, z, scale));
      } else if (h >= 4 && h < 28 && rng() < 0.28 && pools.mangga.length < 240 && rng() < pTree) {
        pools.mangga.push(mk(x, h - 0.15, z, scale));
      } else if (h >= 2.2 && pools.semak.length < 1100 && rng() < 0.30 + (1 - fd) * 0.30) {
        pools.semak.push(mk(x, h - 0.1, z, 0.75 + rng() * 0.6));
      }
    }
    await Util.nextFrame();

    for (let i = 0; i < 900 && pools.rocks.length < 240; i++) {
      const x = (rng() - 0.5) * 1420, z = (rng() - 0.5) * 1420;
      const h = World.getHeight(x, z);
      if (h < 0.5) continue;
      if (!isClearOfStructures(x, z, 3.8)) continue;
      pools.rocks.push(mk(x, h - 0.1, z, 1, { sx: 1.0 + rng() * 1.9, sy: 0.7 + rng() * 1.3, sz: 1.0 + rng() * 1.8, lx: 0, lz: 0, v: pools.rocks.length % 3 }));
    }

    // Tiang listrik di sepanjang jalan
    for (let i = 0; i < World.ROAD_SEGMENTS.length; i++) {
      const [a, b] = World.ROAD_SEGMENTS[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
      const nx = -dz, nz = dx;
      for (let d = 24; d < len - 24; d += 38) {
        const px = a[0] + dx * d + nx * 6.4;
        const pz = a[1] + dz * d + nz * 6.4;
        if (World.isShootRangeCorridor(px, pz) || World.isUrbanPlaza(px, pz) || World.getRiverDistFast(px, pz) < 24) continue;
        const py = World.getHeight(px, pz);
        if (py > 1.2) pools.poles.push({ x: px, y: py, z: pz, rot: Math.atan2(dx, dz), seg: i });
      }
    }

    // Mobil terbengkalai
    for (let i = 0; i < World.ROAD_SEGMENTS.length && pools.cars.length < 32; i++) {
      const [a, b] = World.ROAD_SEGMENTS[i];
      for (const t of [0.28, 0.58, 0.82]) {
        if (pools.cars.length >= 32) break;
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const ang = Math.atan2(dx, dz);
        const cx = a[0] + dx * t + (rng() - 0.5) * 3.5;
        const cz = a[1] + dz * t + (rng() - 0.5) * 3.5;
        if (World.isShootRangeCorridor(cx, cz) || World.isUrbanPlaza(cx, cz) || World.getRiverDistFast(cx, cz) < 28) continue;
        const cy = World.getHeight(cx, cz);
        if (cy > 1.5 && isClearOfStructures(cx, cz, 3.0)) {
          pools.cars.push({ x: cx, y: cy, z: cz, rot: ang + (rng() - 0.5) * 0.4, cidx: pools.cars.length });
        }
      }
    }

    // Buluh/ilalang air di tepi sungai & danau
    const sl = CONFIG.world.seaLevel;
    const lakeNear = (x, z) => Math.hypot(x - 240, z + 220) < 92 || Math.hypot(x + 260, z - 280) < 72;
    for (let t = 0; t < 6000 && pools.reeds.length < 900; t++) {
      const x = (rng() - 0.5) * 1300, z = (rng() - 0.5) * 1300;
      if (!(World.getRiverDistFast(x, z) < 34 || lakeNear(x, z))) continue;
      const h = World.getHeight(x, z);
      if (h < sl - 0.25 || h > sl + 1.3) continue;
      if (!isClearOfStructures(x, z, 2.5)) continue;
      const n = 2 + ((rng() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const rx = x + (rng() - 0.5) * 2.8, rz = z + (rng() - 0.5) * 2.8;
        const ry = World.getHeight(rx, rz);
        if (ry < sl - 0.5) continue;
        pools.reeds.push(mk(rx, ry - 0.05, rz, 0.8 + rng() * 0.9, { lx: 0, lz: 0 }));
      }
    }

    // Batang tumbang & tunggul di dalam hutan
    const forestTrees = pools.pinus.concat(pools.jati);
    for (let i = 0; i < forestTrees.length; i += 11) {
      const t = forestTrees[i];
      const a = rng() * Math.PI * 2, d = 2.5 + rng() * 3;
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!isClearOfStructures(x, z, 3)) continue;
      const y = World.getHeight(x, z);
      if (rng() < 0.55) pools.logs.push({ x, y: y + 0.16, z, rot: rng() * Math.PI, scale: 0.8 + rng() * 0.6, lx: 0, lz: (rng() - 0.5) * 0.12 });
      else pools.stumps.push({ x, y: y - 0.05, z, rot: rng() * Math.PI, scale: 0.8 + rng() * 0.5 });
    }
    await Util.nextFrame();

    // ── Spawn instancing ────────────────────────────────────────────────────
    spawnInstanced(S.pinus.trunk, S.pinus.bark, pools.pinus, { colRad: 0.34, colH: 6.0, colMat: 'wood', tint: 'bark' });
    spawnInstanced(S.pinus.canopy, S.pinus.leaf, pools.pinus, { tint: 'leaf' });
    spawnInstanced(S.jati.trunk, S.jati.bark, pools.jati, { colRad: 0.38, colH: 4.5, colMat: 'wood', tint: 'bark' });
    spawnInstanced(S.jati.canopy, S.jati.leaf, pools.jati, { tint: 'leaf' });
    spawnInstanced(S.kelapa.trunk, S.kelapa.bark, pools.kelapa, { colRad: 0.25, colH: 6.5, colMat: 'wood', tint: 'bark' });
    spawnInstanced(S.kelapa.canopy, S.kelapa.leaf, pools.kelapa, { tint: 'leaf' });
    spawnInstanced(S.mangga.trunk, S.mangga.bark, pools.mangga, { colRad: 0.4, colH: 3.6, colMat: 'wood', tint: 'bark' });
    spawnInstanced(S.mangga.canopy, S.mangga.leaf, pools.mangga, { tint: 'leaf' });
    spawnInstanced(S.semak.canopy, S.semak.leaf, pools.semak, { tint: 'leaf' }); // semak: tanpa collider (cover crouch)

    // Batu berlumut (3 varian, bersudut)
    const rockMat = Assets.get('rock').clone();
    rockMat.vertexColors = true;
    VK.withCSM(rockMat, () => { }, csmInstance, 'vkRock');
    owned.push(rockMat);
    const rockGeos = makeRockGeos();
    for (let v = 0; v < 3; v++) {
      spawnInstanced(rockGeos[v], rockMat, pools.rocks.filter(r => r.v === v), { colRad: 0.95, colH: 1.5, colMat: 'concrete', tint: 'rock' });
    }

    // Tiang listrik + kabel melengkung (katenari)
    const poleGeo = VK.merge([
      VK.toGeo(new THREE.CylinderGeometry(0.11, 0.15, 7.2, 6).translate(0, 3.6, 0)),
      VK.toGeo(new THREE.BoxGeometry(1.7, 0.12, 0.12).translate(0, 6.6, 0)),
      VK.toGeo(new THREE.BoxGeometry(1.1, 0.10, 0.10).translate(0, 5.9, 0)),
      VK.toGeo(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8).translate(0, 5.0, 0.0))
    ]);
    spawnInstanced(poleGeo, Assets.get('wood'), pools.poles, { colRad: 0.2, colH: 6.0, colMat: 'wood' });
    const wirePts = [];
    for (let i = 0; i + 1 < pools.poles.length; i++) {
      const A = pools.poles[i], B = pools.poles[i + 1];
      if (A.seg !== B.seg) continue;
      const len = Math.hypot(B.x - A.x, B.z - A.z);
      if (len > 70) continue;
      const px = Math.cos(A.rot), pz = -Math.sin(A.rot);
      const sag = 0.014 * len;
      for (const off of [-0.75, 0, 0.75]) {
        let prev = null;
        for (let s = 0; s <= 8; s++) {
          const t = s / 8;
          const p = [
            Util.lerp(A.x, B.x, t) + px * off,
            Util.lerp(A.y, B.y, t) + 6.7 - sag * 4 * t * (1 - t),
            Util.lerp(A.z, B.z, t) + pz * off
          ];
          if (prev) wirePts.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
          prev = p;
        }
      }
    }
    if (wirePts.length) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wirePts), 3));
      wg.computeBoundingSphere();
      const wm = new THREE.LineBasicMaterial({ color: 0x14161a });
      owned.push(wm);
      floraGroup.add(new THREE.LineSegments(wg, wm));
    }

    // Mobil karat: kaca gelap, roda hitam, atap, bumper
    if (pools.cars.length) {
      const part = (geo, r, g, b) => VK.paint(VK.toGeo(geo), r, g, b);
      const wheel = (x, z) => part(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10).rotateZ(Math.PI * 0.5).translate(x, 0.36, z), 0.07, 0.07, 0.07);
      const carGeo = VK.merge([
        part(new THREE.BoxGeometry(2.1, 0.7, 4.4).translate(0, 0.62, 0), 1, 1, 1),
        part(new THREE.BoxGeometry(1.86, 0.56, 2.3).translate(0, 1.22, -0.2), 0.10, 0.12, 0.14),
        part(new THREE.BoxGeometry(1.9, 0.08, 2.15).translate(0, 1.54, -0.2), 0.95, 0.95, 0.95),
        part(new THREE.BoxGeometry(2.14, 0.2, 0.16).translate(0, 0.42, 2.22), 0.25, 0.25, 0.25),
        part(new THREE.BoxGeometry(2.14, 0.2, 0.16).translate(0, 0.42, -2.22), 0.25, 0.25, 0.25),
        wheel(-1.02, 1.35), wheel(1.02, 1.35), wheel(-1.02, -1.35), wheel(1.02, -1.35)
      ]);
      const carMat = Assets.get('rust').clone();
      carMat.vertexColors = true;
      VK.withCSM(carMat, () => { }, csmInstance, 'vkCar');
      owned.push(carMat);
      const carIM = new THREE.InstancedMesh(carGeo, carMat, pools.cars.length);
      carIM.castShadow = true; carIM.receiveShadow = true;
      const carColors = [new THREE.Color(0x52635A), new THREE.Color(0x705845), new THREE.Color(0x4A5362), new THREE.Color(0x78766D)];
      for (let i = 0; i < pools.cars.length; i++) {
        const c = pools.cars[i];
        dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(0, c.rot, 0); dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        carIM.setMatrixAt(i, dummy.matrix);
        carIM.setColorAt(i, carColors[i % carColors.length]);
        const swap = Math.abs(Math.sin(c.rot)) > 0.707;
        const hw = swap ? 2.2 : 1.15, hd = swap ? 1.15 : 2.2;
        Physics.addCollider({ minX: c.x - hw, maxX: c.x + hw, minY: c.y, maxY: c.y + 1.65, minZ: c.z - hd, maxZ: c.z + hd, mat: 'metal', tag: 'world' });
      }
      carIM.instanceMatrix.needsUpdate = true;
      if (carIM.instanceColor) carIM.instanceColor.needsUpdate = true;
      floraGroup.add(carIM);
    }

    // Buluh tepi air (kartu silang, bergoyang)
    if (pools.reeds.length) {
      const reedGeo = VK.merge([
        VK.toGeo(new THREE.PlaneGeometry(1.4, 1.9).translate(0, 0.95, 0)),
        VK.toGeo(new THREE.PlaneGeometry(1.4, 1.9).translate(0, 0.95, 0).rotateY(Math.PI * 0.5))
      ]);
      const rn = reedGeo.attributes.normal, rp = reedGeo.attributes.position, rc = reedGeo.attributes.color;
      for (let i = 0; i < rn.count; i++) { rn.setXYZ(i, 0, 1, 0); const k = 0.6 + 0.4 * (rp.getY(i) / 1.9); rc.setXYZ(i, k, k, k * 0.9); }
      const reedMat = new THREE.MeshStandardMaterial({ map: S.reedTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, vertexColors: true });
      VK.withCSM(reedMat, (s) => VK.injectWind(s, 1.9, 0.5), csmInstance, 'vkReedWind');
      owned.push(reedMat);
      spawnInstanced(reedGeo, reedMat, pools.reeds, { tint: 'leaf', cast: false });
    }

    // Log & tunggul
    const barkStatic = Assets.get('bark');
    if (pools.logs.length) {
      const logGeo = VK.toGeo(new THREE.CylinderGeometry(0.26, 0.31, 3.6, 9).rotateZ(Math.PI * 0.5));
      VK.displace(logGeo, 0.05, 2.0, 2.2);
      spawnInstanced(logGeo, barkStatic, pools.logs, {});
    }
    if (pools.stumps.length) {
      const stGeo = VK.toGeo(new THREE.CylinderGeometry(0.3, 0.4, 0.55, 8).translate(0, 0.27, 0));
      VK.displace(stGeo, 0.06, 2.0, 5.5);
      spawnInstanced(stGeo, barkStatic, pools.stumps, {});
    }

    // ── Rumput hidup di sekitar pemain ──────────────────────────────────────
    const gCount = grassDist > 0 ? Math.min(8200, Math.round(grassDist * 145)) : 0;
    if (gCount > 0) {
      const tuftTex = makeTuftTex();
      owned.push(tuftTex);
      const makeCard = (rotY, tiltX) => {
        const g = new THREE.PlaneGeometry(0.76, 0.46, 1, 3);
        const posA = g.getAttribute('position');
        for (let i = 0; i < posA.count; i++) {
          const py = posA.getY(i) + 0.23;
          const t = Math.max(0, py / 0.46);
          posA.setZ(i, posA.getZ(i) + t * t * 0.08);
        }
        posA.needsUpdate = true;
        return VK.toGeo(g.translate(0, 0.21, 0).rotateX(tiltX).rotateY(rotY));
      };
      const bladeGeo = VK.merge([0, 1, 2, 3, 4].map(k => makeCard(k * Math.PI * 0.2, k % 2 ? -0.06 : 0.07)));
      const nAttr = bladeGeo.getAttribute('normal');
      for (let i = 0; i < nAttr.count; i++) nAttr.setXYZ(i, 0, 1, 0);
      nAttr.needsUpdate = true;

      grassMat = new THREE.MeshStandardMaterial({ name: 'grassBlades', map: tuftTex, color: 0xFFFFFF, alphaTest: 0.38, roughness: 0.90, metalness: 0.0, side: THREE.DoubleSide });
      VK.withCSM(grassMat, (shader) => {
        shader.uniforms.uTime = VK.wind.uTime;
        shader.uniforms.uWind = VK.wind.uWind;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;\nvarying float vBladeH;\nvarying float vTint;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float hWeight = clamp(position.y / 0.44, 0.0, 1.0);
            vBladeH = hWeight;
            vec4 wPos = instanceMatrix * vec4(transformed, 1.0);
            vTint = 0.5 + 0.5 * sin(wPos.x * 0.031) * cos(wPos.z * 0.027);
            float gust = 0.7 + 0.55 * sin(uTime * 1.45 + wPos.x * 0.14 + wPos.z * 0.11);
            transformed.x += sin(uTime * 2.5 + wPos.x * 0.42 + wPos.z * 0.30) * 0.16 * hWeight * uWind * gust;
            transformed.z += cos(uTime * 2.1 + wPos.z * 0.36) * 0.11 * hWeight * uWind * gust;`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vBladeH;\nvarying float vTint;')
          .replace('#include <color_fragment>', `#include <color_fragment>
            diffuseColor.rgb *= mix(0.60, 1.08, vBladeH) * mix(vec3(1.06, 1.02, 0.80), vec3(0.88, 1.0, 0.88), vTint);`);
      }, csmInstance, 'vkGrass');
      owned.push(grassMat);

      grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, gCount);
      grassMesh.frustumCulled = false;
      grassMesh.receiveShadow = true;
      grassSlots.length = 0;
      const gTints = [new THREE.Color(0xDBE8C4), new THREE.Color(0xC9DEB0), new THREE.Color(0xE6EDC0), new THREE.Color(0xBDCE9C)];
      for (let i = 0; i < gCount; i++) {
        const ang = rng() * Math.PI * 2;
        const r = Math.pow(rng(), 0.72);
        grassSlots.push({ ox: Math.cos(ang) * r, oz: Math.sin(ang) * r, r, rot: rng() * Math.PI * 2, s: 0.78 + rng() * 0.62, k: rng() });
        grassMesh.setColorAt(i, gTints[i % gTints.length]);
      }
      if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
      floraGroup.add(grassMesh);
      lastGrassCenter.set(9999, 0, 9999);
    }

    scene.add(floraGroup);
    return {
      trees: pools.pinus.length + pools.jati.length + pools.kelapa.length + pools.mangga.length,
      bushes: pools.semak.length, rocks: pools.rocks.length, cars: pools.cars.length, reeds: pools.reeds.length
    };
  }

  // Dipanggil WorldDetail: semak taman di sekitar rumah (visual saja, tanpa collider)
  function addBushes(items) {
    if (!floraGroup || !semakGeo || !items.length) return null;
    return spawnInstanced(semakGeo, semakMat, items.map(it => Object.assign({ cv: [Math.random(), Math.random(), Math.random()], rot: Math.random() * 6.28, scale: 0.9 }, it)), { tint: 'leaf' });
  }

  const gDummy = new THREE.Object3D();
  function update(elapsed, centerPos, weatherState, grassDist) {
    VK.wind.uTime.value = elapsed;
    VK.wind.uWind.value = weatherState?.wind || 1.0;
    if (!grassMesh || !centerPos) return;
    if (Math.hypot(centerPos.x - lastGrassCenter.x, centerPos.z - lastGrassCenter.z) < 4) return;
    lastGrassCenter.copy(centerPos);
    const radius = Math.max(24, Math.min(68, grassDist || 44));
    const n = grassSlots.length;
    const near = [];
    const all = WorldBuildings.footprints;
    for (let i = 0; i < all.length; i++) {
      const f = all[i];
      if (f.maxX > centerPos.x - radius - 6 && f.minX < centerPos.x + radius + 6 && f.maxZ > centerPos.z - radius - 6 && f.minZ < centerPos.z + radius + 6) near.push(f);
    }
    for (let i = 0; i < n; i++) {
      const sl = grassSlots[i];
      const gx = centerPos.x + sl.ox * radius;
      const gz = centerPos.z + sl.oz * radius;
      const gh = World.getHeight(gx, gz);
      let show = true;
      const fade = 1 - VK.smooth(0.78, 1.0, sl.r);
      if (fade < 0.05 || gh < 2.2 || gh > 54) show = false;
      // padang berbintik: area subur lebat, area kering jarang
      else if (VK.noise3(gx * 0.045, 1.7, gz * 0.045) < 0.26 + sl.k * 0.22) show = false;
      else if (World.isUrbanPlaza(gx, gz) || World.getRoadDistFast(gx, gz) < 4.5 || World.getRiverDistFast(gx, gz) < 18) show = false;
      else if (Math.abs(World.getHeight(gx + 1.4, gz) - gh) > 0.95) show = false;
      else if (World.craters.length) {
        for (let ci = 0; ci < World.craters.length; ci++) {
          const cr = World.craters[ci];
          const cdx = gx - cr.x, cdz = gz - cr.z;
          if (cdx * cdx + cdz * cdz < (cr.r * 1.18) * (cr.r * 1.18)) { show = false; break; }
        }
      }
      if (show) {
        for (let bi = 0; bi < near.length; bi++) {
          const f = near[bi];
          if (gx >= f.minX - 0.25 && gx <= f.maxX + 0.25 && gz >= f.minZ - 0.25 && gz <= f.maxZ + 0.25) { show = false; break; }
        }
      }
      if (!show) {
        gDummy.scale.set(0, 0, 0);
      } else {
        const s = sl.s * (0.55 + 0.45 * fade);
        gDummy.position.set(gx, gh - 0.05, gz);
        gDummy.rotation.set(0, sl.rot, 0);
        gDummy.scale.set(s, s * (0.85 + 0.3 * VK.noise3(gx * 0.11, 0.3, gz * 0.11)), s);
      }
      gDummy.updateMatrix();
      grassMesh.setMatrixAt(i, gDummy.matrix);
    }
    grassMesh.instanceMatrix.needsUpdate = true;
  }

  function refreshGrass() {
    lastGrassCenter.set(99999, 0, 99999);
  }

  function dispose(scene) {
    if (floraGroup) {
      floraGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      scene.remove(floraGroup);
      floraGroup = null;
    }
    for (const o of owned) { if (o && o.dispose) o.dispose(); }
    owned = [];
    grassMesh = null; grassMat = null; semakGeo = null; semakMat = null; grassSlots.length = 0;
  }

  return { build, update, dispose, addBushes, refreshGrass };
})();

// ════════════════════════════════════════════════════════════════════════════
// WORLDDETAIL — pelapukan bangunan (overlay kotoran/lumut tanpa mengubah material),
//               cerobong, antena, tangki atap, drum, peti, pot tanaman, semak taman
// ════════════════════════════════════════════════════════════════════════════
const WorldDetail = (() => {
  let group = null;
  let overlayMat = null;
  let buckets = new Map();

  const ARCH_DIM = { house1f: [8, 7], house2f: [10, 8], ruko2f: [9, 10], factory: [18, 12], tower: [4.8, 4.8], bunker: [8, 8] };

  // ── Pelapukan: lapisan hitam-cokelat/lumut transparan di atas mesh gabungan ──
  function addWeathering(root) {
    const fx = new Set(['glass', 'warmGlow', 'neonCyan', 'redSignal'].map(k => Assets.get(k)).filter(Boolean));
    const targets = [];
    root.children.forEach((o) => {
      if (o.isMesh && o.geometry && !o.geometry.index && o.geometry.attributes.position.count > 72 &&
        o.material && o.material.isMeshStandardMaterial && !fx.has(o.material)) targets.push(o);
    });
    overlayMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    let count = 0;
    for (const m of targets) {
      const pos = m.geometry.attributes.position, nrm = m.geometry.attributes.normal;
      const n = pos.count;
      const col = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const ny = Math.abs(nrm.getY(i));
        const up = y - World.getHeight(x, z);
        const vertical = 1 - VK.smooth(0.35, 0.85, ny);
        const ground = 1 - VK.smooth(0.0, 1.9, up);
        const streak = Math.max(0, VK.noise3(x * 1.3, y * 0.12, z * 1.3) - 0.45);
        // dinding: percikan tanah di dasar + jejak air hujan; permukaan datar: noda tipis
        let a = vertical * (ground * 0.50 + (1 - ground) * streak * 0.34) + (1 - vertical) * streak * 0.30;
        if (nrm.getY(i) < -0.5) a += 0.22;
        a = Math.min(0.7, a);
        const moss = vertical * ground * VK.smooth(0.3, 0.9, VK.noise3(x * 0.7, 0.0, z * 0.7));
        col[i * 4] = 0.07 + moss * 0.03;
        col[i * 4 + 1] = 0.06 + moss * 0.10;
        col[i * 4 + 2] = 0.04;
        col[i * 4 + 3] = a;
      }
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', pos);
      og.setAttribute('color', new THREE.BufferAttribute(col, 4));
      if (m.geometry.boundingSphere) og.boundingSphere = m.geometry.boundingSphere.clone();
      const mesh = new THREE.Mesh(og, overlayMat);
      mesh.renderOrder = 2;
      mesh.castShadow = false; mesh.receiveShadow = false;
      group.add(mesh);
      count++;
    }
    return count;
  }

  // ── Properti kecil (digabung per material per sel 200 m) ──────────────────
  function push(x, z, key, g) {
    const k = `${Math.floor((x + 800) / 200)},${Math.floor((z + 800) / 200)}|${key}`;
    let arr = buckets.get(k);
    if (!arr) { arr = []; buckets.set(k, arr); }
    arr.push(g);
  }
  function box(w, h, d, x, y, z, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)));
    return g;
  }
  function cyl(rt, rb, h, seg, x, y, z) {
    const raw = new THREE.CylinderGeometry(rt, rb, h, seg);
    const g = raw.toNonIndexed(); raw.dispose();
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    g.translate(x, y, z);
    return g;
  }
  const solid = (minX, maxX, minY, maxY, minZ, maxZ, mat) =>
    Physics.addCollider({ minX, maxX, minY, maxY, minZ, maxZ, mat, tag: 'world' });

  async function build(scene, seed, csm) {
    dispose(scene);
    group = new THREE.Group();
    group.name = 'PulauRajawaliDetail';
    buckets = new Map();
    const rng = Util.mulberry32(seed + 9091);

    const root = scene.getObjectByName('PulauRajawaliBuildings');
    let weathered = 0;
    if (root) weathered = addWeathering(root);
    await Util.nextFrame();

    const bushes = [];
    const motos = [];
    const fps = WorldBuildings.footprints;
    for (let bi = 0; bi < fps.length; bi++) {
      const f = fps[bi];
      const dim = ARCH_DIM[f.arch];
      if (!dim) continue; // lewati blok kota (city_*)
      const [w, d] = dim;
      const ang = f.rotIdx * Math.PI * 0.5;
      const c = Math.round(Math.cos(ang)), s = Math.round(Math.sin(ang));
      const L2W = (lx, lz) => [f.cx + lx * c + lz * s, f.cz - lx * s + lz * c];
      const hw = (f.maxX - f.minX) * 0.5, hd = (f.maxZ - f.minZ) * 0.5;
      const hs = [World.getHeight(f.cx - hw, f.cz - hd), World.getHeight(f.cx + hw, f.cz - hd), World.getHeight(f.cx - hw, f.cz + hd), World.getHeight(f.cx + hw, f.cz + hd), World.getHeight(f.cx, f.cz)];
      const baseY = Math.max(1.2, Math.max(...hs) + 0.12);
      const ground = (x, z) => World.getHeight(x, z);

      if (f.arch === 'house1f' || f.arch === 'house2f') {
        const roofY = f.arch === 'house1f' ? baseY + 3.2 : baseY + 6.65;
        // cerobong bata + tutup beton
        let [cx, cz] = L2W(w * 0.22, -d * 0.18);
        push(cx, cz, 'brick', box(0.55, 2.4, 0.55, cx, roofY + 1.1, cz, ang));
        push(cx, cz, 'concrete', box(0.78, 0.12, 0.78, cx, roofY + 2.36, cz, ang));
        // antena TV
        [cx, cz] = L2W(-w * 0.2, 0.6);
        push(cx, cz, 'gunmetal', cyl(0.025, 0.025, 2.6, 5, cx, roofY + 2.0, cz));
        for (const yy of [2.5, 2.9]) push(cx, cz, 'gunmetal', box(0.9, 0.03, 0.03, cx, roofY + yy, cz, ang));
        // pot tanaman di sisi teras
        const potX = f.arch === 'house1f' ? 3.1 : 3.4;
        for (const sx of [-potX, potX]) {
          const [px, pz] = L2W(sx, d * 0.5 + 1.5);
          const gy = ground(px, pz);
          push(px, pz, 'terracotta', cyl(0.3, 0.22, 0.5, 8, px, gy + 0.25, pz));
          bushes.push({ x: px, y: gy + 0.45, z: pz, scale: 0.55 });
        }
        // semak taman di sisi & belakang
        for (const [lx, lz] of [[w * 0.5 + 0.9, -d * 0.25], [w * 0.5 + 0.9, d * 0.2], [-w * 0.5 - 0.9, -d * 0.2], [-w * 0.5 - 0.9, d * 0.25], [-w * 0.18, -d * 0.5 - 0.9], [w * 0.2, -d * 0.5 - 0.9]]) {
          if (rng() < 0.25) continue;
          const [bx, bz] = L2W(lx + (rng() - 0.5) * 0.6, lz + (rng() - 0.5) * 0.6);
          if (World.getRoadDistFast(bx, bz) < 5) continue;
          bushes.push({ x: bx, y: ground(bx, bz) - 0.05, z: bz, scale: 0.7 + rng() * 0.6 });
        }
      } else if (f.arch === 'ruko2f') {
        // tangki air di atap + kaki
        const [tx, tz] = L2W(-2.2, -2.6);
        const ty = baseY + 7.2;
        for (const [ox, oz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) push(tx, tz, 'gunmetal', box(0.1, 0.6, 0.1, tx + ox, ty + 0.3, tz + oz));
        push(tx, tz, 'zincRoof', cyl(0.8, 0.8, 1.5, 14, tx, ty + 1.35, tz));
        solid(tx - 0.85, tx + 0.85, ty, ty + 2.1, tz - 0.85, tz + 0.85, 'metal');
      }

      if (f.arch === 'factory' || f.arch === 'bunker' || (f.arch === 'ruko2f' && rng() < 0.5)) {
        // drum minyak (karat) + tumpukan peti di depan bangunan
        const [ox, oz] = L2W(w * 0.5 - 1.6, d * 0.5 + 1.7);
        const gy = ground(ox, oz);
        let placed = 0;
        for (const [dx, dz] of [[0, 0], [0.7, 0.15], [0.3, 0.8]]) {
          const [px, pz] = L2W(w * 0.5 - 1.6 + dx, d * 0.5 + 1.7 + dz);
          push(px, pz, 'rust', cyl(0.3, 0.3, 0.9, 12, px, gy + 0.45, pz));
          placed++;
        }
        if (placed) solid(ox - 0.5, ox + 1.2, gy, gy + 0.9, oz - 0.5, oz + 1.3, 'metal');
        const [kx, kz] = L2W(-w * 0.5 + 1.4, d * 0.5 + 1.6);
        const ky = ground(kx, kz);
        push(kx, kz, 'wood', box(1.1, 0.9, 1.1, kx, ky + 0.45, kz, ang));
        push(kx, kz, 'wood', box(0.9, 0.8, 0.9, kx + 0.1, ky + 1.3, kz - 0.05, ang + 0.3));
        solid(kx - 0.7, kx + 0.7, ky, ky + 1.7, kz - 0.7, kz + 0.7, 'wood');
      }
      // Motor parkir di halaman depan (satu InstancedMesh per material lewat MotoKit)
      if (typeof MotoKit !== 'undefined' && (f.arch === 'house1f' || f.arch === 'house2f' || f.arch === 'ruko2f' || f.arch === 'factory')) {
        if (rng() < (f.arch === 'factory' ? 0.3 : 0.5)) {
          const nM = f.arch === 'ruko2f' && rng() < 0.6 ? 2 : 1;
          for (let mi = 0; mi < nM; mi++) {
            const spread = f.arch === 'factory' ? 1.6 : 1;
            const [mx, mz] = L2W((mi === 0 ? -1 : 1) * (1.6 + rng() * 1.6) * spread, d * 0.5 + 3.4 + rng() * 0.5);
            const gy = ground(mx, mz);
            const yaw = ang + (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
            const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
            const g1 = ground(mx + fx, mz + fz), g2 = ground(mx - fx, mz - fz);
            if (gy < 1.0 || Math.abs(g1 - g2) > 0.5 || Math.abs(gy - ground(f.cx, f.cz)) > 1.5) continue;
            if (World.getRoadDistFast(mx, mz) < 4) continue;
            motos.push({ x: mx, y: (gy + g1 + g2) / 3, z: mz, yaw, lean: 0.2 });
            const hx = Math.abs(Math.cos(yaw)) * 0.32 + Math.abs(Math.sin(yaw)) * 1.05;
            const hz = Math.abs(Math.sin(yaw)) * 0.32 + Math.abs(Math.cos(yaw)) * 1.05;
            solid(mx - hx, mx + hx, gy, gy + 1.1, mz - hz, mz + hz, 'metal');
          }
        }
      }      if (bi % 8 === 7) await Util.nextFrame();
    }

    // Gabung per (sel, material)
    let calls = 0;
    for (const [key, geos] of buckets.entries()) {
      const mat = Assets.get(key.split('|')[1]);
      if (!mat || !geos.length) continue;
      const merged = BufferGeometryUtils.mergeGeometries(geos, false);
      geos.forEach(g => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      calls++;
    }
    buckets.clear();

    if (typeof MotoKit !== 'undefined') group.add(MotoKit.makeParkedGroup(motos));
    if (bushes.length && typeof WorldFlora !== 'undefined') WorldFlora.addBushes(bushes);
    scene.add(group);
    return { weathered, propMeshes: calls, bushes: bushes.length, motos: motos.length };
  }

  function dispose(scene) {
    if (group) {
      group.traverse((o) => {
        // geometri overlay berbagi buffer posisi dengan mesh bangunan → jangan dispose atribut itu
        if (o.geometry && o.material !== overlayMat) o.geometry.dispose();
      });
      scene.remove(group);
      group = null;
    }
    if (overlayMat) { overlayMat.dispose(); overlayMat = null; }
  }

  return { build, dispose };
})();


// ════════════════════════════════════════════════════════════════════════════
// NAVGRID — 200×200 (8m) Walkability Cost Grid & GC-Free Binary Heap A*
// ════════════════════════════════════════════════════════════════════════════
const NavGrid = (() => {
  const N = 200;
  const CELL = 8;
  const HALF = 800;
  const cost = new Uint8Array(N * N); // 0=blocked, 1=road/bridge, 2=flat, 3=hill, 4=building
  // Preallocated A* scratch buffers (Zero GC per query!)
  const gScore = new Float32Array(N * N);
  const fScore = new Float32Array(N * N);
  const parent = new Int32Array(N * N);
  const closed = new Uint8Array(N * N);
  const heap = new Int32Array(N * N);
  let heapLen = 0;

  function worldToCell(x, z) {
    return [
      Util.clamp(Math.floor((x + HALF) / CELL), 0, N - 1),
      Util.clamp(Math.floor((z + HALF) / CELL), 0, N - 1)
    ];
  }

  function cellToWorld(cx, cz) {
    return { x: -HALF + (cx + 0.5) * CELL, z: -HALF + (cz + 0.5) * CELL };
  }

  function build() {
    for (let cz = 0; cz < N; cz++) {
      const wz = -HALF + (cz + 0.5) * CELL;
      for (let cx = 0; cx < N; cx++) {
        const wx = -HALF + (cx + 0.5) * CELL;
        const idx = cz * N + cx;
        const h = World.getHeight(wx, wz);
        if (h < -0.55) { cost[idx] = 0; continue; }
        const n = World.getNormal(wx, wz, Util.v1);
        const slope = 1.0 - n.y;
        if (slope > 0.52) { cost[idx] = 0; continue; }
        const rd = World.getRiverDist(wx, wz);
        if (rd < 16 && h < 0.25) { cost[idx] = 0; continue; }
        const roadD = World.getRoadDist(wx, wz);
        if (roadD < 5.5) cost[idx] = 1;
        else if (slope < 0.14) cost[idx] = 2;
        else cost[idx] = 3;
      }
    }

    // Stamp all 5 bridges as fast walkable road cells
    const bridges = WorldBuildings.bridges;
    for (let i = 0; i < bridges.length; i++) {
      const br = bridges[i];
      for (let t = 0; t <= 1; t += 0.05) {
        const bx = Util.lerp(br.x1, br.x2, t);
        const bz = Util.lerp(br.z1, br.z2, t);
        const [cx, cz] = worldToCell(bx, bz);
        for (let oz = -1; oz <= 1; oz++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = Util.clamp(cx + ox, 0, N - 1), nz = Util.clamp(cz + oz, 0, N - 1);
            cost[nz * N + nx] = 1;
          }
        }
      }
    }

    // Mark building footprints interior navigable (AI enters/loots houses seamlessly)
    const fps = WorldBuildings.footprints;
    for (let i = 0; i < fps.length; i++) {
      const f = fps[i];
      const [c0, r0] = worldToCell(f.minX, f.minZ);
      const [c1, r1] = worldToCell(f.maxX, f.maxZ);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (cost[r * N + c] > 0) cost[r * N + c] = 4;
        }
      }
    }
  }

  function isWalkable(x, z) {
    const [cx, cz] = worldToCell(x, z);
    return cost[cz * N + cx] > 0;
  }

  function pushHeap(idx, f) {
    fScore[idx] = f;
    let i = heapLen++;
    heap[i] = idx;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fScore[heap[p]] <= f) break;
      const tmp = heap[p]; heap[p] = heap[i]; heap[i] = tmp;
      i = p;
    }
  }

  function popHeap() {
    const top = heap[0];
    const last = heap[--heapLen];
    if (heapLen > 0) {
      heap[0] = last;
      let i = 0;
      const lf = fScore[last];
      while (true) {
        const l = (i << 1) + 1, r = l + 1;
        let sm = i, smF = lf;
        if (l < heapLen && fScore[heap[l]] < smF) { sm = l; smF = fScore[heap[l]]; }
        if (r < heapLen && fScore[heap[r]] < smF) { sm = r; smF = fScore[heap[r]]; }
        if (sm === i) break;
        const tmp = heap[i]; heap[i] = heap[sm]; heap[sm] = tmp;
        i = sm;
      }
    }
    return top;
  }

  const multTable = [999, 0.75, 1.0, 1.85, 1.15];
  function findNearestWalkable(cx, cz) {
    if (cost[cz * N + cx] > 0) return [cx, cz];
    for (let rad = 1; rad <= 6; rad++) {
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = Util.clamp(cx + dx, 0, N - 1), nz = Util.clamp(cz + dz, 0, N - 1);
          if (cost[nz * N + nx] > 0) return [nx, nz];
        }
      }
    }
    return [cx, cz];
  }

  function findPath(sx, sz, tx, tz, maxExp = 1400) {
    let [scx, scz] = worldToCell(sx, sz);
    let [tcx, tcz] = worldToCell(tx, tz);
    [scx, scz] = findNearestWalkable(scx, scz);
    [tcx, tcz] = findNearestWalkable(tcx, tcz);

    const startIdx = scz * N + scx;
    const goalIdx = tcz * N + tcx;
    if (startIdx === goalIdx) return [{ x: tx, z: tz }];

    gScore.fill(1e9);
    closed.fill(0);
    parent.fill(-1);
    heapLen = 0;

    gScore[startIdx] = 0;
    pushHeap(startIdx, Math.hypot(tcx - scx, tcz - scz));

    let exp = 0, bestIdx = startIdx, bestH = 1e9;
    const dirs = [[-1,0,1],[1,0,1],[0,-1,1],[0,1,1],[-1,-1,1.414],[1,-1,1.414],[-1,1,1.414],[1,1,1.414]];

    while (heapLen > 0 && exp < maxExp) {
      const cur = popHeap();
      if (closed[cur]) continue;
      closed[cur] = 1;
      exp++;

      if (cur === goalIdx) { bestIdx = cur; break; }
      const cx = cur % N, cz = (cur / N) | 0;
      const hRem = Math.hypot(tcx - cx, tcz - cz);
      if (hRem < bestH) { bestH = hRem; bestIdx = cur; }

      for (let d = 0; d < 8; d++) {
        const nx = cx + dirs[d][0], nz = cz + dirs[d][1];
        if (nx < 0 || nx >= N || nz < 0 || nz >= N) continue;
        const nIdx = nz * N + nx;
        const cCode = cost[nIdx];
        if (cCode === 0 || closed[nIdx]) continue;
        const stepC = dirs[d][2] * multTable[cCode];
        const ng = gScore[cur] + stepC;
        if (ng < gScore[nIdx]) {
          gScore[nIdx] = ng;
          parent[nIdx] = cur;
          pushHeap(nIdx, ng + Math.hypot(tcx - nx, tcz - nz));
        }
      }
    }

    const raw = [];
    let cur = bestIdx;
    while (cur !== -1 && cur !== startIdx) {
      const cx = cur % N, cz = (cur / N) | 0;
      raw.push(cellToWorld(cx, cz));
      cur = parent[cur];
    }
    raw.reverse();
    if (!raw.length) return [{ x: tx, z: tz }];
    // Smooth waypoints (every 2nd waypoint when clear, keep final exact target)
    const out = [];
    for (let i = 0; i < raw.length; i += 2) out.push(raw[i]);
    if (bestIdx === goalIdx) out.push({ x: tx, z: tz });
    return out;
  }

  return { build, findPath, isWalkable, worldToCell };
})();


// ════════════════════════════════════════════════════════════════════════════
// HOOK — sinkronkan air/atmosfer dengan siklus pagi/siang/sore/malam yang sudah ada
// (WorldBuildings.setTimeOfDay / setNightMode tetap berjalan seperti semula)
// ════════════════════════════════════════════════════════════════════════════
(() => {
  const origTod = WorldBuildings.setTimeOfDay;
  WorldBuildings.setTimeOfDay = (key) => { origTod(key); World.setTimeOfDay(key); };
  WorldBuildings.setNightMode = (isNight) => WorldBuildings.setTimeOfDay(isNight ? 'malam' : 'siang');
})();