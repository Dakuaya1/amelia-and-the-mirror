# Amelia and the Mirror: the book, page by page

One scroll experience. It opens on Forefore Manor at night, in the rain, and
walks up the drive to the lit study window in the east wing. Through the window,
the book lies on a desk in the study. Scroll opens the
cover and turns the pages. At each showcased chapter the camera dives into the picture
on the left-hand page, and the chapter's world opens out of the page like a
portal: a built 3D place, like the manor, that the camera moves through, holding
at each of the chapter's moments while the book's own passage for it is on screen. Then the portal closes back into the
page and the page turns to the next chapter. After the last page, the camera
leaves the study and the story ends where it began: the manor, at dawn.

## Build it for hosting

```bash
npm install        # once: installs esbuild
npm run build      # writes the hostable site to ../../dist/amelia-one
```

The build bundles and minifies the code (three.js included, so no import map), minifies
`scrollcraft.js` and `scrollcraft.css`, and copies only the Poly Haven assets the code refers to
(found by scanning `js/`), the book's covers and chapter panels, and the two reels in `assets/reel/` (the out-now explainer, made in `explainer-reel/`, and the 3D book, both driven by `js/edition.js`). Once you know the site's address, build with `SITE_URL=https://your-domain npm run build`: link previews
(WhatsApp, Instagram, X, Facebook) need the share image's full address, and it adds the canonical link. Upload the whole
`dist/amelia-one` folder to any static host (Netlify, Cloudflare Pages, GitHub Pages, Vercel, an
S3 bucket); it needs nothing but HTTPS and ordinary file serving. Run the build again after any edit.

## Deploy from GitHub to Vercel

This folder is the whole site, ready to be its own repository (`.gitignore` leaves out
`node_modules/` and the build). Push it to GitHub, then on vercel.com choose **Add New → Project**,
import the repository and press **Deploy**: `vercel.json` already tells Vercel what to do
(install esbuild, run `node tools/build.mjs dist`, serve `dist/`, cache the images for a week).
Every push to the main branch then redeploys the site, and every other branch gets a preview
address. On Vercel the build fills in the share-card addresses itself, from the project's
production domain; with a custom domain, set `SITE_URL` in the project's environment variables.


## Working on the chapter worlds

The eight chapter worlds are the book's own paintings (`Visual Samples/artwork`), made into
moving dioramas by `js/worlds/painted.js`: each painting is a sheet of relief raised by its depth
map, shown as painted, its torn paper edge on a blurred copy of itself; the camera drifts across
for parallax, and the next painting rises through the last as the captions change. Each chapter's
file (`js/worlds/chNNp.js`) names its paintings in caption order, with optional framing (`focus`,
`show`/`showH`, `subject` for phones) and painted lights that flicker. To prepare paintings:
`node tools/illus/make.mjs tools/illus/jobs.json` (cut-outs and depth maps, Depth Anything V2
Small, fetched at run time) then `node tools/illus/core.mjs chNN` (where the paint really is),
and paste the chapter's `meta.json` into its file. The earlier built 3D worlds are kept in
`js/worlds/legacy-3d/` (see its README).


`tools/worldview.html?k=22&s=1&b=0` renders one chapter world at one camera beat without
scrolling the site (k: chapter, s: beat, 0 = the establishing camera, b: the pull-back while
the portal opens, up to 2.4). `node tools/worldshots.mjs out.jpg 22:0,22:1,10:4 1280x720`
tiles stills of several beats into one sheet. Neither is part of the build.

Shared pieces live in `js/worlds/kit.js`: lake water (`water`, planar reflection rippled and
Fresnel-mixed), light shafts (`lightShaft`), dry-stone walls, prayer flags, cairns, station
outbuildings, a mast and a dish, the Edwardian tourer (`motorcar`), the small oil-dark bird
(`jackdaw`), and `mergeGroup`, which bakes static meshes into one per material. Ground uses
`blendedGround` in `js/assets.js`; a layer marked `tri: true` is projected from three axes so
rock wraps cliffs. Every world is finished by a film grade (`GRADE` in `js/inside.js`), which a
world can tune with `grade`; indoor worlds set `backScale` so the camera never starts behind a wall.

