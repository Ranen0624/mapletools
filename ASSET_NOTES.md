# SD 데이터 메이트 제작 기록

- 방식: 기본 제공 image_gen / imagegen 스킬. 기존 `assets/equipment-art.webp`를 캐릭터·색감 참고로 사용.
- 홈페이지 이미지: `assets/data-mate.webp`, `assets/data-mate-blink.webp`. 투명 배경 512×606 WebP, 지연 로드. 원본 일러스트 교체 없음.
- 현재 애니메이션: `mate-parts.js`의 512×606 기준 경로로 원본 픽셀을 분리하고 `mate-rig.js`에서 Canvas 2D로 합성합니다. 파츠별 회전·이동만 적용하며 WebGL·셰이더·UV 변형은 제거했습니다. 팔 위에 손·구슬, 몸 위에 머리·앞머리가 연결됩니다. 겹치는 파츠는 상위 파츠를 빼서 이중 윤곽을 방지합니다. 눈 감은 이미지는 눈 안에서만 합성합니다.
- 추가 제작: `assets/data-mate-repair.webp`, 512×606, 66,654바이트. 기본 제공 image_gen으로 원본의 팔·바깥 머리카락에 가려졌던 부분을 보완했습니다. 원본 이미지 자체를 덮어쓰지 않았습니다. 보완 그림은 원본 실루엣과 관절 마스크 안에서만 사용하므로 얼굴·의상·움직이는 파츠는 원본 픽셀입니다. 출력 PNG는 크기 조정·WebP 변환 후 저장했습니다.
- 제작 모드: 기본 제공 image_gen, CLI/API 대체 없음. 아래의 보완판 프롬프트 사용.

## 기본 프롬프트

Use case: stylized-concept. Asset type: transparent SD character mascot for the MapleTools dark violet data/statistics website. Reference image 1 is subject/style inspiration only: reinterpret its silver-lavender-haired, violet-eyed friendly young witch, indigo oversized star-decorated pointed hat, gold trim and midnight-purple robe as a polished super-deformed chibi mascot with a big expressive head and tiny full body (2.5 heads tall). One single character facing slightly right toward an adjacent web chart, smiling warmly, holding a small glowing blue-violet crystal orb in one hand and gesturing with the other. Crisp premium anime game illustration, clean readable silhouette at 180px display size, soft cel shading, lovely hair detail, lavender/cobalt/gold palette. Full body from hat tip to shoes centered with comfortable transparent margins. Isolated cutout on genuine transparent alpha. No text, letters, watermark, border, rectangular background, scenery, floor, extra figures, charts or UI. Keep all hat and body inside frame.

## 눈 감은 프레임 프롬프트

Edit target: the attached transparent chibi witch mascot. Change ONLY her two eyes from open to softly closed curved smiling eyelids, like a natural blink. Preserve exactly the same character identity, pose, framing, canvas proportions, silhouette, hat, silver hair, orb, fingers, clothes, shoes and transparency. Keep all elements at their exact positions. Do not redraw the layout. No new objects, no text, no background. This is the closed-eye animation frame of the existing mascot.

## Canvas 2D 보완판 프롬프트

Use case: precise-object-edit. Asset type: layered 2D puppet rig repair underpainting for an existing chibi witch illustration. Edit target: the supplied 512x606 transparent witch mascot. Produce ONE image with EXACTLY the same canvas aspect, framing, scale and alignment of the original witch. Preserve original face, eyes, hat, clothes, legs and character design. ONLY REMOVE the raised hand, its forearm and wide sleeve on VIEWER RIGHT (including the glowing orb), and REMOVE the large flowing outer hair BELOW shoulder level on BOTH outer sides. Reconstruct the hidden continuation of the small torso/cloak and smooth lavender back hair behind those removed parts so a Canvas animation can rotate the ORIGINAL cutout arms and long locks over this repair image without revealing holes. The central original face, huge witch hat, neck, chest brooch, dress and boots must not move or change. No detached parts, no atlas, no text. This is an UNDERPAINT repair plate, not a redesign. Keep genuine transparent background.


## Local workspace cleanup (2026-10-17)

Legacy unreferenced art and mockups were removed from the active local source. Historical filenames above describe creation provenance and may no longer exist. Current layered characters/titles, runtime animation parts, sprite-sheet inputs used by scripts, and license notices are retained. Published website and binary packages have not been changed by this local cleanup.
