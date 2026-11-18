// ════════════════════════════════════════════════════════════════════════════
// RENDER — WebGLRenderer, Sky, CSM Shadows, Post-Processing, Studio Rack (M1)
// ════════════════════════════════════════════════════════════════════════════
const Render = (() => {
  let renderer = null, scene = null, camera = null;
  let vmScene = null, vmCamera = null, vmSun = null, vmHemi = null, vmEnabled = false;
  let composer = null, renderPass = null, bloomPass = null, colorPass = null, fxaaPass = null, outputPass = null;
  let sky = null, sunLight = null, hemiLight = null, csm = null, stars = null;
  let pmremGen = null, envRT = null;
  let studioGroup = null;
  let currentQuality = CONFIG.isMobile ? CONFIG.quality.low : CONFIG.quality.medium;
  let currentTod = 'siang';
  let currentWeather = 'cerah';
  let resScale = 1.0;
  let dynScale = 1.0;
  let dynTimer = 0;
  let dynFrames = 0;
  let dynLastWallMs = 0;
  let lastSceneStats = { calls: 0, triangles: 0 };
  const muzzleLights = [];

  const ColorGradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      uVignette: { value: 0.28 },
      uGrain: { value: 0.02 },
      uTime: { value: 0.0 },
      uFlash: { value: 0.0 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uTime;
      uniform float uFlash;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        // Subtle tactical contrast & grain
        vec2 d = vUv - 0.5;
        float vig = smoothstep(0.32, 0.88, dot(d, d) * 1.45);
        c.rgb *= (1.0 - vig * uVignette);
        float n = (hash(vUv * 500.0 + uTime) - 0.5) * uGrain;
        c.rgb = clamp(c.rgb + n + uFlash, 0.0, 1.0);
        gl_FragColor = c;
      }
    `
  };

  // HLSL/ANGLE-clean 5-tap FXAA (avoids Three.js FXAAShader X3595/X4000 compiler warnings)
  const FastFXAAShader = {
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1 / 1024, 1 / 512) }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      varying vec2 vUv;
      float fxLuma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
      void main(){
        vec3 rgbM  = texture2D(tDiffuse, vUv).rgb;
        vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * resolution).rgb;
        vec3 rgbNE = texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * resolution).rgb;
        vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * resolution).rgb;
        vec3 rgbSE = texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * resolution).rgb;
        float lM = fxLuma(rgbM), lNW = fxLuma(rgbNW), lNE = fxLuma(rgbNE), lSW = fxLuma(rgbSW), lSE = fxLuma(rgbSE);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
        float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
        float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
        float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
        dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * resolution;
        vec3 rgbA = 0.5 * (
          texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
          texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb
        );
        vec3 rgbB = rgbA * 0.5 + 0.25 * (
          texture2D(tDiffuse, vUv + dir * -0.5).rgb +
          texture2D(tDiffuse, vUv + dir *  0.5).rgb
        );
        float lB = fxLuma(rgbB);
        gl_FragColor = vec4((lB < lMin || lB > lMax) ? rgbA : rgbB, 1.0);
      }
    `
  };

  function init(canvas) {
    // Check WebGL2 availability
    const gl = canvas.getContext('webgl2', { antialias: CONFIG.isMobile, powerPreference: 'high-performance' });
    if (!gl) {
      showFatalError('WebGL2 Tidak Tersedia', 'Browser atau GPU Anda belum mengaktifkan WebGL2. Periksa pengaturan akselerasi perangkat keras browser Anda.');
      return false;
    }

    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: CONFIG.isMobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, currentQuality.maxDpr || 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = CONFIG.isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    renderer.debug.checkShaderErrors = false;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xBED6E6, 0.00046);

    camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, CONFIG.camera.near, 2400);
    camera.position.set(0, 80, 260);

    // Viewmodel Isolated Pass Scene (58° fixed FOV, cleared depth buffer)
    vmScene = new THREE.Scene();
    vmCamera = new THREE.PerspectiveCamera(CONFIG.camera.viewmodelFov, window.innerWidth / window.innerHeight, 0.02, 8.0);
    vmHemi = new THREE.HemisphereLight(0xA4CCF0, 0x38424C, 1.05);
    vmSun = new THREE.DirectionalLight(0xF0F6FF, 2.4);
    vmSun.position.set(-1.5, 3.8, 1.6);
    const vmRim = new THREE.DirectionalLight(0x9EC8F8, 1.35);
    vmRim.position.set(1.8, 2.2, -1.5);
    vmScene.add(vmHemi, vmSun, vmRim);

    // Pooled Muzzle Flash PointLights (6 max per Sec 16.2)
    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight(0xFFB347, 0, 18, 2);
      pl.userData = { ttl: 0, maxTtl: 0.05, peakInt: 80 };
      scene.add(pl);
      muzzleLights.push(pl);
    }

    // Calibrated Tropical Atmospheric Sky Dome (hdr-balanced so Bloom never blows out to grey)
    const skyGeo = new THREE.SphereGeometry(1800, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x1557A8) },
        uBot: { value: new THREE.Color(0x87C3EB) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
        uSunCol: { value: new THREE.Color(0xFFF6DE) },
        uCloud: { value: 0.35 },
        uOvercast: { value: 0.0 },
        uNight: { value: 0.0 },
        uTime: { value: 0.0 }
      },
      vertexShader: `varying vec3 vWorldDir;
        void main(){
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform vec3 uTop, uBot, uSunDir, uSunCol;
        uniform float uCloud, uOvercast, uNight, uTime;
        varying vec3 vWorldDir;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0; float a = 0.5;
          for(int i=0;i<4;i++){ v += a*vn(p); p *= 2.05; a *= 0.5; } return v; }
        void main(){
          vec3 d = normalize(vWorldDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 grad = mix(uBot, uTop, pow(h, 0.55));
          if(d.y > 0.03){
            vec2 cuv = d.xz / (d.y + 0.18) * 1.15 + vec2(uTime * 0.008, uTime * 0.004);
            float cl = smoothstep(0.48 - uOvercast * 0.25, 0.78 - uOvercast * 0.15, fbm(cuv * 1.6));
            float fade = smoothstep(0.03, 0.24, d.y);
            vec3 cCol = mix(mix(vec3(0.88, 0.91, 0.95), vec3(0.32, 0.37, 0.42), uOvercast), vec3(0.18, 0.24, 0.36), uNight * 0.8);
            grad = mix(grad, cCol, cl * fade * (0.42 + uOvercast * 0.48) * uCloud);
          }
          float sunAmt = max(0.0, dot(d, normalize(uSunDir)));
          float disc = uNight > 0.5 ? smoothstep(0.9985, 0.9994, sunAmt) * 0.85 : pow(sunAmt, 220.0) * 0.52;
          float halo = pow(sunAmt, uNight > 0.5 ? 24.0 : 16.0) * (uNight > 0.5 ? 0.22 : 0.28) + disc;
          grad += uSunCol * halo * (1.0 - uOvercast * 0.82);
          gl_FragColor = vec4(grad, 1.0);
        }`
    });
    sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    hemiLight = new THREE.HemisphereLight(0x9AD0F5, 0x565E44, 0.85);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xFFF7EA, 3.2);
    scene.add(sunLight);

    // Starfield for night mode
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(1200 * 3);
    const rng = Util.mulberry32(777);
    for (let i = 0; i < 1200; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 0.92 + 0.06);
      const r = 1800;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xDFE9FF, size: 3.2, fog: false, transparent: true, opacity: 0.0 }));
    scene.add(stars);

    // M10 Pooled InstancedMesh Rain Curtain (1 draw call, visible only during weather==='hujan')
    const rainCount = 900;
    const rainGeo = new THREE.BoxGeometry(0.018, 0.92, 0.018);
    const rainMat = new THREE.MeshBasicMaterial({ color: 0xBDD8EE, transparent: true, opacity: 0.36, depthWrite: false });
    const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
    rainMesh.frustumCulled = false;
    rainMesh.visible = false;
    const rainDrops = new Float32Array(rainCount * 4);
    const rRng = Util.mulberry32(909);
    for (let i = 0; i < rainCount; i++) {
      rainDrops[i * 4] = (rRng() - 0.5) * 34;
      rainDrops[i * 4 + 1] = rRng() * 24 - 6;
      rainDrops[i * 4 + 2] = (rRng() - 0.5) * 34;
      rainDrops[i * 4 + 3] = 24 + rRng() * 10;
    }
    scene.add(rainMesh);
    init._rain = { mesh: rainMesh, drops: rainDrops, count: rainCount, dummy: new THREE.Object3D() };

    // M10 Night Tactical Flashlight SpotLight (FPP & TPP unified) + Player Night Rim & 4 POI Lanterns
    const tacLight = new THREE.SpotLight(0xFFF3D4, 0, 78, Math.PI / 4.2, 0.55, 1.25);
    const tacTarget = new THREE.Object3D();
    scene.add(tacLight);
    scene.add(tacTarget);
    tacLight.target = tacTarget;
    init._flashlight = { light: tacLight, target: tacTarget, enabled: false, tmpDir: new THREE.Vector3() };

    const nightRim = new THREE.PointLight(0x88B0FF, 0, 12, 1.6);
    scene.add(nightRim);
    init._nightRim = nightRim;

    const poiLights = [];
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xFFAF58, 0, 26, 1.6);
      scene.add(pl);
      poiLights.push(pl);
    }
    init._poiLights = poiLights;
    init._poiLightTimer = 0;

    pmremGen = new THREE.PMREMGenerator(renderer);
    pmremGen.compileEquirectangularShader();

    // Cascaded Shadow Maps (CSM)
    csm = new CSM({
      maxFar: CONFIG.isMobile ? 95 : 320,
      cascades: currentQuality.cascades || (CONFIG.isMobile ? 1 : 2),
      mode: 'practical',
      parent: scene,
      shadowMapSize: currentQuality.shadowSize || (CONFIG.isMobile ? 512 : 1536),
      lightDirection: new THREE.Vector3(-0.5, -0.8, -0.4).normalize(),
      camera
    });
    csm.fade = !CONFIG.isMobile && (currentQuality.cascades || 2) > 1;
    for (let i = 0; i < csm.lights.length; i++) {
      csm.lights[i].shadow.bias = CONFIG.isMobile ? -0.0012 : -0.0003;
      csm.lights[i].shadow.normalBias = CONFIG.isMobile ? 0.055 : 0.02;
    }

    // Post Processing Pipeline + Viewmodel Overlay Pass
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const vmPass = {
      enabled: true,
      needsSwap: false,
      setSize() {},
      render(r, writeBuf, readBuf) {
        if (vmEnabled) {
          const prevAuto = r.autoClear;
          r.autoClear = false;
          r.setRenderTarget(this.renderToScreen ? null : readBuf);
          r.clearDepth();
          r.render(vmScene, vmCamera);
          r.autoClear = prevAuto;
        }
        lastSceneStats.calls = r.info.render.calls;
        lastSceneStats.triangles = r.info.render.triangles;
      }
    };
    composer.addPass(vmPass);

    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.24, 0.4, 0.92);
    composer.addPass(bloomPass);

    colorPass = new ShaderPass(ColorGradeShader);
    composer.addPass(colorPass);

    fxaaPass = new ShaderPass(FastFXAAShader);
    composer.addPass(fxaaPass);

    outputPass = new OutputPass();
    composer.addPass(outputPass);

    applyAtmosphere('siang', 'cerah');
    onResize();
    window.addEventListener('resize', onResize);
    return true;
  }

  function applyAtmosphere(todKey = 'siang', weatherKey = 'cerah') {
    currentTod = todKey;
    currentWeather = weatherKey;
    const tod = CONFIG.timeOfDay[todKey] || CONFIG.timeOfDay.siang;
    const wth = CONFIG.weather[weatherKey] || CONFIG.weather.cerah;

    const phi = THREE.MathUtils.degToRad(90 - tod.elevation);
    const theta = THREE.MathUtils.degToRad(tod.azimuth);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

    const uniforms = sky.material.uniforms;
    uniforms.uTop.value.setHex(tod.skyTop || 0x1557A8);
    uniforms.uBot.value.setHex(tod.skyBot || 0x87C3EB);
    uniforms.uSunDir.value.copy(sunDir);
    uniforms.uSunCol.value.setHex(tod.sunColor);
    const overC = weatherKey === 'hujan' ? 0.88 : weatherKey === 'mendung' ? 0.68 : weatherKey === 'kabut' ? 0.45 : 0.0;
    uniforms.uOvercast.value = overC;
    uniforms.uNight.value = tod.night ? 1.0 : 0.0;
    uniforms.uCloud.value = tod.night ? 0.34 : (weatherKey === 'cerah' ? 0.55 : 0.92);
    if (overC > 0) {
      uniforms.uTop.value.lerp(new THREE.Color(0x47535E), overC * 0.72);
      uniforms.uBot.value.lerp(new THREE.Color(0x73808A), overC * 0.72);
    }

    // Opposite sky bounce fill prevents deep crushed black shadows while CSM handles primary key light
    sunLight.position.set(-sunDir.x * 300, Math.max(80, sunDir.y * 260), -sunDir.z * 300);
    sunLight.color.setHex(tod.hemiSky);
    sunLight.intensity = tod.sunInt * (tod.night ? 0.42 : 0.28) * (weatherKey === 'mendung' || weatherKey === 'hujan' ? 0.65 : 1.0);

    hemiLight.color.setHex(tod.hemiSky);
    hemiLight.groundColor.setHex(tod.hemiGnd);
    hemiLight.intensity = tod.hemiInt;

    if (stars) stars.material.opacity = tod.night ? 0.90 : 0.0;

    renderer.toneMappingExposure = tod.exposure;
    scene.fog.color.setHex(tod.fogColor);
    if (overC > 0) scene.fog.color.lerp(new THREE.Color(0x6D7B87), overC * 0.65);
    scene.fog.density = tod.fogDensity * wth.fogMult;

    if (csm) {
      csm.lightDirection.copy(sunDir).negate().normalize();
      for (let i = 0; i < csm.lights.length; i++) {
        csm.lights[i].color.setHex(tod.sunColor);
        csm.lights[i].intensity = (tod.sunInt * (weatherKey === 'mendung' || weatherKey === 'hujan' ? 0.6 : 1.0)) / Math.max(1, csm.lights.length * 0.45);
      }
    }

    // Update sky PMREM reflection environment using matching SkyDomeShader
    if (envRT) envRT.dispose();
    const skyScene = new THREE.Scene();
    const skyClone = new THREE.Mesh(new THREE.SphereGeometry(100, 16, 10), sky.material.clone());
    skyScene.add(skyClone);
    envRT = pmremGen.fromScene(skyScene, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = tod.night ? 0.52 : 0.70;
    if (vmScene) {
      vmScene.environment = envRT.texture;
      vmScene.environmentIntensity = tod.night ? 0.38 : 0.48;
      vmSun.color.setHex(tod.sunColor).lerp(new THREE.Color(0xD8E8FA), 0.58);
      vmSun.intensity = tod.sunInt * (tod.night ? 0.95 : 0.85);
      vmHemi.color.setHex(tod.hemiSky).lerp(new THREE.Color(0x98C0E8), 0.55);
      vmHemi.groundColor.setHex(0x28323E);
      vmHemi.intensity = Math.max(0.85, tod.hemiInt);
    }
    if (typeof WorldBuildings !== 'undefined') {
      if (WorldBuildings.setTimeOfDay) WorldBuildings.setTimeOfDay(todKey);
      else if (WorldBuildings.setNightMode) WorldBuildings.setNightMode(!!tod.night);
    }
    if (init._rain) init._rain.mesh.visible = currentWeather === 'hujan';
    if (init._flashlight) init._flashlight.enabled = !!tod.night;
    if (init._nightRim) init._nightRim.intensity = tod.night ? 2.6 : 0;
    if (init._poiLights && !tod.night && todKey !== 'sore') {
      for (let i = 0; i < init._poiLights.length; i++) init._poiLights[i].intensity = 0;
    }
  }

  function applySettings(settings) {
    currentQuality = CONFIG.quality[settings.preset] || CONFIG.quality.medium;
    resScale = settings.resScale || (CONFIG.isMobile ? CONFIG.mobileDefaults.resScale : 1.0);
    dynScale = 1.0;
    dynTimer = 0;
    dynFrames = 0;
    camera.fov = settings.fov || 75;
    // Always keep far plane beyond the 1800m sky dome so center sky never clips black
    camera.far = Math.max(2200, (settings.viewDist || currentQuality.viewDist) + 400);
    camera.updateProjectionMatrix();

    bloomPass.enabled = !!settings.bloom && currentQuality.bloom;
    fxaaPass.enabled = currentQuality.fxaa;
    onResize();
  }

  // Build Studio Scene showcasing all 12+ PBR Material Spheres + Planes (Milestone M1 Verification)
  function buildStudioShowcase() {
    if (studioGroup) { scene.remove(studioGroup); studioGroup = null; }
    studioGroup = new THREE.Group();
    studioGroup.name = 'StudioPBRRack';

    const names = ['concrete', 'brick', 'plaster', 'wood', 'gunmetal', 'rust', 'zincRoof', 'asphalt', 'sand', 'grass', 'dirt', 'rock'];
    const platform = new THREE.Mesh(new THREE.BoxGeometry(24, 0.4, 14), Assets.get('asphalt'));
    platform.position.set(0, 61.8, 0);
    platform.receiveShadow = true;
    studioGroup.add(platform);

    const sphereGeo = new THREE.SphereGeometry(0.75, 28, 20);
    const tileGeo = new THREE.BoxGeometry(1.5, 0.16, 1.5);
    names.forEach((n, idx) => {
      const row = Math.floor(idx / 6);
      const col = idx % 6;
      const x = -7.5 + col * 3.0;
      const z = -2.2 + row * 4.4;
      const mat = Assets.get(n);
      const sphere = new THREE.Mesh(sphereGeo, mat);
      sphere.position.set(x, 63.0, z);
      sphere.castShadow = true; sphere.receiveShadow = true;
      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(x, 62.08, z);
      tile.castShadow = true; tile.receiveShadow = true;
      studioGroup.add(sphere, tile);
    });
    studioGroup.visible = false;
    scene.add(studioGroup);
    return studioGroup;
  }

  function setStudioVisible(v) {
    if (!studioGroup) buildStudioShowcase();
    studioGroup.visible = v;
  }

  function onResize() {
    if (!renderer || !camera || !composer) return;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const maxDpr = currentQuality.maxDpr || 2;
    const effScale = Math.max(CONFIG.isMobile ? 0.95 : 0.5, resScale * dynScale * Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setPixelRatio(effScale);
    renderer.setSize(w, h);
    composer.setPixelRatio(effScale);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (vmCamera) {
      vmCamera.aspect = w / h;
      vmCamera.updateProjectionMatrix();
    }
    if (fxaaPass) {
      fxaaPass.material.uniforms['resolution'].value.set(1 / (w * effScale), 1 / (h * effScale));
    }
    if (csm) csm.updateFrustums();
  }

  async function tryEnterFullscreen(preferLandscape = true) {
    try {
      const root = document.documentElement;
      const req = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen || root.msRequestFullscreen;
      if (req && !document.fullscreenElement && !document.webkitFullscreenElement) {
        await req.call(root, { navigationUI: 'hide' }).catch(() => req.call(root));
      }
      if (preferLandscape && window.screen?.orientation?.lock) {
        await window.screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {}
  }

  async function toggleFullscreen() {
    try {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) {
        const exitFn = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitFn) await exitFn.call(document).catch(() => {});
      } else {
        await tryEnterFullscreen(CONFIG.isMobile);
      }
    } catch {}
  }

  function renderFrame(elapsedTime, dt = 0.016) {
    if (!renderer || !composer) return;
    for (let i = 0; i < muzzleLights.length; i++) {
      const pl = muzzleLights[i];
      if (pl.userData.ttl > 0) {
        pl.userData.ttl -= dt;
        const t = Math.max(0, pl.userData.ttl / (pl.userData.maxTtl || 0.05));
        pl.intensity = t * (pl.userData.peakInt || 80);
      } else pl.intensity = 0;
    }
    if (csm) csm.update();
    if (sky && camera) {
      sky.position.copy(camera.position);
      if (sky.material.uniforms?.uTime) sky.material.uniforms.uTime.value = elapsedTime;
    }
    if (init._rain && init._rain.mesh.visible && camera) {
      const { mesh, drops, count, dummy } = init._rain;
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (let i = 0; i < count; i++) {
        const idx = i * 4;
        drops[idx + 1] -= drops[idx + 3] * dt;
        drops[idx] -= 1.8 * dt;
        if (drops[idx + 1] < -8) {
          drops[idx + 1] += 24;
          drops[idx] = ((drops[idx] + 17) % 34 + 34) % 34 - 17;
        }
        dummy.position.set(cx + drops[idx], cy + drops[idx + 1], cz + drops[idx + 2]);
        dummy.rotation.set(0, 0, -0.07);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    const isNight = !!CONFIG.timeOfDay[currentTod]?.night;
    const isPlaying = typeof Game !== 'undefined' && (Game.state === 'PRACTICE' || Game.state === 'MATCH') && (typeof Player !== 'undefined' && Player.alive);
    if (init._flashlight && camera) {
      const fl = init._flashlight;
      if (fl.enabled && isPlaying) {
        camera.getWorldDirection(fl.tmpDir);
        if (vmEnabled) {
          fl.light.position.copy(camera.position).addScaledVector(fl.tmpDir, 0.35);
          fl.target.position.copy(camera.position).addScaledVector(fl.tmpDir, 28);
        } else {
          // TPP flashlight emanates forward from player's chest/shoulder rig along aim direction
          const pp = Player.pos;
          fl.light.position.set(pp.x, pp.y + 1.48, pp.z).addScaledVector(fl.tmpDir, 0.38);
          fl.target.position.set(pp.x, pp.y + 1.35, pp.z).addScaledVector(fl.tmpDir, 32);
        }
        fl.light.intensity = 38;
      } else {
        fl.light.intensity = 0;
      }
    }
    if (init._nightRim && isPlaying && isNight && typeof Player !== 'undefined') {
      camera.getWorldDirection(init._flashlight.tmpDir);
      const pp = Player.pos;
      init._nightRim.position.set(pp.x - init._flashlight.tmpDir.x * 1.4, pp.y + 2.35, pp.z - init._flashlight.tmpDir.z * 1.4);
      init._nightRim.intensity = 2.8;
    } else if (init._nightRim) {
      init._nightRim.intensity = 0;
    }
    const hasWarmPoi = isNight || currentTod === 'sore';
    if (init._poiLights && hasWarmPoi && camera && typeof WorldBuildings !== 'undefined') {
      init._poiLightTimer -= dt;
      if (init._poiLightTimer <= 0) {
        init._poiLightTimer = 0.22;
        const px = camera.position.x, pz = camera.position.z;
        const inCity = typeof World !== 'undefined' && World.isUrbanPlaza && World.isUrbanPlaza(px, pz);
        if (inCity) {
          const ch = World.getHeight(160, 90);
          const spots = [
            [154.8, ch + 8.1, 102.8, 0xFFBA68, isNight ? 18 : 13, 44],
            [174.5, ch + 3.6, 101.0, 0x72E8FF, isNight ? 14 : 10, 36],
            [133.5, ch + 9.0, 88.0,  0xFFAE52, isNight ? 15 : 11, 40],
            [159.5, ch + 4.8, 89.0,  0xFFD49E, isNight ? 13 : 9,  36]
          ];
          for (let i = 0; i < init._poiLights.length; i++) {
            const pl = init._poiLights[i], sp = spots[i];
            if (sp) {
              pl.position.set(sp[0], sp[1], sp[2]);
              pl.color.setHex(sp[3]);
              pl.intensity = sp[4];
              pl.distance = sp[5];
            } else { pl.intensity = 0; }
          }
        } else if (isNight) {
          const fps = WorldBuildings.footprints;
          const nearest = [];
          for (let i = 0; i < fps.length; i++) {
            const b = fps[i];
            const d2 = (b.cx - px) * (b.cx - px) + (b.cz - pz) * (b.cz - pz);
            if (d2 < 110 * 110) nearest.push({ b, d2 });
          }
          nearest.sort((a, b) => a.d2 - b.d2);
          for (let i = 0; i < init._poiLights.length; i++) {
            const pl = init._poiLights[i];
            pl.color.setHex(0xFFAF58);
            pl.distance = 26;
            if (i < nearest.length) {
              const b = nearest[i].b;
              const by = World.getHeight(b.cx, b.cz);
              pl.position.set(b.cx, by + 2.6, b.cz);
              pl.intensity = 9.5;
            } else {
              pl.intensity = 0;
            }
          }
        } else {
          for (let i = 0; i < init._poiLights.length; i++) init._poiLights[i].intensity = 0;
        }
      }
    }
    const inMatch = typeof Game !== 'undefined' && (Game.state === 'PRACTICE' || Game.state === 'MATCH');
    if (currentQuality.dynRes && inMatch) {
      const nowMs = performance.now();
      const wallDt = dynLastWallMs > 0 ? Math.min(0.5, (nowMs - dynLastWallMs) * 0.001) : 0;
      dynLastWallMs = nowMs;
      if (wallDt > 0) {
        dynTimer += wallDt;
        dynFrames++;
        if (dynTimer >= 3.0 && dynFrames >= 6) {
          const avgFps = dynFrames / dynTimer;
          const minDyn = CONFIG.isMobile ? 0.85 : 0.72;
          let nextDyn = dynScale;
          if (avgFps < 24 && dynScale > minDyn) nextDyn = minDyn;
          else if (avgFps > 54 && dynScale < 1.0) nextDyn = Math.min(1.0, dynScale + 0.08);
          dynTimer = 0;
          dynFrames = 0;
          if (Math.abs(nextDyn - dynScale) > 0.02) {
            dynScale = nextDyn;
            onResize();
          }
        }
      }
    } else {
      dynLastWallMs = 0;
      dynTimer = 0;
      dynFrames = 0;
    }
    const needComposer = bloomPass.enabled || fxaaPass.enabled || ((colorPass?.uniforms?.uFlash?.value || 0) > 0.01);
    renderer.info.reset();
    if (!needComposer) {
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
      if (vmEnabled) {
        const prevAuto = renderer.autoClear;
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(vmScene, vmCamera);
        renderer.autoClear = prevAuto;
      }
      lastSceneStats.calls = renderer.info.render.calls;
      lastSceneStats.triangles = renderer.info.render.triangles;
    } else {
      if (colorPass) colorPass.uniforms.uTime.value = elapsedTime % 100.0;
      composer.render();
    }
  }

  function spawnMuzzleLight(pos) {
    let best = muzzleLights[0];
    for (let i = 1; i < muzzleLights.length; i++) {
      if (muzzleLights[i].userData.ttl <= best.userData.ttl) best = muzzleLights[i];
    }
    if (best) {
      best.color.setHex(0xFFB347);
      best.distance = 18;
      best.position.copy(pos);
      best.intensity = 80;
      best.userData.peakInt = 80;
      best.userData.maxTtl = 0.05;
      best.userData.ttl = 0.05;
    }
  }

  function spawnBlastLight(pos, colorHex = 0xFF922E, peakInt = 32, distance = 48, dur = 1.4) {
    let best = muzzleLights[0];
    for (let i = 1; i < muzzleLights.length; i++) {
      if (muzzleLights[i].userData.ttl <= best.userData.ttl) best = muzzleLights[i];
    }
    if (best) {
      best.color.setHex(colorHex);
      best.distance = distance;
      best.position.set(pos.x, pos.y + 2.2, pos.z);
      best.intensity = peakInt;
      best.userData.peakInt = peakInt;
      best.userData.maxTtl = dur;
      best.userData.ttl = dur;
    }
  }

  return {
    init, applyAtmosphere, applySettings, buildStudioShowcase, setStudioVisible, onResize, renderFrame, spawnMuzzleLight, spawnBlastLight,
    tryEnterFullscreen, toggleFullscreen,
    setViewmodelEnabled(v) { vmEnabled = !!v; },
    setFlashIntensity(v) { if (colorPass) colorPass.uniforms.uFlash.value = v; },
    toggleFlashlight() { if (init._flashlight) init._flashlight.enabled = !init._flashlight.enabled; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get vmScene() { return vmScene; },
    get vmCamera() { return vmCamera; },
    get sceneStats() { return lastSceneStats; },
    get csm() { return csm; },
    get tod() { return currentTod; },
    get weather() { return currentWeather; }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// UI — Menus, Settings (6 tabs + Remap + Persistence), HowTo, Stats, HUD, Map
// ════════════════════════════════════════════════════════════════════════════
const UI = (() => {
  const _hasSavedSettings = (() => {
    try { return !!localStorage.getItem(CONFIG.storageKeys.settings); } catch { return false; }
  })();
  const _defaultForDevice = CONFIG.isMobile
    ? { ...CONFIG.defaultSettings, ...CONFIG.mobileDefaults, keybinds: { ...CONFIG.defaultKeybinds } }
    : CONFIG.defaultSettings;
  let settings = Util.loadStorage(CONFIG.storageKeys.settings, _defaultForDevice);
  if (!_hasSavedSettings && CONFIG.isMobile) {
    Object.assign(settings, CONFIG.mobileDefaults);
  }
  let stats = Util.loadStorage(CONFIG.storageKeys.stats, {
    matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0, damage: 0, bestRank: 99, longestKill: 0, history: []
  });

  let activeModal = null;
  let activeSettingsTab = 'grafis';
  let onStartMatchCallback = null;
  let onCloseModalCallback = null;
  let alertTimerId = null;
  let matchConfig = { participants: 40, difficulty: 'regular', tod: 'siang', weather: 'cerah', perspective: 'free', mapArea: 'island', seed: CONFIG.seedDefault, mode: 'br' };

  function isTouchUiEnabled() {
    if (settings.touchControls === 'on') return true;
    if (settings.touchControls === 'off') return false;
    return !!CONFIG.isMobile;
  }

  function applySettingsToDom() {
    const touchOn = isTouchUiEnabled();
    document.documentElement.style.setProperty('--ui-scale', String((settings.uiScale || 100) / 100));
    document.body.classList.toggle('is-mobile', touchOn);
    document.getElementById('touch-controls')?.classList.toggle('hidden', !touchOn);
    document.getElementById('mobile-util-row')?.classList.toggle('hidden', !touchOn);
    document.body.classList.remove('cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia');
    if (settings.colorblind && settings.colorblind !== 'none') {
      document.body.classList.add(`cb-${settings.colorblind}`);
    }
    const badge = document.getElementById('menu-preset-badge');
    if (badge) badge.textContent = (settings.preset || 'medium').toUpperCase();
    document.getElementById('hud-fps-inline')?.classList.toggle('hidden', !settings.showFps);
    const iosHint = document.getElementById('ios-pwa-hint');
    if (iosHint) iosHint.classList.toggle('hidden', !(CONFIG.isIOS && !CONFIG.isStandalone));
  }

  function saveSettings() {
    Util.saveStorage(CONFIG.storageKeys.settings, settings);
    applySettingsToDom();
    Render.applySettings(settings);
    AudioSys.applySettings(settings);
  }

  function showModal(title, renderBodyFn, renderFooterFn, tabs = null) {
    const bd = document.getElementById('modal-backdrop');
    document.getElementById('modal-title').textContent = title;
    const tabBar = document.getElementById('modal-tabs');
    if (tabs) {
      tabBar.innerHTML = '';
      tabBar.classList.remove('hidden');
      tabs.forEach(t => {
        const b = document.createElement('button');
        b.className = `tab-btn ${t.id === activeSettingsTab ? 'active' : ''}`;
        b.textContent = t.label;
        b.onclick = () => {
          AudioSys.playUiTone('click');
          activeSettingsTab = t.id;
          showSettingsModal();
        };
        tabBar.appendChild(b);
      });
    } else {
      tabBar.classList.add('hidden');
    }

    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    body.innerHTML = '';
    footer.innerHTML = '';
    renderBodyFn(body);
    renderFooterFn(footer);
    bd.classList.remove('hidden');
    activeModal = title;
  }

  function showAlertBanner(msg, durSec = 2.5) {
    const el = document.getElementById('hud-alert-banner');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    if (alertTimerId) clearTimeout(alertTimerId);
    alertTimerId = setTimeout(() => {
      el.classList.remove('visible');
      alertTimerId = null;
    }, Math.max(400, durSec * 1000));
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    activeModal = null;
    if (onCloseModalCallback) onCloseModalCallback();
    if (typeof Game !== 'undefined' && (Game.state === 'PRACTICE' || Game.state === 'MATCH') &&
        !(typeof CheatUI !== 'undefined' && CheatUI.isOpen) && !(typeof MapUI !== 'undefined' && MapUI.isOpen)) {
      try {
        const pr = document.getElementById('gl-canvas')?.requestPointerLock?.();
        if (pr && typeof pr.catch === 'function') pr.catch(() => {});
      } catch (_) {}
    }
  }

  function showMatchSetupModal(mode = 'br', defaultArea = null) {
    matchConfig.mode = mode;
    if (defaultArea) matchConfig.mapArea = defaultArea;
    if (defaultArea === 'city') matchConfig.tod = 'sore';
    else if (defaultArea === 'island' && matchConfig.tod === 'sore') matchConfig.tod = 'siang';
    const isPractice = mode === 'practice';
    const areaTitle = matchConfig.mapArea === 'city' ? ' — KOTA PICCADILLY' : '';
    showModal((isPractice ? 'PENGATURAN MODE LATIHAN' : 'PENGATURAN PERTANDINGAN SOLO') + areaTitle, (body) => {
      body.innerHTML = `<div class="setup-grid">
        <div class="field-card" style="grid-column:1 / -1;">
          <div class="field-label"><span>Lokasi / Area Peta</span><span class="tabular" id="st-area-v">${matchConfig.mapArea === 'city' ? 'Kota Piccadilly' : 'Pulau Rajawali'}</span></div>
          <div class="seg-group" data-group="mapArea">
            ${[['island','Pulau Rajawali (Semua Area)'],['city','Kota Piccadilly (Perkotaan)']].map(([k,l]) => `<button class="seg-btn ${matchConfig.mapArea === k ? 'active' : ''}" data-val="${k}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="field-card">
          <div class="field-label"><span>Jumlah Peserta</span><span class="tabular" id="st-part-v">${isPractice ? (matchConfig.mapArea === 'city' ? '1 + 4 Bot' : '1 (Range)') : matchConfig.participants}</span></div>
          <div class="seg-group" data-group="participants">
            ${[20, 40, 60].map(n => `<button class="seg-btn ${matchConfig.participants === n ? 'active' : ''}" data-val="${n}" ${isPractice ? 'disabled' : ''}>${n} Pemain</button>`).join('')}
          </div>
        </div>
        <div class="field-card">
          <div class="field-label"><span>Tingkat Kesulitan Bot</span></div>
          <div class="seg-group" data-group="difficulty">
            ${[['rookie','Rookie'],['regular','Regular'],['veteran','Veteran']].map(([k,l]) => `<button class="seg-btn ${matchConfig.difficulty === k ? 'active' : ''}" data-val="${k}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="field-card">
          <div class="field-label"><span>Waktu Hari</span></div>
          <div class="seg-group" data-group="tod">
            ${[['pagi','Pagi'],['siang','Siang'],['sore','Sore'],['malam','Malam']].map(([k,l]) => `<button class="seg-btn ${matchConfig.tod === k ? 'active' : ''}" data-val="${k}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="field-card">
          <div class="field-label"><span>Cuaca</span></div>
          <div class="seg-group" data-group="weather">
            ${[['cerah','Cerah'],['mendung','Mendung'],['kabut','Kabut'],['hujan','Hujan']].map(([k,l]) => `<button class="seg-btn ${matchConfig.weather === k ? 'active' : ''}" data-val="${k}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="field-card">
          <div class="field-label"><span>Perspektif Kamera</span></div>
          <div class="seg-group" data-group="perspective">
            ${[['fpp','FPP'],['tpp','TPP'],['free','Bebas (V)']].map(([k,l]) => `<button class="seg-btn ${matchConfig.perspective === k ? 'active' : ''}" data-val="${k}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="field-card">
          <div class="field-label"><span>Seed Pulau Rajawali</span><button id="btn-rand-seed" class="tac-btn sm">Acak</button></div>
          <input id="inp-seed" class="tac-input tabular" type="number" value="${matchConfig.seed}">
        </div>
      </div>`;

      body.querySelectorAll('.seg-group').forEach(grp => {
        const key = grp.dataset.group;
        grp.querySelectorAll('.seg-btn').forEach(btn => {
          btn.onclick = () => {
            AudioSys.playUiTone('click');
            grp.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            matchConfig[key] = key === 'participants' ? Number(btn.dataset.val) : btn.dataset.val;
            if (key === 'participants') document.getElementById('st-part-v').textContent = matchConfig.participants;
            if (key === 'mapArea') {
              const isC = matchConfig.mapArea === 'city';
              document.getElementById('st-area-v').textContent = isC ? 'Kota Piccadilly' : 'Pulau Rajawali';
              document.getElementById('modal-title').textContent = (isPractice ? 'PENGATURAN MODE LATIHAN' : 'PENGATURAN PERTANDINGAN SOLO') + (isC ? ' — KOTA PICCADILLY' : '');
              if (isPractice) document.getElementById('st-part-v').textContent = isC ? '1 + 4 Bot' : '1 (Range)';
            }
          };
        });
      });
      document.getElementById('btn-rand-seed').onclick = () => {
        AudioSys.playUiTone('click');
        matchConfig.seed = Math.floor(100000 + Math.random() * 89999999);
        document.getElementById('inp-seed').value = matchConfig.seed;
      };
      document.getElementById('inp-seed').onchange = (e) => {
        matchConfig.seed = Number(e.target.value) || CONFIG.seedDefault;
      };
    }, (footer) => {
      const bCancel = document.createElement('button');
      bCancel.className = 'tac-btn';
      bCancel.textContent = 'Batal';
      bCancel.onclick = () => { AudioSys.playUiTone('click'); closeModal(); };
      const bGo = document.createElement('button');
      bGo.className = 'tac-btn primary';
      bGo.textContent = isPractice ? 'Masuk Arena Latihan' : 'Mulai Pertandingan';
      bGo.onclick = () => {
        AudioSys.playUiTone('alert');
        if (CONFIG.isMobile) Render.tryEnterFullscreen(true);
        closeModal();
        if (onStartMatchCallback) onStartMatchCallback({ ...matchConfig });
      };
      footer.append(bCancel, bGo);
    });
  }

  function addRangeRow(parent, name, desc, key, min, max, step, unit = '') {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = `<div class="setting-info"><div class="setting-name">${name}</div><div class="setting-desc">${desc}</div></div>
      <div class="setting-ctrl"><input type="range" class="tac-range" min="${min}" max="${max}" step="${step}" value="${settings[key]}"><span class="tabular" style="min-width:52px;text-align:right;">${settings[key]}${unit}</span></div>`;
    const inp = row.querySelector('input');
    const valEl = row.querySelector('span');
    inp.oninput = () => {
      settings[key] = Number(inp.value);
      valEl.textContent = `${settings[key]}${unit}`;
      saveSettings();
    };
    parent.appendChild(row);
  }

  function addSelectRow(parent, name, desc, key, options, onChangeExtra = null) {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = `<div class="setting-info"><div class="setting-name">${name}</div><div class="setting-desc">${desc}</div></div>
      <div class="setting-ctrl"><select class="tac-select">${options.map(([v,l]) => `<option value="${v}" ${settings[key] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
    const sel = row.querySelector('select');
    sel.onchange = () => {
      AudioSys.playUiTone('click');
      const v = options.some(o => typeof o[0] === 'number') ? Number(sel.value) : sel.value;
      settings[key] = v;
      if (onChangeExtra) onChangeExtra(v);
      saveSettings();
    };
    parent.appendChild(row);
  }

  function addToggleRow(parent, name, desc, key) {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const labelBtn = () => (settings[key] ? 'AKTIF' : 'NONAKTIF');
    row.innerHTML = `<div class="setting-info"><div class="setting-name">${name}</div><div class="setting-desc">${desc}</div></div>
      <div class="setting-ctrl"><button class="tac-btn sm ${settings[key] ? 'primary' : ''}">${labelBtn()}</button></div>`;
    const btn = row.querySelector('button');
    btn.onclick = () => {
      settings[key] = !settings[key];
      btn.textContent = labelBtn();
      btn.classList.toggle('primary', settings[key]);
      AudioSys.playUiTone('click');
      saveSettings();
    };
    parent.appendChild(row);
  }

  function showSettingsModal() {
    const tabs = [
      { id: 'grafis', label: 'Grafis' },
      { id: 'kontrol', label: 'Kontrol' },
      { id: 'audio', label: 'Audio' },
      { id: 'gameplay', label: 'Gameplay' },
      { id: 'aksesibilitas', label: 'Aksesibilitas' },
      { id: 'data', label: 'Data' }
    ];
    showModal('PENGATURAN SISTEM', (body) => {
      if (activeSettingsTab === 'grafis') {
        addSelectRow(body, 'Preset Kualitas', 'Menyesuaikan jarak pandang, bayangan, rumput, dan resolusi tekstur.', 'preset',
          [['low','Low'],['medium','Medium'],['high','High'],['ultra','Ultra']], (p) => {
            const q = CONFIG.quality[p];
            settings.viewDist = q.viewDist;
            settings.grassDist = q.grassDist;
            settings.shadowCascades = q.cascades;
            settings.bloom = q.bloom;
          });
        addRangeRow(body, 'Skala Resolusi Internal', 'Turunkan jika FPS kurang dari 60.', 'resScale', 0.6, 1.0, 0.05, '×');
        addRangeRow(body, 'Jarak Render (Far)', 'Batas jarak gambar lanskap.', 'viewDist', 350, 1200, 50, 'm');
        addRangeRow(body, 'Sudut Pandang (FOV)', 'Base vertical FOV kamera utama.', 'fov', 60, 110, 1, '°');
        addToggleRow(body, 'Efek Bloom', 'Silau halus di langit dan muzzle flash.', 'bloom');
        addSelectRow(body, 'Batas FPS', 'Batas frame per detik.', 'fpsCap', [[30,'30 FPS'],[60,'60 FPS'],[120,'120 FPS'],[0,'Tak Terbatas']]);
        addToggleRow(body, 'Tampilkan FPS di HUD', 'Menampilkan counter FPS di pojok kiri atas.', 'showFps');
      } else if (activeSettingsTab === 'kontrol') {
        addRangeRow(body, 'Sensitivitas Mouse', 'Kecepatan putar kamera.', 'sensitivity', 0.2, 3.0, 0.05, '×');
        addRangeRow(body, 'Sensitivitas ADS / Scope', 'Multiplier saat membidik.', 'adsSens', 0.2, 1.5, 0.05, '×');
        addToggleRow(body, 'Balik Sumbu Y (Invert Y)', 'Gerakkan mouse ke bawah untuk melihat ke atas.', 'invertY');
        addToggleRow(body, 'Jongkok Mode Toggle', 'Tekan sekali C untuk jongkok.', 'crouchToggle');
        addToggleRow(body, 'ADS Mode Hold', 'Tahan klik kanan untuk membidik.', 'adsHold');
        addToggleRow(body, 'Dukung Gamepad', 'Gunakan controller dengan deadzone 0.12 (tanpa aim-assist).', 'gamepadEnabled');

        const kbHeader = document.createElement('div');
        kbHeader.className = 'label-uc';
        kbHeader.style.cssText = 'margin:14px 0 6px;color:var(--accent);font-size:11px;';
        kbHeader.textContent = 'Pemetaan Tombol (Klik untuk Ubah)';
        body.appendChild(kbHeader);
        const kbLabels = {
          forward: 'Maju', backward: 'Mundur', left: 'Kiri', right: 'Kanan',
          sprint: 'Sprint', walk: 'Jalan Pelan', jump: 'Lompat / Vault', crouch: 'Jongkok',
          prone: 'Tiarap', leanLeft: 'Intip Kiri', leanRight: 'Intip Kanan', reload: 'Isi Peluru',
          fireMode: 'Mode Tembak', interact: 'Interaksi / Loot', inventory: 'Inventori', map: 'Peta Besar',
          perspective: 'Ubah FPP/TPP', grenade: 'Granat', flashlight: 'Senter'
        };
        Object.entries(kbLabels).forEach(([k, label]) => {
          const row = document.createElement('div');
          row.className = 'setting-row';
          row.innerHTML = `<div class="setting-info"><div class="setting-name">${label}</div></div>
            <div class="setting-ctrl"><button class="tac-btn sm tabular">${settings.keybinds[k]}</button></div>`;
          const b = row.querySelector('button');
          b.onclick = () => {
            b.textContent = 'Tekan tombol...';
            const handler = (ev) => {
              ev.preventDefault();
              window.removeEventListener('keydown', handler, true);
              const conflict = Object.entries(settings.keybinds).find(([ok, ov]) => ok !== k && ov === ev.code);
              if (conflict) settings.keybinds[conflict[0]] = settings.keybinds[k];
              settings.keybinds[k] = ev.code;
              saveSettings();
              showSettingsModal();
            };
            window.addEventListener('keydown', handler, true);
          };
          body.appendChild(row);
        });
      } else if (activeSettingsTab === 'audio') {
        addRangeRow(body, 'Volume Master', 'Volume keseluruhan game.', 'audioMaster', 0, 1, 0.05, '');
        addRangeRow(body, 'Volume SFX', 'Senjata, langkah kaki, ledakan.', 'audioSfx', 0, 1, 0.05, '');
        addRangeRow(body, 'Volume Ambient', 'Angin, ombak pantai, hujan.', 'audioAmbient', 0, 1, 0.05, '');
        addRangeRow(body, 'Volume UI', 'Klik menu dan hit marker.', 'audioUi', 0, 1, 0.05, '');
        addRangeRow(body, 'Volume Musik', 'Tema menu dan akhir ronde.', 'audioMusic', 0, 1, 0.05, '');
        addToggleRow(body, 'Spasialisasi HRTF Headphone', 'Model HRTF akurat untuk posisi suara 3D.', 'audioHrtf');
      } else if (activeSettingsTab === 'gameplay') {
        addSelectRow(body, 'Bahasa Antarmuka', 'Bahasa teks HUD dan menu.', 'lang', [['id','Bahasa Indonesia'],['en','English']]);
        addToggleRow(body, 'Efek Darah', 'Percikan partikel hit (matikan untuk tanpa efek darah).', 'bloodFx');
        addToggleRow(body, 'Hit Marker Crosshair', 'Penanda konfirmasi peluru mengenai target.', 'hitMarkers');
        addSelectRow(body, 'Warna Crosshair', 'Pilih kontras warna reticle tengah.', 'crosshairColor', [['#EDEFF1','Putih'],['#F2B705','Kuning Amber'],['#7AF59A','Hijau Taktis']]);
        addToggleRow(body, 'Auto Pickup', 'Ambil amunisi & perban kompatibel secara otomatis.', 'autoPickup');
        addToggleRow(body, 'Default Perspektif TPP', 'Mulai pertandingan dalam sudut pandang orang ketiga.', 'defaultTpp');
        addSelectRow(body, 'Kontrol Sentuh (HP/Tablet)', 'Tampilkan joystick dan tombol aksi di layar sentuh.', 'touchControls', [['auto','Otomatis'],['on','Selalu Aktif'],['off','Nonaktif']]);
      } else if (activeSettingsTab === 'aksesibilitas') {
        addSelectRow(body, 'Filter Buta Warna', 'Kalibrasi spektrum warna layar.', 'colorblind',
          [['none','Normal'],['protanopia','Protanopia'],['deuteranopia','Deuteranopia'],['tritanopia','Tritanopia']]);
        addRangeRow(body, 'Skala HUD / UI', 'Skalakan elemen antarmuka.', 'uiScale', 80, 130, 5, '%');
        addToggleRow(body, 'Kurangi Guncangan Kamera', 'Kurangi efek getar ledakan dan pendaratan.', 'reduceShake');
        addToggleRow(body, 'Subtitle Suara Penting', 'Tampilkan penanda teks arah tembakan, zona, dan pesawat.', 'subtitles');
      } else if (activeSettingsTab === 'data') {
        const info = document.createElement('div');
        info.innerHTML = `<p style="color:var(--text-dim);margin-bottom:14px;">Semua pengaturan dan riwayat statistik disimpan lokal di <code>localStorage</code> browser Anda.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btn-reset-settings" class="tac-btn danger">Reset Pengaturan Default</button>
            <button id="btn-reset-stats" class="tac-btn danger">Hapus Semua Statistik</button>
          </div>`;
        body.appendChild(info);
        document.getElementById('btn-reset-settings').onclick = () => {
          settings = structuredClone(CONFIG.defaultSettings);
          saveSettings();
          showSettingsModal();
        };
        document.getElementById('btn-reset-stats').onclick = () => {
          stats = { matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0, damage: 0, bestRank: 99, longestKill: 0, history: [] };
          Util.saveStorage(CONFIG.storageKeys.stats, stats);
          AudioSys.playUiTone('alert');
        };
      }
    }, (footer) => {
      const bClose = document.createElement('button');
      bClose.className = 'tac-btn primary';
      bClose.textContent = 'Simpan & Tutup';
      bClose.onclick = () => { AudioSys.playUiTone('click'); saveSettings(); closeModal(); };
      footer.appendChild(bClose);
    }, tabs);
  }

  function showHowToPlayModal() {
    showModal('CARA BERMAIN & PANDUAN TAKTIS', (body) => {
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="field-card">
            <div class="field-label"><span>Kontrol Dasar Tempur</span></div>
            <svg viewBox="0 0 360 150" width="100%" style="background:#0B0D10;border-radius:4px;border:1px solid var(--border-hair);">
              <rect x="20" y="20" width="38" height="32" rx="4" fill="#181C20" stroke="#7A8B4A"/><text x="39" y="40" text-anchor="middle" fill="#EDEFF1" font-size="12" font-weight="bold">Q</text>
              <rect x="64" y="20" width="38" height="32" rx="4" fill="#232930" stroke="#F2B705"/><text x="83" y="40" text-anchor="middle" fill="#F2B705" font-size="12" font-weight="bold">W</text>
              <rect x="108" y="20" width="38" height="32" rx="4" fill="#181C20" stroke="#7A8B4A"/><text x="127" y="40" text-anchor="middle" fill="#EDEFF1" font-size="12" font-weight="bold">E</text>
              <rect x="152" y="20" width="38" height="32" rx="4" fill="#181C20" stroke="#9AA3AB"/><text x="171" y="40" text-anchor="middle" fill="#EDEFF1" font-size="12" font-weight="bold">R</text>
              <rect x="20" y="58" width="38" height="32" rx="4" fill="#232930" stroke="#F2B705"/><text x="39" y="78" text-anchor="middle" fill="#F2B705" font-size="12" font-weight="bold">A</text>
              <rect x="64" y="58" width="38" height="32" rx="4" fill="#232930" stroke="#F2B705"/><text x="83" y="78" text-anchor="middle" fill="#F2B705" font-size="12" font-weight="bold">S</text>
              <rect x="108" y="58" width="38" height="32" rx="4" fill="#232930" stroke="#F2B705"/><text x="127" y="78" text-anchor="middle" fill="#F2B705" font-size="12" font-weight="bold">D</text>
              <rect x="152" y="58" width="38" height="32" rx="4" fill="#181C20" stroke="#9AA3AB"/><text x="171" y="78" text-anchor="middle" fill="#EDEFF1" font-size="12" font-weight="bold">F</text>
              <rect x="20" y="96" width="170" height="30" rx="4" fill="#181C20" stroke="#9AA3AB"/><text x="105" y="116" text-anchor="middle" fill="#EDEFF1" font-size="11" font-weight="bold">SPACE — Lompat / Vault / Parasut</text>
              <text x="210" y="34" fill="#EDEFF1" font-size="11">LMB: Tembak | RMB: ADS</text>
              <text x="210" y="54" fill="#EDEFF1" font-size="11">C / Z: Jongkok / Tiarap</text>
              <text x="210" y="74" fill="#EDEFF1" font-size="11">Q / E: Intip Miring (Lean)</text>
              <text x="210" y="94" fill="#EDEFF1" font-size="11">Tab: Inventori | M: Peta</text>
              <text x="210" y="114" fill="#EDEFF1" font-size="11">1-5: Senjata | 7-0: Medis</text>
              <text x="210" y="134" fill="#F2B705" font-size="11">V: FPP/TPP | F4: Menu Cheat</text>
            </svg>
          </div>
          <div class="field-card">
            <div class="field-label"><span>Kontrol Stik / Gamepad &amp; Cheat Menu</span></div>
            <ul style="padding-left:16px;font-size:12px;color:var(--text-dim);display:flex;flex-direction:column;gap:5px;">
              <li><b style="color:#7CE7FF;">Tombol START (atau F4):</b> Buka <b>Menu Cheat</b> (Bom Chidori, Spawn Mobil/Motor ngebut, dan pengaturan amunisi/god mode).</li>
              <li><b style="color:var(--text-main);">Analog Kiri / L3:</b> Jalan / Bergerak &bull; Tekan <b>L3</b> untuk Lari Sprint atau Nitro Turbo di kendaraan.</li>
              <li><b style="color:var(--text-main);">Analog Kanan / L1 / L2:</b> Kamera 360&deg; di mode <b>FPP</b> (pegang senjata) maupun <b>TPP</b> (full karakter). <b>L1</b> ganti FPP &harr; TPP, <b>L2</b> bidik Scope / Rem kendaraan.</li>
              <li><b style="color:var(--text-main);">R2 / R1 / A / B / X / Y:</b> <b>R2</b> Tembak (peluru pemain &infin;) atau Gas kendaraan, <b>R1</b> Lempar Granat / Chidori, <b>A</b> Lompat, <b>B</b> Jongkok / Tiarap / Turun kendaraan, <b>X (&square;)</b> Reload / Naik-Turun Mobil-Motor, <b>Y (&triangle;)</b> Ganti senjata.</li>
            </ul>
          </div>
          <div class="field-card" style="grid-column:1 / -1;">
            <div class="field-label"><span>Alur Pertempuran &amp; Balistik</span></div>
            <ul style="padding-left:16px;font-size:12px;color:var(--text-dim);display:flex;flex-direction:column;gap:6px;">
              <li><b style="color:var(--text-main);">1. Terjun Bebas &amp; Parasut:</b> Lompat dari pesawat kargo pada jalur strategis. Parasut terbuka otomatis pada ketinggian 120 m AGL atau tekan Space lebih awal.</li>
              <li><b style="color:var(--text-main);">2. Kumpulkan Gear &amp; Attachment:</b> Cari senjata, amunisi, armor L1-L3, dan pasang scope/muzzle/grip di layar Tab agar akurasi dan recoil jauh lebih stabil.</li>
              <li><b style="color:var(--text-main);">3. Balistik Proyektil:</b> Semua peluru memiliki drop gravitasi (9.81 m/s²) dan drag udara. Bidik di atas target saat jarak >150 m atau atur zeroing.</li>
              <li><b style="color:var(--text-main);">4. Bertahan di Zona Aman:</b> Waspadai Zona Biru yang semakin sakit di fase akhir serta Red Zone artileri &amp; Airdrop suplai.</li>
            </ul>
          </div>
        </div>`;
    }, (footer) => {
      const b = document.createElement('button');
      b.className = 'tac-btn primary';
      b.textContent = 'Mengerti';
      b.onclick = () => { AudioSys.playUiTone('click'); closeModal(); };
      footer.appendChild(b);
    });
  }

  function showStatsModal() {
    const winrate = stats.matches ? ((stats.wins / stats.matches) * 100).toFixed(1) : '0.0';
    const kd = stats.deaths ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
    showModal('STATISTIK KARIER TEMPUR', (body) => {
      body.innerHTML = `
        <div class="stats-kpi-grid tabular">
          <div class="kpi-card"><div class="kpi-label">Total Pertandingan</div><div class="kpi-val">${stats.matches}</div></div>
          <div class="kpi-card"><div class="kpi-label">Juara Pulau Rajawali</div><div class="kpi-val">${stats.wins} (${winrate}%)</div></div>
          <div class="kpi-card"><div class="kpi-label">Total Eliminasi / K/D</div><div class="kpi-val">${stats.kills} / ${kd}</div></div>
          <div class="kpi-card"><div class="kpi-label">Headshot / Jarak Terjauh</div><div class="kpi-val">${stats.headshots} / ${stats.longestKill}m</div></div>
        </div>
        <table class="tac-table tabular">
          <thead><tr><th>Waktu</th><th>Mode</th><th>Peringkat</th><th>Kill</th><th>Damage</th></tr></thead>
          <tbody>
            ${stats.history.length ? stats.history.slice(0, 10).map(h => `<tr><td>${h.date}</td><td>${h.mode}</td><td>#${h.rank}</td><td>${h.kills}</td><td>${Math.round(h.damage)}</td></tr>`).join('')
              : `<tr><td colspan="5" style="color:var(--text-dim);text-align:center;">Belum ada riwayat pertandingan yang tercatat.</td></tr>`}
          </tbody>
        </table>`;
    }, (footer) => {
      const b = document.createElement('button');
      b.className = 'tac-btn primary';
      b.textContent = 'Tutup';
      b.onclick = () => { AudioSys.playUiTone('click'); closeModal(); };
      footer.appendChild(b);
    });
  }

  function showLoading(stageText, pct) {
    document.getElementById('screen-loading').classList.remove('hidden');
    document.getElementById('loading-stage').textContent = stageText;
    document.getElementById('loading-pct').textContent = `${Math.round(pct)}%`;
    document.getElementById('loading-bar').style.width = `${Util.clamp(pct, 0, 100)}%`;
  }

  function hideLoading() {
    document.getElementById('screen-loading').classList.add('hidden');
  }

  function init(callbacks) {
    onStartMatchCallback = callbacks.onStartMatch;
    onCloseModalCallback = callbacks.onCloseModal || null;
    applySettingsToDom();

    const fsBtn = document.getElementById('btn-menu-fullscreen');
    if (fsBtn) {
      fsBtn.onclick = () => {
        AudioSys.playUiTone('click');
        Render.toggleFullscreen();
      };
    }
    if (CONFIG.isMobile) {
      const menuEl = document.getElementById('screen-menu');
      const autoFsOnce = () => {
        Render.tryEnterFullscreen(true);
        menuEl?.removeEventListener('pointerup', autoFsOnce);
      };
      menuEl?.addEventListener('pointerup', autoFsOnce, { once: true, passive: true });
    }

    document.getElementById('btn-menu-play').onclick = () => { AudioSys.playUiTone('click'); if (CONFIG.isMobile) Render.tryEnterFullscreen(true); showMatchSetupModal('br', 'island'); };
    document.getElementById('btn-menu-play-city').onclick = () => { AudioSys.playUiTone('click'); if (CONFIG.isMobile) Render.tryEnterFullscreen(true); showMatchSetupModal('br', 'city'); };
    document.getElementById('btn-menu-practice').onclick = () => { AudioSys.playUiTone('click'); if (CONFIG.isMobile) Render.tryEnterFullscreen(true); showMatchSetupModal('practice', 'island'); };
    document.getElementById('btn-menu-practice-city').onclick = () => { AudioSys.playUiTone('click'); if (CONFIG.isMobile) Render.tryEnterFullscreen(true); showMatchSetupModal('practice', 'city'); };
    document.getElementById('btn-menu-settings').onclick = () => { AudioSys.playUiTone('click'); showSettingsModal(); };
    document.getElementById('btn-menu-howto').onclick = () => { AudioSys.playUiTone('click'); showHowToPlayModal(); };
    document.getElementById('btn-menu-stats').onclick = () => { AudioSys.playUiTone('click'); showStatsModal(); };
    document.getElementById('btn-menu-studio').onclick = () => { AudioSys.playUiTone('click'); callbacks.onCameraPreset('studio'); };
    document.getElementById('btn-menu-cam-island').onclick = () => { AudioSys.playUiTone('click'); Render.applyAtmosphere('siang', Render.weather); callbacks.onCameraPreset('island'); };
    document.getElementById('btn-menu-cam-city').onclick = () => { AudioSys.playUiTone('click'); Render.applyAtmosphere('sore', Render.weather); callbacks.onCameraPreset('city'); };
    document.getElementById('btn-menu-cam-studio').onclick = () => { AudioSys.playUiTone('click'); Render.applyAtmosphere('siang', Render.weather); callbacks.onCameraPreset('studio'); };
    document.getElementById('modal-close-btn').onclick = () => { AudioSys.playUiTone('click'); closeModal(); };
  }

  function showPauseModal(onResume, onQuit) {
    document.exitPointerLock?.();
    showModal('PERTANDINGAN DIJEDA', (body) => {
      body.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;max-width:340px;margin:10px auto;">
        <button id="pause-resume" class="tac-btn primary">Lanjutkan Pertandingan</button>
        <button id="pause-settings" class="tac-btn">Pengaturan</button>
        <button id="pause-howto" class="tac-btn">Cara Bermain</button>
        <button id="pause-quit" class="tac-btn danger">Kembali ke Menu Utama</button>
      </div>`;
      document.getElementById('pause-resume').onclick = () => { AudioSys.playUiTone('click'); closeModal(); onResume(); };
      document.getElementById('pause-settings').onclick = () => { AudioSys.playUiTone('click'); showSettingsModal(); };
      document.getElementById('pause-howto').onclick = () => { AudioSys.playUiTone('click'); showHowToPlayModal(); };
      document.getElementById('pause-quit').onclick = () => { AudioSys.playUiTone('click'); closeModal(); onQuit(); };
    }, () => {});
  }

  function showArsenalModal() {
    document.exitPointerLock?.();
    const sl = Player.activeWeapon;
    const def = WEAPONS_DB[sl.id];
    showModal(`ARSENAL & KUSTOMISASI — ${def.name}`, (body) => {
      const renderAttSelect = (slotType, title) => {
        if (!def.slots[slotType]) return `<div class="field-card"><div class="field-label">${title}</div><span style="color:var(--text-dim);font-size:12px;">Tidak tersedia di senjata ini</span></div>`;
        const opts = Object.values(ATTACHMENTS_DB).filter(a => a.slot === slotType && (slotType !== 'muzzle' || (def.class === 'Shotgun' ? a.id === 'choke' || a.id === 'suppressor' : a.id !== 'choke')));
        return `<div class="field-card">
          <div class="field-label"><span>${title}</span></div>
          <select class="tac-select att-sel" data-slot="${slotType}">
            <option value="">— Kosong (Standar) —</option>
            ${opts.map(o => `<option value="${o.id}" ${sl.att[slotType] === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}
          </select>
        </div>`;
      };

      body.innerHTML = `
        <div style="margin-bottom:14px;">
          <div class="field-label" style="margin-bottom:6px;"><span>Pilih Senjata Aktif (11 Varian)</span><span class="tabular">${def.class} • ${def.ammo.toUpperCase()} • DMG ${def.damage} • RPM ${def.rpm}</span></div>
          <div class="seg-group" id="arsenal-weapons">
            ${Object.values(WEAPONS_DB).map(w => `<button class="seg-btn ${w.id === sl.id ? 'active' : ''}" data-wid="${w.id}">${w.name}</button>`).join('')}
          </div>
        </div>
        <div class="setup-grid">
          ${renderAttSelect('optic', 'Optik / Scope')}
          ${renderAttSelect('muzzle', 'Moncong / Muzzle')}
          ${renderAttSelect('grip', 'Pegangan / Laser')}
          ${renderAttSelect('mag', 'Magasen')}
          ${renderAttSelect('stock', 'Popor / Cheek Pad')}
        </div>`;

      body.querySelectorAll('#arsenal-weapons .seg-btn').forEach(b => {
        b.onclick = () => {
          Player.equipWeaponInSlot(b.dataset.wid);
          showArsenalModal();
        };
      });
      body.querySelectorAll('.att-sel').forEach(sel => {
        sel.onchange = () => {
          Player.setAttachment(sel.dataset.slot, sel.value || null);
          showArsenalModal();
        };
      });
    }, (footer) => {
      const b = document.createElement('button');
      b.className = 'tac-btn primary';
      b.textContent = 'Kembali Menembak [TAB]';
      b.onclick = () => { closeModal(); };
      footer.appendChild(b);
    });
  }

  function showInventoryModal() {
    document.exitPointerLock?.();
    const inv = Player.getInventoryData();
    const nearCrate = Loot.findNearbyCrate(Player.pos.x, Player.pos.y, Player.pos.z, 2.7);
    const nearItems = Loot.queryNearby(Player.pos.x, Player.pos.y, Player.pos.z, 2.6);

    showModal(`INVENTARIS TAKTIS — BEBAN ${inv.weight} / ${inv.bag.cap} KG`, (body) => {
      const renderGroundRow = (it, idx, isCrate) => `
        <div class="inv-item-row" data-gidx="${idx}" data-crate="${isCrate ? 1 : 0}" style="cursor:pointer;">
          <span><strong style="color:#F2B705;">+</strong> ${it.def.name}</span>
          <span class="tabular" style="font-size:11px;color:var(--text-dim);">${it.def.cat.toUpperCase()}</span>
        </div>`;

      const groundHtml = [
        ...(nearCrate ? [`<div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:4px;">PETI KEMATIAN (${nearCrate.ownerName})</div>`, ...nearCrate.items.map((it, i) => renderGroundRow(it, i, true))] : []),
        ...nearItems.map((it, i) => renderGroundRow(it, i, false))
      ].join('') || '<div style="color:var(--text-dim);font-size:12px;">Tidak ada item di sekitar tanah.</div>';

      const renderGearWeapon = (sIdx, lbl) => {
        const sl = inv.slots[sIdx];
        const wDef = WEAPONS_DB[sl.id];
        const atts = Object.entries(sl.att).filter(([k, v]) => v);
        return `<div class="field-card" style="padding:8px 10px;margin-bottom:6px;border-color:${inv.activeSlot === sIdx ? 'var(--accent)' : 'var(--border-hair)'};">
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">
            <span>${lbl}: ${wDef.name}</span>
            <span class="tabular">${wDef.ammo === 'none' ? 'MELEE' : `${sl.mag} / ${Player.unlimitedAmmo ? '∞' : (inv.ammoReserve[wDef.ammo] || 0)}`}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
            ${atts.map(([k, aId]) => `<button class="seg-btn detach-btn" data-sidx="${sIdx}" data-slot="${k}" title="Klik untuk lepas ke tas" style="padding:2px 6px;font-size:10px;">${ATTACHMENTS_DB[aId].name} ×</button>`).join('') || '<span style="font-size:11px;color:var(--text-dim);">Tanpa attachment</span>'}
          </div>
        </div>`;
      };

      const pctW = Math.min(100, Math.round((inv.weight / Math.max(1, inv.bag.cap)) * 100));
      const bagConsumables = [
        ['med', 'medkit', 'Medkit (8s -> 100HP)', inv.meds.medkit],
        ['med', 'firstaid', 'Kotak P3K (6s -> 75HP)', inv.meds.firstaid],
        ['med', 'bandage', 'Perban (4s -> +10HP)', inv.meds.bandage],
        ['med', 'drink', 'Minuman Energi (4s)', inv.meds.drink],
        ['med', 'painkiller', 'Pereda Nyeri (6s)', inv.meds.painkiller],
        ['med', 'adrenaline', 'Adrenalin (8s)', inv.meds.adrenaline]
      ].filter(r => r[3] > 0);

      const ammoRows = Object.entries(inv.ammoReserve).filter(([k, v]) => k !== 'none' && v > 0);
      const throwRows = Object.entries(inv.throwables).filter(([k, v]) => v > 0);

      body.innerHTML = `<div class="inv-3panel">
        <div class="inv-col">
          <h4>DI TANAH / PETI</h4>
          <div class="inv-list">${groundHtml}</div>
        </div>
        <div class="inv-col">
          <h4>PERLENGKAPAN &amp; SENJATA</h4>
          <div style="display:flex;gap:6px;margin-bottom:8px;font-size:11px;">
            <span class="armor-badge">Helm L${inv.helm.level} (${Math.round(inv.helm.dur)})</span>
            <span class="armor-badge">Rompi L${inv.vest.level} (${Math.round(inv.vest.dur)})</span>
            <span class="armor-badge">Tas L${inv.bag.level}</span>
          </div>
          ${renderGearWeapon(0, 'Slot 1')}
          ${renderGearWeapon(1, 'Slot 2')}
          ${renderGearWeapon(2, 'Slot 3')}
          ${Game.state === 'PRACTICE' ? '<button id="inv-open-arsenal" class="tac-btn sm primary" style="margin-top:4px;width:100%;">Buka Rak Arsenal Latihan (11 Senjata)</button>' : ''}
        </div>
        <div class="inv-col">
          <h4>TAS RANSEL (${pctW}% TERISI)</h4>
          <div style="height:6px;background:rgba(255,255,255,0.08);margin-bottom:8px;"><div style="height:100%;width:${pctW}%;background:var(--accent);"></div></div>
          <div class="inv-list">
            ${bagConsumables.map(([c, k, lbl, cnt]) => `<div class="inv-item-row bag-use" data-key="${k}" style="cursor:pointer;"><span>${lbl}</span><span class="tabular">×${cnt} <button class="seg-btn drop-btn" data-cat="med" data-key="${k}" style="padding:1px 5px;font-size:10px;margin-left:4px;">Buang</button></span></div>`).join('')}
            ${throwRows.map(([k, cnt]) => `<div class="inv-item-row bag-throw" data-key="${k}" style="cursor:pointer;"><span>Granat: ${k.toUpperCase()}</span><span class="tabular">×${cnt} <button class="seg-btn drop-btn" data-cat="throw" data-key="${k}" style="padding:1px 5px;font-size:10px;margin-left:4px;">Buang</button></span></div>`).join('')}
            ${ammoRows.map(([k, cnt]) => `<div class="inv-item-row"><span>Peluru ${k.toUpperCase()}</span><span class="tabular">${Player.unlimitedAmmo ? '∞' : `×${cnt}`} <button class="seg-btn drop-btn" data-cat="ammo" data-key="${k}" style="padding:1px 5px;font-size:10px;margin-left:4px;">Buang 30</button></span></div>`).join('')}
            ${inv.looseAtts.map((aid, idx) => `<div class="inv-item-row bag-att" data-aidx="${idx}" style="cursor:pointer;"><span>+ ${ATTACHMENTS_DB[aid]?.name || aid}</span><span style="font-size:10px;color:var(--accent);">Pasang</span></div>`).join('')}
          </div>
        </div>
      </div>`;

      body.querySelectorAll('.inv-item-row[data-gidx]').forEach(el => {
        el.onclick = () => {
          const i = Number(el.dataset.gidx);
          const fromC = el.dataset.crate === '1' ? nearCrate : null;
          const item = fromC ? fromC.items[i] : nearItems[i];
          if (item && Player.pickupItem(item, fromC)) showInventoryModal();
        };
      });
      body.querySelectorAll('.detach-btn').forEach(b => {
        b.onclick = () => { if (Player.detachAttachment(Number(b.dataset.sidx), b.dataset.slot)) showInventoryModal(); };
      });
      body.querySelectorAll('.bag-att').forEach(el => {
        el.onclick = () => { if (Player.equipLooseAttachment(Number(el.dataset.aidx))) showInventoryModal(); };
      });
      body.querySelectorAll('.bag-throw').forEach(el => {
        el.onclick = (ev) => {
          if (ev.target.classList.contains('drop-btn')) return;
          Throwables.setGrenadeType(el.dataset.key);
          closeModal();
        };
      });
      body.querySelectorAll('.bag-use').forEach(el => {
        el.onclick = (ev) => {
          if (ev.target.classList.contains('drop-btn')) return;
          if (Player.useConsumable(el.dataset.key)) closeModal();
        };
      });
      body.querySelectorAll('.drop-btn').forEach(b => {
        b.onclick = (ev) => {
          ev.stopPropagation();
          Player.dropItem(b.dataset.cat, b.dataset.key, b.dataset.cat === 'ammo' ? 30 : 1);
          showInventoryModal();
        };
      });
      document.getElementById('inv-open-arsenal')?.addEventListener('click', () => showArsenalModal());
    }, (footer) => {
      const b = document.createElement('button');
      b.className = 'tac-btn primary';
      b.textContent = 'Tutup Tas [TAB]';
      b.onclick = () => { closeModal(); };
      footer.appendChild(b);
    });
  }

  function recordMatchStats(summary) {
    stats.matches = (stats.matches || 0) + 1;
    if (summary.win) stats.wins = (stats.wins || 0) + 1;
    stats.kills = (stats.kills || 0) + (summary.kills || 0);
    if (!summary.win) stats.deaths = (stats.deaths || 0) + 1;
    stats.headshots = (stats.headshots || 0) + (summary.headshots || 0);
    stats.damage = (stats.damage || 0) + Math.round(summary.damage || 0);
    stats.bestRank = Math.min(stats.bestRank || 99, summary.rank || 99);
    stats.longestKill = Math.max(stats.longestKill || 0, Math.round(summary.longestKill || 0));
    if (!Array.isArray(stats.history)) stats.history = [];
    stats.history.unshift({
      date: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      mode: summary.mode || 'Solo BR',
      rank: summary.rank || 1,
      kills: summary.kills || 0,
      damage: Math.round(summary.damage || 0)
    });
    if (stats.history.length > 25) stats.history.length = 25;
    Util.saveStorage(CONFIG.storageKeys.stats, stats);
  }

  function showMatchResultModal(summary, onReturnMenu, onReplay) {
    document.exitPointerLock?.();
    const isWin = !!summary.win;
    const mins = Math.floor((summary.timeSec || 0) / 60);
    const secs = Math.floor((summary.timeSec || 0) % 60);
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const title = isWin ? 'JUARA PULAU RAJAWALI — MAHKOTA TERAKHIR' : 'RINGKASAN PERTANDINGAN';
    showModal(title, (body) => {
      body.innerHTML = `
        <div style="text-align:center;padding:10px 6px 16px;">
          <div style="font-size:36px;font-weight:900;letter-spacing:2px;color:${isWin ? '#F2B705' : '#EDEFF1'};">
            #${summary.rank} <span style="font-size:18px;color:var(--text-dim);">/ ${summary.total} PESERTA</span>
          </div>
          <div style="margin-top:4px;font-size:13px;color:${isWin ? '#F2B705' : '#9AA3AB'};font-weight:700;">
            ${isWin ? 'OPERASI SELESAI — SELAMAT! ANDA BERTAHAN HINGGA AKHIR.' : (summary.cause || 'Tereliminasi di medan tempur')}
          </div>
        </div>
        <div class="stats-kpi-grid tabular">
          <div class="kpi-card"><div class="kpi-label">Eliminasi</div><div class="kpi-val">${summary.kills}</div></div>
          <div class="kpi-card"><div class="kpi-label">Total Damage</div><div class="kpi-val">${Math.round(summary.damage)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Waktu Bertahan</div><div class="kpi-val">${timeStr}</div></div>
          <div class="kpi-card"><div class="kpi-label">Peringkat Terbaik</div><div class="kpi-val">#${stats.bestRank}</div></div>
        </div>`;
    }, (footer) => {
      const bMenu = document.createElement('button');
      bMenu.className = 'tac-btn';
      bMenu.textContent = 'Menu Utama';
      bMenu.onclick = () => { AudioSys.playUiTone('click'); closeModal(); onReturnMenu?.(); };
      const bPlay = document.createElement('button');
      bPlay.className = 'tac-btn primary';
      bPlay.textContent = 'Main Lagi';
      bPlay.onclick = () => { AudioSys.playUiTone('alert'); closeModal(); onReplay?.(); };
      footer.append(bMenu, bPlay);
    });
  }

  return {
    init, showLoading, hideLoading, showModal, closeModal, showAlertBanner, isTouchUiEnabled,
    showMatchSetupModal, showSettingsModal, showHowToPlayModal, showStatsModal,
    showPauseModal, showArsenalModal, showInventoryModal,
    recordMatchStats, showMatchResultModal,
    get settings() { return settings; },
    get hasModalOpen() { return activeModal !== null; }
  };
})();

