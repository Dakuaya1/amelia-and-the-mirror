// A chapter told in its own paintings (Visual Samples/artwork, prepared by tools/illus/make.mjs).
// Each painting becomes a sheet of relief, raised by its depth map, shown exactly as painted
// (no lighting, no tone mapping) with its torn paper edge floating on the dark. The camera
// drifts across it, so the figures shift against the rooms behind them; a wide painting pans to
// show itself whole. As the captions change, the next painting comes up through the last.
// Lamps and fires flicker where they are painted, and dust hangs in the air in front.
// A new painting does not fade in: a line of the Mirror's green light scans down it, the
// paint appearing behind the line and rising off the sheet into its relief as it passes.
import * as THREE from 'three';
import * as K from './kit.js';

const loader = new THREE.TextureLoader();

/** Camera beats for a painted chapter: small drifts from side to side round z ~ 3 (the parallax). */
export function driftBeats(count) {
  return Array.from({ length: count }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const x = side * (0.22 + (i % 3) * 0.04);
    const y = ((i * 37) % 7 - 3) * 0.02;
    return { pos: new THREE.Vector3(x, y, i === 0 ? 3.3 : 2.95 + (i % 2) * 0.05), look: new THREE.Vector3(x * 0.4, y * 0.3, 0) };
  });
}

/** The stretch of the chapter each painting holds: the first from the start, the last to the end. */
export function stretches(n) {
  return Array.from({ length: n }, (_, j) => ({ from: j === 0 ? 0 : j + 0.5, to: j === n - 1 ? 99 : j + 1.5 }));
}

const SheetShader = {
  vertexShader: /* glsl */`
    uniform sampler2D uDepth;
    uniform float uRelief;
    uniform float uWipe;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      float d = texture2D(uDepth, uv).r;
      // the scan line's front, from above the top (0) to below the bottom (1)
      float front = uWipe * 1.3 - 0.15;
      float pos = 1.0 - uv.y;
      // (smoothstep's edges always low to high, and squares by multiplying: reversed edges and
      // pow() of a negative are undefined in GLSL, and on Metal they hide or blacken the sheet)
      float risen = 1.0 - smoothstep(front - 0.14, front + 0.02, pos);
      float dz = (front - pos) / 0.035;
      float lift = exp(-dz * dz) * 0.045 * (1.0 - step(0.999, uWipe));
      vec3 p = position + vec3(0.0, 0.0, (d - 0.5) * uRelief * mix(0.1, 1.0, risen) + lift);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D uMap;
    uniform float uOpacity;
    uniform float uTime;
    uniform float uWipe;
    uniform vec4 uLights[4];   // xy: where it is painted (uv), z: radius, w: strength
    uniform vec3 uLightCol[4];
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(uMap, vUv);
      vec3 col = c.rgb;
      for (int i = 0; i < 4; i++) {
        vec4 L = uLights[i];
        if (L.w <= 0.0) continue;
        float fall = exp(-dot(vUv - L.xy, vUv - L.xy) / (L.z * L.z));
        float flicker = 0.75 + 0.18 * sin(uTime * 9.1 + float(i) * 2.3) + 0.1 * sin(uTime * 23.7 + float(i)) + 0.07 * sin(uTime * 3.3);
        col *= 1.0 + uLightCol[i] * L.w * fall * flicker;
      }
      // the scan: shown above its front, a bright line on it, a green-glass wash just behind
      float n = fract(sin(dot(floor(vUv * vec2(220.0, 140.0)), vec2(12.9898, 78.233))) * 43758.5453);
      float pos = 1.0 - vUv.y + (n - 0.5) * 0.02 + sin(vUv.x * 21.0 + uTime * 2.4) * 0.006;
      float front = uWipe * 1.3 - 0.15;
      float shown = 1.0 - smoothstep(front - 0.004, front + 0.004, pos);
      float scanning = 1.0 - smoothstep(0.9, 1.0, uWipe);
      float dl = (front - pos) / 0.01;
      float line = exp(-dl * dl);
      float wash = (1.0 - smoothstep(0.0, 0.16, front - pos)) * shown;
      vec3 glass = vec3(0.45, 1.0, 0.82);
      col += glass * (line * 1.6 + wash * 0.22) * scanning;
      // fine scanlines in the wash, as if the picture were still being drawn
      col *= 1.0 - wash * scanning * 0.12 * step(0.5, fract(vUv.y * 380.0));
      gl_FragColor = vec4(col, c.a * uOpacity * max(shown, line * scanning));
      #include <colorspace_fragment>
    }`,
};

