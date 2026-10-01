/*
 * scenes.js
 * -----------------------------------------------------------------------------
 * The three Three.js canvases (hero sphere, tech orbit, contact cube).
 *
 * Fix 5 - the original ran FOUR independent, endless requestAnimationFrame loops
 * (Lenis + one per scene) which rendered even when the scene was off screen and
 * even when the tab was hidden, and ScrollTrigger was not synced with Lenis.
 * Here every scene registers an update function driven by the single master loop
 * in main.js, and a scene renders only while its container is intersecting the
 * viewport AND the tab is visible.
 *
 * Geometry, shaders, palettes, lighting and interactions are unchanged.
 * Pixel ratio stays capped at 2. Resize is handled with a ResizeObserver that
 * updates renderer size and camera aspect in place - renderers and scenes are
 * never recreated.
 */
(function (global) {
  'use strict';

  var registry = [];   // { update(dt, elapsed), visible }
  var THREE = global.THREE;

  function register(scene) {
    scene.visible = true;
    registry.push(scene);
    return scene;
  }

  /** Drive every registered scene that is currently allowed to render. */
  function update(dt, elapsed) {
    // Never render a hidden tab (Fix 5).
    if (document.hidden) return;
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].visible) registry[i].update(dt, elapsed);
    }
  }

  /**
   * Watch a container for visibility (IntersectionObserver) and size changes
   * (ResizeObserver). Returns a disposer.
   */
  function observe(container, onResize, onVisible) {
    var io = null;
    var ro = null;

    if ('IntersectionObserver' in global) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (onVisible) onVisible(e.isIntersecting);
        });
      }, { threshold: 0 });
      io.observe(container);
    }

    if ('ResizeObserver' in global) {
      ro = new ResizeObserver(function () {
        if (onResize) onResize();
      });
      ro.observe(container);
    } else {
      global.addEventListener('resize', onResize, { passive: true });
    }

    return function () {
      if (io) io.disconnect();
      if (ro) ro.disconnect();
    };
  }

  function pixelRatio() {
    return Math.min(global.devicePixelRatio || 1, 2);
  }

  var api = { register: register, update: update, observe: observe, registry: registry };

  // Inline HTML handlers (`onclick="cycleSpherePalette()"`, `onfocus="onFormFieldFocus()",
  // `onblur="onFormFieldBlur()"`) and ui.js call these as bare globals, so they must
  // exist even when Three.js failed to load - otherwise every handler would throw.
  function noop() {}

  function exposeGlobalHandlers(handlers) {
    Object.keys(handlers).forEach(function (k) { global[k] = handlers[k]; });
  }

  if (!THREE) {
    // Three.js failed to load: leave the static markup exactly as authored and keep
    // every handler callable (as a no-op) so the page never throws.
    exposeGlobalHandlers({
      cycleSpherePalette: noop,
      onFormFieldFocus: noop,
      onFormFieldBlur: noop,
      triggerCubeBounce: noop,
      triggerCubeSubmitSuccess: noop,
      resetCubeSuccess: noop
    });
    global.Scenes = api;
    return;
  }

  /* ================================================================== */
  /* COMPONENT 1: HERO IRIDESCENT MARBLE SPHERE                         */
  /* ================================================================== */

  var currentPaletteIndex = 0;
  var spherePalettes = [
    { c1: new THREE.Color(0xff2fd0), c2: new THREE.Color(0x7a3cff), c3: new THREE.Color(0x29e0e0), base: new THREE.Color(0x0a0c16) },
    { c1: new THREE.Color(0x7a3cff), c2: new THREE.Color(0x0051ff), c3: new THREE.Color(0x00f0ff), base: new THREE.Color(0x050814) },
    { c1: new THREE.Color(0xff3366), c2: new THREE.Color(0xff8800), c3: new THREE.Color(0xfbbf24), base: new THREE.Color(0x1a0a05) }
  ];

  var hero = { renderer: null, material: null, refMat: null, mesh: null, reflection: null };

  function initHeroSphere() {
    var container = document.getElementById('heroSphereContainer');
    if (!container) return;

    var width = container.clientWidth || 360;
    var height = container.clientHeight || 360;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 4.8);

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio());
    container.appendChild(renderer.domElement);

    var shaderDef = {
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0.6 },
        uColor1: { value: spherePalettes[0].c1 },
        uColor2: { value: spherePalettes[0].c2 },
        uColor3: { value: spherePalettes[0].c3 },
        uBaseColor: { value: spherePalettes[0].base }
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec3 vPosition;',
        'varying vec3 vViewDir;',
        'void main() {',
        '  vNormal = normalize(normalMatrix * normal);',
        '  vPosition = position;',
        '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
        '  vViewDir = -normalize(mvPosition.xyz);',
        '  gl_Position = projectionMatrix * mvPosition;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform vec3 uColor1;',
        'uniform vec3 uColor2;',
        'uniform vec3 uColor3;',
        'uniform vec3 uBaseColor;',
        'varying vec3 vNormal;',
        'varying vec3 vPosition;',
        'varying vec3 vViewDir;',
        'float hash(vec3 p) {',
        '  p = fract(p * 0.3183099 + .1);',
        '  p *= 17.0;',
        '  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));',
        '}',
        'float noise(vec3 x) {',
        '  vec3 i = floor(x);',
        '  vec3 f = fract(x);',
        '  f = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),',
        '                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),',
        '             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),',
        '                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);',
        '}',
        'float fbm(vec3 p) {',
        '  float v = 0.0; float a = 0.5; vec3 shift = vec3(100.0);',
        '  for (int i = 0; i < 4; ++i) {',
        '    v += a * noise(p);',
        '    p = p * 2.0 + shift;',
        '    a *= 0.5;',
        '  }',
        '  return v;',
        '}',
        'void main() {',
        '  vec3 p = vPosition * 2.4 + vec3(0.0, uTime * 0.25, uTime * 0.18);',
        '  float n1 = fbm(p);',
        '  float n2 = fbm(p + vec3(n1 * 2.2));',
        '  float swirl = fbm(p + vec3(n2 * 2.0));',
        '  vec3 col = mix(uBaseColor, uColor2, smoothstep(0.15, 0.65, swirl));',
        '  col = mix(col, uColor1, smoothstep(0.45, 0.85, n1));',
        '  col = mix(col, uColor3, smoothstep(0.65, 0.98, n2));',
        '  float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.5);',
        '  col += mix(vec3(1.0), uColor3, 0.5) * fresnel * 1.35;',
        '  vec3 lightDir = normalize(vec3(0.8, 1.2, 1.0));',
        '  float spec = pow(max(dot(reflect(-lightDir, vNormal), vViewDir), 0.0), 32.0);',
        '  col += vec3(spec * 0.9);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    };

    var material = new THREE.ShaderMaterial({
      uniforms: shaderDef.uniforms,
      vertexShader: shaderDef.vertexShader,
      fragmentShader: shaderDef.fragmentShader
    });

    var sphereGeom = new THREE.SphereGeometry(1.05, 48, 48);
    var mesh = new THREE.Mesh(sphereGeom, material);
    mesh.position.set(0, 0.45, 0);
    scene.add(mesh);

    // Reflective floor plane
    var floorGeom = new THREE.PlaneGeometry(3.6, 2.4);
    var floor = new THREE.Mesh(floorGeom, new THREE.ShaderMaterial({
      uniforms: {
        uColor1: { value: spherePalettes[0].c1 },
        uColor3: { value: spherePalettes[0].c3 }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor1; uniform vec3 uColor3; varying vec2 vUv;',
        'void main() {',
        '  float d = length(vec2(vUv.x - 0.5, (vUv.y - 0.6) * 1.5));',
        '  float fade = smoothstep(0.55, 0.0, d);',
        '  vec3 tint = mix(uColor3, uColor1, vUv.x);',
        '  gl_FragColor = vec4(tint, fade * 0.38);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false
    }));
    floor.rotation.x = -Math.PI / 2.3;
    floor.position.set(0, -0.85, 0.3);
    scene.add(floor);

    // Floor reflection mesh
    var refMat = material.clone();
    refMat.transparent = true;
    var reflection = new THREE.Mesh(sphereGeom, refMat);
    reflection.scale.set(1.0, 0.5, 1.0);
    reflection.position.set(0, -1.05, 0);
    scene.add(reflection);

    // Interactions (behaviour unchanged)
    var targetPosX = 0, targetPosY = 0.45, targetRotX = 0, targetRotY = 0;

    container.addEventListener('pointermove', function (e) {
      var rect = container.getBoundingClientRect();
      var nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      var ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetPosX = nx * 0.2; targetPosY = 0.45 + ny * 0.16;
      targetRotY = nx * 0.8; targetRotX = -ny * 0.6;
    }, { passive: true });

    container.addEventListener('pointerleave', function () {
      targetPosX = 0; targetPosY = 0.45; targetRotX = 0; targetRotY = 0;
    });

    container.addEventListener('click', function () {
      if (typeof global.cycleSpherePalette === 'function') global.cycleSpherePalette();
    });

    hero.renderer = renderer;
    hero.material = material;
    hero.refMat = refMat;
    hero.mesh = mesh;
    hero.reflection = reflection;

    var heroScene = register({
      update: function (dt, elapsed) {
        material.uniforms.uTime.value = elapsed * material.uniforms.uSpeed.value;
        refMat.uniforms.uTime.value = material.uniforms.uTime.value;

        var floatOffset = Math.sin(elapsed * 1.5) * 0.06;
        mesh.position.x += (targetPosX - mesh.position.x) * 0.08;
        mesh.position.y += ((targetPosY + floatOffset) - mesh.position.y) * 0.08;
        mesh.rotation.y += (targetRotY - mesh.rotation.y) * 0.06 + 0.004;
        mesh.rotation.x += (targetRotX - mesh.rotation.x) * 0.06;

        reflection.position.x = mesh.position.x;
        reflection.position.y = -1.1 - (mesh.position.y - 0.45) * 0.5;
        reflection.rotation.y = -mesh.rotation.y;

        renderer.render(scene, camera);
      }
    });

    // Resize in place: no renderer or scene is recreated (Fix 5).
    observe(container, function () {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      renderer.setPixelRatio(pixelRatio());
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }, function (visible) {
      heroScene.visible = visible;
    });
  }

  function cycleSpherePalette() {
    currentPaletteIndex = (currentPaletteIndex + 1) % spherePalettes.length;
    var p = spherePalettes[currentPaletteIndex];
    if (hero.material) {
      hero.material.uniforms.uColor1.value = p.c1;
      hero.material.uniforms.uColor2.value = p.c2;
      hero.material.uniforms.uColor3.value = p.c3;
      hero.material.uniforms.uBaseColor.value = p.base;
      hero.mesh.scale.set(1.08, 1.08, 1.08);
      setTimeout(function () {
        if (hero.mesh) hero.mesh.scale.set(1, 1, 1);
      }, 180);
    }
    var hint = document.getElementById('sphereHintText');
    if (hint) hint.classList.add('opacity-0');
  }
