# MapleTools illustration / title layers

The original baked-title artwork remains in `../equipment-art.webp` and `../union-art.webp`. These new PNGs are separate editable layers, generated with the built-in imagegen tool. No CLI image generation was used.

| Tool | Text-free illustration | Transparent title | Palette |
| --- | --- | --- | --- |
| Equipment | equipment-art.png | equipment-title.png | Blue / silver |
| Union Champion | union-art.png | union-title.png | Mint / jade / ivory |
| Coordi | coordi-art.png | coordi-title.png | Lavender / violet |

The website composes the layers in HTML using `art-title.css`. A stable outer card handles pointer interaction; its inner illustration layer lifts independently from the title. Reduced-motion mode disables displacement. The six source assets can also be used for static compositions without baking text into the illustration master.

## Final prompt set and editing sequence

- Equipment illustration: preserve the lilac-haired witch, globe, navy pointed hat and white companion; render a clean MapleStory-like 2D promotional illustration, rounded expressive face, broad readable shapes, smooth cel shading, simplified moonlit blue castle garden, fewer small stars and ornaments, no lettering.
- Union illustration: preserve the friendly winking open-hand pose and white companion; create a distinct mint/jade commander. Final localized simplification: smooth high ponytail with 3–4 broad locks, no braids/flyaways; clean ivory fitted uniform with jade panels, short cape above waist, one gold maple clasp, plain belt; remove chains, tassels, repeated ornaments and embroidery. Keep mint castle garden, no lettering.
- Coordi illustration: retain smiling pink-lavender stylist, ribbon, purple/ivory dress and gold mirror; clean soft MapleStory-like 2D rendering, amethyst castle garden, reduced glitter and texture. Final localized addition: small happy round white monster with lavender bow on the shoulder opposite the mirror, without covering her face or mirror. No lettering.
- Title family: exact English names (Equipment / Finder; Union / Champion / Finder; Coordi / Finder) and Korean subtitles (메이플 장비 검색기; 유니온챔피언 검색기; 메이플 코디 검색기). Pale silver icy-periwinkle serif letters, narrow blue-violet glow, subtle navy edge. Small faceted maple leaf above, delicate sparkling ellipse behind title, maple-leaf separator below, fine divider and small stars around subtitle. Transparent outside lettering/ornament; no characters or scenery. Match the existing equipment title reference while keeping each title independent.

Reference audit: the archived 2.0.1 `equipment_original.png` and `union_original.png` already contained lettering. No text-free counterpart was found among the inspected project resources and archived packages; these files are redraws, not recovered originals.

Final consistency pass: all three portraits were re-rendered against the blue witch and purple stylist together. Match tapered linework, softly modeled hair with selective secondary strands, detailed eyes, layered fabric folds, moonlight and rim light; preserve each identity and blue/mint/purple palette. Mint retains a simple silhouette but gains the same smooth shading depth and tailored material finish, without hanging chains or excessive ornaments. All three retain white companions.

## 2026-10-17 title palette revision
Built-in imagegen edit mode, transparent output. Replaced `union-title.png` and `coordi-title.png`; Equipment remains unchanged. Both retain original dimensions, lettering, maple crystals, ellipse and Korean subtitles.
- Union prompt: precise color-only edit; ivory pearl letters with pale mint lower gradient, thin deep jade outline, restrained champagne-gold bevel and orbital highlights, mint maple crystals. Preserve all typography and layout; genuine alpha, no scenery or opaque backdrop.
- Coordi prompt: precise color-only edit; pearl white letters with rose-lavender lower gradient, thin plum-violet outline, restrained rose-gold accents and pale amethyst maple crystals. Preserve all typography and layout; genuine alpha, no scenery or opaque backdrop.
The hero Union artwork uses a 1.12 presentation scale anchored at 58% / 55% to balance apparent face size; the source portrait and independent title layer are unchanged by this CSS adjustment.
