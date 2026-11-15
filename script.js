(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Stop the background video for visitors who ask for reduced motion.
  var video = document.querySelector('.hero-video');
  if (video && reduceMotion) {
    video.removeAttribute('autoplay');
    video.pause();
  }

  // Official logo. CSS decides the layout (centered on narrow screens, top
  // left on wide ones) so nothing jumps. On wide screens this fine-tunes it
  // to sit exactly on the spot where the video's own logo was blurred out
  // (video pixels x 12-148, y 1-81).
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
    var bx = x0 + 12 * s;
    var by = y0 + 1 * s;
    var bw = 136 * s;
    var bh = 80 * s;
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
  // show the notice and hide the CTA.
  if (!/Windows NT/.test(navigator.userAgent)) {
    var notice = document.querySelector('.os-notice');
    if (notice) {
      notice.hidden = false;
    }
    var ctas = document.querySelectorAll('.cta-wrap, .cta, .spec-buddy');
    for (var i = 0; i < ctas.length; i++) {
      ctas[i].hidden = true;
    }
  }

  // Card conveyor: append a hidden copy of the cards so the loop is seamless.
  var track = document.querySelector('.card-track');
  if (track && !reduceMotion) {
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (li) {
      var clone = li.cloneNode(true);
      clone.classList.add('card-clone');
      clone.setAttribute('aria-hidden', 'true');
      var btn = clone.querySelector('button');
      if (btn) {
        btn.tabIndex = -1;
      }
      track.appendChild(clone);
    });
  }

  // Card videos: play only while on screen, never for reduced motion.
  var cardVideos = document.querySelectorAll('.card-video');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var p = entry.target.play();
          if (p && p.catch) { p.catch(function () {}); }
        } else {
          entry.target.pause();
        }
      });
    }, { threshold: 0.1 });
    for (var v = 0; v < cardVideos.length; v++) {
      observer.observe(cardVideos[v]);
    }
  }

  // Select one card at a time, with a short synthesized sound.
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

  var cards = document.querySelectorAll('.char-card');
  for (var c = 0; c < cards.length; c++) {
    cards[c].addEventListener('click', function () {
      var key = this.getAttribute('data-card');
      for (var k = 0; k < cards.length; k++) {
        cards[k].setAttribute('aria-pressed', cards[k].getAttribute('data-card') === key ? 'true' : 'false');
      }
      playSelectSound();
    });
  }
})();