Keeping the scroll smooth: a chapter world is built a chapter ahead, during a pause in the
scrolling where possible (`Inside.prefetch`), then its shaders compile in the background against
the composer's own buffer (`compileAhead`), its textures upload a few per frame (`Uploader`), and
it is drawn once unseen (`warmRender`). The skies are prepared just after the loading screen
(`prepareSkies`) so a world gets its light before it compiles; three worlds stay built at once.
`performance.measure` entries name any world build and any render over 30 ms (DevTools,
Performance panel). Resolution follows the frame rate (`adaptResolution` in `js/main.js`).

## Run it

Any static server works. From this folder:

```bash
node ~/.claude/plugins/cache/nateherk/nateherk-design/0.2.0/skills/scrollcraft/scripts/serve.mjs --root . --port 4510
```

The renderer lowers its own resolution if frames run slow, so motion stays smooth
on weaker machines. Add `?lite` to the URL to drop bloom, the vignette and the mirror reflection on
weaker machines.

## Files

| Path | What it is |
| --- | --- |
| `js/main.js` | Timeline, scroll mapping, desk camera, portal, captions, chapter menu |
| `js/book.js` | The 3D book: rounded boards and spine, a block of paper that moves from right to left as you read, pages that rise out of the gutter and curl as they turn, gold-foil cover, headbands, ribbon |
| `js/ao.js` | Ambient occlusion (GTAO, half resolution) for the study, the manor and the chapter worlds; glows, rain, stars and skies are kept out of it. Off with `?lite`, on touch devices and narrow screens |
| `js/worlds/flora.js` | Grass clumps, oaks, hedgerow bushes and desert scrub built in code, instanced, swaying in a shared wind |
| `js/manor.js` | Forefore Manor: the house, grounds, sky, rain, smoke; night and dawn |
| `js/room.js` | Desk, lamp, candle, bookshelf, mirror, dust |
| `js/inside.js` | Renders the chapter world inside the portal and moves its camera |
| `js/assets.js` | Loads the Poly Haven assets: `pbr()` materials, `model()` glTF props, `sky()` HDR skies, `blendedGround()` terrain |
| `assets/ph/` | The Poly Haven textures, models and HDR skies (CC0), with `manifest.json` |
| `js/worlds/kit.js` | Shared toolkit: textures, props (the green-glass Mirror, ship, jackdaw...), terrain, sky, weather |
| `js/worlds/chNN.js` | One built world per showcased chapter |
| `js/worlds/index.js` | Which passages each world tells, in order |
| `js/pages.js` | Draws every page of the book to a canvas |
| `js/scenes.js` | Each chapter's passages, keyed by illustration (generated; used for captions) |
| `js/chapters.js` | Chapter titles, subtitles, excerpts and the cast (generated) |
| `tools/extract-scenes.mjs` | Rebuilds `js/scenes.js` from an unzipped EPUB |

## Chapters

This edition showcases Chapters 1, 4, 10, 18, 22, 29, 31 and 32. Each gets its
spread, its dive and its scenes; the pages between them riffle past in one
motion. Change the list in `SHOWCASE` at the top of `js/main.js`.

## Chapter worlds

| Chapter | The world | Moments (captions) |
| --- | --- | --- |
| 1 | Forefore's east wing at night: dining room, landing, attic, clean room | The long table · The chair on the landing · The string across the attic · The mirror in the clean room |
| 4 | The attic by lantern, then through the mirror into space | The trunk marked Adam · The photograph · The hands on the glass · The sky with no horizon |
| 10 | The Kirkgate workshop, then the hill in the rain | The wheel · The back table · The first run · Up the one in eight |
| 18 | The workshop in daylight, then the lower field at dusk | The workshop · The glass · The ship |
| 22 | A Himalayan lake, from noon to night | The lake · The lamps by the lake · The shelf of the compound |
| 29 | The vault in Nevada, then the desert valley at dawn | The blast in the vault · The narha in the valley |
| 31 | Forefore at night: sitting room, hall, kitchen stairs | The armchair · The fallen door · The long-case clock · Her father in the doorway |
| 32 | The stair that keeps going, then the drawing room at morning | The dark stair · The stair that keeps going · The glass goes out · Anna on the sill |

