// One test for a desktop-class screen: wide, with a fine pointer, and not asked for ?lite.
// It decides the ambient occlusion (ao.js), the 2k photo textures (assets.js) and how dense the
// meadow in Chapter 18 grows. Phones and tablets keep the lighter versions.
export const DESKTOP_CLASS = !new URLSearchParams(location.search).has('lite')
  && window.innerWidth > 860
  && !window.matchMedia('(pointer: coarse)').matches;
