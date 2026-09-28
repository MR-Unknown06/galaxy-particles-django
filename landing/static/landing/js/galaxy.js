/*
 * Spiral-galaxy "6" particle animation (plain Canvas 2D, no libraries).
 *
 *  - Thousands of stars are laid out along spiral arms that form a "6" and a "9"
 *    (the 9 is the 6 rotated 180 degrees), side by side: "69".
 *  - Every star is attached to its home position by a spring.
 *  - The cursor pushes / swirls nearby stars, then they spring back.
 *  - The whole galaxy leans in 3D toward the cursor (perspective tilt).
 *  - The replay button scatters the stars and lets them fly back in.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('galaxy');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var cfgEl = document.getElementById('galaxy-config');
  var userCfg = {};
  try { userCfg = cfgEl ? JSON.parse(cfgEl.textContent) : {}; } catch (e) {}
  var cfg = Object.assign({
    particles: 12000, repelRadius: 140, repelStrength: 1.6,
    spring: 0.03, damping: 0.86, tilt: 0.42
  }, userCfg);

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ *
   * Spiral path: [angle in degrees, radius in design units].
   * Angle grows counter-clockwise; the arm starts at the outer tail
   * (top-right) and winds inward to the bright core.
   * ------------------------------------------------------------------ */
  var PATH = [
    [63, 500], [97, 393], [125, 330], [152, 300], [175, 268], [259, 265],
    [342, 262], [387, 228], [437, 214], [520, 150], [620, 92], [720, 42], [800, 6]
  ];
  var PHI0 = PATH[0][0];
  var PHI1 = PATH[PATH.length - 1][0];

  // Smooth (cubic Hermite / Catmull-Rom) interpolation of the radius.
  function pathR(phi) {
    var i = 0;
    while (i < PATH.length - 2 && phi > PATH[i + 1][0]) i++;
    var p0 = PATH[Math.max(i - 1, 0)], p1 = PATH[i], p2 = PATH[i + 1],
        p3 = PATH[Math.min(i + 2, PATH.length - 1)];
    var span = p2[0] - p1[0];
    var t = (phi - p1[0]) / span;
    var d1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * span;
    var d2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * span;
    var t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * d1 +
           (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * d2;
  }

  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ------------------------------------------------------------------ *
   * Glow sprites (pre-rendered once, drawn thousands of times per frame)
   * ------------------------------------------------------------------ */
  function makeSprite(r, g, b) {
    var s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    var g2 = c.getContext('2d');
    var gr = g2.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(' + r + ',' + g + ',' + b + ',0.85)');
    gr.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',0.18)');
    gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    g2.fillStyle = gr;
    g2.fillRect(0, 0, s, s);
    return c;
  }
  var sprites = [
    makeSprite(170, 205, 255),  // 0: blue-white
    makeSprite(255, 170, 120),  // 1: warm orange
    makeSprite(235, 245, 255)   // 2: white
  ];

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  var W = 0, H = 0, DPR = 1, cx = 0, cy = 0, scale = 1, sf = 1;
  var N = 0;
  var cores = [{ x: 0, y: 0 }, { x: 0, y: 0 }];   // core of the 6 and of the 9 (design units, y up)
  var portrait = false;
  var bx, by, bz, px, py, vx, vy, sz, br, tint, ph, sp;
  var bgStars = [];
  var introStart = 0;

  var mouse = {
    x: -9999, y: -9999,        // pixel position (for repulsion)
    tx: 0.5, ty: 0.5,          // target, normalised 0..1
    nx: 0.5, ny: 0.5,          // smoothed, normalised 0..1
    speed: 0
  };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    portrait = W < 700 || W / H < 0.85;
    if (portrait) {
      // stacked: 6 above 9
      scale = Math.min(H * 0.84 / 1430, W * 0.92 / 580);
      cores[0].x = 17;  cores[0].y = 270;
      cores[1].x = -17; cores[1].y = -270;
      cx = W * 0.5; cy = H * 0.54;
    } else {
      // side by side: 6 on the left, 9 on the right (staggered like a real "69")
      scale = Math.min(H * 0.86 / 730, W * 0.80 / 1200);
      cores[0].x = -300; cores[0].y = -90;
      cores[1].x = 300;  cores[1].y = 90;
      cx = W * 0.5; cy = H * 0.545;
    }
    sf = Math.max(scale, 0.45);
  }

  function build() {
    var small = W < 700;
    var per = Math.round((small ? cfg.particles * 0.6 : cfg.particles) / 2);
    N = per * 2;
    bx = new Float32Array(N); by = new Float32Array(N); bz = new Float32Array(N);
    px = new Float32Array(N); py = new Float32Array(N);
    vx = new Float32Array(N); vy = new Float32Array(N);
    sz = new Float32Array(N); br = new Float32Array(N);
    ph = new Float32Array(N); sp = new Float32Array(N);
    tint = new Uint8Array(N);

    var nCore = Math.round(per * 0.16);
    var nDust = Math.round(per * 0.06);

    for (var g = 0; g < 2; g++) {            // g = 0 -> the "6", g = 1 -> the "9"
      var knots = [];
      for (var k = 0; k < 70; k++) {
        knots.push(PHI0 + Math.pow(Math.random(), 0.8) * (PHI1 - PHI0));
      }

      for (var j = 0; j < per; j++) {
        var i = g * per + j;
        var x, y, z, size, bright;

        if (j < nCore) {
          // dense, bright core
          var a = Math.random() * Math.PI * 2;
          var rc = Math.abs(gauss()) * 24;
          x = Math.cos(a) * rc; y = Math.sin(a) * rc; z = gauss() * 12;
          size = 0.5 + Math.random() * 1.5;
          bright = 0.6 + Math.random() * 0.4;
        } else if (j < nCore + nDust) {
          // faint dust halo around the loop
          var a2 = Math.random() * Math.PI * 2;
          var rd = Math.pow(Math.random(), 0.7) * 330;
          x = Math.cos(a2) * rd; y = Math.sin(a2) * rd; z = gauss() * 30;
          size = 0.4 + Math.random() * 0.6;
          bright = 0.12 + Math.random() * 0.22;
        } else {
          // the spiral arm
          var inKnot = Math.random() < 0.28;
          var phi = inKnot
            ? knots[(Math.random() * knots.length) | 0] + gauss() * 2.2
            : PHI0 + Math.pow(Math.random(), 0.9) * (PHI1 - PHI0);
          phi = Math.min(PHI1, Math.max(PHI0, phi));
          var r = pathR(phi);
          var rad = phi * Math.PI / 180;
          var sigma = 3.5 + 12 * Math.exp(-r / 180);
          var rr = Math.max(0, r + gauss() * sigma * (inKnot ? 0.8 : 1));
          x = rr * Math.cos(rad);
          y = rr * Math.sin(rad);
          z = gauss() * (8 + 22 * Math.exp(-r / 200));
          var near = Math.exp(-r / 220);
          size = 0.45 + Math.pow(Math.random(), 2) * 1.5 + near * 0.5 + (inKnot ? 0.35 : 0);
          bright = 0.42 + Math.random() * 0.5 + near * 0.15;
        }

        // the 9 is the 6 turned upside down
        if (g === 1) { x = -x; y = -y; }

        bx[i] = x + cores[g].x;
        by[i] = y + cores[g].y;
        bz[i] = z;
        sz[i] = size; br[i] = bright;
        ph[i] = Math.random() * Math.PI * 2;
        sp[i] = 0.6 + Math.random() * 0.8;
        var t = Math.random();
        tint[i] = t < 0.62 ? 0 : (t < 0.82 ? 2 : 1);
      }
    }

    bgStars = [];
    for (var s = 0; s < 240; s++) {
      bgStars.push({
        x: Math.random(), y: Math.random(),
        d: 0.2 + Math.random() * 0.8,
        s: 0.5 + Math.random() * 1.2,
        p: Math.random() * 6.28
      });
    }
  }

  /* Fly-in intro: every star starts at a random spot and springs home. */
  function intro(now) {
    for (var i = 0; i < N; i++) {
      px[i] = cx + (Math.random() - 0.5) * W * 1.5;
      py[i] = cy + (Math.random() - 0.5) * H * 1.5;
      vx[i] = 0; vy[i] = 0;
    }
    introStart = now || performance.now();
  }

  /* ------------------------------------------------------------------ *
   * Main loop
   * ------------------------------------------------------------------ */
  var last = 0;

  function frame(now) {
    var dt = Math.min((now - last) / 16.667, 2.5);
    if (!(dt > 0)) dt = 1;
    last = now;

    // smooth the pointer
    var ease = Math.min(1, 0.06 * dt);
    mouse.nx += (mouse.tx - mouse.nx) * ease;
    mouse.ny += (mouse.ty - mouse.ny) * ease;
    mouse.speed *= Math.pow(0.9, dt);

    var rotY = (mouse.nx - 0.5) * 2 * cfg.tilt;
    var rotX = -(mouse.ny - 0.5) * 2 * cfg.tilt * 0.7;
    var rotZ = reduceMotion ? 0 : Math.sin(now * 0.00025) * 0.025;
    var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    var cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);

    var ox = (0.5 - mouse.nx) * 16 * sf;
    var oy = (0.5 - mouse.ny) * 10 * sf;
    var F = 900;

    var mx = mouse.x, my = mouse.y;
    var R = cfg.repelRadius * Math.max(sf, 0.7), R2 = R * R;
    var str = cfg.repelStrength * (1 + Math.min(mouse.speed, 50) * 0.03);
    var damp = Math.pow(cfg.damping, dt);
    var K = cfg.spring * dt;
    var introAlpha = reduceMotion ? 1 : Math.min(1, (now - introStart) / 900);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    // background stars (parallax, independent of the galaxy)
    for (var b = 0; b < bgStars.length; b++) {
      var st = bgStars[b];
      var a = (0.25 + 0.55 * st.d) * (0.7 + 0.3 * Math.sin(now * 0.0012 + st.p)) * introAlpha;
      ctx.fillStyle = 'rgba(210,225,255,' + a.toFixed(3) + ')';
      ctx.fillRect(st.x * W + (0.5 - mouse.nx) * 34 * st.d,
                   st.y * H + (0.5 - mouse.ny) * 22 * st.d, st.s, st.s);
    }

    ctx.globalCompositeOperation = 'lighter';

    // core glows (one for the 6, one for the 9), projected like the stars
    var gx0 = cx + ox, gy0 = cy + oy;
    for (var c = 0; c < 2; c++) {
      var cxx = cores[c].x, cyy = -cores[c].y;
      var c1x = cxx * cosZ - cyy * sinZ, c1y = cxx * sinZ + cyy * cosZ;
      var c2x = c1x * cosY, cz1 = -c1x * sinY;
      var c2y = c1y * cosX - cz1 * sinX, cz2 = c1y * sinX + cz1 * cosX;
      var ck = F / (F + cz2);
      var gx = gx0 + c2x * ck * scale, gy = gy0 + c2y * ck * scale;
      var cr = 120 * scale * ck * (1 + 0.03 * Math.sin(now * 0.0015 + c * 1.7));
      var gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, cr);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.12, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.35, 'rgba(190,215,255,0.16)');
      gr.addColorStop(1, 'rgba(120,160,255,0)');
      ctx.globalAlpha = introAlpha;
      ctx.fillStyle = gr;
      ctx.fillRect(gx - cr, gy - cr, cr * 2, cr * 2);
    }
    var gx = gx0, gy = gy0;

    // stars
    for (var i = 0; i < N; i++) {
      // 3D transform of the home position
      var x = bx[i], y = -by[i], z = bz[i];
      var x1 = x * cosZ - y * sinZ, y1 = x * sinZ + y * cosZ;
      var x2 = x1 * cosY + z * sinY, z1 = -x1 * sinY + z * cosY;
      var y2 = y1 * cosX - z1 * sinX, z2 = y1 * sinX + z1 * cosX;
      var k = F / (F + z2);
      var tx = gx + x2 * k * scale;
      var ty = gy + y2 * k * scale;

      // spring toward home
      var kk = K * sp[i];
      vx[i] += (tx - px[i]) * kk;
      vy[i] += (ty - py[i]) * kk;

      // cursor repulsion + a little swirl
      var dx = px[i] - mx, dy = py[i] - my;
      var d2 = dx * dx + dy * dy;
      if (d2 < R2 && d2 > 0.01) {
        var d = Math.sqrt(d2);
        var f = 1 - d / R;
        var ff = f * f * str * dt;
        vx[i] += (dx / d) * ff - (dy / d) * ff * 0.4;
        vy[i] += (dy / d) * ff + (dx / d) * ff * 0.4;
      }

      vx[i] *= damp; vy[i] *= damp;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;

      // draw
      var tw = 0.78 + 0.22 * Math.sin(now * 0.0016 * sp[i] + ph[i]);
      var alpha = br[i] * tw * introAlpha * (k < 0.75 ? 0.75 : (k > 1.25 ? 1.25 : k));
      var dia = sz[i] * 5 * sf * k;
      ctx.globalAlpha = alpha > 1 ? 1 : alpha;
      ctx.drawImage(sprites[tint[i]], px[i] - dia / 2, py[i] - dia / 2, dia, dia);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // headline parallax (CSS variables)
    var root = document.documentElement.style;
    root.setProperty('--mx', ((mouse.nx - 0.5) * -18).toFixed(2) + 'px');
    root.setProperty('--my', ((mouse.ny - 0.5) * -12).toFixed(2) + 'px');

    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ *
   * Input
   * ------------------------------------------------------------------ */
  var lastPX = null, lastPY = null;

  window.addEventListener('pointermove', function (e) {
    if (lastPX !== null) {
      mouse.speed = Math.min(60, Math.max(mouse.speed, Math.hypot(e.clientX - lastPX, e.clientY - lastPY)));
    }
    lastPX = e.clientX; lastPY = e.clientY;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.tx = e.clientX / W;
    mouse.ty = e.clientY / H;
  }, { passive: true });

  function release() {
    mouse.x = mouse.y = -9999;
    mouse.tx = mouse.ty = 0.5;
    lastPX = lastPY = null;
  }
  document.addEventListener('mouseleave', release);
  window.addEventListener('blur', release);
  window.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'touch') release();
  });

  var replay = document.getElementById('replay');
  if (replay) {
    replay.addEventListener('click', function () { intro(performance.now()); });
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var wasSmall = W < 700, wasPortrait = portrait;
      resize();
      if ((W < 700) !== wasSmall || portrait !== wasPortrait) { build(); intro(performance.now()); }
    }, 120);
  });

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  resize();
  build();
  intro(performance.now());
  last = performance.now();
  requestAnimationFrame(frame);
})();
