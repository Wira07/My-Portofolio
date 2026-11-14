// ════════════════════════════════════════════════════════════════════════════
// WORLD — Seeded Pulau Rajawali Heightmap, River, Roads, 16x16 LOD Chunks, Water
// ════════════════════════════════════════════════════════════════════════════
const World = (() => {
  let currentSeed = CONFIG.seedDefault;
  const SIZE = CONFIG.world.size;
  const HALF = CONFIG.world.halfSize;
  const CHUNK = CONFIG.world.chunk;
  const GRID = CONFIG.world.chunksPerSide;
  const HM_RES = 257; // 257x257 height cache (~6.25m spacing + bilinear interpolation)
  const heightCache = new Float32Array(HM_RES * HM_RES);
  const roadDistCache = new Float32Array(HM_RES * HM_RES);
  const riverDistCache = new Float32Array(HM_RES * HM_RES);

  let group = null;
  let terrainChunks = [];
  let terrainMat = null;
  let waterMesh = null;
  let poiMarkers = null;

  // River spline points from NW lake to East bay
  const RIVER_PTS = [
    [-580, -520], [-360, -280], [-220, -120], [-80, 40], [60, 140], [280, 180], [540, 20], [820, -60]
  ];

  // Road links connecting major POIs
  const ROAD_SEGMENTS = [
    [[-440, 540], [-110, 280]],
    [[-110, 280], [100, 610]],
    [[-110, 280], [160, 90]],
    [[160, 90],   [430, 420]],
    [[-420, 40],  [-110, 280]],
    [[-420, 40],  [-220, -120]],
    [[-220, -120],[-80, -20]],
    [[-80, -20],  [160, 90]],
    [[-80, -20],  [-20, -240]],
    [[-220, -120],[-430, -380]],
    [[-20, -240], [470, -380]],
    [[160, 90],   [560, -20]],
    [[470, -380], [560, -20]]
  ];

  function computeRawElevation(x, z, seed) {
    // Radial island mask with organic coastlines
    const nx = x / HALF;
    const nz = z / HALF;
    const distort = Util.fbm2D(x * 0.0022, z * 0.0022, 3, 2.0, 0.5, seed + 5) * 0.18;
    const r = Math.hypot(nx, nz) + distort;
    const islandMask = 1.0 - Util.smoothstep(0.68, 0.99, r);
    const seaFloor = -14.0 * Util.smoothstep(0.78, 1.08, r);

    const macro = (Util.fbm2D(x * 0.0014, z * 0.0014, 5, 2.05, 0.52, seed + 13) * 0.5 + 0.5) * 44.0;
    const ridge = Util.ridged2D(x * 0.0022, z * 0.0022, 4, seed + 29) * 32.0;
    const detail = Util.fbm2D(x * 0.012, z * 0.012, 3, 2.0, 0.45, seed + 47) * 3.2;

    // Central north ridge bias for Menara Radio peak
    const peakDist = Math.hypot(x + 20, z + 240);
    const centralPeak = Math.exp(-(peakDist * peakDist) / (260 * 260)) * 52.0;

    let h = seaFloor + islandMask * (2.5 + macro + ridge * 0.65 + detail + centralPeak);

    // Flatten POI pads smoothly
    for (let i = 0; i < CONFIG.pois.length; i++) {
      const p = CONFIG.pois[i];
      const rad = Math.max(p.w, p.h) * 0.48;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < rad * 1.4) {
        const w = 1.0 - Util.smoothstep(rad * 0.45, rad * 1.4, d);
        h = Util.lerp(h, p.targetH, w);
      }
    }

    // Two scenic lakes
    const lake1 = Math.hypot(x - 240, z - -220);
    if (lake1 < 85) h = Util.lerp(h, -3.2, 1.0 - Util.smoothstep(25, 85, lake1));
    const lake2 = Math.hypot(x + 260, z - 280);
    if (lake2 < 65) h = Util.lerp(h, -2.6, 1.0 - Util.smoothstep(18, 65, lake2));

    // Carve river channel
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

  async function buildHeightCache(seed, onProgress) {
    currentSeed = seed;
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

  function getHeight(x, z) {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return -14.0;
    return sampleCache(heightCache, x, z);
  }

  function getNormal(x, z, out = new THREE.Vector3()) {
    const e = 1.5;
    const hL = getHeight(x - e, z);
    const hR = getHeight(x + e, z);
    const hD = getHeight(x, z - e);
    const hU = getHeight(x, z + e);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  function buildChunkGeometry(cx, cz, segs) {
    const ox = -HALF + cx * CHUNK;
    const oz = -HALF + cz * CHUNK;
    const step = CHUNK / segs;

    // Include skirt perimeter to guarantee zero seams between LOD levels
    const vertCols = segs + 1;
    const mainVerts = vertCols * vertCols;
    const skirtVerts = vertCols * 4;
    const totalVerts = mainVerts + skirtVerts;

    const pos = new Float32Array(totalVerts * 3);
    const norm = new Float32Array(totalVerts * 3);
    const uv = new Float32Array(totalVerts * 2);
    const splat = new Float32Array(totalVerts * 4); // r: sand, g: grass, b: dirt/road, a: rock

    const nTmp = new THREE.Vector3();
    for (let j = 0; j < vertCols; j++) {
      for (let i = 0; i < vertCols; i++) {
        const wx = ox + i * step;
        const wz = oz + j * step;
        const wy = getHeight(wx, wz);
        getNormal(wx, wz, nTmp);
        const idx = j * vertCols + i;
        pos[idx * 3] = wx; pos[idx * 3 + 1] = wy; pos[idx * 3 + 2] = wz;
        norm[idx * 3] = nTmp.x; norm[idx * 3 + 1] = nTmp.y; norm[idx * 3 + 2] = nTmp.z;
        uv[idx * 2] = wx * 0.08; uv[idx * 2 + 1] = wz * 0.08;

        // Splat weights (sand near water, slope rock, road dirt, lush grass)
        const slope = 1.0 - nTmp.y;
        const roadD = sampleCache(roadDistCache, wx, wz);
        const isBeach = Util.smoothstep(4.0, -0.5, wy);
        const isRock = Util.smoothstep(0.18, 0.45, slope) + Util.smoothstep(52, 78, wy) * 0.45;
        const isRoad = 1.0 - Util.smoothstep(2.6, 5.4, roadD);
        let sSand = isBeach;
        let sRock = Util.clamp(isRock, 0, 1);
        let sDirt = Util.clamp(isRoad + Util.smoothstep(0.08, 0.22, slope) * 0.5, 0, 1);
        let sGrass = Math.max(0.05, 1.0 - Math.max(sSand, sRock, sDirt));
        const invSum = 1.0 / (sSand + sGrass + sDirt + sRock + 1e-5);
        splat[idx * 4]     = sSand * invSum;
        splat[idx * 4 + 1] = sGrass * invSum;
        splat[idx * 4 + 2] = sDirt * invSum;
        splat[idx * 4 + 3] = sRock * invSum;
      }
    }

    // Build edge skirts dropped by 5 meters
    const skirtDrop = 5.0;
    const copySkirt = (destIdx, srcIdx) => {
      pos[destIdx * 3] = pos[srcIdx * 3];
      pos[destIdx * 3 + 1] = pos[srcIdx * 3 + 1] - skirtDrop;
      pos[destIdx * 3 + 2] = pos[srcIdx * 3 + 2];
      norm[destIdx * 3] = norm[srcIdx * 3]; norm[destIdx * 3 + 1] = norm[srcIdx * 3 + 1]; norm[destIdx * 3 + 2] = norm[srcIdx * 3 + 2];
      uv[destIdx * 2] = uv[srcIdx * 2]; uv[destIdx * 2 + 1] = uv[srcIdx * 2 + 1];
      splat[destIdx * 4] = splat[srcIdx * 4]; splat[destIdx * 4 + 1] = splat[srcIdx * 4 + 1];
      splat[destIdx * 4 + 2] = splat[srcIdx * 4 + 2]; splat[destIdx * 4 + 3] = splat[srcIdx * 4 + 3];
    };

    const skirtStart = mainVerts;
    for (let k = 0; k < vertCols; k++) {
      copySkirt(skirtStart + k, k); // top edge
      copySkirt(skirtStart + vertCols + k, segs * vertCols + k); // bottom edge
      copySkirt(skirtStart + vertCols * 2 + k, k * vertCols); // left edge
      copySkirt(skirtStart + vertCols * 3 + k, k * vertCols + segs); // right edge
    }

    const indices = [];
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * vertCols + i;
        const b = a + 1;
        const c = a + vertCols;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    // Skirt indices
    for (let k = 0; k < segs; k++) {
      const topA = k, topB = k + 1, skA = skirtStart + k, skB = skirtStart + k + 1;
      indices.push(topA, topB, skA, topB, skB, skA);

      const botA = segs * vertCols + k, botB = botA + 1, bSkA = skirtStart + vertCols + k, bSkB = bSkA + 1;
      indices.push(botA, bSkA, botB, botB, bSkA, bSkB);

      const lA = k * vertCols, lB = (k + 1) * vertCols, lSkA = skirtStart + vertCols * 2 + k, lSkB = lSkA + 1;
      indices.push(lA, lSkA, lB, lB, lSkA, lSkB);

      const rA = k * vertCols + segs, rB = (k + 1) * vertCols + segs, rSkA = skirtStart + vertCols * 3 + k, rSkB = rSkA + 1;
      indices.push(rA, rB, rSkA, rB, rSkB, rSkA);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  function createTerrainMaterial() {
    const sandTex  = Assets.get('sand').map;
    const grassTex = Assets.get('grass').map;
    const dirtTex  = Assets.get('dirt').map;
    const rockTex  = Assets.get('rock').map;

    const mat = new THREE.MeshStandardMaterial({
      name: 'terrainSplat',
      roughness: 0.92,
      metalness: 0.02
    });
    mat.userData.wetUniform = { value: 0.0 };
    mat.userData.splatBaseCompile = (shader) => {
      shader.uniforms.uTexSand  = { value: sandTex };
      shader.uniforms.uTexGrass = { value: grassTex };
      shader.uniforms.uTexDirt  = { value: dirtTex };
      shader.uniforms.uTexRock  = { value: rockTex };
      shader.uniforms.uWetness  = mat.userData.wetUniform;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aSplat;\nvarying vec4 vSplat;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = aSplat;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uTexSand;
          uniform sampler2D uTexGrass;
          uniform sampler2D uTexDirt;
          uniform sampler2D uTexRock;
          uniform float uWetness;
          varying vec4 vSplat;
          varying vec3 vWPos;
          varying vec3 vWNorm;
          vec3 sampleAntiTile(sampler2D tex, vec2 wp, float freqA, float freqB) {
            vec2 uvA = wp * freqA;
            vec2 uvB = vec2(wp.x * 0.866 - wp.y * 0.5, wp.x * 0.5 + wp.y * 0.866) * freqB;
            float w = 0.5 + 0.5 * sin(wp.x * 0.051 + cos(wp.y * 0.047));
            return mix(texture2D(tex, uvA).rgb, texture2D(tex, uvB).rgb, w * 0.65);
          }
          vec3 sampleTriplanarRock(vec3 p, vec3 n) {
            vec3 blend = abs(n);
            blend = pow(blend, vec3(4.0));
            blend /= (blend.x + blend.y + blend.z + 0.0001);
            vec3 cx = texture2D(uTexRock, p.zy * 0.09).rgb;
            vec3 cy = texture2D(uTexRock, p.xz * 0.09).rgb;
            vec3 cz = texture2D(uTexRock, p.xy * 0.09).rgb;
            return cx * blend.x + cy * blend.y + cz * blend.z;
          }
        `)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 cSand  = sampleAntiTile(uTexSand,  vWPos.xz, 0.14, 0.053);
          vec3 cGrass = sampleAntiTile(uTexGrass, vWPos.xz, 0.22, 0.059);
          vec3 cDirt  = sampleAntiTile(uTexDirt,  vWPos.xz, 0.14, 0.061);
          vec3 cRock  = sampleTriplanarRock(vWPos, vWNorm);
          float turf = 0.90 + 0.12 * sin(vWPos.x * 2.3 + sin(vWPos.z * 2.7)) * cos(vWPos.z * 2.1 + sin(vWPos.x * 2.5));
          float macroPatch = 0.90 + 0.16 * sin(vWPos.x * 0.032 + 0.6) * cos(vWPos.z * 0.029);
          vec3 grassBlend = mix(cGrass, cDirt * vec3(0.88, 1.02, 0.72), 0.14 * (1.0 - macroPatch));
          vec3 albedoMix = (cSand * vSplat.r + grassBlend * vSplat.g + cDirt * vSplat.b + cRock * vSplat.a) * macroPatch * turf;
          diffuseColor.rgb *= albedoMix * (1.0 - 0.28 * uWetness);
        `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor * (1.0 - 0.35 * uWetness), 0.15, 0.98);
        `);
    };
    mat.onBeforeCompile = mat.userData.splatBaseCompile;
    mat.customProgramCacheKey = () => 'terrainSplat_v1';
    return mat;
  }

  function createWaterMesh() {
    const totalSize = SIZE + CONFIG.world.oceanBorder * 2;
    const geo = new THREE.PlaneGeometry(totalSize, totalSize, 72, 72);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      name: 'oceanWater',
      color: 0x164E63,
      roughness: 0.16,
      metalness: 0.45,
      transparent: true,
      opacity: 0.88
    });
    mat.userData.uTime = { value: 0 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = mat.userData.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWaterWorld;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float w1 = sin(position.x * 0.07 + uTime * 1.6) * cos(position.z * 0.06 + uTime * 1.2) * 0.18;
          float w2 = sin((position.x + position.z) * 0.14 - uTime * 2.1) * 0.08;
          transformed.y += w1 + w2;
          vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWaterWorld;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float crest = 0.5 + 0.5 * sin(vWaterWorld.x * 0.25 + uTime * 2.0) * cos(vWaterWorld.z * 0.22 - uTime * 1.7);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18, 0.42, 0.50), crest * 0.35);
        `);
    };
    mat.customProgramCacheKey = () => 'oceanWater_v1';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = CONFIG.world.seaLevel;
    mesh.receiveShadow = true;
    return mesh;
  }

  function createPoiLandmarks() {
    const g = new THREE.Group();
    g.name = 'PoiBeaconsAndSilhouettes';
    // Simple non-slop architectural landmarks so aerial flyovers show distinct POI silhouettes already in M2
    const concreteMat = Assets.get('concrete');
    const rustMat = Assets.get('rust');
    const woodMat = Assets.get('wood');

    // Smokestack at Pabrik Tua
    const stackH = getHeight(-420, 40);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 26, 12), Assets.get('brick'));
    stack.position.set(-420, stackH + 13, 40);
    stack.castShadow = true; stack.receiveShadow = true;
    g.add(stack);

    // Radio Tower truss mast at Menara Radio
    const mH = getHeight(-20, -240);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 2.2, 42, 4), rustMat);
    mast.position.set(-20, mH + 21, -240);
    mast.castShadow = true;
    g.add(mast);

    // Runway pad at Pangkalan Elang
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
      // Preserve splat shader while letting CSM attach its shadow cascade shader hooks cleanly
      const baseCompile = terrainMat.onBeforeCompile;
      csmInstance.setupMaterial(terrainMat);
      const csmCompile = terrainMat.onBeforeCompile;
      terrainMat.onBeforeCompile = (shader, renderer) => {
        if (baseCompile) baseCompile(shader, renderer);
        if (csmCompile) csmCompile(shader, renderer);
      };
    }

    const chunkLods = [32, 16, 8]; // Segs per 100m chunk
    terrainChunks = [];
    for (let cz = 0; cz < GRID; cz++) {
      for (let cx = 0; cx < GRID; cx++) {
        const lod = new THREE.LOD();
        const centerX = -HALF + (cx + 0.5) * CHUNK;
        const centerZ = -HALF + (cz + 0.5) * CHUNK;
        lod.userData = { cx, cz, centerX, centerZ };
        const g0 = buildChunkGeometry(cx, cz, chunkLods[0]);
        const g1 = buildChunkGeometry(cx, cz, chunkLods[1]);
        const g2 = buildChunkGeometry(cx, cz, chunkLods[2]);
        const m0 = new THREE.Mesh(g0, terrainMat);
        const m1 = new THREE.Mesh(g1, terrainMat);
        const m2 = new THREE.Mesh(g2, terrainMat);
        m0.receiveShadow = m1.receiveShadow = true;
        m0.castShadow = false;
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
    group.add(waterMesh);
    poiMarkers = createPoiLandmarks();
    group.add(poiMarkers);
    scene.add(group);

    if (typeof WorldBuildings !== 'undefined') {
      await WorldBuildings.build(scene, seed, csmInstance);
    }
    if (onStage) onStage('Menanam 5 spesies flora tropis, bebatuan & kendaraan...', 86);
    if (typeof WorldFlora !== 'undefined') {
      await WorldFlora.build(scene, seed, csmInstance, UI.settings.grassDist);
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
    if (typeof WorldBuildings !== 'undefined') WorldBuildings.dispose(scene);
    if (typeof WorldFlora !== 'undefined') WorldFlora.dispose(scene);
    if (typeof Loot !== 'undefined') Loot.dispose(scene);
    if (!group) return;
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    scene.remove(group);
    terrainChunks = [];
    group = null;
  }

  function isShootRangeCorridor(x, z) {
    return x >= -138 && x <= -82 && z >= -45 && z <= 335;
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
    isShootRangeCorridor,
    RIVER_PTS,
    ROAD_SEGMENTS,
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
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
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
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
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

    // Ground-anchored concrete foundation slab + ground-anchored step apron on entrance
    addBuildingPart(bx, baseY, bz, rotIdx, 0, -plinthH * 0.5, 0, w + 0.3, plinthH, d + 0.3, 'concrete');
    addBuildingPart(bx, baseY, bz, rotIdx, 0, -plinthH * 0.5, d * 0.5 + 0.55, 2.2, plinthH, 1.1, 'concrete');

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
      addBuildingPart(bx, baseY, bz, rotIdx, 0, 3.95, d * 0.5 + 1.62, 6.2, 0.95, 0.12, 'darkWood');
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
    }
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
      kotamini:  [['ruko2f', -34, -26, 0], ['ruko2f', 34, -26, 0], ['ruko2f', -34, 28, 2], ['ruko2f', 34, 28, 2], ['house2f', -68, 0, 1], ['house2f', 68, 0, 3], ['house1f', 0, -52, 0], ['house1f', 0, 52, 2]],
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
      if (World.isShootRangeCorridor(rx, rz)) continue;
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
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      rootGroup.add(mesh);
      mergedDrawCalls++;
    }
    buckets.clear();
    scene.add(rootGroup);
    return { drawCalls: mergedDrawCalls, buildings: footprints.length, doors: doors.length, pads: lootPads.length };
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
  }

  function dispose(scene) {
    if (rootGroup) {
      rootGroup.traverse((o) => { if (o.geometry && o.geometry !== sharedDoorGeo && o.geometry !== sharedGlassGeo) o.geometry.dispose(); });
      scene.remove(rootGroup);
      rootGroup = null;
    }
    if (sharedDoorGeo) { sharedDoorGeo.dispose(); sharedDoorGeo = null; }
    if (sharedGlassGeo) { sharedGlassGeo.dispose(); sharedGlassGeo = null; }
    radarMesh = null; beaconMesh = null;
  }

  function setNightMode(isNight) {
    const gMat = Assets.get('glass');
    if (gMat) {
      gMat.emissive?.setHex(isNight ? 0xFFA94D : 0x000000);
      gMat.emissiveIntensity = isNight ? 0.65 : 0.0;
      gMat.opacity = isNight ? 0.68 : 0.56;
    }
  }

  return {
    build, update, dispose, findNearestDoor, setNightMode,
    get footprints() { return footprints; },
    get lootPads() { return lootPads; },
    get doors() { return doors; },
    get glassPanes() { return glassPanes; },
    get bridges() { return bridges; }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// WORLDFLORA — 5 Species Instanced Foliage, Wind Grass, Rocks, Cars & Poles
// ════════════════════════════════════════════════════════════════════════════
const WorldFlora = (() => {
  let floraGroup = null;
  let grassMesh = null;
  let grassMat = null;
  const grassSlots = [];
  let lastGrassCenter = new THREE.Vector3(9999, 0, 9999);
  const floraPositions = []; // for NavGrid cover bonus / check

  function buildLeafMaterial(tintHex, isWind = false) {
    const base = Assets.get('leafCard').clone();
    base.color.setHex(tintHex);
    base.alphaTest = 0.35;
    base.side = THREE.DoubleSide;
    if (isWind) {
      base.userData.uTime = { value: 0 };
      base.userData.uWind = { value: 1.0 };
      base.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = base.userData.uTime;
        shader.uniforms.uWind = base.userData.uWind;
        shader.vertexShader = 'uniform float uTime; uniform float uWind;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float hWeight = clamp(position.y / 0.55, 0.0, 1.0);
           vec4 wPos = instanceMatrix * vec4(transformed, 1.0);
           transformed.x += sin(uTime * 2.6 + wPos.x * 0.4 + wPos.z * 0.3) * 0.14 * hWeight * uWind;
           transformed.z += cos(uTime * 2.1 + wPos.z * 0.35) * 0.1 * hWeight * uWind;`
        );
      };
    }
    return base;
  }

  function makeMerged(geos) {
    const clean = geos.map(raw => {
      const g = raw.index ? raw.toNonIndexed() : raw.clone();
      if (g.attributes.uv1) g.deleteAttribute('uv1');
      if (!g.attributes.normal) g.computeVertexNormals();
      raw.dispose();
      return g;
    });
    const m = BufferGeometryUtils.mergeGeometries(clean, false);
    clean.forEach(c => c.dispose());
    return m;
  }

  function makeSpeciesGeometries() {
    // 1. Pinus: tall straight trunk + 4 tiered cones
    const pinusT = makeMerged([new THREE.CylinderGeometry(0.14, 0.32, 9.5, 7).translate(0, 4.75, 0)]);
    const pinusC = makeMerged([
      new THREE.ConeGeometry(2.3, 3.2, 8).translate(0, 5.2, 0),
      new THREE.ConeGeometry(1.9, 2.9, 8).translate(0, 7.1, 0),
      new THREE.ConeGeometry(1.4, 2.6, 7).translate(0, 8.9, 0),
      new THREE.ConeGeometry(0.85, 2.0, 7).translate(0, 10.5, 0)
    ]);

    // 2. Jati (Teak): forked trunk + layered canopy slabs
    const jatiT = makeMerged([
      new THREE.CylinderGeometry(0.26, 0.42, 4.8, 7).translate(0, 2.4, 0),
      new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6).rotateZ(0.42).translate(-0.55, 5.2, 0),
      new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6).rotateZ(-0.42).translate(0.55, 5.2, 0)
    ]);
    const jatiC = makeMerged([
      new THREE.DodecahedronGeometry(2.2, 1).scale(1.25, 0.72, 1.15).translate(0, 6.8, 0),
      new THREE.DodecahedronGeometry(1.6, 1).scale(1.1, 0.7, 1.1).translate(-1.3, 5.9, 0.4),
      new THREE.DodecahedronGeometry(1.6, 1).scale(1.1, 0.7, 1.1).translate(1.2, 6.0, -0.5)
    ]);

    // 3. Kelapa (Coconut Palm): slight curved trunk + 7 arching frond blades
    const segs = [];
    for (let s = 0; s < 6; s++) {
      const g = new THREE.CylinderGeometry(0.2 - s * 0.015, 0.23 - s * 0.015, 1.65, 7);
      g.rotateZ(-0.04 * s);
      g.translate(s * s * 0.04, 0.8 + s * 1.48, 0);
      segs.push(g);
    }
    const kelapaT = makeMerged(segs);
    const frondGeos = [];
    for (let f = 0; f < 7; f++) {
      const a = (f / 7) * Math.PI * 2;
      const fg = new THREE.PlaneGeometry(0.95, 3.2, 1, 3);
      fg.rotateX(-Math.PI * 0.36);
      fg.translate(0, 0.15, -1.55);
      fg.rotateY(a);
      fg.translate(1.1, 9.2, 0);
      frondGeos.push(fg);
    }
    const kelapaC = makeMerged(frondGeos);

    // 4. Mangga (Broad tropical fruit canopy)
    const manggaT = makeMerged([new THREE.CylinderGeometry(0.28, 0.46, 3.4, 8).translate(0, 1.7, 0)]);
    const manggaC = makeMerged([
      new THREE.IcosahedronGeometry(2.5, 1).scale(1.2, 0.88, 1.2).translate(0, 4.7, 0),
      new THREE.IcosahedronGeometry(1.6, 1).translate(1.3, 4.1, 0.8),
      new THREE.IcosahedronGeometry(1.6, 1).translate(-1.2, 4.2, -0.8)
    ]);

    // 5. Semak (Dense tropical bush - no solid trunk collider)
    const semakC = makeMerged([
      new THREE.DodecahedronGeometry(0.85, 1).scale(1.35, 0.9, 1.2).translate(0, 0.65, 0),
      new THREE.DodecahedronGeometry(0.6, 0).translate(0.55, 0.5, 0.3),
      new THREE.DodecahedronGeometry(0.6, 0).translate(-0.5, 0.5, -0.3)
    ]);

    return { pinusT, pinusC, jatiT, jatiC, kelapaT, kelapaC, manggaT, manggaC, semakC };
  }

  function isClearOfStructures(x, z, margin = 3.5) {
    if (World.isShootRangeCorridor(x, z)) return false;
    if (World.getRoadDist(x, z) < 5.5) return false;
    const fps = WorldBuildings.footprints;
    for (let i = 0; i < fps.length; i++) {
      const f = fps[i];
      if (x >= f.minX - margin && x <= f.maxX + margin && z >= f.minZ - margin && z <= f.maxZ + margin) return false;
    }
    return true;
  }

  async function build(scene, seed, csmInstance, grassDist) {
    dispose(scene);
    floraGroup = new THREE.Group();
    floraGroup.name = 'PulauRajawaliFlora';
    floraPositions.length = 0;
    const rng = Util.mulberry32(seed + 7711);

    const geos = makeSpeciesGeometries();
    const barkMat = Assets.get('bark');
    const leafPinus = buildLeafMaterial(0x9BC48A);
    const leafJati = buildLeafMaterial(0xDCEFB4);
    const leafKelapa = buildLeafMaterial(0xD2EE9E);
    const leafMangga = buildLeafMaterial(0xBFE08C);
    const leafSemak = buildLeafMaterial(0xCCE89C);

    const pools = {
      pinus: [], jati: [], kelapa: [], mangga: [], semak: [],
      rocks: [], poles: [], cars: []
    };

    // Scatter Trees & Bushes cleanly by biome elevation
    for (let i = 0; i < 4200; i++) {
      const x = (rng() - 0.5) * 1420;
      const z = (rng() - 0.5) * 1420;
      const h = World.getHeight(x, z);
      if (h < 1.0) continue;
      if (World.getRiverDist(x, z) < 20) continue;
      const n = World.getNormal(x, z, Util.v1);
      if (1 - n.y > 0.36) continue;
      if (!isClearOfStructures(x, z, 4.2)) continue;

      const scale = 0.82 + rng() * 0.45;
      const rot = rng() * Math.PI * 2;
      if (h < 7.0 && pools.kelapa.length < 240) {
        pools.kelapa.push({ x, y: h - 0.15, z, rot, scale });
      } else if (h >= 28 && pools.pinus.length < 340) {
        pools.pinus.push({ x, y: h - 0.15, z, rot, scale });
      } else if (h >= 5 && h < 42 && rng() < 0.28 && pools.jati.length < 320) {
        pools.jati.push({ x, y: h - 0.15, z, rot, scale });
      } else if (h >= 4 && h < 28 && rng() < 0.25 && pools.mangga.length < 220) {
        pools.mangga.push({ x, y: h - 0.15, z, rot, scale });
      } else if (h >= 2.2 && pools.semak.length < 520) {
        pools.semak.push({ x, y: h - 0.1, z, rot, scale: 0.75 + rng() * 0.6 });
      }
    }

    // Scattered Boulders
    for (let i = 0; i < 650 && pools.rocks.length < 220; i++) {
      const x = (rng() - 0.5) * 1420, z = (rng() - 0.5) * 1420;
      const h = World.getHeight(x, z);
      if (h < 0.5) continue;
      if (!isClearOfStructures(x, z, 3.8)) continue;
      pools.rocks.push({ x, y: h, z, rot: rng() * 6.28, sx: 1.0 + rng() * 1.9, sy: 0.7 + rng() * 1.3, sz: 1.0 + rng() * 1.8 });
    }

    // Utility Poles along road corridors (offset 6.2m from road centerline)
    for (let i = 0; i < World.ROAD_SEGMENTS.length; i++) {
      const [a, b] = World.ROAD_SEGMENTS[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
      const nx = -dz, nz = dx;
      for (let d = 24; d < len - 24; d += 38) {
        const px = a[0] + dx * d + nx * 6.4;
        const pz = a[1] + dz * d + nz * 6.4;
        if (World.isShootRangeCorridor(px, pz) || World.getRiverDist(px, pz) < 24) continue;
        const py = World.getHeight(px, pz);
        if (py > 1.2) pools.poles.push({ x: px, y: py, z: pz, rot: Math.atan2(dx, dz) });
      }
    }

    // Damaged / Parked Tactical Vehicles near roads & POIs
    for (let i = 0; i < World.ROAD_SEGMENTS.length && pools.cars.length < 32; i++) {
      const [a, b] = World.ROAD_SEGMENTS[i];
      for (const t of [0.28, 0.58, 0.82]) {
        if (pools.cars.length >= 32) break;
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const ang = Math.atan2(dx, dz);
        const cx = a[0] + dx * t + (rng() - 0.5) * 3.5;
        const cz = a[1] + dz * t + (rng() - 0.5) * 3.5;
        if (World.isShootRangeCorridor(cx, cz) || World.getRiverDist(cx, cz) < 28) continue;
        const cy = World.getHeight(cx, cz);
        if (cy > 1.5 && isClearOfStructures(cx, cz, 3.0)) {
          pools.cars.push({ x: cx, y: cy, z: cz, rot: ang + (rng() - 0.5) * 0.4, cidx: pools.cars.length });
        }
      }
    }

    const dummy = new THREE.Object3D();
    const spawnInstanced = (geo, mat, items, registerColRad = 0, colH = 3.5, colMat = 'wood') => {
      if (!items.length) return;
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      im.castShadow = true; im.receiveShadow = true;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        dummy.position.set(it.x, it.y, it.z);
        dummy.rotation.set(0, it.rot || 0, 0);
        const s = it.scale || 1;
        dummy.scale.set(it.sx || s, it.sy || s, it.sz || s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (registerColRad > 0) {
          const r = registerColRad * (it.sx || s);
          Physics.addCollider({ minX: it.x - r, maxX: it.x + r, minY: it.y, maxY: it.y + colH * s, minZ: it.z - r, maxZ: it.z + r, mat: colMat, tag: 'world' });
        }
      }
      im.instanceMatrix.needsUpdate = true;
      floraGroup.add(im);
      return im;
    };

    spawnInstanced(geos.pinusT, barkMat, pools.pinus, 0.34, 6.0, 'wood');
    spawnInstanced(geos.pinusC, leafPinus, pools.pinus);
    spawnInstanced(geos.jatiT, barkMat, pools.jati, 0.38, 4.5, 'wood');
    spawnInstanced(geos.jatiC, leafJati, pools.jati);
    spawnInstanced(geos.kelapaT, barkMat, pools.kelapa, 0.25, 6.5, 'wood');
    spawnInstanced(geos.kelapaC, leafKelapa, pools.kelapa);
    spawnInstanced(geos.manggaT, barkMat, pools.mangga, 0.4, 3.6, 'wood');
    spawnInstanced(geos.manggaC, leafMangga, pools.mangga);
    spawnInstanced(geos.semakC, leafSemak, pools.semak, 0); // Walk-through crouch bush cover!

    const rockGeo = new THREE.DodecahedronGeometry(1.15, 0);
    spawnInstanced(rockGeo, Assets.get('rock'), pools.rocks, 0.95, 1.5, 'concrete');

    const poleGeo = makeMerged([
      new THREE.CylinderGeometry(0.11, 0.15, 7.2, 6).translate(0, 3.6, 0),
      new THREE.BoxGeometry(1.6, 0.12, 0.12).translate(0, 6.6, 0)
    ]);
    spawnInstanced(poleGeo, Assets.get('wood'), pools.poles, 0.2, 6.0, 'wood');

    // Vehicles (Body + cabin + wheels merged)
    if (pools.cars.length) {
      const carGeo = makeMerged([
        new THREE.BoxGeometry(2.1, 0.85, 4.4).translate(0, 0.68, 0),
        new THREE.BoxGeometry(1.85, 0.68, 2.2).translate(0, 1.42, -0.25),
        new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10).rotateZ(Math.PI * 0.5).translate(-1.02, 0.36, 1.35),
        new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10).rotateZ(Math.PI * 0.5).translate(1.02, 0.36, 1.35),
        new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10).rotateZ(Math.PI * 0.5).translate(-1.02, 0.36, -1.35),
        new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10).rotateZ(Math.PI * 0.5).translate(1.02, 0.36, -1.35)
      ]);
      const carMat = Assets.get('rust').clone();
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

    // Dynamic Wind Grass Ring around player: dense importance-sampled living meadow + wildflower accents
    const gCount = grassDist > 0 ? Math.min(8200, Math.round(grassDist * 145)) : 0;
    if (gCount > 0) {
      const tuftCanvas = document.createElement('canvas');
      tuftCanvas.width = 256; tuftCanvas.height = 128;
      const tctx = tuftCanvas.getContext('2d');
      tctx.clearRect(0, 0, 256, 128);
      const tRng = Util.mulberry32(99123);
      for (let bi = 0; bi < 32; bi++) {
        const bx = 12 + (bi / 31) * 232 + (tRng() - 0.5) * 6;
        const h = 58 + tRng() * 64;
        const lean = (tRng() - 0.5) * 42;
        const bw = 3.2 + tRng() * 2.8;
        const tx = bx + lean;
        const ty = 128 - h;
        const cx = bx + lean * 0.38;
        const cy = 128 - h * 0.55;
        const grad = tctx.createLinearGradient(bx, 128, tx, ty);
        grad.addColorStop(0, '#3D5723');
        grad.addColorStop(0.45, '#5D8135');
        grad.addColorStop(0.85, '#7DA349');
        grad.addColorStop(1, '#9AB85D');
        tctx.fillStyle = grad;
        tctx.beginPath();
        tctx.moveTo(bx - bw, 128);
        tctx.quadraticCurveTo(cx - bw * 0.4, cy, tx, ty);
        tctx.quadraticCurveTo(cx + bw * 0.4, cy, bx + bw, 128);
        tctx.closePath();
        tctx.fill();
        if (bi % 7 === 2) {
          tctx.fillStyle = bi % 14 === 2 ? '#EFE290' : '#E7F0D2';
          tctx.beginPath();
          tctx.arc(tx, ty + 2, 2.8, 0, Math.PI * 2);
          tctx.fill();
        }
      }
      const tuftTex = new THREE.CanvasTexture(tuftCanvas);
      tuftTex.colorSpace = THREE.SRGBColorSpace;
      tuftTex.anisotropy = 4;

      const makeCard = (rotY, tiltX) => {
        const g = new THREE.PlaneGeometry(0.76, 0.46, 1, 3);
        const posA = g.getAttribute('position');
        for (let i = 0; i < posA.count; i++) {
          const py = posA.getY(i) + 0.23;
          const t = Math.max(0, py / 0.46);
          posA.setZ(i, posA.getZ(i) + t * t * 0.08);
        }
        posA.needsUpdate = true;
        return g.translate(0, 0.21, 0).rotateX(tiltX).rotateY(rotY);
      };
      const bladeGeo = makeMerged([
        makeCard(0, 0.07),
        makeCard(Math.PI * 0.25, -0.06),
        makeCard(Math.PI * 0.5, 0.07),
        makeCard(Math.PI * 0.75, -0.06)
      ]);
      const nAttr = bladeGeo.getAttribute('normal');
      for (let i = 0; i < nAttr.count; i++) nAttr.setXYZ(i, 0, 1, 0);
      nAttr.needsUpdate = true;

      grassMat = new THREE.MeshStandardMaterial({
        name: 'grassBlades',
        map: tuftTex,
        color: 0xFFFFFF,
        alphaTest: 0.38,
        roughness: 0.90,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
      grassMat.userData.uTime = { value: 0 };
      grassMat.userData.uWind = { value: 1.0 };
      grassMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = grassMat.userData.uTime;
        shader.uniforms.uWind = grassMat.userData.uWind;
        shader.vertexShader = 'uniform float uTime; uniform float uWind;\nvarying float vBladeH;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float hWeight = clamp(position.y / 0.44, 0.0, 1.0);
           vBladeH = hWeight;
           vec4 wPos = instanceMatrix * vec4(transformed, 1.0);
           float gust = 0.7 + 0.55 * sin(uTime * 1.45 + wPos.x * 0.14 + wPos.z * 0.11);
           transformed.x += sin(uTime * 2.5 + wPos.x * 0.42 + wPos.z * 0.30) * 0.16 * hWeight * uWind * gust;
           transformed.z += cos(uTime * 2.1 + wPos.z * 0.36) * 0.11 * hWeight * uWind * gust;`
        );
        shader.fragmentShader = 'varying float vBladeH;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           diffuseColor.rgb *= mix(0.62, 1.08, vBladeH);`
        );
      };
      grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, gCount);
      grassMesh.frustumCulled = false;
      grassMesh.receiveShadow = true;
      grassSlots.length = 0;
      const gTints = [new THREE.Color(0xDBE8C4), new THREE.Color(0xC9DEB0), new THREE.Color(0xE6EDC0), new THREE.Color(0xBDCE9C)];
      for (let i = 0; i < gCount; i++) {
        const ang = rng() * Math.PI * 2;
        const r = Math.pow(rng(), 0.72); // denser carpet within 0..26m around player, smooth fade to edge
        grassSlots.push({
          ox: Math.cos(ang) * r,
          oz: Math.sin(ang) * r,
          rot: rng() * Math.PI * 2,
          s: 0.78 + rng() * 0.62
        });
        grassMesh.setColorAt(i, gTints[i % gTints.length]);
      }
      if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
      floraGroup.add(grassMesh);
      lastGrassCenter.set(9999, 0, 9999);
    }

    scene.add(floraGroup);
    return {
      trees: pools.pinus.length + pools.jati.length + pools.kelapa.length + pools.mangga.length,
      bushes: pools.semak.length, rocks: pools.rocks.length, cars: pools.cars.length
    };
  }

  const gDummy = new THREE.Object3D();
  function update(elapsed, centerPos, weatherState, grassDist) {
    if (!grassMesh || !centerPos) return;
    if (grassMat?.userData?.uTime) {
      grassMat.userData.uTime.value = elapsed;
      grassMat.userData.uWind.value = weatherState?.wind || 1.0;
    }
    if (Math.hypot(centerPos.x - lastGrassCenter.x, centerPos.z - lastGrassCenter.z) < 4) return;
    lastGrassCenter.copy(centerPos);
    const radius = Math.max(24, Math.min(68, grassDist || 44));
    const n = grassSlots.length;
    const fps = WorldBuildings.footprints;
    for (let i = 0; i < n; i++) {
      const sl = grassSlots[i];
      const gx = centerPos.x + sl.ox * radius;
      const gz = centerPos.z + sl.oz * radius;
      const gh = World.getHeight(gx, gz);
      let insideB = false;
      for (let bi = 0; bi < fps.length; bi++) {
        const f = fps[bi];
        if (gx >= f.minX - 0.25 && gx <= f.maxX + 0.25 && gz >= f.minZ - 0.25 && gz <= f.maxZ + 0.25) { insideB = true; break; }
      }
      if (insideB || gh < 2.2 || gh > 54 || World.getRoadDist(gx, gz) < 4.5 || World.getRiverDist(gx, gz) < 18) {
        gDummy.scale.set(0, 0, 0);
      } else {
        gDummy.position.set(gx, gh - 0.05, gz);
        gDummy.rotation.set(0, sl.rot, 0);
        gDummy.scale.set(sl.s, sl.s, sl.s);
      }
      gDummy.updateMatrix();
      grassMesh.setMatrixAt(i, gDummy.matrix);
    }
    grassMesh.instanceMatrix.needsUpdate = true;
  }

  function dispose(scene) {
    if (floraGroup) {
      floraGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      scene.remove(floraGroup);
      floraGroup = null;
    }
    grassMesh = null; grassMat = null; grassSlots.length = 0;
  }

  return { build, update, dispose };
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

