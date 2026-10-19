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
  const [drag, setDrag] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number; active: boolean; moved: boolean } | null>(null);
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
  const playing = settings.autoplay && !paused && !hover && !reduce && n > 1 && drag === 0;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => go(1), settings.intervalMs);
    return () => clearTimeout(t);
  }, [playing, pos, settings.intervalMs, go]);

  // ----- drag / swipe
  const onPointerDown = (e: PointerEvent) => {
    if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, t: performance.now(), active: false, moved: false };
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
    }
    s.moved = true;
    setAnimate(false);
    setDrag(dx);
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.active) return;
    const width = viewport.current?.clientWidth ?? 1;
    const velocity = Math.abs(drag) / Math.max(1, performance.now() - s.t);
    suppressClick.current = s.moved;
    setAnimate(true);
    if (Math.abs(drag) > width * 0.18 || velocity > 0.6) go(drag < 0 ? 1 : -1);
    setDrag(0);
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
  const transition = animate && drag === 0 && speed > 0;
  const ease = SLIDE_EASINGS[settings.easing];
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
            className="carousel-track"
            style={{
              transform: `translate3d(calc(${-pos * 100}% + ${drag}px), 0, 0)`,
              transition: transition ? `transform ${speed}ms ${ease}` : 'none',
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
          <div className="carousel-stack" style={{ transform: drag ? `translate3d(${drag * 0.25}px,0,0)` : undefined }}>
            {slides.map((s, k) => (
              <div
                key={k}
                className={`carousel-slide${k === index ? ' on' : ''}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${k + 1} of ${n}`}
                aria-hidden={k !== index}
                inert={k !== index ? true : undefined}
                style={{ transition: speed ? `opacity ${speed}ms ${ease}, transform ${Math.round(speed * 1.6)}ms ${ease}` : 'none' }}
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
