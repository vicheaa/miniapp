import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';

export interface WheelOption { value: number; label: string }
export interface WheelPickerHandle { readValue(): number }
const ROW_HEIGHT = 44;

export default function WheelPicker({ label, value, options, minimumValue = options[0]?.value, onChange, ref: handle }: { label: string; value: number; options: WheelOption[]; minimumValue?: number; onChange: (value: number) => void; ref?: Ref<WheelPickerHandle> }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const minimumIndex = Math.max(0, options.findIndex((option) => option.value >= minimumValue));
  const index = Math.max(minimumIndex, options.findIndex((option) => option.value === value));
  const [position, setPosition] = useState(index);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const touching = useRef(false);
  const tap = useRef<{ y: number; moved: boolean } | null>(null);
  const target = useRef<number | null>(null);
  const current = useRef({ options, value, minimumIndex, onChange });
  current.current = { options, value, minimumIndex, onChange };
  function readIndex() {
    const { options, minimumIndex } = current.current;
    return Math.max(minimumIndex, Math.min(options.length - 1, minimumIndex + Math.round((ref.current?.scrollTop ?? 0) / ROW_HEIGHT)));
  }
  function readValue() {
    const values = current.current.options;
    return target.current ?? values[readIndex()]?.value ?? current.current.value;
  }
  function settle() {
    clearTimeout(timer.current);
    if (touching.current) return;
    target.current = null;
    const next = readValue();
    if (next !== current.current.value) current.current.onChange(next);
  }
  function settleWhenIdle() {
    clearTimeout(timer.current);
    // Older embedded WebViews have no scrollend event. Never commit during a held touch.
    if (!touching.current && ref.current && !('onscrollend' in ref.current)) timer.current = setTimeout(settle, 200);
  }
  function scrollToOption(next: number) {
    const element = ref.current;
    if (!element) return;
    clearTimeout(timer.current);
    const nextIndex = Math.max(current.current.minimumIndex, Math.min(current.current.options.length - 1, next));
    const top = (nextIndex - current.current.minimumIndex) * ROW_HEIGHT;
    target.current = current.current.options[nextIndex]?.value ?? null;
    if (Math.abs(element.scrollTop - top) < .5) { settle(); return; }
    element.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    settleWhenIdle();
  }
  useImperativeHandle(handle, () => ({ readValue }));
  useLayoutEffect(() => {
    clearTimeout(timer.current);
    target.current = null;
    const element = ref.current;
    const top = (index - minimumIndex) * ROW_HEIGHT;
    // Do not interrupt the browser's momentum when our own settled selection comes back.
    if (element && Math.abs(element.scrollTop - top) > .5) element.scrollTo({ top, behavior: 'instant' });
    setPosition(index);
  }, [index, minimumIndex, options.length, options[0]?.value]);
  useEffect(() => {
    const element = ref.current;
    element?.addEventListener('scrollend', settle);
    return () => {
      element?.removeEventListener('scrollend', settle);
      clearTimeout(timer.current);
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, []);
  const active = Math.max(minimumIndex, Math.min(options.length - 1, Math.round(position)));
  return <div ref={ref} className="checkout-wheel" role="listbox" aria-label={label} aria-activedescendant={`${id}-${active}`} tabIndex={0}
    onTouchStart={() => { touching.current = true; target.current = null; clearTimeout(timer.current); }}
    onTouchEnd={() => { touching.current = false; settleWhenIdle(); }}
    onTouchCancel={() => { touching.current = false; settleWhenIdle(); }}
    onPointerDown={(event) => {
      tap.current = { y: event.clientY, moved: false };
      target.current = null;
      clearTimeout(timer.current);
    }}
    onPointerMove={(event) => { if (tap.current && Math.abs(event.clientY - tap.current.y) > 5) tap.current.moved = true; }}
    onPointerCancel={() => { if (tap.current) tap.current.moved = true; }}
    onWheel={() => { target.current = null; }}
    onScroll={() => {
      if (frame.current == null) frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        setPosition(current.current.minimumIndex + Math.max(0, ref.current?.scrollTop ?? 0) / ROW_HEIGHT);
      });
      settleWhenIdle();
    }}
    onKeyDown={(event) => {
      let next = target.current == null ? readIndex() : current.current.options.findIndex((option) => option.value === target.current);
      if (event.key === 'ArrowDown') next++;
      else if (event.key === 'ArrowUp') next--;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = options.length - 1;
      else return;
      event.preventDefault();
      scrollToOption(next);
    }}>
    {/* Earlier rows remain visible in the top padding, above the scrollable minimum. */}
    <div className="checkout-wheel-options" style={{ marginTop: -minimumIndex * ROW_HEIGHT }}>
    {options.map((option, offset) => {
      const distance = Math.max(-3, Math.min(3, offset - position));
      const angle = distance * Math.PI / 7;
      const translateY = Math.sin(angle) * ROW_HEIGHT / (Math.PI / 7) - distance * ROW_HEIGHT;
      const fade = Math.min(1, Math.abs(distance));
      // Keep snap targets flat; only the labels curve around the wheel's center.
      return <div key={option.value} id={`${id}-${offset}`} className="checkout-wheel-option" role="option" aria-selected={offset === active} aria-disabled={offset < minimumIndex}
        onClick={(event) => { if (offset >= minimumIndex && (event.detail === 0 || !tap.current?.moved)) scrollToOption(offset); }}>
        <span className="checkout-wheel-label" style={{
          transform: `translateY(${translateY}px) rotateX(${-distance * 180 / 7}deg)`,
          opacity: Math.max(0, 1 - Math.abs(distance) / 3),
          color: `rgb(${Math.round(17 + fade * 110)} ${Math.round(24 + fade * 103)} ${Math.round(39 + fade * 93)})`,
        }}>{option.label}</span>
      </div>;
    })}
    </div>
  </div>;
}
