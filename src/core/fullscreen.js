/**
 * fullscreen.js — one triangle, reused by every post pass.
 *
 * A full-screen *triangle* rather than a quad: a quad's diagonal seam makes the
 * GPU shade the pixels along it twice, and every pass in the chain pays for it.
 */

import * as THREE from 'three';

export function createFullscreen() {
  const geometry = new THREE.BufferGeometry();
  // Clip-space triangle covering [-1,1]², with uv derived to match.
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
  );
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mesh = new THREE.Mesh(geometry, null);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);

  return {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Material} material
     * @param {THREE.WebGLRenderTarget|null} target
     * @param {{clear?: boolean, viewport?: number[]}} [opts]
     */
    render(renderer, material, target, opts = {}) {
      mesh.material = material;
      const prevAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(target || null);
      if (opts.viewport) {
        renderer.setViewport(...opts.viewport);
        renderer.setScissor(...opts.viewport);
        renderer.setScissorTest(true);
      }
      if (opts.clear) renderer.clear(true, false, false);
      renderer.render(scene, camera);
      if (opts.viewport) renderer.setScissorTest(false);
      renderer.autoClear = prevAutoClear;
    },

    dispose() {
      geometry.dispose();
    },
  };
}

/** Standard vertex shader for every full-screen pass. */
export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
