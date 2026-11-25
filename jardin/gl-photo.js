// « Rendu photo haute qualité » : accumulation progressive de N passes sur le GPU.
// Chaque passe = micro-décalage sous-pixel de la caméra (anti-aliasing) + léger jitter de la direction du soleil (ombres douces).
// La moyenne se fait dans une cible demi-flottante (linéaire, HDR) ; tone mapping et sRGB sont appliqués à l'affichage final.

/** Suite de Halton (faible discrépance) pour le jitter. */
export function halton(i, base) {
  let f = 1; let r = 0; let n = i + 1;
  while (n > 0) { f /= base; r += f * (n % base); n = Math.floor(n / base); }
  return r;
}

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/**
 * @param {object} o { renderer, scene, camera, sun (DirectionalLight), width, passes, jitterDeg, msaa, onProgress(i, n), isCancelled(), watermark }
 * @returns {Promise<{blob:Blob, width:number, height:number, passes:number}|null>} null si annulé
 */
export async function renderPhoto(THREE, o) {
  const { renderer, scene, camera, sun } = o;
  const maxTex = renderer.capabilities.maxTextureSize || 4096;
  const aspect = camera.aspect || 1.6;
  let W = Math.min(Math.round(o.width || 2560), maxTex, 4096);
  let H = Math.round(W / aspect);
  if (H > maxTex) { H = maxTex; W = Math.round(H * aspect); }
  const N = Math.max(1, Math.round(o.passes || 32));
  const jitterDeg = o.jitterDeg == null ? 1.1 : o.jitterDeg;

  const half = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const type = half ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const passRT = new THREE.WebGLRenderTarget(W, H, { type, samples: o.msaa === false ? 0 : 4, depthBuffer: true, colorSpace: THREE.LinearSRGBColorSpace });
  const accRT = new THREE.WebGLRenderTarget(W, H, { type, depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace });

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const accumMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: passRT.texture }, alpha: { value: 1 } }, vertexShader: VERT, depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
    fragmentShader: 'uniform sampler2D tex; uniform float alpha; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb, alpha); }',
  });
  const displayMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: accRT.texture } }, vertexShader: VERT, depthTest: false, depthWrite: false, toneMapped: true,
    fragmentShader: `uniform sampler2D tex; varying vec2 vUv;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const quad = new THREE.Mesh(quadGeo, accumMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  const prevSize = renderer.getSize(new THREE.Vector2());
  const prevRatio = renderer.getPixelRatio();
  const prevAuto = renderer.autoClear;
  const prevView = camera.view ? { ...camera.view } : null;
  const sunPos = sun ? sun.position.clone() : null;
  const target = sun && sun.target ? sun.target.position.clone() : new THREE.Vector3();
  const sunDir = sunPos ? sunPos.clone().sub(target) : null;
  const sunDist = sunDir ? sunDir.length() : 0;
  if (sunDir) sunDir.normalize();
  const u = new THREE.Vector3(); const v = new THREE.Vector3();
  if (sunDir) { u.crossVectors(sunDir, new THREE.Vector3(0, 1, 0)); if (u.lengthSq() < 1e-6) u.set(1, 0, 0); u.normalize(); v.crossVectors(sunDir, u).normalize(); }
  const tanJ = Math.tan((jitterDeg * Math.PI) / 180);

  const cleanup = () => {
    camera.clearViewOffset();
    if (prevView && prevView.enabled) camera.setViewOffset(prevView.fullWidth, prevView.fullHeight, prevView.offsetX, prevView.offsetY, prevView.width, prevView.height);
    if (sun && sunPos) sun.position.copy(sunPos);
    renderer.setRenderTarget(null);
    renderer.autoClear = prevAuto;
    renderer.setPixelRatio(prevRatio);
    renderer.setSize(prevSize.x, prevSize.y, false);
    passRT.dispose(); accRT.dispose(); accumMat.dispose(); displayMat.dispose(); quadGeo.dispose();
  };

  try {
    renderer.autoClear = true;
    renderer.setRenderTarget(accRT); renderer.setClearColor(0x000000, 1); renderer.clear();
    const gl = renderer.getContext();
    for (let i = 0; i < N; i++) {
      if (o.isCancelled && o.isCancelled()) { cleanup(); return null; }
      camera.setViewOffset(W, H, halton(i, 2) - 0.5, halton(i, 3) - 0.5, W, H);
      if (sunDir) {
        // point aléatoire dans un disque (Halton 5, 7) autour de la direction du soleil
        const r = Math.sqrt(halton(i, 5)) * tanJ; const a = halton(i, 7) * Math.PI * 2;
        const d = sunDir.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
        sun.position.copy(target).addScaledVector(d, sunDist);
      }
      renderer.autoClear = true;
      renderer.setRenderTarget(passRT);
      renderer.render(scene, camera);
      // moyenne glissante : acc = acc·(1 − 1/(i+1)) + passe·(1/(i+1))
      accumMat.uniforms.alpha.value = 1 / (i + 1);
      quad.material = accumMat;
      renderer.autoClear = false;
      renderer.setRenderTarget(accRT);
      renderer.render(quadScene, quadCam);
      if (gl && gl.finish) gl.finish();
      if (o.onProgress) o.onProgress(i + 1, N);
      await new Promise((r) => setTimeout(r, 0));
    }
    if (o.isCancelled && o.isCancelled()) { cleanup(); return null; }

    // affichage final dans le canvas (taille de l'export), puis copie 2D + filigrane
    camera.clearViewOffset();
    renderer.setRenderTarget(null);
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.autoClear = true;
    quad.material = displayMat;
    renderer.render(quadScene, quadCam);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const c2 = out.getContext('2d');
    c2.drawImage(renderer.domElement, 0, 0, W, H);
    if (o.watermark) {
      const fs = Math.max(14, Math.round(W * 0.0125));
      c2.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      c2.textBaseline = 'bottom'; c2.textAlign = 'left';
      c2.shadowColor = 'rgba(0,0,0,.55)'; c2.shadowBlur = fs * 0.35;
      c2.fillStyle = 'rgba(255,255,255,.82)';
      c2.fillText(o.watermark, fs * 0.9, H - fs * 0.8);
    }
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    cleanup();
    return { blob, width: W, height: H, passes: N };
  } catch (e) {
    cleanup();
    throw e;
  }
}
