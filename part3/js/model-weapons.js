// ════════════════════════════════════════════════════════════════════════════
// GUNKIT — Realistic Modern Firearm Parts Library
//   Continuous Picatinny rails, M-LOK handguards, reflex / ACOG / scope optics,
//   weapon-light, ribbed STANAG mags, stippled grips, wet-look clear-coated metal.
//   All geometry is merged per-material and cached (shared by bots, TPP + viewmodel).
//   Authoring space: +Z = muzzle, +Y = up, authored -X = shooter's RIGHT side
//   (ejection port side) because the rig / viewmodel rotate the gun PI about Y.
// ════════════════════════════════════════════════════════════════════════════
const GunKit = (() => {
  let M = null;
  const bodyCache = new Map();
  const miscCache = new Map();

  function mats() {
    if (M) return M;
    const woodMap = (() => { try { return Assets.get('darkWood')?.map || null; } catch (_) { return null; } })();
    M = {
      black: new THREE.MeshPhysicalMaterial({ name: 'gkBlack', color: 0x25282c, metalness: 0.72, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.20 }),
      rail:  new THREE.MeshPhysicalMaterial({ name: 'gkRail', color: 0x1b1e22, metalness: 0.82, roughness: 0.30, clearcoat: 0.35, clearcoatRoughness: 0.28 }),
      poly:  new THREE.MeshStandardMaterial({ name: 'gkPoly', color: 0x1c1e21, metalness: 0.10, roughness: 0.55 }),
      slot:  new THREE.MeshStandardMaterial({ name: 'gkSlot', color: 0x040506, metalness: 0.2, roughness: 0.95 }),
      steel: new THREE.MeshStandardMaterial({ name: 'gkSteel', color: 0x8d949a, metalness: 0.92, roughness: 0.26 }),
      fde:   new THREE.MeshPhysicalMaterial({ name: 'gkFde', color: 0x8b7757, metalness: 0.18, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
      wood:  new THREE.MeshStandardMaterial({ name: 'gkWood', color: woodMap ? 0xB08A62 : 0x6a4326, map: woodMap, metalness: 0.04, roughness: 0.52 }),
      rubber: new THREE.MeshStandardMaterial({ name: 'gkRubber', color: 0x101112, metalness: 0.0, roughness: 0.92 }),
      glass: new THREE.MeshStandardMaterial({ name: 'gkGlass', color: 0x5b3a78, emissive: 0x6c2a4e, emissiveIntensity: 0.55, metalness: 0.85, roughness: 0.06, transparent: true, opacity: 0.80 }),
      glassClear: new THREE.MeshStandardMaterial({ name: 'gkGlassClear', color: 0x203a4a, metalness: 0.7, roughness: 0.05, transparent: true, opacity: 0.38 }),
      dot:   new THREE.MeshBasicMaterial({ name: 'gkDot', color: 0xFF2A1A }),
      lens:  new THREE.MeshStandardMaterial({ name: 'gkLens', color: 0xFFFFFF, emissive: 0xFFF1C9, emissiveIntensity: 1.4, metalness: 0.1, roughness: 0.1 }),
      lensBlue: new THREE.MeshStandardMaterial({ name: 'gkLensBlue', color: 0x1d4c6e, emissive: 0x08202f, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.05 }),
      fiber: new THREE.MeshBasicMaterial({ name: 'gkFiber', color: 0xFF5A1F }),
      laser: new THREE.MeshBasicMaterial({ name: 'gkLaser', color: 0x35FF66 }),
      brass: new THREE.MeshStandardMaterial({ name: 'gkBrass', color: 0xB8934A, metalness: 0.85, roughness: 0.32 })
    };
    return M;
  }
  const mat = (k) => mats()[k];

  // ── Geometry collector: accumulate transformed primitives per material key, merge once ──
  function collector() {
    const lists = {};
    function push(key, g, x, y, z, rx, ry, rz) {
      if (rx) g.rotateX(rx);
      if (ry) g.rotateY(ry);
      if (rz) g.rotateZ(rz);
      g.translate(x, y, z);
      (lists[key] || (lists[key] = [])).push(g);
    }
    return {
      box(key, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { push(key, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); },
      // Cylinder: rt = radius toward +axis end, rb = radius toward -axis end
      cyl(key, rt, rb, len, x, y, z, axis = 'z', seg = 10) {
        const g = new THREE.CylinderGeometry(rt, rb, len, seg);
        if (axis === 'z') g.rotateX(Math.PI / 2);
        else if (axis === 'x') g.rotateZ(-Math.PI / 2);
        push(key, g, x, y, z, 0, 0, 0);
      },
      geo(key, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { push(key, g, x, y, z, rx, ry, rz); },
      finish() {
        const out = {};
        for (const k in lists) {
          const merged = BufferGeometryUtils.mergeGeometries(lists[k], false);
          lists[k].forEach(g => g.dispose());
          if (merged) out[k] = merged;
        }
        return out;
      }
    };
  }

  function instantiate(geos, castShadow = true) {
    const g = new THREE.Group();
    for (const k in geos) {
      const m = new THREE.Mesh(geos[k], mat(k));
      m.castShadow = castShadow; m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }

  // Continuous Picatinny rail (top face at y, cross-slots every 12.7 mm)
  function rail(c, z0, z1, y, w = 0.022, key = 'rail') {
    c.box(key, w * 0.84, 0.0040, z1 - z0, 0, y - 0.0055, (z0 + z1) / 2);
    for (let z = z0 + 0.004; z < z1 - 0.003; z += 0.0127) c.box(key, w, 0.0036, 0.0064, 0, y - 0.0018, z);
  }

  // Local (ly along box height, lz along box depth) → world (y, z) of a box tilted about X
  function tilt(cy, cz, th, ly, lz) {
    return [cy + ly * Math.cos(th) - lz * Math.sin(th), cz + ly * Math.sin(th) + lz * Math.cos(th)];
  }

  // ── Magazine: ribbed curved STANAG / straight / banana. Origin = mag-well opening. ──
  // Origin = top of the magazine inside the mag-well; body runs down (-Y) and sweeps forward (+Z)
  // along a circular arc of total angle `curve` radians. Each segment is a box rotated -phi about X.
  function magGeos(kind, h, curve = 0.0) {
    const c = collector();
    const w = kind === 'smg' ? 0.032 : kind === 'box' ? 0.040 : 0.027;
    const d = kind === 'smg' ? 0.050 : kind === 'box' ? 0.074 : 0.043;
    const top = 0.020;
    const L = h + top;
    const k = curve > 0 ? curve / L : 0;
    const at = (s) => (k > 0 ? [-Math.sin(k * s) / k, (1 - Math.cos(k * s)) / k] : [-s, 0]);
    const seg = 6;
    for (let i = 0; i < seg; i++) {
      const s0 = (i / seg) * L, s1 = ((i + 1) / seg) * L, sm = (s0 + s1) / 2;
      const [y, z] = at(sm);
      c.box('poly', w, L / seg + 0.003, d, 0, y + top, z, -k * sm);
    }
    // Feed lips, witness holes, horizontal ribs and steel floor-plate with rubber bumper
    {
      const [y0, z0] = at(0.002);
      c.box('black', w + 0.0012, 0.012, d * 0.94, 0, y0 + top, z0);
      for (let i = 0; i < 7; i++) {
        const s = 0.014 + i * (L - 0.04) / 7;
        const [y, z] = at(s);
        c.box('slot', w + 0.0014, 0.0020, d * 0.80, 0, y + top, z + d * 0.0, -k * s);
      }
      const [yb, zb] = at(L - 0.004);
      c.box('black', w + 0.003, 0.010, d + 0.003, 0, yb + top, zb, -k * L);
      c.box('rubber', w * 0.8, 0.004, d * 0.7, 0, yb + top - 0.006, zb, -k * L);
      const [yw, zw] = at(L * 0.45);
      c.box('slot', 0.0016, 0.012, 0.0070, w / 2 + 0.0004, yw + top, zw, -k * L * 0.45);
    }
    return c.finish();
  }

  function buildMag(attId) {
    const key = `mag:${attId}`;
    if (!miscCache.has(key)) {
      const ext = attId === 'extmag' || attId === 'extqdmag';
      miscCache.set(key, magGeos('poly', ext ? 0.170 : 0.115, ext ? 0.20 : 0.12));
    }
    const g = instantiate(miscCache.get(key));
    if (attId.includes('qd')) {
      const c = collector();
      c.box('rubber', 0.030, 0.010, 0.052, 0, -(attId === 'extqdmag' ? 0.172 : 0.118), attId === 'extqdmag' ? 0.034 : 0.016);
      g.add(instantiate(c.finish()));
    }
    return g;
  }

  function buildDefaultMag(body) {
    const kind = body.magKind;
    if (!kind || kind === 'none' || kind === 'pistol') return null;
    const key = `defmag:${kind}`;
    if (!miscCache.has(key)) {
      if (kind === 'ar') miscCache.set(key, magGeos('poly', 0.115, 0.12));
      else if (kind === 'ak') miscCache.set(key, magGeos('poly', 0.150, 0.50));
      else if (kind === 'smg') miscCache.set(key, magGeos('smg', 0.130, 0.0));
      else miscCache.set(key, magGeos('box', 0.130, 0.0));
    }
    return instantiate(miscCache.get(key));
  }

  // ── AR-15 / M4 / M416 class carbine (reference gun) ──
  function buildAR(def, fde) {
    const c = collector();
    const body = fde ? 'fde' : 'black';
    const sk = def.sockets;
    const railTop = sk.optic[1] - 0.007;
    const topY = railTop - 0.0045;
    const hH = 0.056;
    const boreY = topY - hH / 2;
    const muzzleZ = sk.muzzle[2];
    const hgEnd = muzzleZ - 0.105;

    // Upper receiver
    const uz0 = -0.108, uz1 = 0.120;
    c.box(body, 0.040, hH, uz1 - uz0, 0, boreY, (uz0 + uz1) / 2);
    c.box(body, 0.034, 0.010, 0.200, 0, topY - 0.001, 0.0);   // flat-top shoulder
    c.box('slot', 0.0016, 0.021, 0.054, -0.0205, boreY + 0.004, 0.012);       // ejection port (right side)
    c.box(body, 0.006, 0.013, 0.015, -0.0215, boreY + 0.012, -0.030);       // brass deflector
    c.cyl('black', 0.0052, 0.0052, 0.013, -0.0245, boreY - 0.004, -0.050, 'x', 10);  // forward assist
    c.cyl('steel', 0.0036, 0.0036, 0.046, 0, boreY - 0.020, -0.096, 'x', 8);        // takedown pin
    c.box('black', 0.036, 0.013, 0.028, 0, topY - 0.009, uz0 - 0.010);            // charging handle
    c.box('steel', 0.008, 0.006, 0.014, 0, topY - 0.001, uz0 - 0.006);
    rail(c, uz0 + 0.004, hgEnd + 0.004, railTop, 0.022, 'rail');

    // Lower receiver + magwell + trigger guard + pistol grip
    const lowTop = boreY - hH / 2;
    c.box(body, 0.038, 0.040, 0.188, 0, lowTop - 0.020, -0.008);
    c.box(body, 0.037, 0.028, 0.072, 0, lowTop - 0.050, 0.056);               // flared magwell
    // Left-side receiver markings ("PAC-8" laser-etched stencil & serial block, visible in FPP)
    c.box('steel', 0.0012, 0.0055, 0.018, 0.0188, lowTop - 0.038, 0.058);
    c.box('steel', 0.0012, 0.0022, 0.024, 0.0188, lowTop - 0.046, 0.056);
    c.box('steel', 0.0012, 0.0018, 0.020, 0.0188, lowTop - 0.051, 0.055);
    // Upper-to-handguard locking bolts on left side (+X)
    c.cyl('steel', 0.0038, 0.0038, 0.004, 0.0215, topY - 0.006, 0.102, 'x', 8);
    c.cyl('steel', 0.0038, 0.0038, 0.004, 0.0215, topY - 0.006, 0.086, 'x', 8);
    c.box('black', 0.008, 0.010, 0.018, 0.0210, boreY - 0.012, 0.072);        // side sling/rail lug
    c.box(body, 0.006, 0.020, 0.004, 0, lowTop - 0.040, 0.0);
    c.box(body, 0.007, 0.024, 0.005, 0, lowTop - 0.050, 0.020);               // trigger-guard front
    c.box(body, 0.007, 0.005, 0.062, 0, lowTop - 0.060, -0.017);              // trigger-guard bottom
    c.box('steel', 0.0036, 0.020, 0.005, 0, lowTop - 0.044, -0.011, -0.22);   // trigger
    c.cyl('black', 0.0052, 0.0052, 0.006, -0.0205, lowTop - 0.020, 0.032, 'x', 10); // mag release
    c.box('black', 0.004, 0.010, 0.016, 0.0202, lowTop - 0.012, 0.004);        // bolt catch (left side)
    c.box('black', 0.006, 0.0045, 0.024, -0.0212, lowTop - 0.024, -0.042);     // selector
    c.box('black', 0.006, 0.0045, 0.024, 0.0212, lowTop - 0.024, -0.042);
    const th = 0.34, gcy = lowTop - 0.070, gcz = -0.088;
    c.box('poly', 0.032, 0.096, 0.036, 0, gcy, gcz, th);
    for (let i = 0; i < 6; i++) {          // stippling / finger grooves
      const [ry, rz] = tilt(gcy, gcz, th, -0.034 + i * 0.013, 0.0185);
      c.box('slot', 0.030, 0.0030, 0.0025, 0, ry, rz, th);
      const [fy, fz] = tilt(gcy, gcz, th, -0.030 + i * 0.013, -0.0185);
      c.box('slot', 0.030, 0.0030, 0.0025, 0, fy, fz, th);
    }
    c.box('poly', 0.034, 0.014, 0.030, 0, gcy + 0.048, gcz + 0.016, th);       // beavertail / grip base
    c.box(body, 0.030, 0.008, 0.022, 0, lowTop - 0.003, -0.100);               // rear lower

    // M-LOK handguard (long, free-float)
    const hz0 = uz1, len = hgEnd - hz0;
    c.box(body, 0.043, hH, len, 0, boreY, hz0 + len / 2);
    c.box('rail', 0.047, hH + 0.003, 0.008, 0, boreY, hz0 + 0.002);            // delta ring / nut
    c.box('rail', 0.046, hH + 0.002, 0.007, 0, boreY, hgEnd - 0.0035);         // end cap
    for (let z = hz0 + 0.030; z < hgEnd - 0.028; z += 0.030) {
      c.box('slot', 0.0016, 0.0046, 0.022, 0.0217, boreY + 0.012, z);
      c.box('slot', 0.0016, 0.0046, 0.022, -0.0217, boreY + 0.012, z);
      c.box('slot', 0.0016, 0.0046, 0.022, 0.0217, boreY - 0.012, z);
      c.box('slot', 0.0016, 0.0046, 0.022, -0.0217, boreY - 0.012, z);
      c.box('slot', 0.0046, 0.0016, 0.022, 0, boreY - hH / 2 - 0.0002, z + 0.004);
    }
    c.cyl('steel', 0.0034, 0.0034, 0.009, 0, boreY - hH / 2 - 0.004, hz0 + 0.040, 'y', 8);   // QD sling socket
    // Weapon-light + clamp (reference shows light at front-left)
    const lx = 0.0345, ly = boreY + 0.013, lz = hgEnd - 0.040;
    c.box('rail', 0.016, 0.010, 0.034, 0.0245, ly, lz);
    c.cyl('black', 0.0125, 0.0118, 0.082, lx, ly, lz, 'z', 16);
    c.cyl('steel', 0.0142, 0.0142, 0.014, lx, ly, lz + 0.046, 'z', 16);
    c.cyl('lens', 0.0112, 0.0112, 0.002, lx, ly, lz + 0.0545, 'z', 16);
    for (let r = 0; r < 4; r++) c.cyl('slot', 0.0128, 0.0128, 0.0028, lx, ly, lz - 0.026 + r * 0.011, 'z', 16);
    c.box('slot', 0.007, 0.0045, 0.012, lx, ly + 0.0128, lz - 0.040);          // tail switch
    // Barrel + low-profile gas block
    const bz0 = hgEnd - 0.012, bz1 = muzzleZ - 0.006;
    c.cyl('black', 0.0088, 0.0088, bz1 - bz0, 0, boreY, (bz0 + bz1) / 2, 'z', 14);
    c.box('black', 0.022, 0.022, 0.020, 0, boreY, hgEnd + 0.012);
    c.cyl('steel', 0.0095, 0.0095, 0.004, 0, boreY, hgEnd + 0.026, 'z', 12);
    // Stock: buffer tube + collapsible stock + riser + rubber pad
    c.cyl(body, 0.0128, 0.0128, 0.150, 0, boreY - 0.008, -0.178, 'z', 14);
    c.box('poly', 0.042, 0.058, 0.118, 0, boreY - 0.016, -0.204);
    c.box('poly', 0.036, 0.016, 0.104, 0, boreY + 0.020, -0.200);
    c.box('poly', 0.020, 0.024, 0.040, 0, boreY - 0.054, -0.170);               // lock lever
    c.box('rubber', 0.042, 0.088, 0.014, 0, boreY - 0.018, -0.268);
    c.cyl('steel', 0.0045, 0.0045, 0.044, 0, boreY - 0.050, -0.236, 'x', 8);      // sling loop pin

    const geos = c.finish();
    return {
      geos,
      sockets: {
        optic: [0, railTop + 0.003, 0.03],
        muzzle: [0, boreY, muzzleZ],
        grip: [0, boreY - hH / 2 - 0.001, Math.min(0.30, hgEnd - 0.07)],
        mag: [0, lowTop - 0.060, 0.056],
        stock: [0, boreY, -0.22]
      },
      railTop, boreY, hgEnd, topY, muzzleZ, ironFrontZ: hgEnd - 0.01, ironRearZ: -0.075, magKind: 'ar'
    };
  }

  // ── AK / Saiga style (AKM, S12K) ──
  function buildAK(def, shotgun) {
    const c = collector();
    const sk = def.sockets;
    const railTop = sk.optic[1] - 0.007;
    const boreY = 0.040;
    const muzzleZ = sk.muzzle[2];
    // Stamped receiver + ribbed dust cover
    c.box('black', 0.036, 0.056, 0.236, 0, boreY + 0.008, -0.004);
    c.box('black', 0.030, 0.014, 0.228, 0, boreY + 0.040, -0.004);
    for (let z = -0.100; z < 0.090; z += 0.020) c.box('rail', 0.032, 0.0026, 0.005, 0, boreY + 0.0475, z);
    c.box('slot', 0.0016, 0.018, 0.050, -0.0185, boreY + 0.014, 0.010);       // ejection port
    c.box('steel', 0.010, 0.004, 0.044, -0.0210, boreY + 0.024, 0.008);        // charging handle
    c.cyl('steel', 0.0050, 0.0050, 0.014, -0.0235, boreY + 0.024, 0.040, 'x', 8);
    c.box('black', 0.008, 0.030, 0.004, 0, boreY - 0.020, 0.100);
    // dovetail side rail for optic (modern railed AK variants)
    rail(c, -0.045, 0.092, railTop, 0.022, 'rail');
    // Gas tube + wood handguards + gas block + front sight + brake
    c.cyl('steel', 0.0072, 0.0072, 0.190, 0, boreY + 0.030, 0.200, 'z', 10);
    c.box('wood', 0.040, 0.030, 0.150, 0, boreY + 0.014, 0.176);          // upper handguard
    c.box('wood', 0.040, 0.036, 0.150, 0, boreY - 0.020, 0.190);          // lower handguard
    c.box('black', 0.032, 0.012, 0.150, 0, boreY - 0.003, 0.186);
    for (let z = 0.130; z < 0.250; z += 0.016) {
      c.box('slot', 0.0016, 0.012, 0.007, 0.0205, boreY - 0.020, z);
      c.box('slot', 0.0016, 0.012, 0.007, -0.0205, boreY - 0.020, z);
    }
    const bblR = shotgun ? 0.0135 : 0.0092;
    c.cyl('black', bblR, bblR, muzzleZ - 0.12, 0, boreY, 0.12 + (muzzleZ - 0.12) / 2, 'z', 14);
    c.box('black', 0.020, 0.026, 0.026, 0, boreY + 0.010, muzzleZ - 0.130);         // gas block
    c.box('black', 0.012, 0.030, 0.010, 0, boreY + 0.032, muzzleZ - 0.050);          // front sight tower
    c.cyl('steel', 0.0022, 0.0022, 0.014, 0, boreY + 0.052, muzzleZ - 0.050, 'y', 6);
    c.cyl('black', 0.0115, 0.0100, 0.044, 0, boreY, muzzleZ + 0.005, 'z', 12);      // slant brake
    c.box('slot', 0.0125, 0.0035, 0.006, 0, boreY + 0.0105, muzzleZ + 0.014);
    // Trigger group + grip (polymer)
    c.box('black', 0.006, 0.020, 0.005, 0, boreY - 0.056, 0.030);
    c.box('black', 0.007, 0.005, 0.060, 0, boreY - 0.068, -0.0, 0);
    c.box('steel', 0.0036, 0.018, 0.005, 0, boreY - 0.052, 0.0, -0.2);
    const th = 0.36, gcy = boreY - 0.098, gcz = -0.082;
    c.box('poly', 0.032, 0.098, 0.038, 0, gcy, gcz, th);
    for (let i = 0; i < 5; i++) {
      const [ry, rz] = tilt(gcy, gcz, th, -0.032 + i * 0.014, 0.0195);
      c.box('slot', 0.030, 0.0030, 0.0025, 0, ry, rz, th);
    }
    // Stock (side-profile solid wood w/ steel butt plate)
    c.box('wood', 0.034, 0.062, 0.100, 0, boreY - 0.004, -0.150, 0.0);
    c.box('wood', 0.034, 0.080, 0.130, 0, boreY - 0.018, -0.250, -0.12);
    c.box('steel', 0.036, 0.092, 0.008, 0, boreY - 0.022, -0.322, -0.12);
    const geos = c.finish();
    return {
      geos,
      sockets: { optic: [0, railTop + 0.003, 0.03], muzzle: [0, boreY, muzzleZ + 0.026], grip: [0, boreY - 0.040, 0.225], mag: [0, 0.026, 0.078], stock: [0, boreY, -0.22] },
      railTop, boreY, muzzleZ, ironFrontZ: muzzleZ - 0.050, ironRearZ: 0.06, magKind: shotgun ? 'box' : 'ak', ironFixed: true, hasMuzzle: true
    };
  }

  // ── SMG (UMP45) and KRISS-style Vector ──
  function buildSMG(def, vector) {
    const c = collector();
    const sk = def.sockets;
    const railTop = sk.optic[1] - 0.007;
    const boreY = vector ? 0.050 : 0.042;
    const muzzleZ = sk.muzzle[2];
    const uz0 = vector ? -0.10 : -0.120, uz1 = vector ? 0.20 : 0.150;
    // Receiver / shroud
    const rh = vector ? 0.074 : 0.060;
    c.box('poly', vector ? 0.040 : 0.042, rh, uz1 - uz0, 0, boreY + 0.006, (uz0 + uz1) / 2);
    c.box('black', 0.034, 0.014, uz1 - uz0 - 0.02, 0, boreY + 0.006 + rh / 2 - 0.004, (uz0 + uz1) / 2);
    c.box('slot', 0.0016, 0.020, 0.044, -0.0212, boreY + 0.012, 0.020);
    for (let z = uz0 + 0.020; z < uz1 - 0.03; z += 0.020) {
      c.box('slot', 0.0016, 0.020, 0.0045, 0.0212, boreY + 0.002, z);
      c.box('slot', 0.0016, 0.020, 0.0045, -0.0212, boreY - 0.010, z);
    }
    rail(c, uz0 + 0.010, uz1 - 0.010, railTop, 0.022, 'rail');
    if (!vector) {
      c.cyl('black', 0.0096, 0.0096, muzzleZ - uz1 + 0.010, 0, boreY, (muzzleZ + uz1) / 2, 'z', 12);
      c.box('black', 0.026, 0.018, 0.040, 0, boreY - 0.004, uz1 + 0.020);
      c.cyl('rail', 0.011, 0.011, 0.020, 0, boreY, muzzleZ - 0.010, 'z', 12);
    } else {
      c.cyl('black', 0.0090, 0.0090, muzzleZ - uz1 + 0.020, 0, boreY - 0.004, (muzzleZ + uz1) / 2, 'z', 12);
      c.box('black', 0.036, 0.040, 0.045, 0, boreY - 0.004, uz1 + 0.010);
    }
    // Lower + trigger
    c.box('poly', 0.036, 0.036, 0.175, 0, boreY - rh / 2 - 0.018 + 0.006, -0.012);
    c.box('steel', 0.0036, 0.020, 0.005, 0, boreY - rh / 2 - 0.032, -0.004, -0.2);
    c.box('poly', 0.006, 0.020, 0.005, 0, boreY - rh / 2 - 0.040, 0.034);
    c.box('poly', 0.006, 0.005, 0.052, 0, boreY - rh / 2 - 0.052, 0.006);
    const th = vector ? 0.42 : 0.28, gcy = boreY - rh / 2 - 0.082, gcz = vector ? -0.070 : -0.080;
    c.box('poly', 0.033, 0.100, 0.040, 0, gcy, gcz, th);
    for (let i = 0; i < 5; i++) {
      const [ry, rz] = tilt(gcy, gcz, th, -0.030 + i * 0.014, 0.0205);
      c.box('slot', 0.031, 0.003, 0.0025, 0, ry, rz, th);
    }
    // Stock: UMP skeleton / Vector folding
    if (vector) {
      c.box('black', 0.014, 0.014, 0.100, 0, boreY + 0.020, -0.15);
      c.box('poly', 0.030, 0.088, 0.016, 0, boreY - 0.004, -0.210);
      c.box('rubber', 0.032, 0.092, 0.008, 0, boreY - 0.004, -0.220);
    } else {
      c.box('black', 0.012, 0.012, 0.160, 0, boreY + 0.022, -0.200);
      c.box('black', 0.012, 0.012, 0.160, 0, boreY - 0.020, -0.200);
      c.box('poly', 0.034, 0.080, 0.020, 0, boreY + 0.001, -0.288);
      c.box('rubber', 0.036, 0.086, 0.008, 0, boreY + 0.001, -0.300);
    }
    const geos = c.finish();
    return {
      geos,
      sockets: { optic: [0, railTop + 0.003, 0.03], muzzle: [0, boreY, muzzleZ], grip: [0, boreY - rh / 2 - 0.016, uz1 - 0.030], mag: [0, boreY - rh / 2 - 0.012, vector ? 0.050 : 0.045], stock: [0, boreY, -0.22] },
      railTop, boreY, muzzleZ, ironFrontZ: uz1 - 0.02, ironRearZ: uz0 + 0.03, magKind: 'smg'
    };
  }

  // ── SKS (DMR) + Kar98k (bolt, wood) + M24 (bolt, composite) + generic long-gun ──
  function buildLongWood(def, kind) {
    const c = collector();
    const sk = def.sockets;
    const railTop = sk.optic[1] - 0.007;
    const boreY = 0.040;
    const muzzleZ = sk.muzzle[2];
    const stockKey = kind === 'sr' ? 'poly' : 'wood';
    // Action
    c.box('black', 0.032, 0.046, 0.200, 0, boreY + 0.008, 0.0);
    c.box('slot', 0.0016, 0.016, 0.048, -0.0165, boreY + 0.012, 0.018);
    c.box('black', 0.026, 0.012, 0.200, 0, boreY + 0.036, 0.0);
    rail(c, -0.060, 0.090, railTop, 0.021, 'rail');
    // Barrel
    c.cyl('black', 0.0098, 0.0098, muzzleZ - 0.10, 0, boreY, 0.10 + (muzzleZ - 0.10) / 2, 'z', 14);
    c.cyl('steel', 0.0112, 0.0112, 0.016, 0, boreY, muzzleZ - 0.004, 'z', 12);
    c.box('black', 0.012, 0.022, 0.012, 0, boreY + 0.016, muzzleZ - 0.040);     // front sight
    // Stock (full length) + forend
    const forEnd = kind === 'sks' ? 0.40 : kind === 'sr' ? 0.42 : 0.46;
    c.box(stockKey, 0.040, 0.044, forEnd - 0.12, 0, boreY - 0.020, 0.12 + (forEnd - 0.12) / 2);
    c.box(stockKey, 0.036, 0.052, 0.160, 0, boreY - 0.012, -0.060);
    c.box(stockKey, 0.036, 0.094, 0.150, 0, boreY - 0.026, -0.220, -0.16);
    c.box('rubber', 0.038, 0.102, 0.012, 0, boreY - 0.028, -0.298, -0.16);
    if (kind === 'sr') c.box('black', 0.040, 0.020, 0.50, 0, boreY - 0.044, 0.18);        // aluminum bedding rail
    // Grip + trigger
    const th = 0.40, gcy = boreY - 0.076, gcz = -0.074;
    c.box(stockKey, 0.032, 0.080, 0.036, 0, gcy, gcz, th);
    c.box('black', 0.006, 0.005, 0.054, 0, boreY - 0.040, -0.02);
    c.box('steel', 0.0036, 0.018, 0.005, 0, boreY - 0.030, -0.014, -0.2);
    // Bolt handle (bolt-action) / gas tube (SKS)
    if (kind === 'sks') {
      c.cyl('steel', 0.0070, 0.0070, 0.180, 0, boreY + 0.020, 0.200, 'z', 10);
      c.box('black', 0.030, 0.012, 0.18, 0, boreY + 0.050, 0.17);
      c.box('black', 0.030, 0.050, 0.100, 0, boreY - 0.014, 0.060);      // fixed magazine box
    } else {
      c.cyl('steel', 0.0040, 0.0040, 0.060, 0.032, boreY + 0.020, -0.012, 'x', 8);
      c.geo('black', new THREE.SphereGeometry(0.0125, 10, 8), 0.065, boreY + 0.020, -0.012);
      c.box('black', 0.030, 0.024, 0.050, 0, boreY - 0.040, 0.034);
    }
    const geos = c.finish();
    return {
      geos,
      sockets: { optic: [0, railTop + 0.003, 0.03], muzzle: [0, boreY, muzzleZ + 0.004], grip: null, mag: sk.mag ? [0, boreY - 0.060, 0.04] : null, stock: [0, boreY, -0.22] },
      railTop, boreY, muzzleZ, ironFrontZ: muzzleZ - 0.040, ironRearZ: -0.01, magKind: 'none', ironFixed: true, hasMuzzle: true
    };
  }

  // ── Pistol (Beretta 92 / P92) ──
  function buildPistol(def) {
    const c = collector();
    const sk = def.sockets;
    c.box('black', 0.026, 0.032, 0.200, 0, 0.050, 0.065);          // slide
    c.box('black', 0.028, 0.005, 0.200, 0, 0.0645, 0.065);          // slide top flat
    c.box('slot', 0.0016, 0.020, 0.062, -0.0135, 0.052, 0.050);       // ejection port cutout
    for (let i = 0; i < 6; i++) {
      c.box('slot', 0.0016, 0.026, 0.0030, 0.0135, 0.050, -0.018 + i * 0.0065);
      c.box('slot', 0.0016, 0.026, 0.0030, -0.0135, 0.050, -0.018 + i * 0.0065);
    }
    c.box('steel', 0.020, 0.010, 0.140, 0, 0.030, 0.108);           // barrel & locking block
    c.box('poly', 0.026, 0.034, 0.150, 0, 0.018, 0.040);            // frame
    c.box('poly', 0.026, 0.014, 0.060, 0, 0.012, 0.130);            // dust cover rail
    c.box('slot', 0.028, 0.0030, 0.0035, 0, 0.012, 0.130);
    // trigger guard + trigger + hammer
    c.box('poly', 0.0065, 0.026, 0.005, 0, 0.0, 0.074);
    c.box('poly', 0.0065, 0.005, 0.054, 0, -0.013, 0.050);
    c.box('steel', 0.0036, 0.018, 0.005, 0, 0.004, 0.044, -0.22);
    c.box('steel', 0.008, 0.012, 0.010, 0, 0.064, -0.040, 0.3);
    // grip
    const th = 0.20, gcy = -0.038, gcz = -0.012;
    c.box('poly', 0.030, 0.100, 0.044, 0, gcy, gcz, th);
    for (let i = 0; i < 6; i++) {
      const [ry, rz] = tilt(gcy, gcz, th, -0.034 + i * 0.012, 0.0225);
      c.box('slot', 0.028, 0.0028, 0.0025, 0, ry, rz, th);
      const [fy, fz] = tilt(gcy, gcz, th, -0.034 + i * 0.012, -0.0225);
      c.box('slot', 0.028, 0.0028, 0.0025, 0, fy, fz, th);
    }
    const [by, bz] = tilt(gcy, gcz, th, -0.052, 0.0);
    c.box('rubber', 0.032, 0.008, 0.050, 0, by, bz, th);
    c.box('steel', 0.0030, 0.0090, 0.0060, 0, 0.0715, 0.158);        // front sight
    c.box('steel', 0.012, 0.0090, 0.0060, 0, 0.0715, -0.030);        // rear sight
    c.box('slot', 0.0030, 0.0070, 0.0062, 0, 0.0720, -0.0302);
    const geos = c.finish();
    return { geos, sockets: { optic: [0, 0.071, 0.04], muzzle: [0, 0.050, 0.172], grip: [0, 0.0, 0.12], mag: [0, -0.07, -0.02], stock: null }, railTop: 0.066, boreY: 0.050, muzzleZ: 0.172, ironFrontZ: 0.158, ironRearZ: -0.030, magKind: 'pistol', pistol: true, hasMuzzle: true };
  }

  function getBody(def) {
    if (bodyCache.has(def.id)) return bodyCache.get(def.id);
    let b;
    switch (def.style) {
      case 'ar': b = buildAR(def, false); break;
      case 'scar': b = buildAR(def, true); break;
      case 'ak': b = buildAK(def, false); break;
      case 'shotgun': b = buildAK(def, true); break;
      case 'smg': b = buildSMG(def, false); break;
      case 'vector': b = buildSMG(def, true); break;
      case 'dmr': b = buildLongWood(def, 'sks'); break;
      case 'bolt': b = buildLongWood(def, 'bolt'); break;
      case 'sr': b = buildLongWood(def, 'sr'); break;
      case 'pistol': b = buildPistol(def); break;
      default: b = buildAR(def, false);
    }
    bodyCache.set(def.id, b);
    return b;
  }

  // Dynamic add-ons (only when the player has NOT attached something there)
  function defaultMuzzle(body) {
    const c = collector();
    const { boreY, muzzleZ } = body;
    if (body.pistol) return null;
    c.cyl('black', 0.0108, 0.0108, 0.050, 0, boreY, muzzleZ + 0.012, 'z', 12);
    c.cyl('black', 0.0122, 0.0122, 0.006, 0, boreY, muzzleZ + 0.036, 'z', 12);
    for (let i = 0; i < 3; i++) c.box('slot', 0.0125, 0.0040, 0.0100, 0, boreY + 0.0102, muzzleZ + 0.014 + i * 0.011);
    return instantiate(c.finish());
  }

  function ironSights(body, folded = false) {
    const c = collector();
    const { railTop } = body;
    if (body.pistol) return null;
    if (body.ironFixed) {
      if (folded) return null;
      c.box('black', 0.018, 0.010, 0.024, 0, railTop + 0.006, body.ironRearZ);
      c.box('slot', 0.0042, 0.0070, 0.0252, 0, railTop + 0.010, body.ironRearZ);
      return instantiate(c.finish());
    }
    // Front sight base + protective ears at front of handguard rail
    c.box('black', 0.020, 0.010, 0.020, 0, railTop + 0.005, body.ironFrontZ);
    c.box('black', 0.003, 0.014, 0.014, -0.0075, railTop + 0.013, body.ironFrontZ);
    c.box('black', 0.003, 0.014, 0.014,  0.0075, railTop + 0.013, body.ironFrontZ);
    c.cyl('steel', 0.0018, 0.0018, 0.011, 0, railTop + 0.013, body.ironFrontZ, 'y', 6);
    if (folded) {
      // Folded-down rear BUIS lying flat behind the reflex sight (exact match to Reference Image 1)
      const rz = body.ironRearZ + 0.012;
      c.box('black', 0.024, 0.009, 0.044, 0, railTop + 0.0045, rz);
      c.box('rail',  0.018, 0.005, 0.036, 0, railTop + 0.0105, rz - 0.003);
      c.cyl('steel', 0.0048, 0.0048, 0.006, 0.0135, railTop + 0.006, rz + 0.010, 'x', 10);
      c.cyl('steel', 0.0038, 0.0038, 0.005, 0.0130, railTop + 0.005, rz - 0.010, 'x', 10);
      c.cyl('black', 0.0055, 0.0055, 0.008, -0.0140, railTop + 0.008, rz - 0.004, 'x', 10);
      return instantiate(c.finish());
    }
    // Flip-up BUIS (deployed rear aperture) riding the top rail
    c.box('black', 0.022, 0.014, 0.016, 0, railTop + 0.007, body.ironRearZ);
    c.cyl('black', 0.0072, 0.0072, 0.008, 0, railTop + 0.020, body.ironRearZ, 'z', 12);
    c.cyl('slot', 0.0036, 0.0036, 0.0085, 0, railTop + 0.020, body.ironRearZ, 'z', 10);
    return instantiate(c.finish());
  }

  // ── Optics ──
  function opticLine(attId) {
    if (attId === 'reddot') return 0.0283;
    if (attId === 'holo') return 0.0293;
    if (attId === 'scope4x') return 0.032;
    return 0.034;
  }

  function reflexGeos(holo) {
    const c = collector();
    const len = holo ? 0.078 : 0.064, w = 0.042, h = holo ? 0.050 : 0.048;
    const yb = 0.003;
    c.box('black', 0.034, 0.010, len + 0.006, 0, -0.002, 0);                 // rail base
    c.box('black', 0.014, 0.012, 0.016, 0.0245, 0.0, -0.006);                  // QD lever
    c.cyl('steel', 0.0035, 0.0035, 0.012, 0.0295, 0.0, -0.006, 'x', 8);
    c.box('black', 0.0046, h, len, -w / 2 + 0.0023, yb + h / 2, 0);            // side walls
    c.box('black', 0.0046, h, len, w / 2 - 0.0023, yb + h / 2, 0);
    c.box('black', w, 0.0075, len, 0, yb + h - 0.00375, 0);                    // roof
    c.box('black', w, 0.0100, len, 0, yb + 0.005, 0);                          // floor
    c.box('black', w + 0.003, 0.0050, 0.014, 0, yb + h + 0.0010, len / 2 - 0.004);  // hood overhang
    c.box('black', w + 0.003, 0.0050, 0.010, 0, yb + h + 0.0010, -len / 2 + 0.003);
    c.cyl('steel', 0.0072, 0.0072, 0.0030, w / 2 + 0.0008, yb + 0.018, 0.008, 'x', 14);   // battery cap
    c.cyl('rail', 0.0042, 0.0042, 0.0050, w / 2 + 0.0010, yb + h - 0.014, -0.014, 'x', 8);  // windage turret
    c.cyl('rail', 0.0042, 0.0042, 0.0050, 0, yb + h + 0.0030, -0.014, 'y', 8);              // elevation turret
    c.box('slot', 0.016, 0.0016, 0.020, 0, yb + h + 0.0036, 0.016);                       // brand plate
    // Window frames (rear + front) — glass panes
    const wy = yb + 0.0100 + (h - 0.0175) / 2;
    c.box('glass', w - 0.0100, h - 0.0185, 0.0016, 0, wy, -len / 2 + 0.0060);
    c.box('glassClear', w - 0.0100, h - 0.0185, 0.0016, 0, wy, len / 2 - 0.0060);
    c.geo('dot', new THREE.SphereGeometry(0.0013, 6, 6), 0, wy, -len / 2 + 0.0048);
    if (holo) {
      c.box('black', w - 0.004, 0.0030, 0.014, 0, wy + (h - 0.0185) / 2, -len / 2 + 0.005);
      c.cyl('slot', 0.0075, 0.0075, 0.0020, 0, wy, -len / 2 + 0.0045, 'z', 14);
    }
    return c.finish();
  }

  function scopeGeos(attId) {
    const c = collector();
    const acog = attId === 'scope4x';
    const spec = {
      scope2x: { len: 0.115, obj: 0.0195, tube: 0.0125 },
      scope3x: { len: 0.130, obj: 0.021, tube: 0.0128 },
      scope4x: { len: 0.118, obj: 0.0165, tube: 0.0145 },
      scope6x: { len: 0.190, obj: 0.025, tube: 0.0135 },
      scope8x: { len: 0.215, obj: 0.027, tube: 0.0140 },
      scope15x: { len: 0.255, obj: 0.031, tube: 0.0150 }
    }[attId] || { len: 0.14, obj: 0.021, tube: 0.0128 };
    const { len, obj, tube } = spec;
    const ty = acog ? 0.032 : 0.034;
    // Rings / mount
    c.box('black', 0.030, 0.010, len * 0.7, 0, -0.002, 0);
    [-len * 0.22, len * 0.22].forEach(z => {
      c.box('rail', 0.018, ty - 0.004, 0.016, 0, (ty - 0.004) / 2 - 0.006, z);
      c.cyl('rail', tube + 0.0035, tube + 0.0035, 0.014, 0, ty, z, 'z', 16);
    });
    if (acog) {
      c.box('black', 0.034, 0.040, len * 0.78, 0, ty, -len * 0.04);
      c.box('rail', 0.034, 0.008, len * 0.78, 0, ty + 0.023, -len * 0.04);
      c.cyl('black', obj, obj, len * 0.34, 0, ty - 0.001, len * 0.40, 'z', 16);
      c.cyl('lensBlue', obj - 0.001, obj - 0.001, 0.0020, 0, ty - 0.001, len * 0.57, 'z', 16);
      c.cyl('black', 0.0165, 0.0200, 0.026, 0, ty, -len * 0.50, 'z', 16);
      c.cyl('lensBlue', 0.0125, 0.0125, 0.0018, 0, ty, -len * 0.50 - 0.013, 'z', 16);
      c.cyl('fiber', 0.0030, 0.0030, len * 0.60, 0, ty + 0.0285, -len * 0.04, 'z', 6);
      c.box('slot', 0.010, 0.002, len * 0.28, 0, ty + 0.0272, len * 0.18);
    } else {
      const p = [[0.0160, -len * 0.50], [0.0205, -len * 0.47], [0.0205, -len * 0.40], [tube, -len * 0.33], [tube, len * 0.20],
        [obj * 0.75, len * 0.30], [obj, len * 0.36], [obj, len * 0.50], [obj - 0.0016, len * 0.50]];
      const lathe = new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(r, y)), 20);
      lathe.rotateX(Math.PI / 2);
      c.geo('black', lathe, 0, ty, 0);
      c.cyl('lensBlue', obj - 0.0016, obj - 0.0016, 0.0020, 0, ty, len * 0.495, 'z', 18);
      c.cyl('lensBlue', 0.0150, 0.0150, 0.0018, 0, ty, -len * 0.50, 'z', 18);
      c.cyl('rail', 0.0072, 0.0072, 0.016, 0, ty + tube + 0.006, -len * 0.05, 'y', 12);      // elevation turret
      c.cyl('rail', 0.0072, 0.0072, 0.016, tube + 0.006, ty, -len * 0.05, 'x', 12);          // windage turret
      c.cyl('steel', 0.0064, 0.0064, 0.003, 0, ty + tube + 0.0145, -len * 0.05, 'y', 12);
      c.cyl('rail', 0.0100, 0.0100, 0.010, -tube - 0.006, ty, len * 0.12, 'x', 12);        // parallax knob
    }
    return c.finish();
  }

  function buildOptic(attId) {
    const key = `optic:${attId}`;
    if (!miscCache.has(key)) {
      miscCache.set(key, (attId === 'reddot' || attId === 'holo') ? reflexGeos(attId === 'holo') : scopeGeos(attId));
    }
    return instantiate(miscCache.get(key));
  }

  function buildMuzzle(attId) {
    const key = `muzzle:${attId}`;
    if (!miscCache.has(key)) {
      const c = collector();
      if (attId === 'suppressor') {
        c.cyl('black', 0.0185, 0.0185, 0.190, 0, 0, 0.100, 'z', 18);
        c.cyl('steel', 0.0125, 0.0125, 0.020, 0, 0, 0.005, 'z', 14);
        c.cyl('slot', 0.0192, 0.0192, 0.0035, 0, 0, 0.020, 'z', 18);
        for (let i = 0; i < 6; i++) c.cyl('rail', 0.0192, 0.0192, 0.0035, 0, 0, 0.052 + i * 0.026, 'z', 18);
        c.cyl('slot', 0.0075, 0.0075, 0.0020, 0, 0, 0.1955, 'z', 12);
      } else if (attId === 'comp') {
        c.cyl('black', 0.0150, 0.0150, 0.066, 0, 0, 0.030, 'z', 16);
        for (let i = 0; i < 3; i++) {
          c.box('slot', 0.0042, 0.0320, 0.0070, 0, 0, 0.012 + i * 0.014);
          c.box('slot', 0.0320, 0.0042, 0.0070, 0, 0, 0.012 + i * 0.014);
        }
      } else if (attId === 'flashhider') {
        c.cyl('black', 0.0118, 0.0118, 0.058, 0, 0, 0.026, 'z', 14);
        for (let i = 0; i < 3; i++) c.box('slot', 0.0125, 0.0040, 0.0260, 0, 0, 0.038);
        c.box('slot', 0.0040, 0.0260, 0.0260, 0, 0, 0.038);
        c.cyl('steel', 0.0126, 0.0126, 0.006, 0, 0, 0.002, 'z', 14);
      } else {
        c.cyl('black', 0.0135, 0.0135, 0.055, 0, 0, 0.026, 'z', 14);
        c.cyl('steel', 0.0120, 0.0120, 0.004, 0, 0, 0.054, 'z', 14);
      }
      miscCache.set(key, c.finish());
    }
    return instantiate(miscCache.get(key));
  }

  function buildGrip(attId) {
    const key = `grip:${attId}`;
    if (!miscCache.has(key)) {
      const c = collector();
      c.box('rail', 0.026, 0.010, 0.040, 0, -0.005, 0);
      if (attId === 'vertgrip') {
        c.cyl('poly', 0.0145, 0.0128, 0.088, 0, -0.054, 0, 'y', 14);
        for (let i = 0; i < 6; i++) c.cyl('slot', 0.0150, 0.0150, 0.0035, 0, -0.026 - i * 0.012, 0, 'y', 14);
        c.cyl('rubber', 0.0132, 0.0132, 0.006, 0, -0.100, 0, 'y', 14);
      } else if (attId === 'angledgrip') {
        c.box('poly', 0.026, 0.040, 0.034, 0, -0.026, 0.008, -0.25);
        c.box('poly', 0.026, 0.020, 0.056, 0, -0.050, 0.030, -0.55);
        for (let i = 0; i < 4; i++) c.box('slot', 0.027, 0.0030, 0.0030, 0, -0.022 - i * 0.008, -0.010 + i * 0.006, -0.25);
      } else if (attId === 'laser') {
        c.box('black', 0.030, 0.026, 0.074, 0.016, -0.014, 0.004);
        c.cyl('lens', 0.0070, 0.0070, 0.004, 0.016, -0.014, 0.043, 'z', 12);
        c.cyl('laser', 0.0030, 0.0030, 0.006, 0.022, -0.006, 0.0415, 'z', 8);
        c.box('slot', 0.010, 0.0030, 0.016, 0.016, 0.0005, -0.014);
      } else {
        c.box('poly', 0.026, 0.040, 0.042, 0, -0.026, 0.0);
        c.box('slot', 0.028, 0.0030, 0.030, 0, -0.030, 0.0);
      }
      miscCache.set(key, c.finish());
    }
    return instantiate(miscCache.get(key));
  }

  function buildStock(attId) {
    const key = `stock:${attId}`;
    if (!miscCache.has(key)) {
      const c = collector();
      if (attId === 'cheekpad') {
        c.box('rubber', 0.040, 0.026, 0.120, 0, 0.030, -0.020);
        c.box('slot', 0.034, 0.0030, 0.100, 0, 0.0445, -0.020);
      } else {
        c.box('poly', 0.044, 0.080, 0.120, 0, -0.012, -0.050);
        c.box('poly', 0.038, 0.018, 0.110, 0, 0.040, -0.048);
        c.box('rubber', 0.044, 0.096, 0.014, 0, -0.012, -0.112);
      }
      miscCache.set(key, c.finish());
    }
    return instantiate(miscCache.get(key));
  }

  return { mat, mats, collector, instantiate, getBody, buildMag, buildDefaultMag, buildOptic, buildMuzzle, buildGrip, buildStock, defaultMuzzle, ironSights, opticLine, magGeos, rail };
})();