// Behind each painting, the painting again: blurred to its colours (a deep mip) and darkened,
// so the torn edges fall away into the painting's own light rather than into black.
const BackShader = {
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D uMap; uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      vec2 uv = 0.5 + (vUv - 0.5) * 0.7;
      // the painted pixels' colour nearby (the cut-away paper carries none), and where there is no
      // paint nearby at all, the painting's overall colour (its last mip)
      vec4 near = texture2D(uMap, uv, 7.0);
      vec4 all = texture2D(uMap, uv, 11.0);
      vec4 c = vec4(mix(all.rgb / max(all.a, 0.04), near.rgb / max(near.a, 0.04), smoothstep(0.05, 0.6, near.a)), 1.0);
      float edge = smoothstep(0.0, 0.1, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
      gl_FragColor = vec4(c.rgb * 0.32 * edge, uOpacity * edge);
      #include <colorspace_fragment>
    }`,
};

/**
 * paintings: [{ name, from, to, lights?: [{ at: [u, v], r, amount, color }], focus?: [u, v], show?, sweep?, reverse? }]
 *   from/to: the stretch of the chapter (in beats, s) the painting holds the screen for.
 *   focus (from the top left, 0..1) and show (the fraction of its width in view) frame a
 *   painting by hand; sweep is how far (in widths) it drifts across while it holds.
 *   subject (from the top left): where a phone's narrow slice of a wide painting centres.
 * beats: camera beats as for any world (small drifts round z ~ 3 give the parallax).
 */
export function paintedWorld({ dir, meta, paintings, beats, background = 0x0b0908, relief = 0.24, motes = 0xffd9a0 }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const sheets = paintings.map((p, i) => {
    const m = meta[p.name];
    const aspect = m.w / m.h;
    const map = loader.load(`${dir}/${p.name}.webp`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const depth = loader.load(`${dir}/${p.name}_depth.png`);
    depth.colorSpace = THREE.NoColorSpace;
    const segX = Math.round(Math.min(320, 200 * Math.max(1, aspect)));
    const segY = Math.round(Math.min(320, 200 * Math.max(1, 1 / aspect)));
    const geo = new THREE.PlaneGeometry(aspect, 1, segX, segY);
    const lights = Array.from({ length: 4 }, (_, k) => {
      const L = p.lights?.[k];
      return L ? new THREE.Vector4(L.at[0], L.at[1], L.r ?? 0.08, L.amount ?? 0.5) : new THREE.Vector4(0, 0, 0.1, 0);
    });
    const lightCol = Array.from({ length: 4 }, (_, k) => new THREE.Color(p.lights?.[k]?.color ?? 0xffb060));
    const mat = new THREE.ShaderMaterial({
      ...SheetShader,
      uniforms: {
        uMap: { value: map },
        uDepth: { value: depth },
        uRelief: { value: relief },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uWipe: { value: 1 },
        uLights: { value: lights },
        uLightCol: { value: lightCol },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1), new THREE.ShaderMaterial({
      ...BackShader,
      uniforms: { uMap: { value: map }, uOpacity: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }));
    back.renderOrder = i * 2;
    back.frustumCulled = false;
    scene.add(back);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = i * 2 + 1;
    // each sheet keeps its own depth: clear the buffer before it, so the next painting rises
    // through the last instead of being hidden by its relief. (A depth clear only clears while
    // depth writing is on, and the backdrop drawn just before turns it off: without turning it
    // back on, the last painting's relief cut holes in this one.)
    mesh.onBeforeRender = (renderer) => {
      renderer.state.buffers.depth.setMask(true);
      renderer.clearDepth();
    };
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { p, m, aspect, mesh, mat, back };
  });
  const dust = K.motes(scene, { count: 260, min: new THREE.Vector3(-2.2, -1.2, 0.1), max: new THREE.Vector3(2.2, 1.2, 2.2), color: motes, size: 0.016, opacity: 0.55 });
  dust.object.renderOrder = 20;

  const tmp = new THREE.Vector3();
  const ease = (x) => x * x * (3 - 2 * x);
  return {
    scene,
    exposure: 1,
    toneMapping: THREE.NoToneMapping, // the paintings' own colours
    noAO: true,
    bloom: 0.18,
    backScale: 0.5,
    grade: { contrast: 1.04, sat: 1.04, vignette: 0.42, grain: 0.035, lift: 0.01 },
    beats,
    update(t, dt, s, cam) {
      dust.update(t);
      // how the frame is seen: the camera's height of view at the sheet, and its shape
      const camera = this.camera;
      const D = Math.max(0.5, cam ? cam.z : 3);
      const viewH = 2 * D * Math.tan(THREE.MathUtils.degToRad((camera?.fov ?? 42) / 2));
      const viewA = camera?.aspect ?? 16 / 9;
      const viewW = viewH * viewA;
      for (const sh of sheets) {
        const { p, m, aspect, mesh, mat, back } = sh;
        // when this painting holds the screen: it scans in over the last one, its blurred backdrop
        // follows once the scan is through, and it fades only after the next has scanned in over it
        const wipe = p.from <= 0 ? 1 : THREE.MathUtils.clamp((s - (p.from - 0.32)) / 0.64, 0, 1);
        const fadeOut = p.to >= 99 ? 1 : 1 - ease(THREE.MathUtils.clamp((s - (p.to + 0.3)) / 0.24, 0, 1));
        mat.uniforms.uWipe.value = wipe;
        mat.uniforms.uOpacity.value = fadeOut;
        const o = Math.min(ease(THREE.MathUtils.clamp((wipe - 0.7) / 0.3, 0, 1)), fadeOut);
        back.material.uniforms.uOpacity.value = o;
        mat.uniforms.uTime.value = t;
        mesh.visible = wipe > 0.002 && fadeOut > 0.002;
        back.visible = o > 0.002;
        if (!mesh.visible) continue;
        // progress through its stretch (the last painting's runs to the end, so measure a beat's worth)
        const local = THREE.MathUtils.clamp((s - p.from) / Math.max(0.5, Math.min(p.to - p.from, 1.2)), 0, 1);
        const sweep = (local - 0.5) * 2 * (p.reverse ? -1 : 1);
        let k, cx, cy, panX, panY;
        if (p.focus) {
          // framed by hand: this much of its width in view (or, for a tall painting, of its
          // height: showH), centred on its subject
          k = p.showH ? (viewH * 1.04) / p.showH : (viewW * 1.06) / ((p.show ?? 0.75) * aspect);
          if (viewA < 1 && aspect >= 1) k = viewH * 0.62; // phones: a wide painting takes most of the height and pans across
          cx = ((viewA < 1 && p.subject ? p.subject[0] : p.focus[0]) - 0.5) * aspect;
          cy = 0.5 - p.focus[1];
          panX = viewA < 1 && aspect >= 1 ? Math.max(0, aspect * k - viewW) / 2 / k * sweep * 0.9 : (p.sweep ?? 0.05) * aspect * sweep;
          panY = 0;
        } else {
          // the painted area covers the view, with room for the drift; but never so close that
          // less than half of the painting shows (a tall painting on a wide screen)
          // frame on where the paint really is (its core and centre), not on torn-edge strays
          const core = m.core || m.box;
          const bw = (core[2] - core[0]) * aspect * 1.06;
          const bh = (core[3] - core[1]) * 1.06;
          const cover = Math.max((viewW * 1.14) / bw, (viewH * 1.14) / bh);
          const shape = bw / bh;
          if (viewA >= 1) {
            // a narrow painting (a vignette, a tall scene) is shown whole, by its height, with its
            // own blurred colours either side; a wide one covers the screen and pans
            k = shape < viewA * 0.8 ? (viewH * 1.02) / bh : Math.min(cover, (viewW * 2) / bw, (viewH * 2) / bh);
          } else {
            // phones: a narrow painting fits the width (or the height, if taller); a wide one takes
            // most of the height and pans across
            k = shape < 1.1 ? Math.min((viewW * 1.08) / bw, (viewH * 0.96) / bh) : Math.min(cover, Math.max((viewW * 1.6) / bw, (viewH * 0.62) / bh));
          }
          const mid = m.c ? [(m.c[0] + (core[0] + core[2]) / 2) / 2, (m.c[1] + (core[1] + core[3]) / 2) / 2] : [(core[0] + core[2]) / 2, (core[1] + core[3]) / 2];
          cx = (mid[0] - 0.5) * aspect;
          cy = 0.5 - mid[1]; // measured from the top
          panX = Math.max(0, bw * k - viewW) / 2 / k * sweep * 0.92;
          panY = -Math.max(0, bh * k - viewH) / 2 / k * sweep * 0.6;
          if (viewA < 1 && shape >= 1.1 && p.subject) {
            // a phone sees a slice of a wide painting: centre the slice on its subject, drifting a little
            cx = (p.subject[0] - 0.5) * aspect;
            panX = 0.05 * aspect * sweep;
          }
        }
        // a slow push in over the painting's stretch
        const scale = k * (1 + 0.06 * local);
        mesh.scale.set(scale, scale, scale);
        mesh.position.set(-(cx + panX) * scale, -(cy + panY) * scale, 0);
        // the backdrop fills the whole frame behind, whatever the painting's shape
        const bs = Math.max(viewW / aspect, viewH) * 3.6;
        back.scale.set(bs, bs, 1);
        back.position.set(cam ? cam.x : 0, cam ? cam.y : 0, -1.6); // centred on the view, so it always fills the frame
      }
      tmp.set(0, 0, 0);
    },
  };
}
