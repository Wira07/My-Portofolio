// ════════════════════════════════════════════════════════════════════════════
// CHARACTERRIG — 17-Bone Articulated 3D Soldier, Armor L1-L3, Pan & TPP Rig
// ════════════════════════════════════════════════════════════════════════════
const CharacterRig = (() => {
  const PALETTES = [
    0xFFFFFF, 0xD8CFC0, 0xB8C6D4, 0xB4C4B0, 0xAAB8CA,
    0xCEC2AE, 0xC4BEB0, 0xC8B4B4, 0xAEB6C0, 0xD6C8AC
  ];
  let geos = null;
  let mats = null;

  function makeCamoTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#2d3d50';
    ctx.fillRect(0, 0, 128, 128);
    // Digital tactical urban / slate-blue / tan multi-camo blocks (matching Reference Image 2)
    const cols = ['#1d2631', '#3b4f66', '#4d6278', '#8c7d63', '#a59579', '#242f3d', '#686e73'];
    let seed = 1337;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = cols[i % cols.length];
      const x = Math.floor(rnd() * 32) * 4;
      const y = Math.floor(rnd() * 32) * 4;
      const w = (1 + Math.floor(rnd() * 5)) * 4;
      const h = (1 + Math.floor(rnd() * 3)) * 4;
      ctx.fillRect(x, y, w, h);
    }
    // Ripstop micro-grid weave
    ctx.strokeStyle = 'rgba(10,14,18,0.18)';
    ctx.lineWidth = 1;
    for (let p = 0; p < 128; p += 4) {
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(128, p); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeBalaclavaTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, '#cfd4dc');
    grad.addColorStop(0.5, '#e6eaef');
    grad.addColorStop(1, '#adb4be');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    // Fine micro-perforated breathable mesh pores (exact match to Reference Image 2 lower-face mask)
    ctx.fillStyle = 'rgba(65, 72, 82, 0.42)';
    for (let y = 2; y < 128; y += 3) {
      for (let x = (y % 6 === 2 ? 1 : 3); x < 128; x += 3) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    // Subtle vertical center seam
    ctx.strokeStyle = 'rgba(90, 98, 110, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeVisorTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 32;
    const ctx = cv.getContext('2d');
    // Iridescent blue -> violet -> crimson/orange ski-goggle lens gradient
    const grad = ctx.createLinearGradient(0, 4, 64, 28);
    grad.addColorStop(0.0, '#1652d0');
    grad.addColorStop(0.28, '#6a2bc2');
    grad.addColorStop(0.55, '#d83858');
    grad.addColorStop(0.78, '#eb6842');
    grad.addColorStop(1.0, '#1e5CE6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillRect(6, 5, 52, 4);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makePdaTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#041624';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#00d8ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, 58, 58);
    ctx.fillStyle = 'rgba(0, 216, 255, 0.25)';
    ctx.fillRect(8, 10, 48, 26);
    ctx.fillStyle = '#48ffff';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(10 + i * 8, 42, 5, 14 - (i % 3) * 4);
    }
    ctx.beginPath();
    ctx.arc(32, 23, 9, 0, Math.PI * 2);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function xf(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    if (x || y || z) g.translate(x, y, z);
    return g;
  }
  const bGeo = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  const cGeo = (rt, rb, h, x = 0, y = 0, z = 0, seg = 10, rx = 0, ry = 0, rz = 0) => xf(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz);
  const sGeo = (r, x = 0, y = 0, z = 0, ws = 12, hs = 9, sx = 1, sy = 1, sz = 1, pL = Math.PI * 2, tL = Math.PI) => {
    const g = new THREE.SphereGeometry(r, ws, hs, 0, pL, 0, tL);
    if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
    return xf(g, x, y, z);
  };
  const mGeo = (list) => BufferGeometryUtils.mergeGeometries(list, false);

  function ensureShared() {
    if (geos) return;
    const camoTex = makeCamoTexture();
    const maskTex = makeBalaclavaTexture();
    const visorTex = makeVisorTexture();
    const pdaTex = makePdaTexture();

    // 1. Pelvis + Battle Belt + Left-Hip Smoke/Frag Canister
    const pelvisPant = mGeo([
      bGeo(0.35, 0.16, 0.23, 0, 0, 0),
      bGeo(0.18, 0.10, 0.24, 0, -0.05, 0) // groin pad
    ]);
    const pelvisBelt = mGeo([
      bGeo(0.375, 0.058, 0.255, 0, 0.055, 0),                // heavy MOLLE battle belt
      bGeo(0.075, 0.11, 0.085, -0.205, 0.01, 0.01),          // left hip utility pouch
      bGeo(0.080, 0.13, 0.095,  0.205, -0.01, -0.01),        // right hip drop-leg holster
      cGeo(0.028, 0.028, 0.125, -0.175, 0.005, -0.115, 10, 0.12, 0, -0.15), // left-hip smoke/frag canister (Ref Image 2)
      bGeo(0.024, 0.028, 0.030, -0.175, 0.072, -0.115)       // grenade spoon/fuze head
    ]);
    const pelvisAccent = mGeo([
      bGeo(0.072, 0.052, 0.022, 0, 0.055, -0.132),           // Cobra belt buckle
      cGeo(0.0295, 0.0295, 0.024, -0.175, 0.022, -0.115, 10, 0.12, 0, -0.15) // red band on belt canister
    ]);

    // 2. Torso + Jacket Shoulders + Collar
    const chestSuit = mGeo([
      bGeo(0.43, 0.34, 0.25, 0, 0, 0),
      sGeo(0.092, -0.235, 0.115, 0, 10, 8, 1.0, 1.05, 1.05), // left shoulder deltoid pad
      sGeo(0.092,  0.235, 0.115, 0, 10, 8, 1.0, 1.05, 1.05), // right shoulder deltoid pad
      cGeo(0.118, 0.148, 0.078, 0, 0.185, 0, 12),            // combat collar
      bGeo(0.012, 0.085, 0.070, -0.318, 0.09, 0, 0, 0, 0.12), // left shoulder patch
      bGeo(0.012, 0.085, 0.070,  0.318, 0.09, 0, 0, 0, -0.12) // right shoulder patch
    ]);

    // 3. Heavy Plate Carrier Vest + 4 Front STANAG Mag Pouches + Diagonal Sling (Ref Image 2)
    const vestBody = mGeo([
      bGeo(0.445, 0.355, 0.285, 0, -0.005, 0),               // main front/back plate carrier
      bGeo(0.32, 0.065, 0.295, 0, 0.12, 0),                  // upper chest admin panel
      bGeo(0.085, 0.065, 0.26, -0.155, 0.178, 0),            // left padded shoulder strap
      bGeo(0.085, 0.065, 0.26,  0.155, 0.178, 0),            // right padded shoulder strap
      bGeo(0.465, 0.14, 0.22, 0, -0.08, 0)                   // cummerbund side armor wraps
    ]);
    const pouchParts = [
      bGeo(0.15, 0.075, 0.025, 0, 0.085, -0.152)             // chest admin velcro pouch
    ];
    const hwParts = [
      // Diagonal tactical rifle sling across chest (exact match to Ref Image 2)
      bGeo(0.036, 0.42, 0.018, -0.02, 0.01, -0.154, 0, 0, -0.62),
      // Radio / PTT unit on left upper chest + antenna wire
      bGeo(0.052, 0.078, 0.034, -0.145, 0.115, -0.152),
      cGeo(0.004, 0.004, 0.14, -0.162, 0.19, -0.142, 6),
      // Chest morale/ID patch plate
      bGeo(0.086, 0.038, 0.010, 0.01, 0.095, -0.164),
      // Shoulder strap D-rings & buckles
      bGeo(0.048, 0.018, 0.024, -0.155, 0.155, -0.138),
      bGeo(0.048, 0.018, 0.024,  0.155, 0.155, -0.138)
    ];
    // 4 Front Open-Top Magazine Pouches + 4 Ribbed STANAG Mags + Bungee Pull Tabs
    const magXs = [-0.138, -0.046, 0.046, 0.138];
    for (let i = 0; i < 4; i++) {
      const mx = magXs[i];
      pouchParts.push(
        bGeo(0.078, 0.125, 0.046, mx, -0.075, -0.165),       // tan/camo pouch body
        bGeo(0.082, 0.018, 0.050, mx, -0.045, -0.165),       // upper MOLLE webbing band
        bGeo(0.082, 0.018, 0.050, mx, -0.095, -0.165)        // lower MOLLE webbing band
      );
      hwParts.push(
        bGeo(0.062, 0.068, 0.032, mx, -0.002, -0.165, 0.08, 0, 0), // dark STANAG mag sticking out top
        bGeo(0.040, 0.014, 0.036, mx,  0.034, -0.163),             // Magpul floorplate loop
        bGeo(0.010, 0.095, 0.008, mx, -0.045, -0.190)              // vertical retention bungee cord
      );
    }
    const vestPouches = mGeo(pouchParts);
    const vestHardware = mGeo(hwParts);

    // 4. Head + Perforated Lower-Face Balaclava + Iridescent Ski Goggles + ComTac Headset
    const headCranium = sGeo(0.132, 0, 0.005, 0.004, 14, 12, 0.95, 1.04, 1.02);
    const balaclavaGeo = mGeo([
      sGeo(0.126, 0, -0.022, -0.024, 14, 10, 0.92, 0.96, 0.98),    // front-only lower face mask wrap
      bGeo(0.118, 0.088, 0.095, 0, -0.056, -0.052),                // sculpted jaw & chin guard
      cGeo(0.018, 0.038, 0.072, 0, -0.012, -0.120, 8, -0.25, 0, 0) // contoured nose bridge
    ]);
    // Smoothly curved wrap-around ski/ballistic goggle lens (-Z front, zero vertical box seams)
    const goggleLens = xf(new THREE.CylinderGeometry(0.138, 0.134, 0.068, 22, 1, false, Math.PI * 0.68, Math.PI * 0.64), 0, 0.022, -0.006);
    const headRigging = mGeo([
      // Contoured ski-goggle rubber frame top/bottom + helmet strap
      xf(new THREE.CylinderGeometry(0.141, 0.141, 0.012, 20, 1, false, Math.PI * 0.67, Math.PI * 0.66), 0, 0.056, -0.006),
      xf(new THREE.CylinderGeometry(0.136, 0.136, 0.010, 20, 1, false, Math.PI * 0.69, Math.PI * 0.62), 0, -0.012, -0.006),
      bGeo(0.285, 0.032, 0.22, 0, 0.022, -0.01),
      // ComTac Tactical Headset Ear-cups + Boom Mic
      cGeo(0.046, 0.046, 0.038, -0.138, -0.012, -0.005, 10, 0, 0, Math.PI * 0.5),
      cGeo(0.046, 0.046, 0.038,  0.138, -0.012, -0.005, 10, 0, 0, Math.PI * 0.5),
      bGeo(0.010, 0.010, 0.115, -0.112, -0.052, -0.068, 0.18, -0.38, 0),
      sGeo(0.014, -0.048, -0.058, -0.128, 8, 6), // mic windscreen foam
      // Dark chin guard & strap
      bGeo(0.112, 0.022, 0.088, 0, -0.098, -0.046)
    ]);

    // 5. FAST High-Cut Tactical Helmet + NVG Mount + Side Rails + Right-Side Flashlight Pod (Ref Image 2)
    const fastHelmShell = mGeo([
      sGeo(0.158, 0, 0.022, 0.005, 16, 12, 0.98, 0.96, 1.05, Math.PI * 2, Math.PI * 0.54),
      bGeo(0.235, 0.024, 0.065, 0, 0.058, -0.128, 0.12, 0, 0) // front brow rim
    ]);
    const fastHelmHardware = mGeo([
      // Front NVG Wilcox Mount Shroud + 3 Vent Slots
      bGeo(0.064, 0.056, 0.022, 0, 0.082, -0.152, -0.18, 0, 0),
      bGeo(0.038, 0.036, 0.028, 0, 0.082, -0.156, -0.18, 0, 0),
      bGeo(0.028, 0.010, 0.016, -0.058, 0.088, -0.138, 0,  0.30, 0),
      bGeo(0.028, 0.010, 0.016,  0.058, 0.088, -0.138, 0, -0.30, 0),
      // Side ARC Accessory Rails (left & right)
      bGeo(0.018, 0.022, 0.145, -0.152, 0.042, -0.015, 0.08, 0, 0),
      bGeo(0.018, 0.022, 0.145,  0.152, 0.042, -0.015, 0.08, 0, 0),
      // Right-side Helmet Tactical Light Pod (character's right = +X, visible on viewer's left in Ref Image 2!)
      bGeo(0.028, 0.026, 0.036,  0.164, 0.052, -0.055),
      cGeo(0.020, 0.018, 0.072,  0.172, 0.052, -0.068, 12, Math.PI * 0.5, 0, 0)
    ]);
    const helmLightLens = cGeo(0.015, 0.015, 0.006, 0.172, 0.052, -0.105, 10, Math.PI * 0.5, 0, 0);

    // 6. Arms + Full-Length Camo Sleeves + Two-Tone Armored Gloves + Forearm Tactical PDA
    const upperArm = cGeo(0.074, 0.062, 0.26, 0, -0.13, 0, 10);
    const foreArm  = cGeo(0.060, 0.048, 0.24, 0, -0.12, 0, 10);
    const elbAndCuff = mGeo([
      sGeo(0.058, 0, 0, 0.012, 8, 6),                         // elbow pad
      cGeo(0.051, 0.050, 0.036, 0, -0.225, 0, 10),            // wrist velcro cuff
      bGeo(0.082, 0.034, 0.080, 0, -0.255, 0),                // dark carbon-fiber knuckle plate
      bGeo(0.074, 0.042, 0.036, 0, -0.285, -0.018)            // dark finger grip pads
    ]);
    const gloveTan = mGeo([
      bGeo(0.078, 0.078, 0.074, 0, -0.265, 0),                // tan leather glove body
      bGeo(0.032, 0.048, 0.034, 0, -0.260, -0.046, 0.25, 0, 0) // articulated thumb
    ]);
    // Left-forearm glowing cyan tactical wrist-screen (Ref Image 2)
    const pdaFrame  = bGeo(0.064, 0.105, 0.022, -0.018, -0.135, -0.048, 0, 0.22, 0);
    const pdaScreen = bGeo(0.050, 0.086, 0.006, -0.020, -0.135, -0.058, 0, 0.22, 0);

    // 7. Legs + Cargo Pockets + Contoured Knee Pads + Laced Combat Boots
    const thigh = mGeo([
      cGeo(0.104, 0.082, 0.42, 0, -0.21, 0, 10),
      bGeo(0.035, 0.15, 0.11, -0.088, -0.20, 0),
      bGeo(0.035, 0.15, 0.11,  0.088, -0.20, 0)
    ]);
    const shin = cGeo(0.078, 0.060, 0.40, 0, -0.20, 0, 10);
    const legGear = mGeo([
      bGeo(0.108, 0.118, 0.048, 0, 0, -0.076),                // knee pad shell
      bGeo(0.165, 0.026, 0.165, 0, 0, -0.005),                // knee pad strap
      bGeo(0.124, 0.028, 0.275, 0, -0.475, -0.055)            // lugged boot sole
    ]);
    const bootUpper = mGeo([
      cGeo(0.068, 0.065, 0.11, 0, -0.35, 0, 10),              // boot ankle cuff
      bGeo(0.116, 0.095, 0.26, 0, -0.425, -0.055)             // boot vamp & toe
    ]);

    const panMerged = mGeo([
      cGeo(0.16, 0.15, 0.03, 0, 0, 0, 14, Math.PI * 0.5, 0, 0),
      bGeo(0.03, 0.18, 0.025, 0, -0.20, 0)
    ]);

    geos = {
      pelvisPant, pelvisBelt, pelvisAccent,
      waist: new THREE.CylinderGeometry(0.165, 0.175, 0.16, 10),
      chestSuit,
      neck: new THREE.CylinderGeometry(0.070, 0.082, 0.11, 10),
      headCranium, balaclavaGeo, goggleLens, headRigging,
      fastHelmShell, fastHelmHardware, helmLightLens,
      vestBody, vestPouches, vestHardware,
      bag1: new THREE.BoxGeometry(0.27, 0.34, 0.15),
      bag2: new THREE.BoxGeometry(0.32, 0.42, 0.19),
      bag3: new THREE.BoxGeometry(0.36, 0.48, 0.24),
      upperArm, foreArm, elbAndCuff, gloveTan, pdaFrame, pdaScreen,
      thigh, shin, legGear, bootUpper,
      panMerged,
      chute: new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.46)
    };

    mats = {
      skin: new THREE.MeshStandardMaterial({ color: 0xC68E68, roughness: 0.68 }),
      balaclava: new THREE.MeshStandardMaterial({ color: 0xE2E6EC, map: maskTex, roughness: 0.82, metalness: 0.04 }),
      visorIridescent: new THREE.MeshPhysicalMaterial({
        color: 0xFFFFFF, map: visorTex, emissive: 0x3A1642, emissiveIntensity: 0.28,
        roughness: 0.12, metalness: 0.55, clearcoat: 1.0, clearcoatRoughness: 0.05
      }),
      wristScreen: new THREE.MeshStandardMaterial({
        color: 0x88F4FF, map: pdaTex, emissive: 0x00D8FF, emissiveMap: pdaTex, emissiveIntensity: 1.15,
        roughness: 0.18, metalness: 0.4
      }),
      pdaLens: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, emissive: 0xFFF2CC, emissiveIntensity: 1.4 }),
      boots: new THREE.MeshStandardMaterial({ color: 0x1B1E22, roughness: 0.76, metalness: 0.12 }),
      gearDark: new THREE.MeshStandardMaterial({ color: 0x1E2328, roughness: 0.64, metalness: 0.22 }),
      pouchTan: new THREE.MeshStandardMaterial({ color: 0x86775C, roughness: 0.74, metalness: 0.08 }),
      redBand: new THREE.MeshStandardMaterial({ color: 0xC83228, roughness: 0.42, metalness: 0.35 }),
      helmCamo: new THREE.MeshStandardMaterial({ color: 0xDCE2E8, map: camoTex, roughness: 0.68, metalness: 0.12 }),
      vestBase: new THREE.MeshStandardMaterial({ color: 0x52585E, map: camoTex, roughness: 0.70, metalness: 0.14 }),
      armor: [
        new THREE.MeshStandardMaterial({ color: 0xDCE2E8, map: camoTex, roughness: 0.68, metalness: 0.12 }),
        new THREE.MeshStandardMaterial({ color: 0x889480, map: camoTex, roughness: 0.64, metalness: 0.16 }),
        new THREE.MeshStandardMaterial({ color: 0x9C927A, map: camoTex, roughness: 0.58, metalness: 0.22 }),
        new THREE.MeshStandardMaterial({ color: 0x4A5462, map: camoTex, roughness: 0.42, metalness: 0.38 })
      ],
      pan: new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.36, metalness: 0.84 }),
      chute: new THREE.MeshStandardMaterial({ color: 0xE57A25, roughness: 0.68, side: THREE.DoubleSide }),
      suits: PALETTES.map(col => new THREE.MeshStandardMaterial({ color: col, map: camoTex, roughness: 0.76, metalness: 0.06 })),
      pants: PALETTES.map(col => {
        const c = new THREE.Color(col).multiplyScalar(0.90);
        return new THREE.MeshStandardMaterial({ color: c, map: camoTex, roughness: 0.80, metalness: 0.05 });
      })
    };
  }

  function createRig(paletteIdx = 0, weaponId = 'm416') {
    ensureShared();
    const pIdx = paletteIdx % mats.suits.length;
    const suitMat = mats.suits[pIdx];
    const pantMat = mats.pants[pIdx];
    const root = new THREE.Group();

    const pelvis = new THREE.Group(); pelvis.position.y = 0.89;
    pelvis.add(
      new THREE.Mesh(geos.pelvisPant, pantMat),
      new THREE.Mesh(geos.pelvisBelt, mats.gearDark),
      new THREE.Mesh(geos.pelvisAccent, mats.redBand)
    );
    root.add(pelvis);

    const spine = new THREE.Group(); spine.position.y = 0.08;
    const waistM = new THREE.Mesh(geos.waist, suitMat); waistM.position.y = 0.07;
    spine.add(waistM);
    pelvis.add(spine);

    const chest = new THREE.Group(); chest.position.y = 0.28;
    chest.add(new THREE.Mesh(geos.chestSuit, suitMat));
    spine.add(chest);

    const neck = new THREE.Group(); neck.position.y = 0.22;
    neck.add(new THREE.Mesh(geos.neck, mats.gearDark));
    chest.add(neck);

    const head = new THREE.Group(); head.position.y = 0.13;
    head.add(
      new THREE.Mesh(geos.headCranium, mats.gearDark),
      new THREE.Mesh(geos.balaclavaGeo, mats.balaclava),
      new THREE.Mesh(geos.goggleLens, mats.visorIridescent),
      new THREE.Mesh(geos.headRigging, mats.gearDark)
    );
    neck.add(head);

    // Tactical FAST High-Cut Operator Helmets (L0-L3, all oriented toward -Z)
    const makeFastHelmet = (lvl) => {
      const hg = new THREE.Group();
      hg.position.y = 0.022;
      const shell = new THREE.Mesh(geos.fastHelmShell, mats.armor[lvl] || mats.helmCamo);
      const hw = new THREE.Mesh(geos.fastHelmHardware, mats.gearDark);
      const lens = new THREE.Mesh(geos.helmLightLens, mats.pdaLens);
      hg.add(shell, hw, lens);
      hg.visible = (lvl === 0);
      head.add(hg);
      return hg;
    };
    const helmMeshes = [makeFastHelmet(0), makeFastHelmet(1), makeFastHelmet(2), makeFastHelmet(3)];

    // Tactical Plate Carrier Vest with 4 Front Magazine Pouches + Sling (Always equipped on operator, upgraded by L1-L3)
    const vestGrp = new THREE.Group();
    const vestBody = new THREE.Mesh(geos.vestBody, mats.vestBase);
    const vestPouches = new THREE.Mesh(geos.vestPouches, mats.pouchTan);
    const vestHw = new THREE.Mesh(geos.vestHardware, mats.gearDark);
    vestGrp.add(vestBody, vestPouches, vestHw);
    vestGrp.visible = true;
    chest.add(vestGrp);

    // Backpacks & Pan sit on +Z (BACK side when character faces -Z!)
    const bagMeshes = [null, new THREE.Mesh(geos.bag1, mats.armor[1]), new THREE.Mesh(geos.bag2, mats.armor[2]), new THREE.Mesh(geos.bag3, mats.armor[3])];
    for (let i = 1; i <= 3; i++) { bagMeshes[i].position.set(0, 0.01, 0.21); bagMeshes[i].visible = false; chest.add(bagMeshes[i]); }

    const panGrp = new THREE.Group();
    panGrp.add(new THREE.Mesh(geos.panMerged, mats.pan));
    panGrp.position.set(-0.08, -0.05, 0.175);
    panGrp.rotation.z = -0.35;
    chest.add(panGrp);

    const chuteGrp = new THREE.Group();
    const canopy = new THREE.Mesh(geos.chute, mats.chute); canopy.position.y = 3.2;
    chuteGrp.add(canopy);
    chuteGrp.visible = false;
    root.add(chuteGrp);

    // Weapon Pivot attached to chest facing -Z cleanly (+Z gun models rotated PI around Y)
    const gunPivot = new THREE.Group();
    gunPivot.position.set(0.15, 0.04, -0.24);
    const gunMount = new THREE.Group();
    gunMount.rotation.y = Math.PI;
    gunPivot.add(gunMount);
    chest.add(gunPivot);

    // Arms (Full digital camo sleeves + two-tone gloves + glowing cyan PDA on left forearm)
    const makeArm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.26, 0.12, 0);
      const uArm = new THREE.Mesh(geos.upperArm, suitMat);
      const elb = new THREE.Group(); elb.position.y = -0.26;
      const fArm = new THREE.Mesh(geos.foreArm, suitMat);
      const elbGear = new THREE.Mesh(geos.elbAndCuff, mats.gearDark);
      const glove = new THREE.Mesh(geos.gloveTan, mats.pouchTan);
      const hand = new THREE.Group(); hand.position.y = -0.25;
      sh.add(uArm, elb);
      elb.add(fArm, elbGear, glove, hand);
      if (side === -1) {
        elb.add(
          new THREE.Mesh(geos.pdaFrame, mats.gearDark),
          new THREE.Mesh(geos.pdaScreen, mats.wristScreen)
        );
      }
      chest.add(sh);
      return { sh, elb, hand, get rotation() { return sh.rotation; } };
    };
    const armL = makeArm(-1), armR = makeArm(1);

    // Legs (boots toe facing -Z forward)
    const makeLeg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.115, -0.06, 0);
      const thigh = new THREE.Mesh(geos.thigh, pantMat);
      const knee = new THREE.Group(); knee.position.y = -0.42;
      const shin = new THREE.Mesh(geos.shin, pantMat);
      const lGear = new THREE.Mesh(geos.legGear, mats.gearDark);
      const bUp = new THREE.Mesh(geos.bootUpper, mats.boots);
      const foot = new THREE.Group(); foot.position.y = -0.41;
      hip.add(thigh, knee);
      knee.add(shin, lGear, bUp, foot);
      pelvis.add(hip);
      return { hip, knee, foot, get rotation() { return hip.rotation; } };
    };
    const legL = makeLeg(-1), legR = makeLeg(1);

    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const rig = {
      root, pelvis, spine, chest, neck, head, armL, armR, legL, legR,
      gunPivot, gunMount, helmMeshes, vestM: vestBody, vestGrp, bagMeshes, panGrp, chuteGrp,
      weaponId: '', walkPhase: 0, shootKick: 0, suitColor: mats.suits[pIdx].color.getHex()
    };
    setWeapon(rig, weaponId);
    return rig;
  }

  function setWeapon(rig, weaponId) {
    if (!rig || rig.weaponId === weaponId) return;
    rig.weaponId = weaponId;
    while (rig.gunMount.children.length) rig.gunMount.remove(rig.gunMount.children[0]);
    if (weaponId && WEAPONS_DB[weaponId]) {
      const def = WEAPONS_DB[weaponId];
      const defAtt = (def.style === 'ar' || def.style === 'scar' || def.style === 'ak' || def.style === 'smg' || def.style === 'vector')
        ? { optic: 'reddot', grip: 'vertgrip' }
        : {};
      const built = ModelBuilders.buildWeaponModel(weaponId, defAtt);
      built.root.scale.setScalar(1.06);
      rig.gunMount.add(built.root);
    }
  }

  function setGear(rig, helmLvl, vestLvl, bagLvl, hasPan = true) {
    if (!rig) return;
    for (let i = 0; i <= 3; i++) {
      if (rig.helmMeshes[i]) rig.helmMeshes[i].visible = helmLvl === i;
    }
    for (let i = 1; i <= 3; i++) {
      if (rig.bagMeshes[i]) rig.bagMeshes[i].visible = bagLvl === i;
    }
    rig.vestGrp.visible = true;
    rig.vestM.material = vestLvl > 0 ? mats.armor[vestLvl] : mats.vestBase;
    rig.panGrp.visible = !!hasPan;
  }

  function animateRig(rig, pose, dt) {
    if (!rig) return;
    const { speed = 0, stance = 'stand', pitch = 0, ads = 0, chuteOpen = false, freefall = false } = pose;
    rig.shootKick = Math.max(0, rig.shootKick - dt * 6);
    rig.chuteGrp.visible = chuteOpen;

    if (freefall) {
      rig.pelvis.position.y = 0.89;
      rig.pelvis.rotation.set(-Math.PI * 0.44, 0, 0);
      rig.armL.sh.rotation.set(0.3, 0, -0.9); rig.armR.sh.rotation.set(0.3, 0, 0.9);
      rig.legL.hip.rotation.set(-0.25, 0, -0.22); rig.legR.hip.rotation.set(-0.25, 0, 0.22);
      rig.legL.knee.rotation.x = -0.35; rig.legR.knee.rotation.x = -0.35;
      return;
    }

    if (stance === 'prone') {
      rig.pelvis.position.y = 0.28;
      rig.pelvis.rotation.set(-Math.PI * 0.45, 0, 0);
      rig.spine.rotation.set(0.4, 0, 0);
      rig.armL.sh.rotation.set(0.85, 0, -0.18); rig.armR.sh.rotation.set(0.90, 0, 0.12);
      rig.legL.hip.rotation.x = 0.1 + Math.sin(rig.walkPhase) * 0.16;
      rig.legR.hip.rotation.x = 0.1 - Math.sin(rig.walkPhase) * 0.16;
      rig.legL.knee.rotation.x = -0.1; rig.legR.knee.rotation.x = -0.1;
      return;
    }

    rig.pelvis.rotation.set(0, 0, 0);
    const isCrouch = stance === 'crouch';
    rig.walkPhase += speed * dt * (isCrouch ? 2.4 : 2.1);
    const amp = Util.clamp(speed / 5.5, 0, 1);
    const sw = Math.sin(rig.walkPhase) * 0.62 * amp;

    rig.pelvis.position.y = isCrouch ? 0.66 + Math.abs(Math.cos(rig.walkPhase)) * 0.025 * amp : 0.89 + Math.abs(Math.cos(rig.walkPhase)) * 0.03 * amp;
    rig.spine.rotation.set(isCrouch ? -0.24 : -0.04, 0, 0);

    // Legs stride forward toward -Z (+X rotation = forward, -X knee = natural rear bend)
    rig.legL.hip.rotation.set(sw + (isCrouch ? 0.58 : 0.06), 0, -0.03);
    rig.legR.hip.rotation.set(-sw + (isCrouch ? 0.58 : -0.04), 0, 0.03);
    rig.legL.knee.rotation.x = -Math.max(0.06, (isCrouch ? 1.05 : 0.08) + Math.max(0, -sw) * 0.85);
    rig.legR.knee.rotation.x = -Math.max(0.06, (isCrouch ? 1.05 : 0.08) + Math.max(0, sw) * 0.85);

    const isMelee = rig.weaponId === 'pan';
    const isPistol = rig.weaponId === 'p92' || rig.weaponId === 'deagle';
    if (isMelee) {
      rig.gunPivot.position.set(0.24, -0.06, -0.22);
      rig.gunPivot.rotation.set(0.55 - pitch * 0.4, -0.15, -0.35);
      rig.armR.sh.rotation.set(0.75 + pitch * 0.4 - sw * 0.2, 0.1, 0.08);
      rig.armR.elb.rotation.x = 0.65;
      rig.armL.sh.rotation.set(-sw * 0.45 + 0.15, 0, -0.12);
      rig.armL.elb.rotation.x = 0.35;
    } else if (isPistol) {
      rig.gunPivot.position.set(0.08, 0.11, -0.38);
      rig.gunPivot.rotation.set(pitch * 0.72 + rig.shootKick * 0.16, 0, 0);
      const aR = 1.05 + pitch * 0.65 - rig.shootKick * 0.16;
      rig.armR.sh.rotation.set(aR, 0.18, 0.08);
      rig.armR.elb.rotation.x = 0.52;
      rig.armL.sh.rotation.set(aR, -0.24, -0.10);
      rig.armL.elb.rotation.x = 0.52;
    } else {
      // Tactical Two-Handed Rifle / SMG / SR Stance pointing -Z cleanly
      rig.gunPivot.position.set(0.14, 0.06, -0.24);
      rig.gunPivot.rotation.set(pitch * 0.75 + rig.shootKick * 0.15, 0.10, 0);
      const raise = 0.72 + pitch * 0.62 - rig.shootKick * 0.14 + ads * 0.14;
      rig.armR.sh.rotation.set(raise, 0.18, 0.12);
      rig.armR.elb.rotation.x = 0.96;
      rig.armL.sh.rotation.set(raise + 0.25, -0.52, -0.14);
      rig.armL.elb.rotation.x = 0.72;
    }
    rig.head.rotation.x = Util.clamp(pitch * 0.55, -0.45, 0.45);
  }

  return { createRig, setWeapon, setGear, animateRig, get PALETTES() { return PALETTES; } };
})();

