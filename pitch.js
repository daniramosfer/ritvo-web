// The background: a football pitch and a basketball court take turns. The dots
// of each line flow into the matching line of the other (box into three-point
// line, goal area into key, penalty arc into free-throw circle). The canvas
// paints the whole scene over the still WebP, which stays for pages without
// JavaScript, and only draws while the first screen is in view.
(() => {
  const canvas = document.getElementById("pitch");
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  const toggle = document.querySelector(".motion-toggle");
  const english = document.documentElement.lang === "en";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const layer = () => {
    const element = document.createElement("canvas");
    return [element, element.getContext("2d")];
  };
  const [base, baseContext] = layer(), [grain, grainContext] = layer(), [scratch, scratchContext] = layer();
  const glows = [layer(), layer()];
  const HOLD = 5.5, CHANGE = 2.4, CYCLE = 2 * (HOLD + CHANGE), TAU = Math.PI * 2;
  let width, height, ratio, compact, dots = [], ring = [];
  let frame = 0, previous = 0, time = .75, paused = false, resizing = 0;

  const bell = (offset, spread) => Math.exp(-((offset / spread) ** 2));

  function point(x, y) {
    // Past the near goal line (the goal) there is no more depth to give.
    const depth = compact ? 1 - Math.max(0, 1 - y) ** 2.25 : y;
    return [width * (.5 + (x - .5) * (.58 + .76 * y)), height * (.08 + .89 * depth)];
  }

  function dot(context, x, y, radius) {
    context.moveTo(x + radius, y);
    context.arc(x, y, radius, 0, TAU);
  }

  function arc(cx, cy, rx, ry, from, to, steps = 40) {
    return Array.from({length: steps + 1}, (_, i) => {
      const angle = from + (to - from) * i / steps;
      return [cx + rx * Math.sin(angle), cy + ry * Math.cos(angle)];
    });
  }

  // [football, basketball] lines in the pitch's own 0–1 space, halfway at .55.
  // The court's halves are shorter below, where the perspective is nearer.
  function lines() {
    const outline = [[0,0],[1,0],[1,1],[0,1],[0,0]], halfway = [[0,.55],[1,.55]];
    const pairs = [
      [outline, outline],
      [halfway, halfway],
      [arc(.5, .55, .21, .109, -Math.PI, Math.PI, 96), arc(.5, .55, .12, .0623, -Math.PI, Math.PI, 96)],
    ];
    for (const below of [false, true]) {
      const end = (path, scale) => below ? path.map(([x, y]) => [x, 1 - y * scale]) : path;
      [
        [[[.2,0],[.2,.16],[.8,.16],[.8,0]], [[.06,0], ...arc(.5, .0619, .45, .2652, -1.36, 1.36, 48), [.94,0]]],
        [[[.36,0],[.36,.06],[.64,.06],[.64,0]], [[.337,0],[.337,.228],[.663,.228],[.663,0]]],
        [arc(.5, .107, .1346, .0887, -.927, .927), arc(.5, .228, .12, .0707, -Math.PI, Math.PI, 64)],
        [arc(.5, .107, .005, .003, -Math.PI, Math.PI, 8), arc(.5, .0619, .03, .0177, -Math.PI, Math.PI, 24)],
        [[[.446,0],[.446,-.014],[.554,-.014],[.554,0]], [[.44,.047],[.56,.047]]],
      ].forEach(([football, court]) => pairs.push([end(football, 1), end(court, .818)]));
    }
    return pairs;
  }

  function measure(path) {
    const screen = path.map(p => point(...p)), lengths = [0];
    for (let i = 1; i < path.length; i++) {
      lengths.push(lengths[i - 1] + Math.hypot(screen[i][0] - screen[i - 1][0], screen[i][1] - screen[i - 1][1]));
    }
    return lengths;
  }

  function sample(path, lengths, count) {
    const total = lengths.at(-1), out = [];
    for (let i = 0, s = 1; i < count; i++) {
      const target = total * i / Math.max(1, count - 1);
      while (s < path.length - 1 && lengths[s] < target) s++;
      const t = (target - lengths[s - 1]) / (lengths[s] - lengths[s - 1] || 1);
      out.push([path[s - 1][0] + (path[s][0] - path[s - 1][0]) * t, path[s - 1][1] + (path[s][1] - path[s - 1][1]) * t]);
    }
    return out;
  }

  function setup() {
    width = innerWidth;
    height = innerHeight;
    compact = width <= 600;
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    for (const [element, context] of [[canvas, ctx], [base, baseContext], [grain, grainContext], [scratch, scratchContext], ...glows]) {
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      context.scale(ratio, ratio);
    }
    let seed = 38;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // The still part: dark turf, lit around the resting light, and its grain.
    const light = .725;
    baseContext.fillStyle = "#050508";
    baseContext.fillRect(0, 0, width, height);
    for (let row = Math.floor(height * .08); row < height * .97; row++) {
      const depth = (row / height - .08) / .89;
      const y = compact ? 1 - (1 - depth) ** (1 / 2.25) : depth;
      const left = point(0, y)[0], right = point(1, y)[0];
      const glow = bell(row / height - light, .21);
      baseContext.fillStyle = `rgb(${13 + 22 * glow | 0},${6 + 9 * glow | 0},${21 + 30 * glow | 0})`;
      baseContext.fillRect(left, row, right - left, 1);
    }
    const specks = new Map();
    for (let i = 0; i < Math.min(30000, width * height / 36); i++) {
      const [x, y] = point(random(), random());
      const energy = random() ** 1.65 * (28 + 40 * bell(y / height - light, .19));
      const level = Math.round(energy / 4) * 4, size = .9 + random() * 1.4;
      if (!specks.has(level)) specks.set(level, []);
      specks.get(level).push([x, y, size]);
    }
    for (const [energy, list] of specks) {
      baseContext.fillStyle = `rgb(${22 + energy | 0},${12 + .47 * energy | 0},${35 + 1.4 * energy | 0})`;
      for (const [x, y, size] of list) baseContext.fillRect(x, y, size, size);
    }
    grainContext.fillStyle = "rgba(185,140,255,.48)";
    for (let i = 0; i < Math.min(9500, width * height / 95); i++) {
      const [x, y] = point(random(), random());
      const size = .6 + random() * 1.55;
      grainContext.fillRect(x, y, size, size);
    }

    // One dot per 3 px of the longer line of each pair, paired by position.
    dots = [];
    lines().forEach(([football, court], index) => {
      const a = measure(football), b = measure(court);
      const count = Math.max(2, Math.ceil(Math.max(a.at(-1), b.at(-1)) / 3));
      const from = sample(football, a, count), to = sample(court, b, count);
      for (let i = 0; i < count; i++) {
        const angle = random() * TAU, lift = random() * .025;
        dots.push({
          from: from[i], to: to[i], ring: index === 2 && i % 2 === 0,
          dx: (random() - .5) * 3.8, dy: (random() - .5) * 4.4, radius: .8 + random() * 1.2,
          lx: Math.cos(angle) * lift, ly: Math.sin(angle) * lift,
          delay: .22 * Math.abs(from[i][1] - .55) / .55 + random() * .08,
        });
      }
    });

    // The violet halo around each set of lines, blurred once.
    glows.forEach(([, context], sport) => {
      scratchContext.clearRect(0, 0, width, height);
      scratchContext.beginPath();
      for (const d of dots) {
        const [x, y] = point(...(sport ? d.to : d.from));
        dot(scratchContext, x + d.dx, y + d.dy, d.radius + (typeof context.filter === "string" ? 0 : 4));
      }
      scratchContext.fillStyle = typeof context.filter === "string" ? "#8e36fc" : "rgba(142,54,252,.07)";
      scratchContext.fill();
      if (typeof context.filter === "string") {
        for (const blur of [16, 16, 5]) {
          context.filter = `blur(${blur}px)`;
          context.drawImage(scratch, 0, 0, width, height);
        }
        context.filter = "none";
      } else {
        context.drawImage(scratch, 0, 0, width, height);
      }
    });
    draw();
    canvas.classList?.add("ready");
  }

  // 0 is football and 1 basketball; in between, the change in progress.
  function change() {
    const t = time % CYCLE;
    if (t < HOLD) return 0;
    if (t < HOLD + CHANGE) return (t - HOLD) / CHANGE;
    if (t < 2 * HOLD + CHANGE) return 1;
    return 1 - (t - 2 * HOLD - CHANGE) / CHANGE;
  }

  const smooth = t => t < .5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;

  function draw() {
    ctx.drawImage(base, 0, 0, width, height);
    const sweep = .53 + .38 * Math.sin(time * .72);
    const band = Math.ceil(canvas.height / 45);
    for (let y = 0; y < canvas.height; y += band) {
      const distance = ((y + band / 2) / canvas.height - sweep) / .145;
      if (Math.abs(distance) >= 1) continue;
      const rows = Math.min(band, canvas.height - y);
      ctx.globalAlpha = .88 * Math.cos(distance * Math.PI / 2) ** 2;
      ctx.drawImage(grain, 0, y, canvas.width, rows, 0, y / ratio, width, rows / ratio);
    }

    const raw = change(), sport = smooth(raw);
    glows.forEach(([element], index) => {
      ctx.globalAlpha = index ? sport : 1 - sport;
      if (ctx.globalAlpha > .01) ctx.drawImage(element, 0, 0, width, height);
    });
    ctx.globalAlpha = 1;

    // The lines' dots, brighter under the sweep and while they travel.
    const levels = [[], [], [], [], []];
    ring = [];
    for (const d of dots) {
      const step = smooth(Math.max(0, Math.min(1, (raw - d.delay) / .7)));
      const travel = Math.sin(step * Math.PI);
      const [x, y] = point(
        d.from[0] + (d.to[0] - d.from[0]) * step + d.lx * travel,
        d.from[1] + (d.to[1] - d.from[1]) * step + d.ly * travel);
      const px = x + d.dx, py = y + d.dy;
      const beam = bell(py / height - sweep, .12) + travel * .55;
      levels[Math.min(4, Math.round(beam * 4))].push([px, py, d.radius]);
      if (d.ring) ring.push([x, y]);
    }
    levels.forEach((list, level) => {
      if (!list.length) return;
      const bright = level / 4;
      ctx.beginPath();
      for (const [x, y, radius] of list) dot(ctx, x, y, radius);
      ctx.fillStyle = `rgba(${142 + 102 * bright | 0},${54 + 179 * bright | 0},${252 + 3 * bright | 0},${.72 + .25 * bright})`;
      ctx.fill();
    });

    const pulse = (1 + Math.sin(time * 2.6)) / 2;
    const [cx, cy] = point(.5, .55);
    ctx.beginPath();
    for (const [x, y] of ring) {
      const scale = 1 + pulse * .055;
      dot(ctx, cx + (x - cx) * scale, cy + (y - cy) * scale, 1 + pulse * .75);
    }
    ctx.fillStyle = `rgba(223,195,255,${.26 + pulse * .61})`;
    ctx.fill();

    // The ball: violet-white on grass, warming to orange on the court.
    for (let i = 32; i >= 0; i--) {
      const angle = (time - i * .036) * .69 + .24;
      const [x, y] = point(.5 + .45 * Math.sin(angle), .69 + .19 * Math.cos(angle));
      const life = 1 - i / 33;
      ctx.beginPath();
      dot(ctx, x, y + Math.sin(i * 2.4) * i * .2, i ? .65 + 1.9 * life : 3.7);
      const warm = i > 9 ? 0 : sport;
      const color = i > 9 ? "185,140,255" : `${248 + 7 * warm | 0},${237 - 77 * warm | 0},${255 - 175 * warm | 0}`;
      ctx.fillStyle = `rgba(${color},${life * .94})`;
      ctx.fill();
    }
  }

  function tick(now) {
    frame = 0;
    if (document.hidden || paused || reduced.matches) return;
    if (scrollY < height && now - previous >= 1000 / 30 - .5) {
      time += Math.min((now - previous) / 1000, .05);
      previous = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = performance.now();
    toggle.hidden = reduced.matches;
    if (reduced.matches) {
      time = .75;
      draw();
    } else if (!document.hidden && !paused) {
      frame = requestAnimationFrame(tick);
    }
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.textContent = english ? (paused ? "Play background" : "Pause background") : (paused ? "Animar fondo" : "Pausar fondo");
    sync();
  });
  addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(setup, 150);
  });
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  setup();
  sync();
})();
