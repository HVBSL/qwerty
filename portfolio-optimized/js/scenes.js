// 3D Scenes Module
const Scenes = {
  hero: { isVisible: false },
  orbit: { isVisible: false, group: null, isDragging: false, spheres: [] },
  cube: { isVisible: false, mesh: null, isFocused: false, isSubmitting: false, startRot: 0 },

  init() {
    this.initHero();
    this.initOrbit();
    this.initCube();

    // Intersection Observer to pause rendering when offscreen
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.target.id === 'heroSphereContainer') this.hero.isVisible = entry.isIntersecting;
        if(entry.target.id === 'techOrbitContainer') this.orbit.isVisible = entry.isIntersecting;
        if(entry.target.id === 'contactCubeContainer') this.cube.isVisible = entry.isIntersecting;
      });
    }, { threshold: 0 });

    const heroC = document.getElementById('heroSphereContainer');
    const orbitC = document.getElementById('techOrbitContainer');
    const cubeC = document.getElementById('contactCubeContainer');

    if(heroC) this.observer.observe(heroC);
    if(orbitC) this.observer.observe(orbitC);
    if(cubeC) this.observer.observe(cubeC);

    // Resize Observer
    this.resizeObserver = new ResizeObserver(entries => {
      entries.forEach(entry => {
         if(entry.target.id === 'heroSphereContainer') this.resizeHero(entry.contentRect);
         if(entry.target.id === 'techOrbitContainer') this.resizeOrbit(entry.contentRect);
         if(entry.target.id === 'contactCubeContainer') this.resizeCube(entry.contentRect);
      });
    });

    if(heroC) this.resizeObserver.observe(heroC);
    if(orbitC) this.resizeObserver.observe(orbitC);
    if(cubeC) this.resizeObserver.observe(cubeC);
  },

  // HERO SPHERE
  initHero() {
    const container = document.getElementById('heroSphereContainer');
    if (!container || !window.THREE) return;

    this.hero.palettes = [
      { c1: new THREE.Color(0x7a3cff), c2: new THREE.Color(0x29e0e0), c3: new THREE.Color(0xff2fd0), base: new THREE.Color(0x1a102b) },
      { c1: new THREE.Color(0xff3a5a), c2: new THREE.Color(0xff9a44), c3: new THREE.Color(0xf2c94c), base: new THREE.Color(0x2b1016) },
      { c1: new THREE.Color(0x00c6ff), c2: new THREE.Color(0x0072ff), c3: new THREE.Color(0x00f2fe), base: new THREE.Color(0x0a1a2b) },
      { c1: new THREE.Color(0xa8ff78), c2: new THREE.Color(0x78ffd6), c3: new THREE.Color(0x00b09b), base: new THREE.Color(0x102b1a) }
    ];
    this.hero.paletteIndex = 0;

    this.hero.scene = new THREE.Scene();
    this.hero.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.hero.camera.position.set(0, 0, 5);

    this.hero.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.hero.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Will be sized by ResizeObserver
    container.appendChild(this.hero.renderer.domElement);

    // Setup fallback removal
    const fallback = document.getElementById('sphereFallback');
    if (fallback) fallback.remove();

    this.hero.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pl = new THREE.PointLight(0xffffff, 0.8, 10);
    pl.position.set(2, 2, 3);
    this.hero.scene.add(pl);

    this.hero.uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: 0.5 },
      uNoiseIntensity: { value: 0.15 },
      uColor1: { value: this.hero.palettes[0].c1.clone() },
      uColor2: { value: this.hero.palettes[0].c2.clone() },
      uColor3: { value: this.hero.palettes[0].c3.clone() },
      uBaseColor: { value: this.hero.palettes[0].base.clone() }
    };

    const vert = `
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uNoiseIntensity;

      // Classic Perlin 3D Noise
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

      float cnoise(vec3 P){
        vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0); Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
        vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0); vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy); vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
        vec4 ixy = permute(permute(ix) + iy); vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
        vec4 gx0 = ixy0 / 7.0; vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5; gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0); vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);
        vec4 gx1 = ixy1 / 7.0; vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5; gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1); vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y); vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w); vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
        float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);
        vec3 fade_xyz = fade(Pf0); vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y); float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
        return 2.2 * n_xyz;
      }

      void main() {
        vUv = uv; vPosition = position; vNormal = normal;
        float noise = cnoise(position * 2.0 + uTime * uSpeed) * uNoiseIntensity;
        vec3 newPosition = position + normal * noise;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;
    const frag = `
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uColor3; uniform vec3 uBaseColor; uniform float uTime;
      void main() {
        float noise = sin(vPosition.x * 5.0 + uTime) * 0.5 + 0.5;
        vec3 color = mix(uColor1, uColor2, noise);
        color = mix(color, uColor3, sin(vPosition.y * 5.0 + uTime) * 0.5 + 0.5);
        color = mix(uBaseColor, color, 0.7);
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(vNormal, lightDir), 0.0);
        color = color * (diff * 0.5 + 0.5);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    this.hero.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: this.hero.uniforms,
      wireframe: false
    });

    const geom = new THREE.SphereGeometry(1.5, 64, 64);
    this.hero.mesh = new THREE.Mesh(geom, this.hero.material);
    this.hero.mesh.position.y = 0.45;
    this.hero.scene.add(this.hero.mesh);

    // Reflector
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, depthWrite: false })
    );
    floorMesh.rotation.x = -Math.PI / 2.3;
    floorMesh.position.set(0, -0.85, 0.3);
    this.hero.scene.add(floorMesh);

    this.hero.refMat = this.hero.material.clone();
    this.hero.refMat.transparent = true;
    this.hero.reflectionMesh = new THREE.Mesh(geom, this.hero.refMat);
    this.hero.reflectionMesh.scale.set(1.0, 0.5, 1.0);
    this.hero.reflectionMesh.position.set(0, -1.05, 0);
    this.hero.scene.add(this.hero.reflectionMesh);

    // Interactions
    this.hero.targetPosX = 0;
    this.hero.targetPosY = 0.45;
    this.hero.targetRotX = 0;
    this.hero.targetRotY = 0;

    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      this.hero.targetPosX = nx * 0.2;
      this.hero.targetPosY = 0.45 + ny * 0.16;
      this.hero.targetRotY = nx * 0.8;
      this.hero.targetRotX = -ny * 0.6;
    }, {passive:true});

    container.addEventListener('mouseleave', () => {
      this.hero.targetPosX = 0;
      this.hero.targetPosY = 0.45;
      this.hero.targetRotX = 0;
      this.hero.targetRotY = 0;
    }, {passive:true});

    container.addEventListener('click', () => {
        this.hero.paletteIndex = (this.hero.paletteIndex + 1) % this.hero.palettes.length;
        this.hero.mesh.scale.set(1.08, 1.08, 1.08);
        setTimeout(() => this.hero.mesh.scale.set(1, 1, 1), 180);
    });
  },

  resizeHero(rect) {
      if(!this.hero.camera) return;
      this.hero.camera.aspect = rect.width / rect.height;
      this.hero.camera.updateProjectionMatrix();
      this.hero.renderer.setSize(rect.width, rect.height);
  },

  // ORBIT
  initOrbit() {
    const container = document.getElementById('techOrbitContainer');
    if (!container || !window.THREE) return;

    this.orbit.scene = new THREE.Scene();
    this.orbit.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.orbit.camera.position.set(0, 1.8, 3.8);
    this.orbit.camera.lookAt(0, 0, 0);

    this.orbit.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.orbit.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.orbit.renderer.domElement);

    this.orbit.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    this.orbit.group = new THREE.Group();
    this.orbit.scene.add(this.orbit.group);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.3, metalness: 0.8, emissive: 0x221133 })
    );
    this.orbit.group.add(core);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.52, 48),
      new THREE.MeshBasicMaterial({ color: 0x29e0e0, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    this.orbit.group.add(ring);

    const techs = ["React", "ASP.NET Core", "MSSQL", "REST APIs", "WordPress", "PHP", "CI/CD Jenkins", "Node.js"];
    const sGeom = new THREE.SphereGeometry(0.14, 16, 16);

    techs.forEach((tech, i) => {
      const angle = (i / techs.length) * Math.PI * 2;
      const sphere = new THREE.Mesh(sGeom, new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xff2fd0 : 0x29e0e0,
        roughness: 0.2, metalness: 0.5
      }));
      sphere.position.x = Math.cos(angle) * 1.51;
      sphere.position.z = Math.sin(angle) * 1.51;
      sphere.userData = { name: tech };
      this.orbit.group.add(sphere);
      this.orbit.spheres.push(sphere);
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    container.addEventListener('click', (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(mouse, this.orbit.camera);
      const hits = raycaster.intersectObjects(this.orbit.spheres);
      if (hits.length > 0) {
        if(window.handleTechSelect) window.handleTechSelect(hits[0].object.userData.name);
      }
    });

    let prevX = 0;
    container.addEventListener('mousedown', (e) => { this.orbit.isDragging = true; prevX = e.clientX; });
    window.addEventListener('mousemove', (e) => {
      if (!this.orbit.isDragging) return;
      this.orbit.group.rotation.y += (e.clientX - prevX) * 0.01;
      prevX = e.clientX;
    }, {passive:true});
    window.addEventListener('mouseup', () => this.orbit.isDragging = false);
  },

  resizeOrbit(rect) {
      if(!this.orbit.camera) return;
      this.orbit.camera.aspect = rect.width / rect.height;
      this.orbit.camera.updateProjectionMatrix();
      this.orbit.renderer.setSize(rect.width, rect.height);
  },

  // CUBE
  initCube() {
    const container = document.getElementById('contactCubeContainer');
    if (!container || !window.THREE) return;

    this.cube.scene = new THREE.Scene();
    this.cube.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.cube.camera.position.set(0, 0, 4.2);

    this.cube.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.cube.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.cube.renderer.domElement);

    this.cube.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const ptLight = new THREE.PointLight(0xff2fd0, 2, 10);
    ptLight.position.set(2, 2, 3);
    this.cube.scene.add(ptLight);

    const geom = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    this.cube.mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4 }));
    this.cube.scene.add(this.cube.mesh);

    const edges = new THREE.EdgesGeometry(geom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x7a3cff });
    this.cube.mesh.add(new THREE.LineSegments(edges, lineMat));
    this.cube.mesh.userData.lineMat = lineMat;
  },

  resizeCube(rect) {
      if(!this.cube.camera) return;
      this.cube.camera.aspect = rect.width / rect.height;
      this.cube.camera.updateProjectionMatrix();
      this.cube.renderer.setSize(rect.width, rect.height);
  },

  // GLOBALLY EXPOSED TO MATCH INLINE HTML
  onFormFieldFocus() {
    this.cube.isFocused = true;
    if (this.cube.mesh) this.cube.mesh.userData.lineMat.color.setHex(0x29e0e0);
  },

  onFormFieldBlur() {
    this.cube.isFocused = false;
    if (this.cube.mesh && !this.cube.isSubmitting) this.cube.mesh.userData.lineMat.color.setHex(0x7a3cff);
  },

  triggerCubeBounce() {
    if (!this.cube.mesh) return;
    this.cube.mesh.scale.set(1.18, 1.18, 1.18);
    this.cube.mesh.userData.lineMat.color.setHex(0xff2fd0);
    setTimeout(() => {
      if(this.cube.mesh) this.cube.mesh.scale.set(1, 1, 1);
      if (!this.cube.isFocused && this.cube.mesh) this.cube.mesh.userData.lineMat.color.setHex(0x7a3cff);
    }, 180);
  },

  triggerCubeSubmitSuccess() {
    if (!this.cube.mesh) return;
    this.cube.isSubmitting = true;
    this.cube.startRot = this.cube.mesh.rotation.y;
    this.cube.mesh.userData.lineMat.color.setHex(0x29e0e0);
  },

  update(time) {
    if(document.hidden) return; // don't render if tab is hidden

    // Hero Update
    if (this.hero.isVisible && this.hero.mesh) {
        this.hero.uniforms.uTime.value = time * this.hero.uniforms.uSpeed.value;
        this.hero.refMat.uniforms.uTime.value = this.hero.uniforms.uTime.value;

        const p = this.hero.palettes[this.hero.paletteIndex];
        this.hero.uniforms.uColor1.value.lerp(p.c1, 0.05);
        this.hero.uniforms.uColor2.value.lerp(p.c2, 0.05);
        this.hero.uniforms.uColor3.value.lerp(p.c3, 0.05);
        this.hero.uniforms.uBaseColor.value.lerp(p.base, 0.05);

        const floatOffset = Math.sin(time * 1.5) * 0.06;
        this.hero.mesh.position.x += (this.hero.targetPosX - this.hero.mesh.position.x) * 0.08;
        this.hero.mesh.position.y += ((this.hero.targetPosY + floatOffset) - this.hero.mesh.position.y) * 0.08;
        this.hero.mesh.rotation.y += (this.hero.targetRotY - this.hero.mesh.rotation.y) * 0.06 + 0.004;
        this.hero.mesh.rotation.x += (this.hero.targetRotX - this.hero.mesh.rotation.x) * 0.06;

        this.hero.reflectionMesh.position.x = this.hero.mesh.position.x;
        this.hero.reflectionMesh.position.y = -1.1 - (this.hero.mesh.position.y - 0.45) * 0.5;
        this.hero.reflectionMesh.rotation.y = -this.hero.mesh.rotation.y;

        this.hero.renderer.render(this.hero.scene, this.hero.camera);
    }

    // Orbit Update
    if (this.orbit.isVisible && this.orbit.group) {
        if (!this.orbit.isDragging) this.orbit.group.rotation.y += 0.005;
        this.orbit.renderer.render(this.orbit.scene, this.orbit.camera);
    }

    // Cube Update
    if (this.cube.isVisible && this.cube.mesh) {
        if (!this.cube.isSubmitting && !this.cube.isFocused) {
          this.cube.mesh.rotation.y += 0.006;
          this.cube.mesh.rotation.x += 0.003;
        } else if (this.cube.isFocused && !this.cube.isSubmitting) {
          this.cube.mesh.rotation.y += (0.4 - this.cube.mesh.rotation.y) * 0.1;
          this.cube.mesh.rotation.x += (0.2 - this.cube.mesh.rotation.x) * 0.1;
        } else if (this.cube.isSubmitting) {
          this.cube.mesh.rotation.y += 0.22;
          // Submitting animation logic replacement for setInterval
          if (this.cube.mesh.rotation.y - this.cube.startRot >= Math.PI * 4) {
             this.cube.isSubmitting = false;
             this.cube.mesh.rotation.set(0,0,0);
             const overlay = document.getElementById('cubeCheckOverlay');
             if(overlay) overlay.classList.remove('opacity-0');
          }
        }
        this.cube.renderer.render(this.cube.scene, this.cube.camera);
    }
  }
};