/* ================================================================== */
  /* COMPONENT 2: TECH ORBIT                                           */
  /* ================================================================== */

  var orbit = { group: null };

  function initTechOrbit() {
    var container = document.getElementById('techOrbitContainer');
    if (!container) return;

    var width = container.clientWidth || 280;
    var height = container.clientHeight || 200;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 3.8);
    camera.lookAt(0, 0, 0);

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio());
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));

    var group = new THREE.Group();
    scene.add(group);

    // Central node
    var core = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.3, metalness: 0.8, emissive: 0x221133 })
    );
    group.add(core);

    // Orbit ring
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.52, 48),
      new THREE.MeshBasicMaterial({ color: 0x29e0e0, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    var techs = ["React", "ASP.NET Core", "MSSQL", "REST APIs", "WordPress", "PHP", "CI/CD Jenkins", "Node.js"];
    var sGeom = new THREE.SphereGeometry(0.14, 16, 16);
    var orbitSpheres = [];

    techs.forEach(function (tech, i) {
      var angle = (i / techs.length) * Math.PI * 2;
      var sphere = new THREE.Mesh(sGeom, new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xff2fd0 : 0x29e0e0,
        roughness: 0.2, metalness: 0.5
      }));
      sphere.position.x = Math.cos(angle) * 1.51;
      sphere.position.z = Math.sin(angle) * 1.51;
      sphere.userData = { name: tech };
      group.add(sphere);
      orbitSpheres.push(sphere);
    });

    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    container.addEventListener('click', function (e) {
      var rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(mouse, camera);
      var hits = raycaster.intersectObjects(orbitSpheres);
      if (hits.length > 0) {
        var name = hits[0].object.userData.name;
        if (typeof global.handleTechSelect === 'function') global.handleTechSelect(name);
        var tag = document.getElementById('orbitActiveTag');
        if (tag) tag.innerText = 'Active: ' + name;
      }
    });

    var isDragging = false, prevX = 0;
    container.addEventListener('pointerdown', function (e) {
      isDragging = true; prevX = e.clientX;
    });
    global.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      group.rotation.y += (e.clientX - prevX) * 0.01;
      prevX = e.clientX;
    }, { passive: true });
    global.addEventListener('pointerup', function () { isDragging = false; });
    global.addEventListener('pointercancel', function () { isDragging = false; });

    orbit.group = group;

    var orbitScene = register({
      update: function () {
        if (!isDragging) group.rotation.y += 0.005;
        renderer.render(scene, camera);
      }
    });

    observe(container, function () {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      renderer.setPixelRatio(pixelRatio());
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }, function (visible) {
      orbitScene.visible = visible;
    });
  }

