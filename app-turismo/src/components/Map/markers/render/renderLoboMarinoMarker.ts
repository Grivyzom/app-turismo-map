import { TurismoEvent } from '../../types';
import { renderVinetaBadge } from './renderVinetaBadge';

export function renderLoboMarinoMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapStyleLayer?: string,
) {
  pinEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-lobo-marino-container';
  Object.assign(container.style, {
    position: 'relative',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: isSelected
      ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))'
      : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
    transition: 'transform 0.3s ease, filter 0.3s ease',
  });

  const isDark = mapStyleLayer === 'dark';

  if (event.markerSvg) {
    container.innerHTML = event.markerSvg;
    // Set color to blue if selected, else white/dark gray depending on theme
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
      svgEl.style.fill = isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748';
      svgEl.style.color = isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748';
    }
    pinEl.appendChild(container);
    return;
  } else if (
    event.imageUrl &&
    event.imageUrl !==
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=800'
  ) {
    const img = document.createElement('img');
    img.src = event.imageUrl;
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    });
    container.appendChild(img);
    pinEl.appendChild(container);
    return;
  }

  // Helper to sanitize fauna name (e.g. "Lobo Marino" -> "lobo_marino", "Pudú" -> "pudu")
  const getSanitizedName = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/(^_|_$)/g, '');
  };

  const name = getSanitizedName(event.title || 'lobo_marino');
  const suffix = isDark ? '_blanca' : '';
  const filename = `${name}${suffix}.svg`;
  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  const primaryUrl = `${baseUrl}/assets/svg/${filename}`;
  const fallbackUrl = `${baseUrl}/assets/svg/lobo_marino${suffix}.svg`;

  // Draw default lobo marino icon immediately as fallback
  const renderFallback = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1770 1200');
    Object.assign(svg.style, {
      width: '100%',
      height: '100%',
    });

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(0, 1200) scale(0.1, -0.1)');
    g.setAttribute('fill', isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748');

    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p1.setAttribute(
      'd',
      'M13970 11984 c-270 -36 -493 -101 -713 -207 -467 -225 -795 -555 -995 -1002 -138 -307 -206 -591 -307 -1265 -68 -455 -187 -951 -286 -1191 l-40 -96 -87 -64 c-277 -205 -506 -438 -759 -772 -64 -84 -87 -106 -176 -165 -410 -274 -847 -459 -1787 -757 -623 -197 -947 -321 -1445 -552 -653 -304 -1357 -761 -1945 -1263 -344 -293 -486 -427 -1120 -1055 -473 -469 -559 -544 -715 -620 -345 -169 -718 -247 -1560 -325 -786 -74 -1159 -175 -1506 -409 -187 -126 -278 -217 -299 -302 -27 -108 19 -165 205 -255 120 -58 497 -193 588 -209 20 -4 37 -10 37 -14 0 -3 -28 -14 -63 -24 -187 -55 -491 -195 -642 -295 -229 -152 -388 -409 -336 -544 18 -48 61 -76 169 -112 336 -111 610 -154 1029 -163 320 -7 475 3 740 47 482 80 885 222 1381 484 157 83 220 120 664 389 114 69 229 132 255 141 111 37 256 49 588 50 185 0 375 -5 450 -12 431 -42 1071 -142 1580 -247 591 -122 951 -195 1085 -219 239 -44 545 -96 598 -103 29 -3 52 -9 52 -12 0 -3 -83 -48 -184 -99 -334 -167 -479 -306 -481 -459 0 -53 4 -67 30 -105 78 -110 330 -163 835 -175 733 -17 1779 93 2446 257 505 124 741 277 938 607 34 57 42 64 89 78 94 28 550 187 652 227 232 92 613 284 814 409 51 33 96 59 100 59 3 0 35 -42 71 -92 35 -51 116 -145 180 -209 346 -347 712 -458 1615 -490 633 -22 1204 18 1575 112 230 58 338 118 385 214 33 66 30 123 -10 191 -81 138 -288 233 -797 364 -267 70 -356 98 -439 140 -137 71 -296 205 -411 348 -190 239 -331 602 -433 1122 l-26 135 71 150 c229 476 351 894 419 1435 48 373 48 734 0 1155 -31 278 -58 422 -198 1072 -63 288 -134 671 -163 874 -17 125 -22 204 -22 419 -1 290 9 396 50 520 39 118 84 175 194 247 271 177 441 334 567 525 182 275 273 541 273 795 0 251 -68 449 -201 584 -125 126 -259 171 -644 214 -268 30 -315 46 -518 180 -307 202 -590 308 -922 345 -124 14 -369 11 -495 -6z m630 -377 c58 -14 139 -37 180 -52 112 -41 310 -144 449 -235 206 -135 298 -172 468 -189 89 -9 94 -11 135 -50 27 -27 72 -54 131 -78 106 -44 142 -80 177 -180 30 -85 58 -113 115 -113 36 0 47 5 71 33 16 19 34 42 40 53 10 16 13 8 19 -49 11 -101 -2 -220 -36 -322 -42 -126 -53 -131 -43 -20 13 153 12 172 -19 202 -50 51 -147 28 -147 -35 0 -40 -65 -151 -138 -237 -127 -148 -355 -312 -540 -390 -280 -117 -537 -119 -764 -4 -71 36 -88 36 -127 3 -41 -34 -43 -88 -5 -133 35 -42 169 -105 279 -132 114 -28 309 -30 430 -5 284 61 555 211 796 443 l86 83 16 -36 c16 -32 16 -37 1 -67 -64 -126 -222 -284 -402 -401 -163 -106 -206 -145 -280 -254 -50 -72 -73 -97 -134 -137 -40 -26 -143 -99 -228 -160 -168 -121 -336 -231 -442 -289 -37 -20 -74 -46 -83 -59 -39 -55 2 -127 73 -127 65 0 290 119 535 282 65 44 120 78 122 76 1 -2 -4 -37 -11 -78 -7 -41 -17 -147 -20 -235 l-7 -159 -58 -88 c-148 -226 -281 -550 -374 -913 -42 -162 -108 -493 -175 -869 -99 -562 -174 -886 -275 -1191 -320 -970 -829 -1702 -1539 -2214 -48 -35 -89 -62 -91 -60 -2 3 3 30 10 63 24 103 78 494 71 520 -15 59 -87 78 -123 32 -21 -26 -102 -239 -239 -628 -143 -405 -182 -554 -274 -1043 -144 -768 -302 -1165 -532 -1343 -262 -201 -1060 -365 -2173 -444 -224 -16 -992 -18 -1018 -2 -15 9 2 20 110 71 70 34 243 111 383 172 467 204 643 302 838 465 216 182 400 464 495 761 69 213 97 403 122 817 22 366 54 526 174 880 65 190 67 209 19 242 -58 41 -98 4 -186 -177 -90 -181 -140 -320 -191 -527 -37 -150 -52 -227 -106 -533 -15 -82 -21 -100 -39 -107 -23 -10 -214 -32 -446 -52 -199 -18 -1228 -18 -1490 0 -107 7 -312 22 -455 32 -718 53 -1079 50 -1570 -11 -528 -66 -983 -195 -1510 -428 -204 -91 -621 -306 -776 -402 -723 -446 -1183 -669 -1599 -774 -234 -59 -449 -96 -680 -116 -172 -15 -617 -6 -757 15 -118 18 -279 50 -343 69 l-45 13 85 56 c221 146 377 204 985 368 436 118 758 241 1036 395 222 123 594 390 737 528 48 47 56 93 22 127 -37 37 -74 26 -301 -88 -250 -127 -398 -191 -617 -266 -305 -104 -517 -146 -749 -146 -227 0 -452 35 -699 110 -159 48 -228 76 -219 90 12 20 204 110 321 150 274 94 497 133 1139 195 812 79 1246 181 1609 379 199 109 284 184 891 786 499 495 664 651 919 869 554 474 1137 867 1731 1164 478 239 911 409 1570 615 652 205 1048 351 1364 503 90 44 166 77 168 75 3 -2 -5 -22 -16 -45 -109 -213 -291 -767 -291 -885 0 -52 22 -84 65 -92 52 -10 77 21 135 168 168 428 481 971 814 1415 176 234 319 380 551 562 179 140 222 185 265 276 108 226 236 726 326 1270 140 853 175 995 314 1292 230 490 688 835 1255 947 182 36 167 34 410 31 194 -3 232 -6 325 -28z',
    );
    p1.setAttribute('fill', isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748');
    g.appendChild(p1);

    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute(
      'd',
      'M14103 11266 c-230 -56 -394 -300 -355 -529 18 -104 64 -190 141 -268 77 -76 147 -113 250 -131 278 -48 541 180 541 467 0 134 -47 241 -147 336 -122 117 -277 162 -430 125z m67 -112 c-68 -31 -134 -93 -168 -159 -19 -38 -26 -70 -30 -131 -4 -73 -1 -88 23 -143 38 -84 105 -144 192 -171 81 -25 115 -25 192 -1 60 19 117 54 154 96 16 18 16 15 -2 -21 -28 -58 -120 -138 -189 -165 -42 -17 -77 -23 -134 -23 -69 1 -86 5 -152 38 -85 41 -135 92 -173 174 -96 206 12 449 230 517 23 8 58 14 77 14 34 1 34 0 -20 -25z m307 -131 c42 -51 24 -146 -32 -171 -56 -26 -120 -9 -148 38 -70 117 95 238 180 133z',
    );
    p2.setAttribute('fill', isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748');
    g.appendChild(p2);

    const p3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p3.setAttribute(
      'd',
      'M12983 10811 c-81 -59 -165 -193 -179 -287 -13 -86 32 -153 108 -161 95 -9 165 91 107 153 l-20 22 20 40 c11 23 43 65 71 94 59 62 66 103 25 143 -34 35 -81 33 -132 -4z',
    );
    p3.setAttribute('fill', isSelected ? '#3B82F6' : isDark ? '#FFFFFF' : '#2D3748');
    g.appendChild(p3);

    svg.appendChild(g);
    container.appendChild(svg);
  };

  // Immediate render fallback
  renderFallback();
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}