window.Scenes = Scenes;
window.onFormFieldFocus = () => Scenes.onFormFieldFocus();
window.onFormFieldBlur = () => Scenes.onFormFieldBlur();
window.triggerCubeBounce = () => Scenes.triggerCubeBounce();
window.triggerCubeSubmitSuccess = () => Scenes.triggerCubeSubmitSuccess();

// Main App Loop Setup
const MainApp = {
   lenis: null,
   init() {
       if(!window.gsap) return;

       // Lenis Setup
       if (typeof window.Lenis !== 'undefined') {
          this.lenis = new window.Lenis({
          duration: 1.2,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: 'vertical',
          gestureOrientation: 'vertical',
          smoothWheel: true,
       });
       } else if (typeof window.studioFreight !== 'undefined' && window.studioFreight.Lenis) {
          this.lenis = new window.studioFreight.Lenis({
             duration: 1.2,
             easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
             orientation: 'vertical',
             gestureOrientation: 'vertical',
             smoothWheel: true,
          });
       } else {
          console.warn("Lenis is not loaded");
          this.lenis = {
             on: () => {},
             raf: () => {},
             scrollTo: () => {},
             start: () => {},
             stop: () => {}
          };
       }

       if(window.ScrollTrigger) {
           this.lenis.on('scroll', ScrollTrigger.update);
       }

       if(window.UI) {
           this.lenis.on('scroll', (e) => window.UI.onScroll(e));
       }

       // Single Master Loop
       gsap.ticker.lagSmoothing(0);
       gsap.ticker.add((time, deltaTime) => {
           this.lenis.raf(time * 1000);

           if (window.TextEngine && window.TextEngine.isActive) {
               window.TextEngine.tick();
           }

           if(window.Scenes) {
               window.Scenes.update(time);
           }
       });
   },

   wakeTextEngine() {
       // Called by TextEngine to ensure the loop processes it if it fell asleep
       // The gsap ticker runs continuously, so we don't need to actually restart anything,
       // but we keep the method for logic parity.
   }
};

window.MainApp = MainApp;
