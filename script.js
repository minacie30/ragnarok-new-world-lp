(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Stop the background video for visitors who ask for reduced motion.
  var video = document.querySelector('.hero-video');
  if (video && reduceMotion) {
    video.removeAttribute('autoplay');
    video.pause();
  }

  // Speaker button: the trailer always starts muted (browsers require it for
  // autoplay); this turns its sound on and off.
  var soundBtn = document.querySelector('.sound-toggle');
  if (soundBtn && video) {
    soundBtn.addEventListener('click', function () {
      var on = video.muted;
      video.muted = !on;
      soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on && video.paused) {
        var pr = video.play();
        if (pr && pr.catch) { pr.catch(function () {}); }
      }
    });
  }

  // Language menu: close it when clicking elsewhere or pressing Escape.
  var langMenu = document.querySelector('.lang-menu');
  if (langMenu) {
    document.addEventListener('click', function (e) {
      if (langMenu.open && !langMenu.contains(e.target)) {
        langMenu.open = false;
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && langMenu.open) {
        langMenu.open = false;
        langMenu.querySelector('summary').focus();
      }
    });
  }

  // Official logo. CSS decides the layout (centered on narrow screens, top
  // left on wide ones) so nothing jumps. On wide screens this pins it to the
  // video's top-left corner (x 12-148, y 1-81 on a 960 px wide video) so it scales with
  // the video.
  var hero = document.querySelector('.hero');
  var logo = document.querySelector('.hero-logo');
  var LOGO_RATIO = 253 / 440;
  var wideQuery = window.matchMedia('(min-width: 1000px) and (min-aspect-ratio: 3/2)');
  function placeLogo() {
    if (!hero || !logo || !video) {
      return;
    }
    if (!wideQuery.matches) {
      logo.style.cssText = '';
      return;
    }
    var vw = video.videoWidth || 960;
    var vh = video.videoHeight || 540;
    var W = hero.clientWidth;
    var H = hero.clientHeight;
    var s = Math.max(W / vw, H / vh);
    var x0 = (W - vw * s) / 2;
    var y0 = (H - vh * s) / 2;
    // Corner box measured on a 960 px wide video; scale it to this video
    var u = s * (vw / 960);
    var bx = x0 + 12 * u;
    var by = y0 + 1 * u;
    var bw = 136 * u;
    var bh = 80 * u;
    if (bx < 0 || by < 0) {
      // The old logo spot is cropped off screen: keep the CSS position.
      logo.style.cssText = '';
      return;
    }
    var w = Math.max(bw * 1.12, (bh * 1.12) / LOGO_RATIO);
    var h = w * LOGO_RATIO;
    logo.style.width = w + 'px';
    logo.style.minWidth = '0';
    logo.style.left = Math.max(8, bx + bw / 2 - w / 2) + 'px';
    logo.style.top = Math.max(0, by + bh / 2 - h / 2) + 'px';
  }
  var placeQueued = false;
  function queuePlaceLogo() {
    if (placeQueued) {
      return;
    }
    placeQueued = true;
    window.requestAnimationFrame(function () {
      placeQueued = false;
      placeLogo();
    });
  }
  placeLogo();
  window.addEventListener('resize', queuePlaceLogo);
  if (video) {
    video.addEventListener('loadedmetadata', queuePlaceLogo);
  }

  // The game is Windows PC only. On Mac, Linux and mobile:
  // show the notice and hide every CTA orb (hero and footer).
  var ctaWraps = Array.prototype.slice.call(document.querySelectorAll('.cta-wrap'));
  if (!/Windows NT/.test(navigator.userAgent)) {
    var notices = document.querySelectorAll('.os-notice');
    for (var nn = 0; nn < notices.length; nn++) {
      notices[nn].hidden = false;
    }
    var ctas = document.querySelectorAll('.cta');
    for (var i = 0; i < ctas.length; i++) {
      ctas[i].hidden = true;
    }
    ctaWraps.forEach(function (w) { w.classList.add('is-blocked'); });
  }

  // Fireball around each CTA orb: flames wrap the whole ball and burn upward,
  // with embers. Off for reduced motion, non-Windows visitors
  // (orb hidden), and whenever the orb is off screen or the tab is hidden.
  ctaWraps.forEach(function (w) {
    var fire = w.querySelector('.orb-fire');
    if (fire && !w.classList.contains('is-blocked') && !reduceMotion && fire.getContext) {
      startFire(fire, w);
    }
  });

  // A soft teardrop flame tongue, 64 wide by 128 tall (tip at the top)
  function makeSprite(rgb, round) {
    var c = document.createElement('canvas');
    c.width = 64;
    c.height = round ? 64 : 128;
    var g = c.getContext('2d');
    if (!round) {
      g.translate(32, 84);
      g.scale(1, 2.6);
      g.translate(-32, -32);
    }
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(0.3, 'rgba(' + rgb + ',0.8)');
    grad.addColorStop(0.65, 'rgba(' + rgb + ',0.22)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  function startFire(cv, wrap) {
    var ctx = cv.getContext('2d');
    var sprites = [makeSprite('255,215,90'), makeSprite('255,130,25'), makeSprite('215,45,10')];
    var ember = makeSprite('255,220,120', true);
    var parts = [];
    var w = 0, h = 0, cx = 0, cy = 0, r = 0;
    var running = false, onScreen = true, last = 0, boost = 1;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      r = wrap.clientWidth / 2;
      cx = w / 2;
      cy = h * 0.56;
    }

    function spawn() {
      // Fireball: flames start all around the rim, push out a little, then
      // get pulled upward, so the fire wraps the ball and burns upward
      var a = Math.random() * Math.PI * 2;
      var d = r * (0.78 + Math.random() * 0.18);
      var isEmber = Math.random() < 0.06;
      var out = isEmber ? 0.6 + Math.random() * 0.6 : 0.25 + Math.random() * 0.45;
      parts.push({
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d,
        vx: Math.cos(a) * out + (Math.random() - 0.5) * 0.3,
        vy: Math.sin(a) * out - (0.3 + Math.random() * 0.5),
        life: 0,
        max: isEmber ? 70 + Math.random() * 40 : 26 + Math.random() * 20,
        size: isEmber ? r * 0.045 : r * (0.12 + Math.random() * 0.12),
        ember: isEmber,
        seed: Math.random() * 10
      });
    }

    function frame(t) {
      if (!running) {
        return;
      }
      var dt = last ? Math.min((t - last) / 16.67, 3) : 1;
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      var n = Math.round(10 * boost * dt);
      for (var i = 0; i < n && parts.length < 900; i++) {
        spawn();
      }
      for (var j = parts.length - 1; j >= 0; j--) {
        var p = parts[j];
        p.life += dt;
        if (p.life >= p.max) {
          parts.splice(j, 1);
          continue;
        }
        var k = p.life / p.max;
        // Heat rises: pull every flame upward, with a little flicker
        p.vy -= 0.07 * dt;
        p.vx *= Math.pow(0.97, dt);
        p.x += (p.vx + Math.sin(p.seed + p.life * 0.3) * 0.25) * dt;
        p.y += p.vy * dt;
        var s = p.ember ? p.size : p.size * (1 - k * 0.55);
        var img = p.ember ? ember : sprites[k < 0.3 ? 0 : k < 0.65 ? 1 : 2];
        ctx.globalAlpha = p.ember ? (1 - k) : (1 - k) * 0.6;
        if (p.ember) {
          ctx.drawImage(img, p.x - s, p.y - s, s * 2, s * 2);
        } else {
          // Point the flame tongue along the way it is moving
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
          ctx.drawImage(img, -s, -s * 2.6, s * 2, s * 4);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      window.requestAnimationFrame(frame);
    }

    function update() {
      var should = onScreen && !document.hidden;
      if (should && !running) {
        running = true;
        last = 0;
        window.requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        ctx.clearRect(0, 0, w, h);
        parts.length = 0;
      }
    }

    size();
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', update);
    var orbLink = wrap.querySelector('.cta-orb');
    if (orbLink) {
      orbLink.addEventListener('mouseenter', function () { boost = 2; });
      orbLink.addEventListener('mouseleave', function () { boost = 1; });
      orbLink.addEventListener('focus', function () { boost = 2; });
      orbLink.addEventListener('blur', function () { boost = 1; });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        update();
      }).observe(cv);
    }
    update();
  }

  // Short synthesized "select" sound, played when a showroom slot is picked.
  var audioCtx = null;
  function playSelectSound() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }
    try {
      audioCtx = audioCtx || new AudioContext();
      var now = audioCtx.currentTime;
      [880, 1320].forEach(function (freq, n) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        var start = now + n * 0.07;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.13);
      });
    } catch (e) {
      // Sound is a nice-to-have; never break the page over it.
    }
  }

  // Hero showroom: 8 statues on a ring (45 degrees apart); the one in front
  // is featured. The ring turns one step every few seconds on its own,
  // whether or not the mouse is over it. Picking a statue turns it to the
  // front and holds it for 8 seconds before the turning resumes.
  var statueRing = document.querySelector('.statue-ring');
  if (statueRing) {
    var statues = Array.prototype.slice.call(statueRing.querySelectorAll('.statue'));
    var statueBtns = statues.map(function (s) { return s.querySelector('.statue-btn'); });
    var N = statues.length;
    var turn = 0;
    var showOnScreen = false;
    var heldUntil = 0;
    var timer = null;

    function front() {
      return ((turn % N) + N) % N;
    }

    var faces = statues.map(function (s) { return s.querySelector('.statue-face'); });
    function render() {
      // Ring and faces are plain transforms with the same timing, so the
      // GPU animates them together and each statue keeps facing the screen
      var ringAngle = -turn * 360 / N;
      statueRing.style.transform = 'rotateY(' + ringAngle + 'deg)';
      var f = front();
      statues.forEach(function (st, k) {
        faces[k].style.transform = 'rotateY(' + (-(k * 360 / N + ringAngle)) + 'deg) rotateX(10deg)';
        var rel = ((k - f) % N + N) % N;
        st.setAttribute('data-dist', String(Math.min(rel, N - rel)));
        statueBtns[k].setAttribute('aria-pressed', k === f ? 'true' : 'false');
      });

    }

    function goTo(k) {
      var delta = ((k - front()) % N + N) % N;
      if (delta > N / 2) {
        delta -= N;
      }
      turn += delta;
      render();
    }

    function tick() {
      if (showOnScreen && !document.hidden && Date.now() > heldUntil) {
        turn += 1;
        render();
      }
    }

    function syncTimer() {
      var should = showOnScreen && !reduceMotion;
      if (should && !timer) {
        timer = window.setInterval(tick, 5500);
      } else if (!should && timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    statueBtns.forEach(function (btn, k) {
      btn.addEventListener('click', function () {
        heldUntil = Date.now() + 8000;
        goTo(k);
        playSelectSound();
      });
      // Keyboard users: bring the focused statue to the front and hold it
      // for a while. Mouse clicks are handled above and never block the
      // automatic turning for longer than the hold.
      btn.addEventListener('focus', function () {
        var byKeyboard = false;
        try { byKeyboard = btn.matches(':focus-visible'); } catch (e) { byKeyboard = false; }
        if (byKeyboard) {
          heldUntil = Date.now() + 8000;
          if (front() !== k) {
            goTo(k);
          }
        }
      });
    });

    var showroom = statueRing.closest('.showroom');

    if ('IntersectionObserver' in window && showroom) {
      new IntersectionObserver(function (entries) {
        showOnScreen = entries[0].isIntersecting;
        render();
        syncTimer();
      }, { threshold: 0.15 }).observe(showroom);
    } else {
      showOnScreen = true;
      syncTimer();
    }
    render();
    // Turn animations on only after the first layout is painted
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (showroom) {
          showroom.classList.add('is-ready');
        }
      });
    });
  }

  // Glass-case carousel under the showroom: slides on its own (CSS), with a
  // hidden copy of the cases appended so the loop is seamless. Videos play
  // only while on screen; picking a case highlights it (and its copy).
  var vtrack = document.querySelector('.vitrine-track');
  if (vtrack) {
    if (!reduceMotion) {
      Array.prototype.slice.call(vtrack.children).forEach(function (li) {
        var clone = li.cloneNode(true);
        clone.classList.add('vit-clone');
        clone.setAttribute('aria-hidden', 'true');
        var cb = clone.querySelector('button');
        if (cb) {
          cb.tabIndex = -1;
        }
        vtrack.appendChild(clone);
      });
    }
    var cases = Array.prototype.slice.call(vtrack.querySelectorAll('.vitrine'));
    cases.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-card');
        cases.forEach(function (b) {
          b.setAttribute('aria-pressed', b.getAttribute('data-card') === key ? 'true' : 'false');
        });
        playSelectSound();
      });
    });
    var caseVideos = vtrack.querySelectorAll('.card-video');
    if (!reduceMotion && 'IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var pr = entry.target.play();
            if (pr && pr.catch) { pr.catch(function () {}); }
          } else {
            entry.target.pause();
          }
        });
      }, { threshold: 0.1 });
      for (var cv = 0; cv < caseVideos.length; cv++) {
        vio.observe(caseVideos[cv]);
      }
    }
  }

  // Info ticker: repeat the requirement items until one set is wider than the
  // band, then double it so translateX(-50%) loops seamlessly. Copies are
  // hidden from screen readers. Slow, about 35 px per second.
  var ttrack = document.querySelector('.ticker-track');
  var tview = document.querySelector('.info-ticker');
  if (ttrack && tview && !reduceMotion) {
    var originalsT = Array.prototype.slice.call(ttrack.children);
    function addCopy() {
      originalsT.forEach(function (li) {
        var c = li.cloneNode(true);
        c.classList.add('ticker-clone');
        c.setAttribute('aria-hidden', 'true');
        ttrack.appendChild(c);
      });
    }
    var guard = 0;
    while (ttrack.scrollWidth < tview.clientWidth + 40 && guard < 10) {
      addCopy();
      guard++;
    }
    var sets = guard + 1;
    for (var t2 = 0; t2 < sets; t2++) {
      addCopy();
    }
    ttrack.style.animationDuration = Math.max(20, Math.round(ttrack.scrollWidth / 2 / 35)) + 's';
  }
})();
