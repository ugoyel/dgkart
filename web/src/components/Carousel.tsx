import { SLIDE_EASINGS, SliderSettings } from '@engine';
import { KeyboardEvent, MouseEvent, PointerEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Banner slider used on the home page, category pages and the admin preview.
 * Swipe or drag with a finger or mouse, use the arrows, dots or keyboard; it
 * loops forever, pauses on hover / focus / the pause button, and animates with
 * the admin's chosen effect, speed and easing.
 */
export function Carousel({ slides, settings, label, className = '' }: {
  slides: ReactNode[];
  settings: SliderSettings;
  label: string;
  className?: string;
}) {
  const n = slides.length;
  const effect = settings.effect;
  const loop = effect === 'slide' && n > 1;
  // In "slide" mode the track holds [last, ...slides, first] so it can loop without jumping back.
  const [pos, setPos] = useState(loop ? 1 : 0);
  const [animate, setAnimate] = useState(true);
  // Dragging moves the track directly (no React render per pointer move), so swipes stay at 60fps.
  const [dragging, setDragging] = useState(false);
  // After a swipe, finish with a short ease-out that carries the finger's momentum.
  const [fling, setFling] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; dx: number; lastX: number; lastT: number; v: number; active: boolean } | null>(null);
  const frame = useRef(0);
  const suppressClick = useRef(false);
  const busy = useRef(false);
  const reduce = reducedMotion();
  const speed = reduce ? 0 : settings.speedMs;

  const index = loop ? (pos - 1 + n) % n : pos;

  // Reset when the slide list or effect changes (admin preview).
  useEffect(() => {
    setAnimate(false);
    setPos(loop ? 1 : 0);
  }, [n, loop]);

  const go = useCallback((delta: number) => {
    if (n < 2) return;
    if (loop) {
      if (busy.current) return;
      if (speed > 0) {
        busy.current = true;
        setTimeout(() => (busy.current = false), speed + 80);
      }
      setAnimate(true);
      setPos((p) => p + delta);
    } else {
      setAnimate(true);
      setPos((p) => (p + delta + n) % n);
    }
  }, [n, loop, speed]);

  const goTo = (k: number) => {
    setAnimate(true);
    setPos(loop ? k + 1 : k);
  };

  // After animating onto a clone, jump to the real slide without animation.
  const onTransitionEnd = () => {
    busy.current = false;
    if (!loop) return;
    if (pos === 0 || pos === n + 1) {
      setAnimate(false);
      setPos(pos === 0 ? n : 1);
    }
  };
  useEffect(() => {
    if (speed === 0) onTransitionEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);
  // Re-enable animation one frame after a silent jump.
  useEffect(() => {
    if (animate) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(r);
  }, [animate]);

  // Autoplay.
  const playing = settings.autoplay && !paused && !hover && !reduce && n > 1 && !dragging;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => go(1), settings.intervalMs);
    return () => clearTimeout(t);
  }, [playing, pos, settings.intervalMs, go]);

  // ----- drag / swipe
  const paint = () => {
    frame.current = 0;
    const s = start.current;
    const el = track.current;
    if (!s || !el) return;
    const width = viewport.current?.clientWidth ?? 1;
    if (effect === 'slide') {
      el.style.transform = `translate3d(${-pos * width + s.dx}px, 0, 0)`;
    } else {
      el.style.transform = `translate3d(${s.dx * 0.25}px, 0, 0)`;
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, dx: 0, lastX: e.clientX, lastT: performance.now(), v: 0, active: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        start.current = null; // vertical scroll wins
        return;
      }
      if (Math.abs(dx) < 6) return;
      s.active = true;
      viewport.current?.setPointerCapture(e.pointerId);
      if (track.current) track.current.style.transition = 'none';
      setDragging(true);
    }
    // Velocity from the most recent movement, smoothed, so a quick flick counts even after a slow start.
    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
    s.v = 0.7 * ((e.clientX - s.lastX) / dt) + 0.3 * s.v;
    s.lastX = e.clientX;
    s.lastT = now;
    // Resist past the ends when the slider does not loop.
    s.dx = !loop && ((index === 0 && dx > 0) || (index === n - 1 && dx < 0)) ? dx / 3 : dx;
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.active) return;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    const width = viewport.current?.clientWidth ?? 1;
    suppressClick.current = true;
    // Touch swipes fire no click afterwards; don't swallow the next real tap.
    setTimeout(() => (suppressClick.current = false), 80);
    const flick = Math.abs(s.v) > 0.45 && Math.sign(s.v) === Math.sign(s.dx);
    const delta = Math.abs(s.dx) > width * 0.2 || flick ? (s.dx < 0 ? 1 : -1) : 0;
    const el = track.current;
    if (el) {
      // Hand the track back to React's position, animating from where the finger let go.
      el.style.transition = `transform ${Math.min(speed, 420)}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.transform = effect === 'slide' ? `translate3d(${-pos * 100}%, 0, 0)` : '';
    }
    setFling(true);
    setTimeout(() => setFling(false), Math.min(speed, 420) + 60);
    setDragging(false);
    if (delta) {
      busy.current = false;
      go(delta);
    } else {
      setAnimate(true);
    }
  };
  const onClickCapture = (e: MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  };

  if (n === 0) return null;
  const transition = animate && !dragging && speed > 0;
  // A released swipe finishes faster with a strong ease-out, like native scrolling.
  const ease = fling ? 'cubic-bezier(0.22, 1, 0.36, 1)' : SLIDE_EASINGS[settings.easing];
  const duration = fling ? Math.min(speed, 420) : speed;
  const items = loop ? [slides[n - 1], ...slides, slides[0]] : slides;

  return (
    <section
      className={`carousel fx-${effect} ${className}`}
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onKeyDown={onKeyDown}
    >
      <div
        className="carousel-viewport"
        ref={viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
      >
        {effect === 'slide' ? (
          <div
            className={`carousel-track${dragging ? ' dragging' : ''}`}
            ref={track}
            style={{
              transform: `translate3d(${-pos * 100}%, 0, 0)`,
              transition: transition ? `transform ${duration}ms ${ease}` : 'none',
            }}
            onTransitionEnd={(e) => e.target === e.currentTarget && onTransitionEnd()}
          >
            {items.map((s, k) => {
              const real = loop ? (k - 1 + n) % n : k;
              const clone = loop && (k === 0 || k === n + 1);
              return (
                <div key={k} className="carousel-slide" role="group" aria-roledescription="slide" aria-label={`${real + 1} of ${n}`} aria-hidden={clone || real !== index} inert={clone || real !== index ? true : undefined}>
                  {s}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="carousel-stack" ref={track} style={{ transition: dragging ? 'none' : `transform ${Math.min(speed, 420)}ms cubic-bezier(0.22, 1, 0.36, 1)` }}>
            {slides.map((s, k) => (
              <div
                key={k}
                className={`carousel-slide${k === index ? ' on' : ''}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${k + 1} of ${n}`}
                aria-hidden={k !== index}
                inert={k !== index ? true : undefined}
                style={{ transition: speed ? `opacity ${speed}ms ${ease}, transform ${Math.round(speed * 1.6)}ms ${ease}` : 'none', transitionDelay: k === index ? '0ms' : `${Math.round(speed * 0.15)}ms` }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
      {n > 1 && (
        <>
          <button className="carousel-arrow prev" onClick={() => go(-1)} aria-label="Previous slide"><Icon name="chevronLeft" /></button>
          <button className="carousel-arrow next" onClick={() => go(1)} aria-label="Next slide"><Icon name="chevronRight" /></button>
          <div className="carousel-controls">
            <div className="carousel-dots" role="tablist" aria-label="Choose slide">
              {slides.map((_, k) => (
                <button key={k} role="tab" aria-selected={k === index} aria-label={`Slide ${k + 1}`} className={k === index ? 'on' : ''} onClick={() => goTo(k)}>
                  {k === index && playing && <span key={pos} className="carousel-progress" style={{ animationDuration: `${settings.intervalMs}ms` }} />}
                </button>
              ))}
            </div>
            {settings.autoplay && !reduce && (
              <button className="carousel-pause" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play slides' : 'Pause slides'}>
                <Icon name={paused ? 'play' : 'pause'} size={16} />
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