People are shown as shapes against the light rather than as models. Each world
exports `build({ renderer })` returning its scene, its camera `beats` (an
establishing view, then one per caption, with optional `via` waypoints) and an
`update()` that can animate things from the reader's position (the trunk lid,
the vanishing bench, the descending ship, the cracking glass). Change which
passages a world tells in `js/worlds/index.js`.

## Photographed assets

Surfaces, furniture and skies come from [Poly Haven](https://polyhaven.com),
released under CC0 (public domain; no attribution required, credited here
anyway). They are 1k versions, about 89 MB in `assets/ph/`, plus 2k versions of the four surfaces seen
close up (`oak_wood_planks`, `old_wooden_floor_02`, `plastered_wall_03`, `castle_wall_slates`; colour and
ARM maps recompressed at JPEG quality 85, 22.5 MB) that only desktop-class screens load (`js/device.js`).
All of them load in the background: a model drops into place when it arrives.

| Kind | Assets | Used in |
| --- | --- | --- |
| Textures | old_wooden_floor_02, plastered_wall_03, oak_wood_planks, quatrefoil_jacquard_fabric, velour_velvet | Floors, walls, beams, furniture and fabrics in the study, Forefore and the workshops |
| | castle_wall_slates, roof_slates_02, leafy_grass, gravelly_sand | The manor's masonry, roofs, lawns and drive; Chapter 10's road and hedges |
| | brick_wall_08, concrete_floor_worn_001, chipped_concrete, rusty_metal_02 | Chapter 10's workshop, Chapter 22's compound, Chapter 29's vault, the attic trunk |
| | rock_face_03, dry_ground_rocks, snow_02 | The mountains and desert in Chapters 22 and 29 |
| Models | dining_table, dining_chair_02, Chandelier_02, book_encyclopedia_set_01, Lantern_01 | Chapter 1's dining room and attic |
| | GothicCabinet_01, old_drill_press, vintage_oil_lamp, bench_vice_01, hand_plane_no4, handsaw_wood, wooden_ladder | Chapters 4, 10 and 18 |
| | stone_01 (its textures), brass_diya_lantern, industrial_caged_sconce, namaqualand_boulder_02, dead_tree_trunk | Chapters 22 and 29 |
| | ArmChair_01, large_castle_door, vintage_grandfather_clock_01, fancy_picture_frame_01 | Chapters 31 and 32 (GreenChair_01 is downloaded but unused) |
| HDR skies | moonlit_golf, farmland_overcast, belfast_sunset_puresky, kloofendal_48d_partly_cloudy_puresky, klippad_dawn_1 | Forefore at night; Chapters 10, 18, 22 and 29; the view from Chapter 32's window |

Terrain uses the photographs for detail only: `blendedGround(..., { normalize: true })`
divides each by its average colour, so a world's own colours stay in charge and
the sand, rock and snow simply add grain. Each HDR sky is turned (`rotation`) so
its sun sits where that world's sunlight comes from.

## Tuning the pace

All timings are at the top of `js/main.js`, in timeline units. One unit is
`VH_PER_UNIT` viewport heights of scroll (0.5 by default).

- `SCENE_T`: how long each illustration holds. Lower it to move faster.
- `IN_T` / `OUT_T`: the dive into and out of the page.
- `SPREAD_T`: how long a chapter's spread sits on the desk before the dive.
- `MANOR_T` / `DAWN_T`: the walk up to the manor at the start, and the return at dawn.
- Scroll glide: `new SmoothScroll()` in `js/main.js` takes `{ lerp, wheelScale, maxStep }`
  (defaults 0.11, 0.85, 110px). `maxStep` caps how far one flick can move the page.
  Higher feels snappier, lower feels heavier. Touch scrolling stays native.
- `FLIP_T` / `RIFFLE_STEP`: a single page turn, and the extra time per page in a riffle.
- `VH_PER_UNIT`: scales the whole experience. At 0.5 the eight-chapter journey is
  about 92 viewport heights.

## Regenerating the captions

If the book's text changes, unzip the EPUB and run:

```bash
node tools/extract-scenes.mjs path/to/unzipped/OEBPS/text js/scenes.js
```

Each caption is the illustration's alt text (as the title) and the paragraphs that
follow it in the chapter, trimmed to whole sentences.
