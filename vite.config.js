/**
 * vite.config.js — the build, and the ONE thing a hosted build needs that a dev
 * server does not.
 *
 * WHY THIS FILE EXISTS AT ALL. Twenty-one sessions ran against `vite` with no
 * config, because the dev server serves from `/` and every gate opens
 * `http://127.0.0.1:PORT/`. A GitHub project page is served from
 * `https://<owner>.github.io/<repo>/`, so every asset URL in the built
 * `index.html` has to carry that prefix. Without it the page loads, requests
 * `/assets/index-*.js` from the domain root, gets the 404 page, and shows a
 * black canvas with no error anybody can act on — which is the same failure
 * shape as a module that renders nothing and says nothing.
 *
 * `base` IS DERIVED FROM THE ENVIRONMENT RATHER THAN HARD-CODED, and the
 * default is the dev server's `/`:
 *
 *   unset            '/'                 the dev server and every gate, unchanged
 *   NOCTIS_BASE set  whatever is given   a user page, a custom domain, a subpath
 *
 * The Pages workflow sets it to `/<repo>/` from `github.event.repository.name`,
 * so renaming the repository cannot leave a stale prefix behind. A literal
 * `/noctis-city/` here would be CONTRACT §9.1's config-the-code-does-not-read
 * with a URL: right until somebody renames the repo, and then silently wrong.
 *
 * NOTHING ELSE IS CONFIGURED. The worker is instantiated as
 * `new Worker(new URL('../workers/canyon-worker.js', import.meta.url), { type: 'module' })`
 * (`src/modules/canyon.js`), which is the form Vite resolves and bundles on its
 * own — a `worker` block here would be a second description of something that
 * already works.
 */
export default {
  base: process.env.NOCTIS_BASE || '/',
};
