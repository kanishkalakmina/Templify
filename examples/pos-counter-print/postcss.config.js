/**
 * Empty on purpose.
 *
 * PostCSS walks up the directory tree looking for a config, and the repository
 * root has one that wires in Tailwind. This example is plain CSS, so without
 * this file the root's Tailwind pipeline would be applied to it — and warn about
 * a content configuration that has nothing to do with this app.
 */
export default { plugins: {} }
