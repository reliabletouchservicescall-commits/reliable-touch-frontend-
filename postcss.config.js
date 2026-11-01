import brandVars from './postcss-brand-vars.js'

export default {
  plugins: [
    (await import('tailwindcss')).default,
    (await import('autoprefixer')).default,
    brandVars(),
  ],
}
