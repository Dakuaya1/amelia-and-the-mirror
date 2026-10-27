// The reels on the page (assets/reel/): the out-now explainer and the edition's 3D book.
// Each loads nothing until it is near the screen, plays only while at least a third of it is
// visible, and pauses when it leaves. With reduced motion none starts on its own; each button
// plays and pauses its own reel either way.
//
// A reel with a Sound button (the explainer) starts muted, as autoplay needs; the button
// turns its score on and off, and starts the reel if it was paused.
//
// Watching starts once the page is ready (body.is-ready, set by main.js after the act is
// measured): before that, the act is short and the reels sit inside the first screen.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const watchers = [];

for (const frame of document.querySelectorAll('.edition__frame')) {
  const video = frame.querySelector('video');
  const toggle = frame.querySelector('.edition__toggle');
  if (!video || !toggle) continue;
  const name = toggle.dataset.label || 'the reel';
  let wanted = !reduced; // the reader's choice, or the default
  let visible = false;

  const label = () => {
    const playing = !video.paused;
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${name}`);
    toggle.querySelector('span').textContent = playing ? 'Pause' : 'Play';
    toggle.querySelector('path').setAttribute('d', playing ? 'M2 1h2v8H2zM6 1h2v8H6z' : 'M2 1l7 4-7 4z');
  };

  const sync = () => {
    if (visible && wanted) {
      video.preload = 'auto';
      // A browser may refuse to autoplay (NotAllowedError); the reader can still press play.
      // A play cut short by a pause, from scrolling past quickly, is not a refusal.
      video.play().catch((e) => { if (e.name === 'NotAllowedError') { wanted = false; label(); } });
    } else if (!video.paused) {
      video.pause();
    }
  };

  const sound = frame.querySelector('.edition__sound');
  if (sound) {
    const paint = () => {
      const on = !video.muted;
      sound.setAttribute('aria-pressed', String(on));
      sound.setAttribute('aria-label', on ? `Mute ${name}` : `Turn on the sound for ${name}`);
      sound.querySelector('span').textContent = on ? 'Mute' : 'Sound';
      sound.querySelector('.wave').setAttribute('d', on ? 'M9.5 3.5a3.5 3.5 0 0 1 0 5M11.2 2a5.6 5.6 0 0 1 0 8' : 'M9.5 4l3 4M12.5 4l-3 4');
    };
    sound.addEventListener('click', () => {
      video.muted = !video.muted;
      if (!video.muted && video.paused) { wanted = true; video.preload = 'auto'; video.play().catch(() => {}); }
    });
    video.addEventListener('volumechange', paint);
    paint();
  }

  video.addEventListener('play', label);
  video.addEventListener('pause', label);
  // The button works whether or not the page got ready.
  toggle.addEventListener('click', () => {
    wanted = video.paused;
    if (wanted) { video.preload = 'auto'; video.play().catch(() => {}); } else { video.pause(); }
  });

  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.35 });
  watchers.push(() => io.observe(video));
  label();
}

const watch = () => watchers.splice(0).forEach((start) => start());
if (document.body.classList.contains('is-ready')) watch();
else {
  const mo = new MutationObserver(() => { if (document.body.classList.contains('is-ready')) { mo.disconnect(); watch(); } });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