/* ================================================================== */
  /* COMPONENT 3: REACTIVE CONTACT CUBE                                */
  /* ================================================================== */

  var cube = { mesh: null, focused: false, spinning: false, spin: null };

  function initContactCube() {
    var container = document.getElementById('contactCubeContainer');
    if (!container) return;

    var width = container.clientWidth || 200;
    var height = container.clientHeight || 180;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio());
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    var ptLight = new THREE.PointLight(0xff2fd0, 2, 10);
    ptLight.position.set(2, 2, 3);
    scene.add(ptLight);

    var geom = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    var mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4 }));
    scene.add(mesh);

    var edges = new THREE.EdgesGeometry(geom);
    var lineMat = new THREE.LineBasicMaterial({ color: 0x7a3cff });
    mesh.add(new THREE.LineSegments(edges, lineMat));
    mesh.userData.lineMat = lineMat;

    cube.mesh = mesh;

    var cubeScene = register({
      update: function (dt) {
        // The submit spin used to be driven by a setInterval(20ms); it now runs
        // inside the master loop with the same 0.22 rad step and 4*PI target.
        if (cube.spin) {
          cube.spin.acc += dt;
          while (cube.spin.acc >= 20) {
            cube.spin.acc -= 20;
            mesh.rotation.y += 0.22;
            if (mesh.rotation.y - cube.spin.start >= Math.PI * 4) {
              cube.spinning = false;
              cube.spin = null;
              mesh.rotation.set(0, 0, 0);
              var overlay = document.getElementById('cubeCheckOverlay');
              if (overlay) overlay.classList.remove('opacity-0');
              break;
            }
          }
        } else if (!cube.spinning && !cube.focused) {
          mesh.rotation.y += 0.006;
          mesh.rotation.x += 0.003;
        } else if (cube.focused && !cube.spinning) {
          mesh.rotation.y += (0.4 - mesh.rotation.y) * 0.1;
          mesh.rotation.x += (0.2 - mesh.rotation.x) * 0.1;
        }
        renderer.render(scene, camera);
      }
    });

    observe(container, function () {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      renderer.setPixelRatio(pixelRatio());
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }, function (visible) {
      cubeScene.visible = visible;
    });
  }

  function onFormFieldFocus() {
    cube.focused = true;
    if (cube.mesh && cube.mesh.userData.lineMat) cube.mesh.userData.lineMat.color.setHex(0x29e0e0);
  }

  function onFormFieldBlur() {
    cube.focused = false;
    if (cube.mesh && cube.mesh.userData.lineMat && !cube.spinning) {
      cube.mesh.userData.lineMat.color.setHex(0x7a3cff);
    }
  }

  function triggerCubeBounce() {
    if (!cube.mesh) return;
    cube.mesh.scale.set(1.18, 1.18, 1.18);
    cube.mesh.userData.lineMat.color.setHex(0xff2fd0);
    setTimeout(function () {
      if (!cube.mesh) return;
      cube.mesh.scale.set(1, 1, 1);
      if (!cube.focused) cube.mesh.userData.lineMat.color.setHex(0x7a3cff);
    }, 180);
  }

  function triggerCubeSubmitSuccess() {
    if (!cube.mesh) return;
    cube.spinning = true;
    cube.mesh.userData.lineMat.color.setHex(0x29e0e0);
    cube.spin = { start: cube.mesh.rotation.y, acc: 0 };
  }

  function resetCubeSuccess() {
    var overlay = document.getElementById('cubeCheckOverlay');
    if (overlay) overlay.classList.add('opacity-0');
  }

  /* ================================================================== */
  /* Boot                                                               */
  /* ================================================================== */

  function init() {
    initHeroSphere();
    initTechOrbit();
    initContactCube();
  }

  api.init = init;
  api.cycleSpherePalette = cycleSpherePalette;
  api.onFormFieldFocus = onFormFieldFocus;
  api.onFormFieldBlur = onFormFieldBlur;
  api.triggerCubeBounce = triggerCubeBounce;
  api.triggerCubeSubmitSuccess = triggerCubeSubmitSuccess;
  api.resetCubeSuccess = resetCubeSuccess;

  // The markup wires these up as inline attributes, and ui.js calls them directly.
  exposeGlobalHandlers({
    cycleSpherePalette: cycleSpherePalette,
    onFormFieldFocus: onFormFieldFocus,
    onFormFieldBlur: onFormFieldBlur,
    triggerCubeBounce: triggerCubeBounce,
    triggerCubeSubmitSuccess: triggerCubeSubmitSuccess,
    resetCubeSuccess: resetCubeSuccess
  });

  global.Scenes = api;

})(window);