// ════════════════════════════════════════════════════════════════════════════
// VERLETRAGDOLL — 14-Point Verlet Particle Elimination Physics (Pool 12)
// ════════════════════════════════════════════════════════════════════════════
const VerletRagdoll = (() => {
  const MAX_POOL = 12;
  const ragdolls = [];
  let boneGeo = null;
  let headGeo = null;

  const PAIRS = [
    [0, 1, 0.22], [1, 2, 0.24], [2, 3, 0.42],
    [2, 4, 0.30], [4, 6, 0.28], [2, 5, 0.30], [5, 7, 0.28],
    [3, 8, 0.16], [3, 9, 0.16], [8, 10, 0.42], [10, 12, 0.42], [9, 11, 0.42], [11, 13, 0.42]
  ];

  function createEntry(scene) {
    if (!boneGeo) {
      boneGeo = new THREE.CylinderGeometry(0.075, 0.072, 1, 6);
      headGeo = new THREE.SphereGeometry(0.14, 8, 8);
    }
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x4B593B, roughness: 0.85 });
    const limbs = PAIRS.map(() => {
      const m = new THREE.Mesh(boneGeo, mat);
      m.castShadow = true;
      grp.add(m);
      return m;
    });
    const headM = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xC68E68, roughness: 0.72 }));
    grp.add(headM);
    grp.visible = false;
    scene.add(grp);
    return {
      active: false, life: 0, grp, mat, limbs, headM,
      pts: Array.from({ length: 14 }, () => ({ x: 0, y: 0, z: 0, ox: 0, oy: 0, oz: 0 }))
    };
  }

  function init(scene) {
    ragdolls.forEach(r => scene.remove(r.grp));
    ragdolls.length = 0;
    for (let i = 0; i < MAX_POOL; i++) ragdolls.push(createEntry(scene));
  }

  function spawnRagdoll(basePos, yaw, suitHex, hitDir, hitZone) {
    if (!ragdolls.length) return;
    let slot = ragdolls.find(r => !r.active) || ragdolls.reduce((a, b) => a.life < b.life ? a : b);
    slot.active = true;
    slot.life = 7.0;
    slot.mat.color.setHex(suitHex || 0x4B593B);
    slot.grp.visible = true;

    const c = Math.cos(yaw), s = Math.sin(yaw);
    const localPts = [
      [0, 1.68, 0], [0, 1.48, 0], [0, 1.28, 0], [0, 0.88, 0],
      [-0.28, 1.15, -0.1], [0.28, 1.15, -0.1], [-0.32, 0.90, -0.25], [0.32, 0.90, -0.25],
      [-0.12, 0.84, 0], [0.12, 0.84, 0], [-0.12, 0.45, 0], [0.12, 0.45, 0], [-0.12, 0.05, 0], [0.12, 0.05, 0]
    ];
    for (let i = 0; i < 14; i++) {
      const [lx, ly, lz] = localPts[i];
      const wx = basePos.x + lx * c + lz * s;
      const wz = basePos.z - lx * s + lz * c;
      const wy = basePos.y + ly;
      const p = slot.pts[i];
      p.x = p.ox = wx; p.y = p.oy = wy; p.z = p.oz = wz;
      if (i <= 2 && hitDir) {
        const k = hitZone === 'head' && i === 0 ? 0.18 : 0.09;
        p.ox -= hitDir.x * k;
        p.oy -= 0.02;
        p.oz -= hitDir.z * k;
      }
    }
  }

  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vUp = new THREE.Vector3(0, 1, 0), vDir = new THREE.Vector3();
  function update(dt) {
    const g = 18 * dt * dt;
    for (let r = 0; r < ragdolls.length; r++) {
      const rag = ragdolls[r];
      if (!rag.active) continue;
      rag.life -= dt;
      if (rag.life <= 0) { rag.active = false; rag.grp.visible = false; continue; }

      if (rag.life > 3.5) {
        for (let i = 0; i < 14; i++) {
          const p = rag.pts[i];
          const vx = (p.x - p.ox) * 0.96, vy = (p.y - p.oy) * 0.96, vz = (p.z - p.oz) * 0.96;
          p.ox = p.x; p.oy = p.y; p.oz = p.z;
          p.x += vx; p.y += vy - g; p.z += vz;
          const gh = World.getHeight(p.x, p.z) + 0.06;
          if (p.y < gh) { p.y = gh; p.ox = Util.lerp(p.ox, p.x, 0.35); p.oz = Util.lerp(p.oz, p.z, 0.35); }
        }
        for (let it = 0; it < 2; it++) {
          for (let k = 0; k < PAIRS.length; k++) {
            const [ia, ib, rest] = PAIRS[k];
            const a = rag.pts[ia], b = rag.pts[ib];
            const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            const d = Math.hypot(dx, dy, dz) || 0.001;
            const diff = (d - rest) / d * 0.5;
            a.x += dx * diff; a.y += dy * diff; a.z += dz * diff;
            b.x -= dx * diff; b.y -= dy * diff; b.z -= dz * diff;
          }
        }
      }
      rag.headM.position.set(rag.pts[0].x, rag.pts[0].y, rag.pts[0].z);
      for (let k = 0; k < PAIRS.length; k++) {
        const [ia, ib] = PAIRS[k];
        const a = rag.pts[ia], b = rag.pts[ib];
        vA.set(a.x, a.y, a.z); vB.set(b.x, b.y, b.z);
        const m = rag.limbs[k];
        m.position.copy(vA).add(vB).multiplyScalar(0.5);
        vDir.subVectors(vB, vA);
        const len = Math.max(0.02, vDir.length());
        m.scale.set(1, len, 1);
        m.quaternion.setFromUnitVectors(vUp, vDir.divideScalar(len));
      }
    }
  }

  return { init, spawnRagdoll, update };
})();

