// ════════════════════════════════════════════════════════════════════════════
// LOOT — Tiered World Loot Registry, Death Crates, Spatial Hash & Instanced Visuals
// ════════════════════════════════════════════════════════════════════════════
const Loot = (() => {
  const ITEMS = {
    // Weapons (11)
    m416:   { id: 'm416',   cat: 'weapon', name: 'M416',   wt: 0, tier: 2, color: 0xF2B705, desc: 'Senapan Serbu 5.56mm' },
    akm:    { id: 'akm',    cat: 'weapon', name: 'AKM',    wt: 0, tier: 1, color: 0xF2B705, desc: 'Senapan Serbu 7.62mm' },
    scarl:  { id: 'scarl',  cat: 'weapon', name: 'SCAR-L', wt: 0, tier: 2, color: 0xF2B705, desc: 'Senapan Serbu 5.56mm' },
    ump45:  { id: 'ump45',  cat: 'weapon', name: 'UMP45',  wt: 0, tier: 1, color: 0xF2B705, desc: 'SMG .45 ACP' },
    vector: { id: 'vector', cat: 'weapon', name: 'Vector', wt: 0, tier: 2, color: 0xF2B705, desc: 'SMG 9mm Laju Cepat' },
    kar98k: { id: 'kar98k', cat: 'weapon', name: 'Kar98k', wt: 0, tier: 2, color: 0xFF9F1A, desc: 'Sniper Bolt 7.62mm' },
    m24:    { id: 'm24',    cat: 'weapon', name: 'M24',    wt: 0, tier: 3, color: 0xFF9F1A, desc: 'Sniper Militer 7.62mm' },
    mini14: { id: 'mini14', cat: 'weapon', name: 'Mini-14',wt: 0, tier: 2, color: 0xF2B705, desc: 'DMR Semi-Otomatis 5.56mm' },
    s12k:   { id: 's12k',   cat: 'weapon', name: 'S12K',   wt: 0, tier: 1, color: 0xF2B705, desc: 'Shotgun 12-Gauge' },
    p92:    { id: 'p92',    cat: 'weapon', name: 'P92',    wt: 0, tier: 1, color: 0xD9A441, desc: 'Pistol 9mm' },
    pan:    { id: 'pan',    cat: 'weapon', name: 'Panci',  wt: 0, tier: 1, color: 0x9CA3AF, desc: 'Melee + Pelindung Belakang' },
    // Ammo
    ammo556: { id: 'ammo556', cat: 'ammo', ammoKey: '556', qty: 30, name: 'Peluru 5.56mm (30)', wt: 0.45, color: 0x7A8B4A },
    ammo762: { id: 'ammo762', cat: 'ammo', ammoKey: '762', qty: 30, name: 'Peluru 7.62mm (30)', wt: 0.55, color: 0x7A8B4A },
    ammo9mm: { id: 'ammo9mm', cat: 'ammo', ammoKey: '9mm', qty: 30, name: 'Peluru 9mm (30)',    wt: 0.35, color: 0x7A8B4A },
    ammo45:  { id: 'ammo45',  cat: 'ammo', ammoKey: '45acp', qty: 30, name: 'Peluru .45 (30)',  wt: 0.4,  color: 0x7A8B4A },
    ammo12:  { id: 'ammo12',  cat: 'ammo', ammoKey: '12ga', qty: 10, name: 'Selongsong 12G (10)',wt: 0.7,  color: 0x7A8B4A },
    // Armor & Backpacks
    helm1: { id: 'helm1', cat: 'helm', level: 1, dur: 80,  name: 'Helm Lvl 1', wt: 0, color: 0x4A90E2 },
    helm2: { id: 'helm2', cat: 'helm', level: 2, dur: 150, name: 'Helm Lvl 2', wt: 0, color: 0x4A90E2 },
    helm3: { id: 'helm3', cat: 'helm', level: 3, dur: 230, name: 'Helm Spetsnaz Lvl 3', wt: 0, color: 0x2B8CFF },
    vest1: { id: 'vest1', cat: 'vest', level: 1, dur: 200, name: 'Rompi Lvl 1', wt: 0, color: 0x4A90E2 },
    vest2: { id: 'vest2', cat: 'vest', level: 2, dur: 220, name: 'Rompi Lvl 2', wt: 0, color: 0x4A90E2 },
    vest3: { id: 'vest3', cat: 'vest', level: 3, dur: 250, name: 'Rompi Militer Lvl 3', wt: 0, color: 0x2B8CFF },
    bag1:  { id: 'bag1',  cat: 'bag',  level: 1, cap: 150, name: 'Tas Ransel Lvl 1', wt: 0, color: 0x637A96 },
    bag2:  { id: 'bag2',  cat: 'bag',  level: 2, cap: 250, name: 'Tas Ransel Lvl 2', wt: 0, color: 0x4A90E2 },
    bag3:  { id: 'bag3',  cat: 'bag',  level: 3, cap: 350, name: 'Tas Komando Lvl 3', wt: 0, color: 0x2B8CFF },
    // Consumables
    medkit:     { id: 'medkit',     cat: 'med', medKey: 'medkit',     name: 'Medkit',       wt: 20, color: 0xE54B4B },
    firstaid:   { id: 'firstaid',   cat: 'med', medKey: 'firstaid',   name: 'Kotak P3K',    wt: 10, color: 0xE54B4B },
    bandage:    { id: 'bandage',    cat: 'med', medKey: 'bandage',    name: 'Perban',       wt: 2,  color: 0xEFEFEF },
    drink:      { id: 'drink',      cat: 'med', medKey: 'drink',      name: 'Minuman Energi', wt: 4,  color: 0x3EC994 },
    painkiller: { id: 'painkiller', cat: 'med', medKey: 'painkiller', name: 'Pereda Nyeri', wt: 10, color: 0x3EC994 },
    adrenaline: { id: 'adrenaline', cat: 'med', medKey: 'adrenaline', name: 'Adrenalin',    wt: 20, color: 0x1FB6A6 },
    // Throwables
    frag:      { id: 'frag',      cat: 'throw', throwKey: 'frag',      name: 'Granat Frag',   wt: 12, color: 0xFF7B47 },
    smoke:     { id: 'smoke',     cat: 'throw', throwKey: 'smoke',     name: 'Granat Asap',   wt: 10, color: 0x8F9BA6 },
    flashbang: { id: 'flashbang', cat: 'throw', throwKey: 'flashbang', name: 'Flashbang',     wt: 8,  color: 0xF5F7FA },
    // Attachments
    reddot:    { id: 'reddot',    cat: 'att', attId: 'reddot',    name: 'Red Dot Sight', wt: 4, color: 0xA8B2C2 },
    holo:      { id: 'holo',      cat: 'att', attId: 'holo',      name: 'Holographic Sight', wt: 4, color: 0xA8B2C2 },
    scope2x:   { id: 'scope2x',   cat: 'att', attId: 'scope2x',   name: 'Scope 2x', wt: 5, color: 0xA8B2C2 },
    scope4x:   { id: 'scope4x',   cat: 'att', attId: 'scope4x',   name: 'Scope 4x ACOG', wt: 7, color: 0x90B4D8 },
    scope8x:   { id: 'scope8x',   cat: 'att', attId: 'scope8x',   name: 'Scope 8x CQBSS', wt: 9, color: 0x72A6E8 },
    comp:      { id: 'comp',      cat: 'att', attId: 'comp',      name: 'Kompensator', wt: 4, color: 0xA8B2C2 },
    flash:     { id: 'flash',     cat: 'att', attId: 'flash',     name: 'Flash Hider', wt: 3, color: 0xA8B2C2 },
    suppressor:{ id: 'suppressor',cat: 'att', attId: 'suppressor',name: 'Peredam', wt: 6, color: 0x72A6E8 },
    vertgrip:  { id: 'vertgrip',  cat: 'att', attId: 'vertgrip',  name: 'Grip Vertikal', wt: 4, color: 0xA8B2C2 },
    angled:    { id: 'angled',    cat: 'att', attId: 'angled',    name: 'Angled Grip', wt: 4, color: 0xA8B2C2 },
    laser:     { id: 'laser',     cat: 'att', attId: 'laser',     name: 'Laser Taktis', wt: 3, color: 0x3EC994 },
    extmag:    { id: 'extmag',    cat: 'att', attId: 'extmag',    name: 'Magasen Diperpanjang', wt: 5, color: 0xA8B2C2 },
    quickdraw: { id: 'quickdraw', cat: 'att', attId: 'quickdraw', name: 'Magasen Cepat', wt: 5, color: 0xA8B2C2 },
    extquick:  { id: 'extquick',  cat: 'att', attId: 'extquick',  name: 'Magasen Ekstend+Cepat', wt: 6, color: 0x72A6E8 },
    tacstock:  { id: 'tacstock',  cat: 'att', attId: 'tacstock',  name: 'Popor Taktis', wt: 5, color: 0xA8B2C2 },
    cheekpad:  { id: 'cheekpad',  cat: 'att', attId: 'cheekpad',  name: 'Cheek Pad', wt: 5, color: 0xA8B2C2 }
  };

  const POOLS_BY_TIER = {
    1: ['ump45','s12k','p92','akm','pan','ammo9mm','ammo45','ammo12','ammo762','helm1','vest1','bag1','bandage','firstaid','drink','frag','smoke','reddot','flash','vertgrip','quickdraw'],
    2: ['m416','scarl','vector','mini14','kar98k','akm','ammo556','ammo762','ammo9mm','helm2','vest2','bag2','firstaid','painkiller','bandage','drink','frag','smoke','flashbang','holo','scope2x','scope4x','comp','angled','extmag','tacstock','laser'],
    3: ['m416','m24','kar98k','scarl','vector','mini14','ammo556','ammo762','helm3','helm2','vest3','vest2','bag3','bag2','medkit','adrenaline','painkiller','firstaid','frag','smoke','scope4x','scope8x','suppressor','extquick','cheekpad','comp']
  };

  const WEAPON_AMMO = { m416: 'ammo556', scarl: 'ammo556', mini14: 'ammo556', akm: 'ammo762', kar98k: 'ammo762', m24: 'ammo762', vector: 'ammo9mm', p92: 'ammo9mm', ump45: 'ammo45', s12k: 'ammo12' };

  const groundItems = [];
  const deathCrates = [];
  const spatial = new Map();
  let visualIM = null;
  let crateGroup = null;
  let crateGeo = null;
  const MAX_VIS = 520;
  let lastVisPos = new THREE.Vector3(9999, 0, 9999);
  const vDummy = new THREE.Object3D();
  const cTmp = new THREE.Color();

  function addSpatial(it) {
    const k = `${Math.floor(it.x / 8)},${Math.floor(it.z / 8)}`;
    let a = spatial.get(k);
    if (!a) { a = []; spatial.set(k, a); }
    a.push(it);
  }

  function spawnItemAt(itemId, x, y, z, qty = 1) {
    const def = ITEMS[itemId];
    if (!def) return null;
    const it = { uid: groundItems.length, itemId, def, qty, x, y, z, taken: false };
    groundItems.push(it);
    addSpatial(it);
    return it;
  }

  function spawnWorldLoot(scene, pads, seed) {
    dispose(scene);
    groundItems.length = 0;
    deathCrates.length = 0;
    spatial.clear();
    const rng = Util.mulberry32(seed + 9203);

    crateGroup = new THREE.Group();
    crateGroup.name = 'RajawaliDeathCrates';
    scene.add(crateGroup);

    const gunArmed = new Set();
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      const t = Util.clamp(p.tier || 1, 1, 3);
      const pool = POOLS_BY_TIER[t];

      // Guarantee each building gets at least 1 rifle/SMG + matching ammo + 1 gear/heal!
      if (!gunArmed.has(p.bId)) {
        gunArmed.add(p.bId);
        const wPool = pool.filter(id => ITEMS[id].cat === 'weapon' && id !== 'pan');
        const wid = wPool[Math.floor(rng() * wPool.length)] || 'm416';
        spawnItemAt(wid, p.x, p.y, p.z, 1);
        const ak = WEAPON_AMMO[wid];
        if (ak) spawnItemAt(ak, p.x + 0.38, p.y, p.z + 0.15, 2);
      } else {
        const roll = pool[Math.floor(rng() * pool.length)];
        spawnItemAt(roll, p.x, p.y, p.z, ITEMS[roll].cat === 'ammo' ? 2 : 1);
        if (ITEMS[roll].cat === 'weapon' && WEAPON_AMMO[roll]) {
          spawnItemAt(WEAPON_AMMO[roll], p.x - 0.35, p.y, p.z + 0.25, 2);
        } else if (rng() < 0.45) {
          const second = pool[Math.floor(rng() * pool.length)];
          spawnItemAt(second, p.x + 0.35, p.y, p.z - 0.2, 1);
        }
      }
    }

    const boxG = new THREE.BoxGeometry(0.42, 0.16, 0.28);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.25 });
    visualIM = new THREE.InstancedMesh(boxG, mat, MAX_VIS);
    visualIM.frustumCulled = false;
    scene.add(visualIM);
    lastVisPos.set(9999, 0, 9999);
    return groundItems.length;
  }

  function spawnDeathCrate(x, y, z, itemsList, ownerName = 'Kombatan') {
    if (!crateGroup) return null;
    let cx = x, cy = y, cz = z, list = itemsList, owner = ownerName;
    if (x && typeof x === 'object') {
      cx = Number(x.x) || 0;
      cy = Number(x.y) || 0;
      cz = Number(x.z) || 0;
      list = Array.isArray(y) ? y : [];
      owner = typeof z === 'string' && z ? z : 'Kombatan';
    }
    const normItems = Array.isArray(list)
      ? list
          .filter(it => it && (it.def || ITEMS[it.itemId || it.id]))
          .map(it => {
            const iid = it.itemId || it.id || it.def?.id;
            return { itemId: iid, id: iid, def: it.def || ITEMS[iid], qty: it.qty || 1 };
          })
      : [];
    if (!crateGeo) crateGeo = new THREE.BoxGeometry(0.85, 0.48, 0.65);
    const m = new THREE.Mesh(crateGeo, Assets.get('wood'));
    const h = Math.max(Number.isFinite(cy) ? cy : 0, World.getHeight(cx, cz));
    m.position.set(cx, h + 0.24, cz);
    m.castShadow = true; m.receiveShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.68), new THREE.MeshStandardMaterial({ color: 0xD19A1B, roughness: 0.5 }));
    lid.position.y = 0.24;
    m.add(lid);
    crateGroup.add(m);
    const crate = { x: cx, y: h + 0.25, z: cz, ownerName: owner || 'Kombatan', items: normItems, mesh: m };
    deathCrates.push(crate);
    return crate;
  }

  function queryNearby(x, y, z, rad = 2.8) {
    const out = [];
    const c0x = Math.floor((x - rad) / 8), c1x = Math.floor((x + rad) / 8);
    const c0z = Math.floor((z - rad) / 8), c1z = Math.floor((z + rad) / 8);
    const rSq = rad * rad;
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const arr = spatial.get(`${cx},${cz}`);
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          if (it.taken) continue;
          const dx = it.x - x, dz = it.z - z;
          if (dx * dx + dz * dz <= rSq && Math.abs(it.y - y) < 2.2) out.push(it);
        }
      }
    }
    return out;
  }

  function findNearbyCrate(x, y, z, rad = 2.8) {
    for (let i = 0; i < deathCrates.length; i++) {
      const c = deathCrates[i];
      if (!c || !Array.isArray(c.items) || c.items.length === 0) continue;
      if (Math.hypot(c.x - x, c.z - z) <= rad && Math.abs(c.y - y) < 2.2) return c;
    }
    return null;
  }

  function markDirty() { lastVisPos.set(9999, 0, 9999); }

  function updateVisuals(playerPos) {
    if (!visualIM || !playerPos) return;
    if (Math.hypot(playerPos.x - lastVisPos.x, playerPos.z - lastVisPos.z) < 1.8) return;
    lastVisPos.copy(playerPos);
    const nearby = queryNearby(playerPos.x, playerPos.y, playerPos.z, 44);
    const cnt = Math.min(MAX_VIS, nearby.length);
    for (let i = 0; i < MAX_VIS; i++) {
      if (i < cnt) {
        const it = nearby[i];
        const isWep = it.def.cat === 'weapon';
        vDummy.position.set(it.x, it.y + 0.08, it.z);
        vDummy.rotation.set(0, (it.uid * 1.1) % 6.28, 0);
        vDummy.scale.set(isWep ? 1.8 : 1.0, isWep ? 0.85 : 1.0, isWep ? 0.75 : 1.0);
        vDummy.updateMatrix();
        visualIM.setMatrixAt(i, vDummy.matrix);
        cTmp.setHex(it.def.color || 0xF2B705);
        visualIM.setColorAt(i, cTmp);
      } else {
        vDummy.scale.set(0, 0, 0);
        vDummy.updateMatrix();
        visualIM.setMatrixAt(i, vDummy.matrix);
      }
    }
    visualIM.instanceMatrix.needsUpdate = true;
    if (visualIM.instanceColor) visualIM.instanceColor.needsUpdate = true;
  }

  function dispose(scene) {
    if (visualIM) { visualIM.geometry.dispose(); visualIM.material.dispose(); scene.remove(visualIM); visualIM = null; }
    if (crateGroup) { scene.remove(crateGroup); crateGroup = null; }
    if (crateGeo) { crateGeo.dispose(); crateGeo = null; }
  }

  return {
    ITEMS, POOLS_BY_TIER, WEAPON_AMMO,
    spawnWorldLoot, spawnItemAt, spawnDeathCrate, queryNearby, findNearbyCrate, markDirty, updateVisuals, dispose,
    get groundItems() { return groundItems; },
    get deathCrates() { return deathCrates; }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// MAPUI — Topographic Map Canvas Baker, Zooming Minimap [N] & Big Tactical Map [M]
// ════════════════════════════════════════════════════════════════════════════
const MapUI = (() => {
  const BASE_SIZE = 1024;
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = BASE_SIZE;
  baseCanvas.height = BASE_SIZE;
  const bCtx = baseCanvas.getContext('2d');

  const miniScales = [140, 280, 500];
  let miniZoomIdx = 0;
  let bigOpen = false;
  let panX = 0, panZ = 0, zoom = 1.0;
  let dragging = false, lastMx = 0, lastMy = 0, downMx = 0, downMy = 0;
  let ping = null; // { x, z }
  let initedEvents = false;

  function w2b(wx, wz) {
    return [(wx + 800) / 1600 * BASE_SIZE, (wz + 800) / 1600 * BASE_SIZE];
  }

  function bakeBaseMap() {
    const img = bCtx.createImageData(BASE_SIZE, BASE_SIZE);
    const data = img.data;
    for (let py = 0; py < BASE_SIZE; py++) {
      const wz = (py / BASE_SIZE) * 1600 - 800;
      for (let px = 0; px < BASE_SIZE; px++) {
        const wx = (px / BASE_SIZE) * 1600 - 800;
        const h = World.getHeight(wx, wz);
        const rd = World.getRiverDist(wx, wz);
        let r = 13, g = 37, b = 53;
        if (h < -3.0) { r = 11; g = 32; b = 46; }
        else if (h < 0.0) { r = 24; g = 68; b = 82; }
        else if (rd < 16 && h < 0.8) { r = 36; g = 104; b = 128; }
        else if (h < 2.2) { r = 148; g = 138; b = 102; }
        else {
          const t = Util.clamp(h / 75, 0, 1);
          const contour = (Math.floor(h / 10) !== Math.floor((World.getHeight(wx + 2.5, wz) / 10))) ? -14 : 0;
          r = 44 + t * 54 + contour;
          g = 68 + t * 42 + contour;
          b = 39 + t * 36 + contour;
        }
        const i = (py * BASE_SIZE + px) * 4;
        data[i] = Util.clamp(r, 0, 255); data[i + 1] = Util.clamp(g, 0, 255); data[i + 2] = Util.clamp(b, 0, 255); data[i + 3] = 255;
      }
    }
    bCtx.putImageData(img, 0, 0);

    // Draw Roads
    bCtx.strokeStyle = '#8F8267';
    bCtx.lineWidth = 4.2;
    bCtx.lineCap = 'round';
    for (const [a, b] of World.ROAD_SEGMENTS) {
      const [ax, az] = w2b(a[0], a[1]);
      const [bx, bz] = w2b(b[0], b[1]);
      bCtx.beginPath(); bCtx.moveTo(ax, az); bCtx.lineTo(bx, bz); bCtx.stroke();
    }

    // Draw 5 Bridges
    bCtx.strokeStyle = '#E5D3B3';
    bCtx.lineWidth = 6.5;
    for (const br of WorldBuildings.bridges) {
      const [x1, z1] = w2b(br.x1, br.z1);
      const [x2, z2] = w2b(br.x2, br.z2);
      bCtx.beginPath(); bCtx.moveTo(x1, z1); bCtx.lineTo(x2, z2); bCtx.stroke();
    }

    // Draw Building Footprints
    bCtx.fillStyle = '#D9CBAE';
    bCtx.strokeStyle = '#24292E';
    bCtx.lineWidth = 0.8;
    for (const fp of WorldBuildings.footprints) {
      const [bx, bz] = w2b(fp.cx, fp.cz);
      const bw = Math.max(3, fp.w / 1600 * BASE_SIZE);
      const bd = Math.max(3, fp.d / 1600 * BASE_SIZE);
      bCtx.fillRect(bx - bw * 0.5, bz - bd * 0.5, bw, bd);
      bCtx.strokeRect(bx - bw * 0.5, bz - bd * 0.5, bw, bd);
    }

    // Draw POI Names
    bCtx.font = '700 13px Inter, sans-serif';
    bCtx.textAlign = 'center';
    for (const p of CONFIG.pois) {
      const [px, pz] = w2b(p.x, p.z);
      bCtx.fillStyle = 'rgba(0,0,0,0.75)';
      bCtx.fillText(p.name.toUpperCase(), px + 1, pz - 7);
      bCtx.fillStyle = p.tier === 3 ? '#F2B705' : '#EDEFF1';
      bCtx.fillText(p.name.toUpperCase(), px, pz - 8);
    }
  }

  function updateMinimap(px, pz, pyaw, zones = null) {
    const cvs = document.getElementById('minimap-canvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.width, H = cvs.height;
    const halfViewM = miniScales[miniZoomIdx];
    const scalePx = (BASE_SIZE / 1600);
    const srcW = (halfViewM * 2) * scalePx;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W * 0.5, H * 0.5);
    // Rotating minimap aligned with player facing (match forward = -Z -> yaw 0 at top)
    ctx.rotate(pyaw);
    const [bx, bz] = w2b(px, pz);
    const mPerPx = (halfViewM * 2) / W;
    const scale = 1 / (mPerPx * scalePx);
    ctx.scale(scale, scale);
    ctx.drawImage(baseCanvas, -bx, -bz);
    ctx.restore();

    // Draw Zone circles & Ping in rotated minimap space
    const drawMiniMarker = (wx, wz, fn) => {
      const dx = wx - px, dz = wz - pz;
      const c = Math.cos(pyaw), s = Math.sin(pyaw);
      const rx = (dx * c - dz * s) / mPerPx + W * 0.5;
      const ry = (dx * s + dz * c) / mPerPx + H * 0.5;
      fn(rx, ry);
    };

    if (zones?.blue) {
      drawMiniMarker(zones.blue.x, zones.blue.z, (x, y) => {
        ctx.strokeStyle = '#2B8CFF'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, zones.blue.r / mPerPx, 0, Math.PI * 2); ctx.stroke();
      });
    }
    if (zones?.white) {
      drawMiniMarker(zones.white.x, zones.white.z, (x, y) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, zones.white.r / mPerPx, 0, Math.PI * 2); ctx.stroke();
      });
    }
    if (ping) {
      drawMiniMarker(ping.x, ping.z, (x, y) => {
        ctx.fillStyle = '#F2B705';
        ctx.beginPath(); ctx.arc(Util.clamp(x, 8, W - 8), Util.clamp(y, 8, H - 8), 5, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Center Player Chevron
    ctx.fillStyle = '#F2B705';
    ctx.beginPath();
    ctx.moveTo(W * 0.5, H * 0.5 - 8);
    ctx.lineTo(W * 0.5 + 6, H * 0.5 + 7);
    ctx.lineTo(W * 0.5, H * 0.5 + 3);
    ctx.lineTo(W * 0.5 - 6, H * 0.5 + 7);
    ctx.closePath();
    ctx.fill();
  }

  function cycleZoom() {
    miniZoomIdx = (miniZoomIdx + 1) % miniScales.length;
    const tag = document.getElementById('minimap-zoom-tag');
    if (tag) tag.textContent = `${miniScales[miniZoomIdx]}m`;
  }

  function initBigMapEvents() {
    if (initedEvents) return;
    initedEvents = true;
    const cvs = document.getElementById('bigmap-canvas');
    if (!cvs) return;

    const screenToWorld = (clientX, clientY) => {
      const rect = cvs.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      const viewSpan = 1600 / zoom;
      return {
        x: panX + (nx - 0.5) * viewSpan,
        z: panZ + (ny - 0.5) * viewSpan
      };
    };

    cvs.oncontextmenu = (e) => e.preventDefault();
    cvs.addEventListener('mousedown', (e) => {
      dragging = true; lastMx = e.clientX; lastMy = e.clientY; downMx = e.clientX; downMy = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!bigOpen) return;
      const w = screenToWorld(e.clientX, e.clientY);
      const col = String.fromCharCode(65 + Util.clamp(Math.floor((w.x + 800) / 200), 0, 7));
      const row = 1 + Util.clamp(Math.floor((w.z + 800) / 200), 0, 7);
      const coordEl = document.getElementById('bigmap-coords');
      if (coordEl) coordEl.textContent = `Grid ${col}${row} (${Math.round(w.x)}m, ${Math.round(w.z)}m) • Klik: Ping • Scroll: Zoom (${zoom.toFixed(1)}x)`;
      if (dragging) {
        const rect = cvs.getBoundingClientRect();
        const span = 1600 / zoom;
        panX = Util.clamp(panX - ((e.clientX - lastMx) / rect.width) * span, -750, 750);
        panZ = Util.clamp(panZ - ((e.clientY - lastMy) / rect.height) * span, -750, 750);
        lastMx = e.clientX; lastMy = e.clientY;
        drawBigMap();
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (!bigOpen || !dragging) return;
      dragging = false;
      if (Math.hypot(e.clientX - downMx, e.clientY - downMy) < 5) {
        ping = screenToWorld(e.clientX, e.clientY);
        AudioSys.playUiTone('click');
        drawBigMap();
      }
    });
    cvs.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom = Util.clamp(zoom * (e.deltaY < 0 ? 1.18 : 0.85), 1.0, 5.5);
      drawBigMap();
    }, { passive: false });

    document.getElementById('bigmap-center')?.addEventListener('click', () => {
      panX = Player.pos.x; panZ = Player.pos.z; zoom = 2.2; drawBigMap();
    });
    document.getElementById('bigmap-clear-ping')?.addEventListener('click', () => {
      ping = null; drawBigMap();
    });
    document.getElementById('bigmap-close')?.addEventListener('click', closeBigMap);
  }

  function drawBigMap(zones = null, planeInfo = null, airdropPos = null, redZone = null) {
    const cvs = document.getElementById('bigmap-canvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.width, H = cvs.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const viewSpan = 1600 / zoom;
    const toScreenX = (wx) => ((wx - panX) / viewSpan + 0.5) * W;
    const toScreenY = (wz) => ((wz - panZ) / viewSpan + 0.5) * H;

    const sx = ((panX - viewSpan * 0.5 + 800) / 1600) * BASE_SIZE;
    const sy = ((panZ - viewSpan * 0.5 + 800) / 1600) * BASE_SIZE;
    const sw = (viewSpan / 1600) * BASE_SIZE;
    ctx.drawImage(baseCanvas, sx, sy, sw, sw, 0, 0, W, H);

    // 8x8 Tactical Grid A..H / 1..8
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.font = '600 11px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(237,239,241,0.6)';
    for (let i = 0; i <= 8; i++) {
      const wg = -800 + i * 200;
      const gx = toScreenX(wg), gy = toScreenY(wg);
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      if (i < 8) {
        ctx.fillText(String.fromCharCode(65 + i), gx + 6, 14);
        ctx.fillText(String(i + 1), 6, gy + 14);
      }
    }

    if (zones?.blue) {
      ctx.strokeStyle = '#2B8CFF'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(toScreenX(zones.blue.x), toScreenY(zones.blue.z), (zones.blue.r / viewSpan) * W, 0, Math.PI * 2); ctx.stroke();
    }
    if (zones?.white) {
      ctx.strokeStyle = '#FFFFFF'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2.0;
      ctx.beginPath(); ctx.arc(toScreenX(zones.white.x), toScreenY(zones.white.z), (zones.white.r / viewSpan) * W, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (redZone?.active) {
      ctx.fillStyle = 'rgba(229,56,59,0.22)'; ctx.strokeStyle = '#E5383B'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(toScreenX(redZone.x), toScreenY(redZone.z), (redZone.r / viewSpan) * W, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (airdropPos) {
      const ax = toScreenX(airdropPos.x), ay = toScreenY(airdropPos.z);
      ctx.fillStyle = '#E5383B'; ctx.fillRect(ax - 6, ay - 6, 12, 12);
      ctx.strokeStyle = '#FFF'; ctx.strokeRect(ax - 6, ay - 6, 12, 12);
    }
    if (planeInfo?.active) {
      ctx.strokeStyle = '#F2B705'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(toScreenX(planeInfo.x0), toScreenY(planeInfo.z0)); ctx.lineTo(toScreenX(planeInfo.x1), toScreenY(planeInfo.z1)); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ping) {
      const px = toScreenX(ping.x), py = toScreenY(ping.z);
      ctx.fillStyle = '#F2B705'; ctx.strokeStyle = '#0C0E10'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Player Chevron
    const px = toScreenX(Player.pos.x), py = toScreenY(Player.pos.z);
    ctx.translate(px, py);
    ctx.rotate(-Player.yaw);
    ctx.fillStyle = '#F2B705'; ctx.strokeStyle = '#0C0E10'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function openBigMap() {
    initBigMapEvents();
    bigOpen = true;
    document.exitPointerLock?.();
    document.getElementById('map-overlay')?.classList.remove('hidden');
    drawBigMap();
  }

  function closeBigMap() {
    bigOpen = false;
    document.getElementById('map-overlay')?.classList.add('hidden');
  }

  function toggleBigMap() {
    if (bigOpen) closeBigMap(); else openBigMap();
    return bigOpen;
  }

  return {
    bakeBaseMap, updateMinimap, cycleZoom, openBigMap, closeBigMap, toggleBigMap, drawBigMap,
    get isOpen() { return bigOpen; },
    get ping() { return ping; }
  };
})();

