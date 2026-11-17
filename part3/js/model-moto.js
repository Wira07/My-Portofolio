// ════════════════════════════════════════════════════════════════════════════
// MOTOKIT — Realistic 3D Trail / Supermoto Motorcycle (CRF / KLX / EXC Style)
//   Sculpted teardrop tank, sharp diagonal radiator shrouds, dipped saddle,
//   upswept tail fender, high-mount trail front fender, exposed trellis/perimeter
//   tubular frame, finned DOHC engine block + swept chrome header pipe,
//   gold USD forks, visible yellow monoshock spring, aluminum swingarm,
//   12-spoke wheels with wave brake discs, digital dash, handguards & mirrors.
//   Convention: Front = -Z, Up = +Y, Rider Right = +X, Ground = y:0.
// ════════════════════════════════════════════════════════════════════════════
const MotoKit = (() => {
  let M = null;
  const partCache = new Map();
  let staticCache = null;

  function mats() {
    if (M) return M;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    M = {
      paint: new THREE.MeshPhysicalMaterial({ name: 'mkPaint', color: 0xFFFFFF, metalness: 0.38, roughness: 0.22, clearcoat: 0.92, clearcoatRoughness: 0.10 }),
      decal: std({ name: 'mkDecal', color: 0xF4F6F8, metalness: 0.15, roughness: 0.35 }),
      frame: std({ name: 'mkFrame', color: 0x1E2228, metalness: 0.72, roughness: 0.36 }),
      black: std({ name: 'mkBlack', color: 0x141619, metalness: 0.30, roughness: 0.58 }),
      plastic: std({ name: 'mkPlastic', color: 0x191C20, metalness: 0.08, roughness: 0.64 }),
      steel: std({ name: 'mkSteel', color: 0xC2C9D0, metalness: 0.92, roughness: 0.22 }),
      alu: std({ name: 'mkAlu', color: 0x9AA2AA, metalness: 0.86, roughness: 0.30, side: THREE.DoubleSide }),
      gold: std({ name: 'mkGold', color: 0xD8A228, metalness: 0.88, roughness: 0.24 }),
      engine: std({ name: 'mkEngine', color: 0x464C54, metalness: 0.78, roughness: 0.38 }),
      bronze: std({ name: 'mkBronze', color: 0x8A6D46, metalness: 0.82, roughness: 0.32 }),
      rubber: std({ name: 'mkRubber', color: 0x121316, metalness: 0.02, roughness: 0.90 }),
      seat: std({ name: 'mkSeat', color: 0x181A1E, metalness: 0.05, roughness: 0.82 }),
      seatGrip: std({ name: 'mkSeatGrip', color: 0x8C1D1D, metalness: 0.05, roughness: 0.78 }),
      disc: std({ name: 'mkDisc', color: 0xBCC4CC, metalness: 0.90, roughness: 0.26 }),
      spring: std({ name: 'mkSpring', color: 0xF0B418, metalness: 0.45, roughness: 0.32 }),
      plate: std({ name: 'mkPlate', color: 0xECEEE8, metalness: 0.05, roughness: 0.55 }),
      lens: new THREE.MeshStandardMaterial({ name: 'mkLens', color: 0xFFFFFF, emissive: 0xFFF4D2, emissiveIntensity: 1.65, metalness: 0.1, roughness: 0.08 }),
      tail: new THREE.MeshStandardMaterial({ name: 'mkTail', color: 0xFF2A2A, emissive: 0xFF1818, emissiveIntensity: 1.4, roughness: 0.25 }),
      amber: new THREE.MeshStandardMaterial({ name: 'mkAmber', color: 0xFFA21A, emissive: 0xFF8800, emissiveIntensity: 1.0, roughness: 0.28 }),
      mirror: std({ name: 'mkMirror', color: 0xA8C4D8, metalness: 0.96, roughness: 0.06 }),
      screen: new THREE.MeshStandardMaterial({ name: 'mkScreen', color: 0x0A2230, emissive: 0x2CE6FF, emissiveIntensity: 0.95, roughness: 0.18 })
    };
    return M;
  }

  function collector() {
    const lists = {};
    const push = (key, g, x, y, z, rx, ry, rz) => {
      if (rx) g.rotateX(rx);
      if (ry) g.rotateY(ry);
      if (rz) g.rotateZ(rz);
      g.translate(x, y, z);
      (lists[key] || (lists[key] = [])).push(g);
    };
    const up = new THREE.Vector3(0, 1, 0);
    return {
      box(key, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { push(key, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); },
      cyl(key, rt, rb, h, x, y, z, axis = 'y', seg = 10, rx = 0, ry = 0, rz = 0) {
        const g = new THREE.CylinderGeometry(rt, rb, h, seg);
        if (axis === 'x') g.rotateZ(Math.PI / 2);
        else if (axis === 'z') g.rotateX(Math.PI / 2);
        push(key, g, x, y, z, rx, ry, rz);
      },
      sphere(key, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 12, rx = 0) {
        const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3));
        g.scale(sx, sy, sz);
        push(key, g, x, y, z, rx, 0, 0);
      },
      geo(key, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { push(key, g, x, y, z, rx, ry, rz); },
      tube(key, a, b, r, r2 = r, seg = 8) {
        const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const L = dir.length();
        if (L < 1e-5) return;
        dir.normalize();
        const g = new THREE.CylinderGeometry(r2, r, L, seg);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
        g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        (lists[key] || (lists[key] = [])).push(g);
      },
      finish() {
        const out = {};
        for (const k of Object.keys(lists)) {
          const merged = BufferGeometryUtils.mergeGeometries(lists[k], false);
          lists[k].forEach(g => g.dispose());
          if (merged) out[k] = merged;
        }
        return out;
      }
    };
  }

  // ── Spoked Supermoto / Trail Wheel (Origin = Hub Center, Spin Axis = X) ──
  function wheelParts(R, tubeR, isRear) {
    const c = collector();
    const tire = new THREE.TorusGeometry(R - tubeR, tubeR, 12, 32);
    tire.rotateY(Math.PI / 2);
    c.geo('rubber', tire);

    // Knobby dual-sport tread blocks around circumference
    const nKnobs = 24;
    for (let i = 0; i < nKnobs; i++) {
      const a = (i / nKnobs) * Math.PI * 2;
      const ny = Math.sin(a) * (R - 0.004), nz = Math.cos(a) * (R - 0.004);
      c.box('rubber', tubeR * 1.45, 0.016, 0.032, 0, ny, nz, Math.PI / 2 - a);
      const s = (i % 2 === 0 ? 1 : -1) * tubeR * 0.62;
      c.box('rubber', tubeR * 0.55, 0.014, 0.026, s, ny * 0.97, nz * 0.97, Math.PI / 2 - a);
    }

    // Gold/anodized outer alloy rim band + inner bead ring (open center so wire spokes are visible!)
    const rimR = R - tubeR * 1.72;
    const rimRing = new THREE.TorusGeometry(rimR, 0.018, 8, 28);
    rimRing.rotateY(Math.PI / 2);
    c.geo('gold', rimRing);
    const innerRim = new THREE.TorusGeometry(rimR - 0.012, 0.010, 8, 28);
    innerRim.rotateY(Math.PI / 2);
    c.geo('alu', innerRim);

    // 12 Wire Spokes (cross-laced from hub flanges to rim)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const a2 = a + (i % 2 === 0 ? 0.28 : -0.28);
      const sx = (i % 2 === 0 ? 1 : -1) * 0.032;
      c.tube('steel', [sx, Math.sin(a) * 0.042, Math.cos(a) * 0.042], [sx * 0.25, Math.sin(a2) * (rimR - 0.01), Math.cos(a2) * (rimR - 0.01)], 0.0032, 0.0028, 5);
    }

    // Center hub + axle + hollow wave brake rotor ring + hollow rear sprocket ring
    c.cyl('alu', 0.038, 0.038, tubeR * 1.6, 0, 0, 0, 'x', 14);
    c.cyl('steel', 0.015, 0.015, isRear ? 0.28 : 0.22, 0, 0, 0, 'x', 10);
    const discX = tubeR * 0.72 + 0.010;
    const discRing = new THREE.TorusGeometry(0.088, 0.011, 6, 20);
    discRing.rotateY(Math.PI / 2);
    c.geo('disc', discRing, discX, 0, 0);
    if (isRear) {
      const spX = -(tubeR * 0.72 + 0.012);
      const spRing = new THREE.TorusGeometry(0.082, 0.010, 6, 20);
      spRing.rotateY(Math.PI / 2);
      c.geo('steel', spRing, spX, 0, 0);
    }
    return c.finish();
  }

  // ── Sculpted Supermoto / Trail Body ──
  function bodyParts(withStand) {
    const c = collector();

    // 1. Engine: Crankcase, bronze clutch cover, tilted finned cylinder + DOHC head + radiator
    c.box('engine', 0.22, 0.23, 0.32, 0, 0.44, 0.02);
    c.cyl('engine', 0.095, 0.095, 0.24, 0, 0.41, 0.08, 'x', 16);
    c.cyl('bronze', 0.082, 0.082, 0.032, 0.118, 0.41, 0.06, 'x', 16); // right clutch cover
    c.cyl('black', 0.078, 0.078, 0.030, -0.118, 0.42, 0.05, 'x', 16); // left stator cover
    // Tilted cylinder + cooling fins + red/gold valve cover
    c.box('engine', 0.15, 0.20, 0.16, 0, 0.61, -0.07, -0.34);
    for (let i = 0; i < 6; i++) {
      c.box('alu', 0.185, 0.008, 0.185, 0, 0.54 + i * 0.028, -0.05 - i * 0.010, -0.34);
    }
    c.box('gold', 0.16, 0.048, 0.17, 0, 0.72, -0.115, -0.34);
    // Dual front radiators behind shrouds
    for (const s of [-1, 1]) {
      c.box('alu', 0.035, 0.21, 0.11, s * 0.105, 0.74, -0.30, 0.26);
      c.box('black', 0.038, 0.19, 0.09, s * 0.108, 0.74, -0.305, 0.26);
    }
    // Bash / skid plate under crankcase
    c.box('alu', 0.23, 0.018, 0.34, 0, 0.30, 0.01, 0.06);
    c.box('alu', 0.22, 0.12, 0.02, 0, 0.35, -0.16, -0.55);

    // 2. Twin-Spar Perimeter + Trellis Frame (clearly visible around engine)
    c.cyl('frame', 0.036, 0.036, 0.18, 0, 0.98, -0.50, 'y', 12, 0.42); // steering head tube
    for (const s of [-1, 1]) {
      // Main twin-spar upper beams (steering head -> swingarm pivot)
      c.tube('alu', [s * 0.032, 1.01, -0.49], [s * 0.118, 0.78, -0.14], 0.020, 0.022, 8);
      c.tube('alu', [s * 0.118, 0.78, -0.14], [s * 0.112, 0.43, 0.20], 0.022, 0.020, 8);
      // Front downtube + lower cradle
      c.tube('frame', [0, 0.90, -0.47], [0, 0.52, -0.22], 0.018, 0.018, 8);
      c.tube('frame', [0, 0.52, -0.22], [s * 0.095, 0.32, -0.12], 0.015, 0.015, 8);
      c.tube('frame', [s * 0.095, 0.32, -0.12], [s * 0.112, 0.43, 0.20], 0.015, 0.015, 8);
      // Rear subframe rails (exposed under slim tail)
      c.tube('frame', [s * 0.105, 0.76, -0.05], [s * 0.078, 0.93, 0.72], 0.014, 0.012, 8);
      c.tube('frame', [s * 0.112, 0.52, 0.18], [s * 0.082, 0.84, 0.54], 0.013, 0.012, 8);
    }

    // 3. Sculpted Aluminum Swingarm + Visible Yellow Rear Monoshock
    for (const s of [-1, 1]) {
      c.tube('alu', [s * 0.102, 0.43, 0.18], [s * 0.102, 0.36, 0.72], 0.026, 0.018, 8);
      c.box('alu', 0.024, 0.062, 0.52, s * 0.102, 0.395, 0.45, -0.13);
    }
    c.cyl('steel', 0.018, 0.018, 0.26, 0, 0.43, 0.18, 'x', 10); // swingarm pivot bolt
    // Central monoshock + bright yellow coil spring (clearly visible in gap behind engine)
    c.tube('gold', [0, 0.76, 0.14], [0, 0.42, 0.28], 0.024, 0.020, 10);
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      c.cyl('spring', 0.036, 0.036, 0.016, 0, 0.72 - t * 0.23, 0.155 + t * 0.095, 'y', 12, -0.38);
    }

    // 4. Sleek Wasp-Waisted Bodywork: Teardrop Tank, Diagonal Radiator Shrouds, Dipped Seat & Tail
    // Fuel tank dome
    c.sphere('paint', 0.135, 0, 0.90, -0.22, 0.95, 0.72, 1.55, 14, 0.18);
    c.cyl('alu', 0.030, 0.030, 0.016, 0, 0.995, -0.24, 'y', 12); // billet gas cap
    // Aggressive forward-swept radiator shrouds (painted + white racing graphic)
    for (const s of [-1, 1]) {
      c.box('paint', 0.028, 0.19, 0.38, s * 0.125, 0.83, -0.33, 0.38, s * 0.08, -s * 0.12);
      c.box('paint', 0.026, 0.09, 0.28, s * 0.128, 0.90, -0.38, 0.15, s * 0.10, -s * 0.10);
      c.box('decal', 0.030, 0.055, 0.26, s * 0.128, 0.84, -0.33, 0.38, s * 0.08, -s * 0.12);
      // Slim triangular rear side number plates
      c.box('decal', 0.024, 0.11, 0.30, s * 0.102, 0.86, 0.42, -0.22, -s * 0.06, -s * 0.08);
      c.box('paint', 0.026, 0.055, 0.32, s * 0.096, 0.92, 0.56, -0.24, -s * 0.05, 0);
    }
    // Contoured two-tone MX gripper seat (dips at rider hip, sweeps up onto tank & tail)
    c.box('seat', 0.185, 0.068, 0.32, 0, 0.855, 0.06, 0.08);
    c.box('seatGrip', 0.175, 0.064, 0.34, 0, 0.895, 0.36, -0.18);
    c.box('seat', 0.135, 0.050, 0.18, 0, 0.915, -0.12, 0.36);
    // Upswept rear tail fender + LED tail light + angled license plate holder
    c.box('paint', 0.145, 0.028, 0.34, 0, 0.955, 0.72, -0.22);
    c.box('tail', 0.095, 0.028, 0.028, 0, 0.955, 0.89, -0.20);
    c.box('plastic', 0.11, 0.024, 0.14, 0, 0.895, 0.88, -0.48);
    c.box('plate', 0.15, 0.095, 0.008, 0, 0.825, 0.935, 0.42);
    for (const s of [-1, 1]) c.box('amber', 0.038, 0.022, 0.022, s * 0.095, 0.885, 0.89);

    // 5. Gold USD Front Forks + Triple Clamps + High-Mount Trail Front Beak Fender
    for (const s of [-1, 1]) {
      // Upper gold anodized outer tube (headstock -> lower clamp)
      c.tube('gold', [s * 0.095, 1.04, -0.46], [s * 0.095, 0.65, -0.665], 0.024, 0.024, 10);
      // Chrome inner slider tube (lower clamp -> front axle at 0, 0.35, -0.82)
      c.tube('steel', [s * 0.095, 0.66, -0.66], [s * 0.095, 0.35, -0.82], 0.018, 0.018, 10);
      // Black fork guard protecting front of slider
      c.box('plastic', 0.032, 0.28, 0.026, s * 0.095, 0.50, -0.755, -0.48);
      c.box('alu', 0.038, 0.055, 0.048, s * 0.095, 0.355, -0.82);
    }
    // Upper & lower CNC triple clamps
    c.box('alu', 0.225, 0.028, 0.075, 0, 1.02, -0.47, 0.42);
    c.box('alu', 0.225, 0.032, 0.080, 0, 0.84, -0.565, 0.42);
    c.box('gold', 0.032, 0.072, 0.058, 0.068, 0.42, -0.72, 0.20); // front Brembo caliper
    // High-mount motocross front fender beak (mounted right under lower triple clamp!)
    c.box('paint', 0.135, 0.024, 0.36, 0, 0.79, -0.74, 0.18);
    c.box('paint', 0.110, 0.020, 0.22, 0, 0.755, -0.92, 0.42);
    c.box('plastic', 0.125, 0.022, 0.20, 0, 0.78, -0.58, -0.35);

    // 6. Enduro Headlight Mask + Digital Dash + Fatbar Handlebars + Handguards & Mirrors
    c.box('paint', 0.23, 0.22, 0.055, 0, 0.96, -0.59, 0.36);
    c.box('decal', 0.18, 0.09, 0.058, 0, 1.01, -0.575, 0.36);
    c.box('black', 0.15, 0.085, 0.060, 0, 0.92, -0.61, 0.36);
    c.box('lens', 0.125, 0.065, 0.064, 0, 0.92, -0.612, 0.36);
    for (const s of [-1, 1]) c.box('amber', 0.034, 0.022, 0.024, s * 0.135, 0.93, -0.58);
    // Digital LCD speedometer
    c.box('black', 0.10, 0.048, 0.035, 0, 1.075, -0.495, -0.35);
    c.box('screen', 0.082, 0.034, 0.008, 0, 1.082, -0.482, -0.35);
    // Tapered Fatbar + risers + grips + levers + rally handguards + mirrors
    c.box('alu', 0.09, 0.042, 0.036, 0, 1.06, -0.455, 0.42);
    c.tube('steel', [-0.18, 1.095, -0.44], [0.18, 1.095, -0.44], 0.012, 0.012, 8);
    c.cyl('plastic', 0.022, 0.022, 0.16, 0, 1.105, -0.44, 'x', 10); // bar pad
    for (const s of [-1, 1]) {
      c.tube('steel', [s * 0.18, 1.095, -0.44], [s * 0.38, 1.115, -0.38], 0.011, 0.011, 8);
      c.tube('rubber', [s * 0.28, 1.105, -0.41], [s * 0.39, 1.116, -0.375], 0.016, 0.016, 10);
      c.box('steel', 0.08, 0.010, 0.014, s * 0.29, 1.095, -0.455, 0, -s * 0.22);
      c.box('paint', 0.11, 0.052, 0.016, s * 0.33, 1.11, -0.465, 0, -s * 0.24); // handguard shield
      c.tube('steel', [s * 0.25, 1.11, -0.42], [s * 0.29, 1.24, -0.40], 0.006, 0.006, 6);
      c.sphere('black', 0.036, s * 0.30, 1.255, -0.395, 1.2, 0.75, 0.32, 10);
      c.box('mirror', 0.058, 0.036, 0.005, s * 0.30, 1.255, -0.382);
    }

    // 7. Swept Stainless Exhaust Header + High-Mount Carbon/Alu Muffler (Right Side +X)
    c.tube('steel', [0.03, 0.62, -0.15], [0.135, 0.56, -0.22], 0.019, 0.019, 8);
    c.tube('steel', [0.135, 0.56, -0.22], [0.145, 0.48, 0.18], 0.019, 0.021, 8);
    c.tube('steel', [0.145, 0.48, 0.18], [0.155, 0.78, 0.48], 0.021, 0.024, 8);
    c.cyl('alu', 0.048, 0.044, 0.38, 0.155, 0.85, 0.64, 'z', 14, -0.24); // muffler canister
    c.cyl('black', 0.046, 0.036, 0.055, 0.155, 0.895, 0.83, 'z', 14, -0.24); // carbon end-cap

    // 8. Drive Chain (Left Side -X) + Footpegs
    c.tube('black', [-0.112, 0.45, 0.12], [-0.112, 0.46, 0.72], 0.007, 0.007, 6);
    c.tube('black', [-0.112, 0.39, 0.12], [-0.112, 0.26, 0.72], 0.007, 0.007, 6);
    for (const s of [-1, 1]) {
      c.box('steel', 0.075, 0.014, 0.038, s * 0.155, 0.34, 0.08);
    }

    if (withStand) {
      c.tube('black', [-0.105, 0.34, 0.08], [-0.28, 0.04, 0.06], 0.013, 0.011, 8);
      c.box('black', 0.045, 0.014, 0.065, -0.28, 0.04, 0.06, 0, 0, 0.18);
    }
    return c.finish();
  }

  function getParts(withStand) {
    const key = withStand ? 'stand' : 'ride';
    if (partCache.has(key)) return partCache.get(key);
    const parts = {
      body: bodyParts(withStand),
      front: wheelParts(0.35, 0.064, false),
      rear: wheelParts(0.36, 0.076, true)
    };
    partCache.set(key, parts);
    return parts;
  }

  function instantiate(dict, paintOverride = null) {
    const g = new THREE.Group();
    const m = mats();
    for (const k of Object.keys(dict)) {
      const mesh = new THREE.Mesh(dict[k], k === 'paint' && paintOverride ? paintOverride : m[k]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }

  function buildRideable(paintHex = 0xD81E1E) {
    const parts = getParts(false);
    const paint = mats().paint.clone();
    paint.color.setHex(paintHex);
    const grp = new THREE.Group();
    const bodyGrp = new THREE.Group();
    grp.add(bodyGrp);
    bodyGrp.add(instantiate(parts.body, paint));
    const wF = instantiate(parts.front); wF.position.set(0, 0.35, -0.82);
    const wR = instantiate(parts.rear);  wR.position.set(0, 0.36, 0.72);
    grp.add(wF, wR);
    return { grp, bodyGrp, wheels: [wF, wR] };
  }

  function staticDict() {
    if (staticCache) return staticCache;
    const parts = getParts(true);
    const lists = {};
    const add = (dict, dx, dy, dz) => {
      for (const k of Object.keys(dict)) {
        const g = dict[k].clone();
        g.translate(dx, dy, dz);
        (lists[k] || (lists[k] = [])).push(g);
      }
    };
    add(parts.body, 0, 0, 0);
    add(parts.front, 0, 0.35, -0.82);
    add(parts.rear, 0, 0.36, 0.72);
    staticCache = {};
    for (const k of Object.keys(lists)) {
      staticCache[k] = BufferGeometryUtils.mergeGeometries(lists[k], false);
      lists[k].forEach(g => g.dispose());
    }
    return staticCache;
  }

  const PARK_COLORS = [0xD81E1E, 0x1858D6, 0x38B828, 0xF05E16, 0xD4A018, 0x262C36];

  function makeParkedGroup(placements) {
    const group = new THREE.Group();
    group.name = 'ParkedMotorbikes';
    if (!placements.length) return group;
    const dict = staticDict();
    const m = mats();
    const dummy = new THREE.Object3D();
    dummy.rotation.order = 'YXZ';
    const col = new THREE.Color();
    for (const k of Object.keys(dict)) {
      const im = new THREE.InstancedMesh(dict[k].clone(), m[k], placements.length);
      im.castShadow = true; im.receiveShadow = true;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.yaw, p.lean === undefined ? 0.16 : p.lean);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (k === 'paint') im.setColorAt(i, col.setHex(p.color !== undefined ? p.color : PARK_COLORS[i % PARK_COLORS.length]));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      if (im.computeBoundingSphere) im.computeBoundingSphere();
      group.add(im);
    }
    return group;
  }

  return { mats, buildRideable, makeParkedGroup, PARK_COLORS };
})();