// ════════════════════════════════════════════════════════════════════════════
// AI — 10Hz Staggered Utility + Behavior Tree Bots (<=1.5ms budget, Pan, Smoke LoS)
// ════════════════════════════════════════════════════════════════════════════
const AI = (() => {
  const CALLSIGNS = [
    'Garuda-01','Bima-2','Rimba','Elang-7','Harimau','Cakra-4','Nusantara','Krakatau','Wijaya','Komodo',
    'Surya-9','Merpati','Kencana','Badak-5','Banteng','Barakuda','Satria','Jalak-3','Patriot','Mandala',
    'Rajasa','Arjuna','Kresna','Nakula','Sadewa','Gatutkaca','Gajah-8','Siliwangi','Diponegoro','Sudirman',
    'Pattimura','Hasanudin','Antasari','Mataram','Majapahit','Sriwijaya','Kalimantan','Sumatra','Jawa-01','Sulawesi',
    'Papua-6','Bali-2','Maluku','Sumbawa','Timor-8','Sabang','Merauke','Borneo','Cendrawasih','Bromo',
    'Semeru','Merapi','Rinjani','Toba-3','Mahakam','Kapuas','Bengawan','Brantas','Serayu','Cisadane'
  ];

  const bots = [];
  let botGroup = null;
  let diffKey = 'regular';
  let aiTimeMs = 0;
  let tickFrame = 0;
  let killsByPlayer = 0;
  let dmgByPlayer = 0;

  function initScene(scene) {
    if (botGroup) scene.remove(botGroup);
    bots.length = 0;
    botGroup = new THREE.Group();
    botGroup.name = 'RajawaliBots';
    scene.add(botGroup);
    VerletRagdoll.init(scene);
    killsByPlayer = 0;
    dmgByPlayer = 0;
  }

  function makeRayHitTest(bot) {
    return function(ro, rd, maxT) {
      if (!this.alive) return null;
      const p = this.pos;
      const eyeOff = this.stance === 'prone' ? 0.35 : this.stance === 'crouch' ? 1.1 : 1.65;
      // 1. Head sphere check
      const hy = p.y + eyeOff + 0.08;
      const toHx = ro.x - p.x, toHy = ro.y - hy, toHz = ro.z - p.z;
      const bH = toHx * rd.x + toHy * rd.y + toHz * rd.z;
      const cH = toHx * toHx + toHy * toHy + toHz * toHz - 0.18 * 0.18;
      const dH = bH * bH - cH;
      if (dH >= 0) {
        const tH = -bH - Math.sqrt(dH);
        if (tH > 0 && tH < maxT) return { t: tH, zone: 'head' };
      }
      // 2. Torso / Pan / Legs cylinder check
      const a = rd.x * rd.x + rd.z * rd.z;
      if (a > 1e-6) {
        const toCx = ro.x - p.x, toCz = ro.z - p.z;
        const b = 2 * (toCx * rd.x + toCz * rd.z);
        const c = toCx * toCx + toCz * toCz - 0.30 * 0.30;
        const d = b * b - 4 * a * c;
        if (d >= 0) {
          const t = (-b - Math.sqrt(d)) / (2 * a);
          if (t > 0 && t < maxT) {
            const hitY = ro.y + rd.y * t - p.y;
            const maxH = this.stance === 'prone' ? 0.55 : this.stance === 'crouch' ? 1.25 : 1.60;
            if (hitY >= 0.04 && hitY <= maxH) {
              // Check Rear Frying Pan shield deflection!
              if (this.hasPan && hitY >= 0.72 && hitY <= 1.25) {
                const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
                if (rd.x * fwdX + rd.z * fwdZ > 0.45) return { t, zone: 'pan' };
              }
              return { t, zone: hitY > maxH * 0.62 ? 'chest' : hitY > maxH * 0.44 ? 'abdomen' : 'leg' };
            }
          }
        }
      }
      return null;
    };
  }

  function createBot(idx, sx, sz, sy, mode = 'skydive', wepId = 'akm', poiTarget = null) {
    const name = CALLSIGNS[idx % CALLSIGNS.length];
    const rig = CharacterRig.createRig(idx, wepId);
    rig.root.position.set(sx, sy, sz);
    botGroup.add(rig.root);

    const initMag = WEAPONS_DB[wepId]?.mag || 30;
    const bot = {
      id: idx, name, alive: true, isBot: true, hp: 100, maxHp: 100,
      pos: new THREE.Vector3(sx, sy, sz), vel: new THREE.Vector3(),
      yaw: 0, pitch: 0, stance: 'stand',
      weaponId: wepId, mag: initMag, ammo: initMag * 2, reloadTimer: 0, meleeCd: 0,
      helm: { level: mode === 'practice' ? 1 : 0, dur: mode === 'practice' ? 80 : 0 },
      vest: { level: mode === 'practice' ? 1 : 0, dur: mode === 'practice' ? 200 : 0 },
      bagLvl: 1, hasPan: true, meds: 2,
      state: mode === 'skydive' ? 'PARACHUTE' : 'LOOT',
      rig, reactTimer: 0, fireCd: 0, healTimer: 0, pathTimer: 0, stuckTimer: 0, teleStuck: 0,
      lastProgressPos: new THREE.Vector3(sx, sy, sz),
      waypoints: [], wpIdx: 0, targetObj: null, goalPos: poiTarget || { x: sx, z: sz },
      chuteOpen: mode === 'skydive', shootKick: 0, kills: 0
    };
    bot.rayHitTest = makeRayHitTest(bot);
    CharacterRig.setGear(rig, bot.helm.level, bot.vest.level, bot.bagLvl, bot.hasPan);
    bots.push(bot);
    return bot;
  }

  function spawnMatchBots(scene, count = 39, difficulty = 'regular', dropCenter = { x: 0, z: 0 }) {
    initScene(scene);
    diffKey = difficulty;
    const rng = Util.mulberry32(World.seed + 5511);
    const cityFocus = !!dropCenter?.cityFocus;
    for (let i = 0; i < count; i++) {
      const poi = (cityFocus && i % 5 !== 0)
        ? { x: dropCenter.x || 160, z: dropCenter.z || 90 }
        : CONFIG.pois[i % CONFIG.pois.length];
      const ang = rng() * Math.PI * 2;
      const rad = cityFocus && i % 5 !== 0 ? (16 + rng() * 62) : (18 + rng() * 55);
      const gx = Util.clamp(poi.x + Math.cos(ang) * rad, -700, 700);
      const gz = Util.clamp(poi.z + Math.sin(ang) * rad, -700, 700);
      const startY = 380 + rng() * 140;
      const wPool = ['akm', 'm416', 'ump45', 'scarl', 'p92'];
      createBot(i, gx + (rng() - 0.5) * 80, gz + (rng() - 0.5) * 80, startY, 'skydive', wPool[i % wPool.length], { x: gx, z: gz });
    }
    return bots.length;
  }

  function spawnPracticeSkirmish(scene, count = 4) {
    initScene(scene);
    diffKey = 'regular';
    const px = Player.pos.x, pz = Player.pos.z;
    const inCity = typeof World !== 'undefined' && World.isUrbanPlaza && World.isUrbanPlaza(px, pz);
    const offsets = inCity
      ? [[-12, -38], [13, -40], [-9, -56], [11, -54], [-13, -46], [8, -48]]
      : [[-14, -36], [14, -40], [-6, -54], [10, -48], [-18, -28], [16, -30]];
    for (let i = 0; i < Math.min(count, offsets.length); i++) {
      const bx = px + offsets[i][0], bz = pz + offsets[i][1];
      const by = World.getHeight(bx, bz);
      const b = createBot(i, bx, bz, by, 'practice', i % 2 === 0 ? 'akm' : 'ump45', { x: bx, z: bz });
      b.chuteOpen = false;
      if (inCity) b.fireCd = 2.6 + i * 0.4;
    }
    return bots.length;
  }

  function pushKillFeed(killerName, victimName, wepName, isHead = false) {
    const kf = document.getElementById('hud-kill-feed');
    if (!kf) return;
    const row = document.createElement('div');
    row.className = 'kill-row';
    row.innerHTML = `<span style="color:#F2B705;">${killerName}</span> <span>[${wepName}${isHead ? ' • HS' : ''}]</span> <span>${victimName}</span>`;
    kf.prepend(row);
    while (kf.children.length > 5) kf.removeChild(kf.lastChild);
    setTimeout(() => row.remove(), 6500);
  }

  function eliminateBot(bot, killerName = 'Zona', wepName = 'Senjata', hitDir = null, hitZone = 'chest') {
    if (!bot.alive) return;
    bot.alive = false;
    bot.hp = 0;
    bot.rig.root.visible = false;
    VerletRagdoll.spawnRagdoll(bot.pos, bot.yaw, bot.rig.suitColor, hitDir, hitZone);

    const dropItems = [];
    if (bot.weaponId && Loot.ITEMS[bot.weaponId]) dropItems.push({ itemId: bot.weaponId, def: Loot.ITEMS[bot.weaponId], qty: 1 });
    const ak = Loot.WEAPON_AMMO[bot.weaponId] || 'ammo762';
    const remTotal = (bot.mag || 0) + (bot.ammo || 0);
    if (remTotal > 0 && Loot.ITEMS[ak]) dropItems.push({ itemId: ak, def: Loot.ITEMS[ak], qty: Math.min(remTotal, 45) });
    if (bot.helm.level > 0) dropItems.push({ itemId: `helm${bot.helm.level}`, def: Loot.ITEMS[`helm${bot.helm.level}`], qty: 1 });
    if (bot.vest.level > 0) dropItems.push({ itemId: `vest${bot.vest.level}`, def: Loot.ITEMS[`vest${bot.vest.level}`], qty: 1 });
    dropItems.push({ itemId: 'firstaid', def: Loot.ITEMS.firstaid, qty: 1 });
    dropItems.push({ itemId: 'frag', def: Loot.ITEMS.frag, qty: 1 });
    Loot.spawnDeathCrate(bot.pos.x, bot.pos.y, bot.pos.z, dropItems, bot.name);

    pushKillFeed(killerName, bot.name, wepName, hitZone === 'head');
    if (killerName === 'Anda') {
      killsByPlayer++;
      const klEl = document.getElementById('hud-kills');
      if (klEl) klEl.textContent = String(killsByPlayer);
    }
    const alEl = document.getElementById('hud-alive');
    if (alEl) {
      const rem = bots.filter(b => b.alive).length + (Player.alive ? 1 : 0);
      alEl.textContent = String(rem);
    }
  }

  function applyBotDamage(bot, rawDmg, zone, dist, hitPos, hitDir, owner) {
    if (!bot.alive) return;
    if (zone === 'pan') {
      AudioSys.playImpact('pan', hitPos || bot.pos);
      for (let s = 0; s < 5; s++) Ballistics.spawnParticle(hitPos || bot.pos, new THREE.Vector3((Math.random()-0.5)*5, 3, (Math.random()-0.5)*5), 0xFFCC55, 1.0, 0.3, 12);
      if (owner === 'player') Player.showHitFeedback?.(0, 'pan', dist, true);
      return;
    }
    let dmg = rawDmg;
    if (zone === 'head' && bot.helm.level > 0 && bot.helm.dur > 0) {
      const abs = dmg * CONFIG.armor.helm[bot.helm.level - 1].abs;
      bot.helm.dur = Math.max(0, bot.helm.dur - abs); dmg -= abs;
    } else if ((zone === 'chest' || zone === 'abdomen') && bot.vest.level > 0 && bot.vest.dur > 0) {
      const abs = dmg * CONFIG.armor.vest[bot.vest.level - 1].abs;
      bot.vest.dur = Math.max(0, bot.vest.dur - abs); dmg -= abs;
    }
    bot.hp -= dmg;
    if (owner === 'player') {
      dmgByPlayer += dmg;
      Player.showHitFeedback?.(dmg, zone, dist, false);
    }
    if (bot.hp <= 0) {
      const killerName = owner === 'player' ? 'Anda' : owner?.name || 'Kombatan';
      const wepName = owner === 'player' ? WEAPONS_DB[Player.activeWeapon.id]?.name : WEAPONS_DB[owner?.weaponId]?.name || 'Senjata';
      eliminateBot(bot, killerName, wepName, hitDir, zone);
    }
  }

  function rayBlockedBySmoke(ox, oy, oz, tx, ty, tz, smokes) {
    if (!smokes || !smokes.length) return false;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const lSq = dx * dx + dy * dy + dz * dz;
    if (lSq < 1) return false;
    for (let i = 0; i < smokes.length; i++) {
      const sm = smokes[i];
      if (!sm.active) continue;
      const t = Util.clamp(((sm.x - ox) * dx + (sm.y + 1.5 - oy) * dy + (sm.z - oz) * dz) / lSq, 0, 1);
      const cx = ox + dx * t - sm.x, cy = oy + dy * t - (sm.y + 1.5), cz = oz + dz * t - sm.z;
      if (cx * cx + cy * cy + cz * cz < sm.r * sm.r) return true;
    }
    return false;
  }

  function update(dt, elapsed, playerTarget, smokes, zones) {
    const t0 = performance.now();
    VerletRagdoll.update(dt);
    tickFrame++;

    const diff = CONFIG.bots.difficulty[diffKey] || CONFIG.bots.difficulty.regular;
    const pPos = Player.pos;
    const nBots = bots.length;

    for (let i = 0; i < nBots; i++) {
      const bot = bots[i];
      if (!bot.alive) continue;

      const distToCam = Math.hypot(bot.pos.x - pPos.x, bot.pos.z - pPos.z);
      const isNear = distToCam < 340;
      bot.rig.root.visible = isNear;

      // Skydiving / Parachute descent phase
      if (bot.state === 'PARACHUTE') {
        const gh = Math.max(0, World.getHeight(bot.goalPos.x, bot.goalPos.z));
        const dx = bot.goalPos.x - bot.pos.x, dz = bot.goalPos.z - bot.pos.z;
        const dH = Math.hypot(dx, dz);
        if (dH > 2) {
          bot.pos.x += (dx / dH) * 14 * dt;
          bot.pos.z += (dz / dH) * 14 * dt;
          bot.yaw = Math.atan2(-dx, -dz);
        }
        bot.pos.y -= (bot.pos.y - gh > 120 ? 38 : 11) * dt;
        bot.chuteOpen = (bot.pos.y - gh <= 125);
        bot.rig.root.position.copy(bot.pos);
        bot.rig.root.rotation.y = bot.yaw;
        if (isNear) CharacterRig.animateRig(bot.rig, { chuteOpen: bot.chuteOpen, freefall: !bot.chuteOpen, speed: 0 }, dt);
        if (bot.pos.y <= gh + 0.1) {
          bot.pos.y = gh; bot.chuteOpen = false; bot.state = 'LOOT';
          bot.rig.chuteGrp.visible = false;
        }
        continue;
      }

      // Blue Zone DPS if zone active
      if (zones?.blue && zones.blue.dps > 0) {
        if (Math.hypot(bot.pos.x - zones.blue.x, bot.pos.z - zones.blue.z) > zones.blue.r) {
          bot.hp -= zones.blue.dps * dt;
          if (bot.hp <= 0) { eliminateBot(bot, 'Zona Biru', 'Radiasi', null, 'chest'); continue; }
        }
      }

      // Coarse Simulation (> 340m away from player) -> Fast move & distant skirmishes
      if (!isNear) {
        if (zones?.white) {
          const dZ = Math.hypot(bot.pos.x - zones.white.x, bot.pos.z - zones.white.z);
          if (dZ > zones.white.r * 0.85) {
            const ang = Math.atan2(zones.white.z - bot.pos.z, zones.white.x - bot.pos.x);
            bot.pos.x += Math.cos(ang) * 4.5 * dt;
            bot.pos.z += Math.sin(ang) * 4.5 * dt;
          }
        }
        bot.pos.y = Math.max(World.getHeight(bot.pos.x, bot.pos.z), -0.5);
        // Resolve occasional background skirmish at 10Hz bucket
        if ((i % 12 === tickFrame % 12) && Math.random() < 0.008) {
          for (let j = i + 1; j < nBots; j++) {
            const b2 = bots[j];
            if (b2.alive && Math.hypot(b2.pos.x - bot.pos.x, b2.pos.z - bot.pos.z) < 65) {
              b2.hp -= 28;
              if (b2.hp <= 0) eliminateBot(b2, bot.name, WEAPONS_DB[bot.weaponId]?.name || 'AKM');
              break;
            }
          }
        }
        continue;
      }

      // Staggered 10Hz AI Decision Slice
      if (bot.fireCd > 0) bot.fireCd -= dt;
      if (i % 3 === tickFrame % 3) {
        // Decision Evaluation (~10Hz)
        if (zones?.white && Math.hypot(bot.pos.x - zones.white.x, bot.pos.z - zones.white.z) > zones.white.r * 0.92) {
          bot.state = 'FLEE_ZONE';
          bot.goalPos = { x: zones.white.x + (Math.random() - 0.5) * 40, z: zones.white.z + (Math.random() - 0.5) * 40 };
        } else if (bot.hp < 52 && bot.meds > 0 && !bot.targetObj) {
          bot.state = 'HEAL'; bot.healTimer = 3.5;
        }

        // Line-of-Sight Target Scan (Player + Nearby Bots within 135m)
        let bestTgt = null, bestDist = 135;
        const eyeY = bot.pos.y + 1.55;
        const candidates = playerTarget?.alive ? [playerTarget] : [];
        for (let bi = 0; bi < nBots; bi++) {
          if (bi !== i && bots[bi].alive) candidates.push(bots[bi]);
        }
        for (let ci = 0; ci < candidates.length; ci++) {
          const cand = candidates[ci];
          const d = Math.hypot(cand.pos.x - bot.pos.x, cand.pos.z - bot.pos.z);
          if (d >= bestDist) continue;
          const tEye = cand.pos.y + 1.4;
          const v = Util.v1.set(cand.pos.x - bot.pos.x, tEye - eyeY, cand.pos.z - bot.pos.z);
          const len = v.length(); v.divideScalar(Math.max(0.01, len));
          const hit = Physics.raycast(bot.pos.x, eyeY, bot.pos.z, v.x, v.y, v.z, len - 0.4, cand);
          if (!hit && !rayBlockedBySmoke(bot.pos.x, eyeY, bot.pos.z, cand.pos.x, tEye, cand.pos.z, smokes)) {
            bestDist = d; bestTgt = cand;
          }
        }
        if (bestTgt && (bot.mag > 0 || bot.ammo > 0 || bestDist < 10)) {
          if (bot.targetObj !== bestTgt) bot.reactTimer = diff.react;
          bot.targetObj = bestTgt;
          bot.state = 'ENGAGE';
        } else if (bot.state === 'ENGAGE') {
          bot.targetObj = null;
          bot.state = 'LOOT';
        }

        // Waypoint refresh if LOOT / FLEE_ZONE
        bot.pathTimer -= dt * 3;
        if (bot.pathTimer <= 0 && (bot.state === 'LOOT' || bot.state === 'FLEE_ZONE')) {
          bot.pathTimer = 2.6;
          if (bot.state === 'LOOT') {
            const nearbyLoot = Loot.queryNearby(bot.pos.x, bot.pos.y, bot.pos.z, 30);
            const needAmmo = (bot.mag + bot.ammo) < 15;
            const preferred = needAmmo
              ? (nearbyLoot.find(l => l.def.cat === 'ammo' || (l.def.cat === 'weapon' && l.itemId !== 'pan')) || nearbyLoot[0])
              : nearbyLoot[0];
            if (preferred) {
              const pick = preferred;
              if (Math.hypot(pick.x - bot.pos.x, pick.z - bot.pos.z) < 2.2) {
                pick.taken = true; Loot.markDirty();
                if (pick.def.cat === 'weapon' && pick.itemId !== 'pan') {
                  bot.weaponId = pick.itemId;
                  const mSz = WEAPONS_DB[pick.itemId]?.mag || 30;
                  bot.mag = mSz;
                  bot.ammo += mSz;
                  CharacterRig.setWeapon(bot.rig, pick.itemId);
                } else if (pick.def.cat === 'ammo') {
                  bot.ammo += (pick.def.qty || 30);
                } else if (pick.def.cat === 'helm' && pick.def.level > bot.helm.level) {
                  bot.helm = { level: pick.def.level, dur: pick.def.dur };
                } else if (pick.def.cat === 'vest' && pick.def.level > bot.vest.level) {
                  bot.vest = { level: pick.def.level, dur: pick.def.dur };
                } else if (pick.def.cat === 'med') {
                  bot.meds++;
                }
                CharacterRig.setGear(bot.rig, bot.helm.level, bot.vest.level, bot.bagLvl, bot.hasPan);
              } else {
                bot.goalPos = { x: pick.x, z: pick.z };
              }
            } else {
              bot.goalPos = { x: bot.pos.x + (Math.random() - 0.5) * 70, z: bot.pos.z + (Math.random() - 0.5) * 70 };
            }
          }
          bot.waypoints = NavGrid.findPath(bot.pos.x, bot.pos.z, bot.goalPos.x, bot.goalPos.z, 600);
          bot.wpIdx = 0;
        }
      }

      // Every-frame smooth locomotion, door opening & finite-ammo combat firing
      if (bot.meleeCd > 0) bot.meleeCd -= dt;
      let spd = 0;
      if (bot.state === 'HEAL') {
        bot.stance = 'crouch';
        bot.healTimer -= dt;
        if (bot.healTimer <= 0) { bot.hp = Math.min(100, bot.hp + 45); bot.meds--; bot.state = 'LOOT'; bot.stance = 'stand'; }
      } else if (bot.state === 'ENGAGE' && bot.targetObj?.alive) {
        const t = bot.targetObj;
        const dx = t.pos.x - bot.pos.x, dz = t.pos.z - bot.pos.z;
        const dist = Math.hypot(dx, dz);
        bot.yaw = Math.atan2(-dx, -dz);
        bot.stance = (dist > 55 || bot.reloadTimer > 0) ? 'crouch' : 'stand';

        if (bot.reloadTimer > 0) {
          bot.reloadTimer -= dt;
          if (bot.reloadTimer <= 0) {
            const maxM = WEAPONS_DB[bot.weaponId]?.mag || 30;
            const take = Math.min(maxM, Math.max(0, bot.ammo));
            bot.mag += take;
            bot.ammo -= take;
          }
        } else if (bot.mag <= 0) {
          if (bot.ammo > 0) {
            bot.reloadTimer = 2.1;
          } else {
            // Out of ammo! Close-in with Pan melee if very close, otherwise disengage to loot
            if (dist > 2.4 && dist < 10) {
              spd = 4.6;
              bot.pos.x += (dx / dist) * spd * dt;
              bot.pos.z += (dz / dist) * spd * dt;
            } else if (dist <= 2.4 && bot.meleeCd <= 0) {
              bot.meleeCd = 0.75;
              bot.rig.shootKick = 1.0;
              if (t.isPlayer) Player.takeDamage(38, 'chest', bot.pos, bot.name);
              else applyBotDamage(t, 38, 'chest', dist, t.pos, new THREE.Vector3(dx, 0, dz).normalize(), bot);
            } else if (dist >= 10) {
              bot.targetObj = null;
              bot.state = 'LOOT';
            }
          }
        } else {
          // Slight tactical strafe when close
          if (dist > 14 && dist < 50) {
            const side = ((bot.id & 1) ? 1 : -1) * Math.sin(elapsed * 1.8 + bot.id);
            bot.pos.x += Math.cos(bot.yaw) * side * 2.2 * dt;
            bot.pos.z -= Math.sin(bot.yaw) * side * 2.2 * dt;
            spd = 2.2;
          }
          if (bot.reactTimer > 0) bot.reactTimer -= dt;
          else if (bot.fireCd <= 0 && bot.mag > 0) {
            bot.mag--;
            const wDef = WEAPONS_DB[bot.weaponId] || WEAPONS_DB.akm;
            bot.fireCd = (60 / wDef.rpm) * (1.8 + Math.random() * 1.4);
            // Ballistic Lead + Gravity Drop compensation + Difficulty Err
            const tof = dist / Math.max(100, wDef.muzzleVel);
            const dropY = 0.5 * CONFIG.ballistics.gravity * tof * tof;
            const aimX = t.pos.x + (t.vel?.x || 0) * tof + (Math.random() - 0.5) * diff.err * (dist / 100);
            const aimY = t.pos.y + 1.32 + dropY + (Math.random() - 0.5) * diff.err * 0.5 * (dist / 100);
            const aimZ = t.pos.z + (t.vel?.z || 0) * tof + (Math.random() - 0.5) * diff.err * (dist / 100);
            const ori = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.48, bot.pos.z);
            const fDir = new THREE.Vector3(aimX - ori.x, aimY - ori.y, aimZ - ori.z).normalize();
            bot.pitch = Util.clamp(Math.asin(Util.clamp(fDir.y, -0.9, 0.9)), -1.2, 1.2);
            Ballistics.fireBullet(ori, fDir, wDef, { owner: bot });
            AudioSys.playGunshot(wDef.sound, ori, false, false, false);
            bot.rig.shootKick = 1.0;
          }
        }
      } else {
        bot.stance = 'stand';
        const wp = bot.waypoints[bot.wpIdx] || bot.goalPos;
        const dx = wp.x - bot.pos.x, dz = wp.z - bot.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.2) {
          if (bot.wpIdx < bot.waypoints.length - 1) bot.wpIdx++;
        } else {
          spd = 4.5;
          bot.yaw = Math.atan2(-dx, -dz);
          bot.pos.x += (dx / d) * spd * dt;
          bot.pos.z += (dz / d) * spd * dt;
          // Auto-open closed door if encountered
          const dr = WorldBuildings.findNearestDoor(bot.pos, 1.9);
          if (dr && !dr.isOpen) dr.toggle(false);
        }
        // Anti-stuck watchdog
        bot.stuckTimer += dt;
        if (bot.stuckTimer >= 1.2) {
          const moved = Math.hypot(bot.pos.x - bot.lastProgressPos.x, bot.pos.z - bot.lastProgressPos.z);
          if (spd > 1 && moved < 0.7) {
            bot.teleStuck += bot.stuckTimer;
            bot.pos.x += Math.cos(bot.yaw) * 1.4;
            bot.pos.z -= Math.sin(bot.yaw) * 1.4;
            if (bot.teleStuck > 10) { bot.pos.x += (Math.random() - 0.5) * 10; bot.pos.z += (Math.random() - 0.5) * 10; bot.teleStuck = 0; }
          } else {
            bot.teleStuck = 0;
          }
          bot.lastProgressPos.copy(bot.pos);
          bot.stuckTimer = 0;
        }
      }

      const fl = Physics.resolveCapsuleXZ(bot.pos, 0.34, 1.75);
      bot.pos.y = fl;
      bot.rig.root.position.copy(bot.pos);
      bot.rig.root.rotation.y = bot.yaw;
      CharacterRig.animateRig(bot.rig, { speed: spd, stance: bot.stance, pitch: bot.pitch, ads: bot.state === 'ENGAGE' ? 0.6 : 0 }, dt);
    }

    // Distance LOD + <55m shadow culling + single-draw InstancedMesh far silhouette proxy (<= 900 calls budget)
    const camP = Render.camera?.position;
    if (camP) {
      if (!update._farProxy) {
        const pGeo = new THREE.CapsuleGeometry(0.32, 0.96, 4, 6);
        pGeo.translate(0, 0.85, 0);
        const pMat = new THREE.MeshStandardMaterial({ color: 0x3b4836, roughness: 0.88 });
        const im = new THREE.InstancedMesh(pGeo, pMat, 64);
        im.frustumCulled = false;
        im.count = 0;
        Render.scene?.add(im);
        update._farProxy = im;
        update._dummy = new THREE.Object3D();
      }
      const farIm = update._farProxy;
      if (Render.scene && farIm.parent !== Render.scene) Render.scene.add(farIm);
      const dObj = update._dummy;
      let farCount = 0;
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        const rig = b.rig;
        if (!rig || !rig.root) continue;
        if (!b.alive) { rig.root.visible = false; continue; }
        const dx = b.pos.x - camP.x, dz = b.pos.z - camP.z;
        const dSq = dx * dx + dz * dz;
        const close = dSq < 78 * 78;
        const wantShadow = dSq < 36 * 36;
        rig.root.visible = close;
        if (close) {
          if (rig._lastShadow !== wantShadow) {
            rig._lastShadow = wantShadow;
            rig.root.traverse((o) => { if (o.isMesh) o.castShadow = wantShadow; });
          }
        } else if (dSq < 620 * 620 && farCount < 64) {
          dObj.position.copy(b.pos);
          dObj.rotation.set(0, b.yaw || 0, 0);
          dObj.scale.set(1, b.stance === 'crouch' ? 0.72 : (b.stance === 'prone' ? 0.38 : 1), 1);
          dObj.updateMatrix();
          farIm.setMatrixAt(farCount++, dObj.matrix);
        }
      }
      farIm.count = farCount;
      farIm.instanceMatrix.needsUpdate = true;
    }

    aiTimeMs = performance.now() - t0;
  }

  return {
    initScene, spawnMatchBots, spawnPracticeSkirmish, update, applyBotDamage, eliminateBot, pushKillFeed,
    resetPlayerStats() { killsByPlayer = 0; dmgByPlayer = 0; },
    get bots() { return bots; },
    get aiTimeMs() { return aiTimeMs; },
    get playerKills() { return killsByPlayer; },
    get playerDamage() { return dmgByPlayer; }
  };
})();

