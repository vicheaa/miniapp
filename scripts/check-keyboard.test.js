import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachKeyboardViewport, dismissKeyboard } from '../src/utils/keyboardViewport.ts';

// Small DOM/clock fixture: exercises the real controller without browser timers
// or assumptions about an OS keyboard in a desktop test runner.
function fixture({ visualViewport = true, ios = false, reducedMotion = false } = {}) {
  class Target extends EventTarget {
    listeners = new Set();
    addEventListener(type, fn, options) { super.addEventListener(type, fn, options); this.listeners.add(fn); }
    removeEventListener(type, fn, options) { super.removeEventListener(type, fn, options); this.listeners.delete(fn); }
  }
  const doc = new Target();
  class Element extends Target {
    tagName;
    parentElement = null;
    dataset = {};
    attributes = {};
    className = '';
    type = 'text';
    value = '';
    disabled = false;
    readOnly = false;
    isContentEditable = false;
    bounds = { top: 0, bottom: 0, height: 0 };
    scrollTop = 0;
    blurCount = 0;
    styles = new Map();
    styleWrites = 0;
    scrollRequests = [];
    style = { setProperty: (key, value) => { this.styleWrites++; this.styles.set(key, value); }, removeProperty: (key) => this.styles.delete(key) };
    scrollTo(options) { this.scrollRequests.push(options); this.scrollTop = options.top; }
    constructor(tag = 'div', parent = null, attributes = {}) {
      super();
      this.tagName = tag.toUpperCase();
      this.parentElement = parent;
      this.attributes = attributes;
    }
    closest(selectors) {
      for (let node = this; node; node = node.parentElement) {
        if (selectors.split(',').some((selector) => {
          selector = selector.trim();
          if (selector.startsWith('.')) return node.className.split(' ').includes(selector.slice(1));
          if (selector.startsWith('[')) {
            const [, name, value] = selector.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);
            return name in node.attributes && (value === undefined || node.attributes[name] === value);
          }
          return node.tagName === selector.toUpperCase();
        })) return node;
      }
      return null;
    }
    getBoundingClientRect() {
      let offset = 0;
      for (let node = this.parentElement; node; node = node.parentElement) offset += node.scrollTop;
      return { ...this.bounds, top: this.bounds.top - offset, bottom: this.bounds.bottom - offset };
    }
    focus(options) {
      this.focusOptions = options;
      if (doc.activeElement === this) return;
      doc.activeElement?.blur();
      doc.activeElement = this;
      emit(doc, 'focusin', { target: this });
    }
    blur() {
      if (doc.activeElement !== this) return;
      this.blurCount++;
      doc.activeElement = doc.body;
      emit(doc, 'focusout', { target: this });
    }
  }
  doc.documentElement = new Element('html');
  doc.body = new Element('body', doc.documentElement);
  doc.activeElement = doc.body;
  let now = 0;
  let id = 0;
  const frames = new Map();
  const timers = new Map();
  const win = new Target();
  Object.assign(win, {
    document: doc, Element, innerHeight: 800, innerWidth: 393, scrollX: 0, scrollY: 0,
    navigator: { userAgent: ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)' : 'Android', maxTouchPoints: ios ? 5 : 1 },
    matchMedia: () => ({ matches: reducedMotion }),
    scrollTo: (x, y) => { win.scrollX = x; win.scrollY = y; },
    requestAnimationFrame: (fn) => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: (key) => frames.delete(key),
    setTimeout: (fn, delay) => { timers.set(++id, { fn, time: now + delay }); return id; },
    clearTimeout: (key) => timers.delete(key),
  });
  if (visualViewport) win.visualViewport = Object.assign(new Target(), { height: 800, offsetTop: 0 });
  const scroller = new Element('div', doc.body, { 'data-keyboard-scroll': '' });
  scroller.bounds = { top: 80, bottom: 700, height: 620 };
  const field = new Element('div', scroller, { 'data-keyboard-field': '' });
  field.bounds = { top: 550, bottom: 640, height: 90 };
  const input = new Element('input', field);
  input.bounds = { top: 580, bottom: 630, height: 50 };
  input.value = 'Sok Dara';
  const flush = () => {
    const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn());
  };
  const advance = (ms = 140) => {
    now += ms;
    for (const [key, timer] of timers) if (timer.time <= now) { timers.delete(key); timer.fn(); }
  };
  const resize = (height, { native = false, top = 0 } = {}) => {
    if (native || !win.visualViewport) win.innerHeight = height;
    if (win.visualViewport) Object.assign(win.visualViewport, { height, offsetTop: top });
    scroller.bounds = { top: top + 80, bottom: top + height, height: height - 80 };
    emit(win, 'resize');
    if (win.visualViewport) emit(win.visualViewport, 'resize');
  };
  const open = () => { input.focus(); resize(400); flush(); advance(); };
  const dispose = attachKeyboardViewport(win);
  return { win, doc, root: doc.documentElement, Element, input, field, scroller, frames, timers, flush, advance, resize, open, dispose };
}

function emit(target, name, values = {}) {
  const event = new Event(name, { cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}

function touch(f, name, target, x = 100, y = 200, count = 1) {
  const point = { clientX: x, clientY: y, identifier: 1 };
  return emit(f.doc, name, { target, touches: name === 'touchend' ? [] : Array(count).fill(point), changedTouches: [point] });
}

test('keyboard: iOS taps focus without native document scrolling and field switches remain continuous', () => {
  const f = fixture({ ios: true });
  f.doc.body.className = 'keyboard-page';
  touch(f, 'touchstart', f.input);
  const first = touch(f, 'touchend', f.input);
  assert.equal(first.defaultPrevented, true);
  assert.equal(f.doc.activeElement, f.input);
  assert.deepEqual(f.input.focusOptions, { preventScroll: true });
  f.resize(400); f.flush(); f.advance();
  const next = new f.Element('input', f.scroller);
  next.type = 'tel';
  touch(f, 'touchstart', next); touch(f, 'touchend', next);
  f.flush();
  assert.equal(f.doc.activeElement, next);
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  assert.equal(f.input.value, 'Sok Dara');
  f.dispose();
});

test('keyboard: iOS focus interception preserves selection and cancels dragged or interrupted taps', () => {
  const f = fixture({ ios: true });
  f.doc.body.className = 'keyboard-page';
  for (const cancel of ['move', 'cancel', 'multitouch']) {
    touch(f, 'touchstart', f.input);
    if (cancel === 'move') touch(f, 'touchmove', f.input, 100, 240);
    if (cancel === 'cancel') emit(f.doc, 'touchcancel');
    if (cancel === 'multitouch') touch(f, 'touchstart', f.input, 100, 200, 2);
    assert.equal(touch(f, 'touchend', f.input).defaultPrevented, false);
    assert.equal(f.doc.activeElement, f.doc.body);
  }
  f.input.focus();
  touch(f, 'touchstart', f.input);
  assert.equal(touch(f, 'touchend', f.input).defaultPrevented, false, 'focused fields keep native caret gestures');
  f.dispose();
});

test('keyboard: focus interception is limited to editable iOS page fields', () => {
  for (const options of [{}, { ios: true }]) {
    const f = fixture(options);
    if (!options.ios) f.doc.body.className = 'keyboard-page';
    touch(f, 'touchstart', f.input);
    assert.equal(touch(f, 'touchend', f.input).defaultPrevented, false);
    assert.equal(f.doc.activeElement, f.doc.body);
    f.dispose();
  }
  const f = fixture({ ios: true }); f.doc.body.className = 'keyboard-page';
  f.input.readOnly = true;
  touch(f, 'touchstart', f.input);
  assert.equal(touch(f, 'touchend', f.input).defaultPrevented, false);
  f.dispose();
});

test('keyboard: iOS label taps focus their field; navigation and disabled fields cancel pending focus', () => {
  const f = fixture({ ios: true }); f.doc.body.className = 'keyboard-page';
  const label = new f.Element('label', f.field);
  label.control = f.input;
  touch(f, 'touchstart', label);
  assert.equal(touch(f, 'touchend', label).defaultPrevented, true);
  assert.equal(f.doc.activeElement, f.input);
  f.input.blur();
  touch(f, 'touchstart', f.input);
  emit(f.win, 'hashchange');
  assert.equal(touch(f, 'touchend', f.input).defaultPrevented, false);
  assert.equal(f.doc.activeElement, f.doc.body);
  touch(f, 'touchstart', f.input); f.input.disabled = true;
  assert.equal(touch(f, 'touchend', f.input).defaultPrevented, false);
  assert.equal(f.doc.activeElement, f.doc.body);
  f.dispose();
});

test('keyboard: focus alone and small viewport changes do not report an open keyboard', () => {
  const f = fixture();
  f.input.focus(); f.resize(760); f.flush(); f.advance();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  assert.equal(f.doc.activeElement, f.input);
  f.dispose();
});

test('keyboard: bottom actions hide synchronously before the first keyboard resize', () => {
  for (const native of [false, true]) {
    const f = fixture();
    f.input.focus();
    assert.equal(f.root.dataset.keyboardActionsHidden, 'true', 'hide before animation frames or viewport events');
    assert.equal(f.root.dataset.keyboardOpen, 'false', 'provisional hiding must not report a software keyboard');
    for (const height of [790, 760, 720, 650, 400]) {
      f.resize(height, { native }); f.flush();
      assert.equal(f.root.dataset.keyboardActionsHidden, 'true', 'early resize frames must not lift a visible footer');
    }
    f.input.blur(); f.flush();
    assert.equal(f.root.dataset.keyboardActionsHidden, 'true');
    f.resize(800, { native }); f.flush(); f.advance(139);
    assert.equal(f.root.dataset.keyboardActionsHidden, 'true');
    f.advance(1); f.flush();
    assert.equal(f.root.dataset.keyboardActionsHidden, 'false', 'restore after stable recovery');
    f.dispose();
  }
});

test('keyboard: hardware focus releases provisional action hiding without losing text', () => {
  const f = fixture();
  f.input.focus(); f.resize(760); f.flush(); f.advance(499); f.flush();
  assert.equal(f.root.dataset.keyboardActionsHidden, 'true');
  f.advance(1); f.flush();
  assert.equal(f.root.dataset.keyboardActionsHidden, 'false');
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  assert.equal(f.doc.activeElement, f.input);
  assert.equal(f.input.value, 'Sok Dara');
  f.dispose();
});

test('keyboard: Android refocusing after Back hides actions before a resize without another focus event', () => {
  const f = fixture(); f.open();
  f.resize(800); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardActionsHidden, 'false');
  assert.equal(f.doc.activeElement, f.input);
  touch(f, 'touchstart', f.input); touch(f, 'touchend', f.input);
  assert.equal(f.root.dataset.keyboardActionsHidden, 'true');
  f.resize(780); f.flush();
  assert.equal(f.root.dataset.keyboardActionsHidden, 'true');
  f.resize(400); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.dispose();
});

test('keyboard: resize bursts update once per frame and reveal once after settling', () => {
  const f = fixture();
  f.input.focus();
  for (const height of [760, 650, 510, 400]) f.resize(height);
  assert.equal(f.frames.size, 1);
  f.flush(); f.advance(139);
  assert.equal(f.root.styles.get('--keyboard-viewport-height'), '400px');
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  assert.equal(f.scroller.scrollTop, 0);
  f.advance(1);
  assert.equal(f.scroller.scrollTop, 252); // Include the field's label, with a 12px margin.
  f.advance(1000);
  assert.equal(f.scroller.scrollTop, 252);
  assert.equal(f.doc.activeElement, f.input, 'automatic scrolling must not dismiss editing');
  assert.equal(f.input.value, 'Sok Dara');
  f.dispose();
});

test('keyboard: native resizing and visual resizing never subtract the keyboard twice', () => {
  const f = fixture();
  f.input.focus(); f.resize(400, { native: true }); f.flush(); f.advance();
  assert.equal(f.root.styles.get('--keyboard-viewport-height'), '400px');
  assert.equal(f.root.styles.get('--keyboard-viewport-top'), '0px');
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.dispose();
});

test('keyboard: stationary caret/viewport events do not rewrite the page layer or move the form', () => {
  const f = fixture({ ios: true }); f.open();
  const writes = f.root.styleWrites;
  const scrolls = f.scroller.scrollRequests.length;
  for (let i = 0; i < 10; i++) {
    emit(f.win.visualViewport, 'scroll');
    emit(f.win.visualViewport, 'resize');
    f.flush(); f.advance();
  }
  assert.equal(f.root.styleWrites, writes);
  assert.equal(f.scroller.scrollRequests.length, scrolls);
  assert.equal(f.doc.activeElement, f.input);
  f.dispose();
});

test('keyboard: field reveal glides after settling and respects reduced motion', () => {
  for (const reducedMotion of [false, true]) {
    const f = fixture({ reducedMotion });
    f.input.focus(); f.resize(400); f.flush();
    assert.equal(f.scroller.scrollRequests.length, 0);
    f.advance();
    assert.deepEqual(f.scroller.scrollRequests, [{ top: 252, behavior: reducedMotion ? 'auto' : 'smooth' }]);
    f.dispose();
  }
});

test('keyboard: follows visual viewport panning without scrolling the document', () => {
  const f = fixture();
  f.input.focus(); f.resize(400, { top: 60 }); f.flush(); f.advance();
  assert.equal(f.root.styles.get('--keyboard-viewport-top'), '60px');
  assert.equal(f.scroller.scrollTop, 192);
  assert.equal(f.doc.body.scrollTop, 0);
  f.dispose();
});

test('keyboard: Android Back restores actions even when the input retains focus', () => {
  const f = fixture(); f.open();
  const scroll = f.scroller.scrollTop;
  f.resize(800); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  assert.equal(f.doc.activeElement, f.input);
  assert.equal(f.scroller.scrollTop, scroll);
  f.resize(400); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.dispose();
});

test('keyboard: blur keeps actions hidden until viewport recovery', () => {
  const f = fixture(); f.open();
  dismissKeyboard(f.doc); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.resize(650); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.resize(800); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  assert.equal(f.scroller.scrollTop, 252);
  f.dispose();
});

test('keyboard: iOS restores actions only after the recovered viewport settles', () => {
  const f = fixture(); f.open();
  f.resize(800); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.advance(139); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.advance(1); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  assert.equal(f.doc.activeElement, f.input);
  f.dispose();
});

test('keyboard: transient iOS recovery while switching keyboards cannot flash actions', () => {
  const f = fixture(); f.open();
  f.resize(800); f.flush(); f.advance(70);
  f.resize(450); f.flush(); f.advance(140); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  assert.equal(f.root.styles.get('--keyboard-viewport-height'), '450px');
  f.dispose();
});

test('keyboard: iOS stale close offsets recover without resetting form scrolling', () => {
  const f = fixture(); f.open();
  f.root.dataset.keyboardPage = 'true';
  const scroll = f.scroller.scrollTop;
  f.win.scrollY = 84;
  f.win.innerHeight = 900;
  f.resize(800, { top: 24 }); f.flush();
  assert.equal(f.root.styles.get('--keyboard-page-top'), '0px');
  f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  assert.equal(f.root.styles.get('--keyboard-page-top'), '0px');
  assert.equal(f.win.scrollY, 0);
  assert.equal(f.scroller.scrollTop, scroll);
  assert.equal(f.input.value, 'Sok Dara');
  f.dispose();
});

test('keyboard: iOS document panning cannot feed back into the screen position', () => {
  const f = fixture(); f.input.focus();
  f.win.scrollY = 40;
  f.resize(400, { top: 60 }); f.flush();
  assert.equal(f.root.styles.get('--keyboard-page-top'), '60px');
  f.win.scrollY = 70;
  emit(f.win, 'scroll'); f.flush();
  assert.equal(f.root.styles.get('--keyboard-page-top'), '60px');
  f.dispose();
});

test('keyboard: an iOS 34px safe-area change is closed and becomes the next baseline', () => {
  const f = fixture(); f.open();
  f.resize(766); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  f.resize(400); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.resize(766); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  f.dispose();
});

test('keyboard: native iOS dismissal clears a stale DOM editing session before the next tap', () => {
  const f = fixture({ ios: true }); f.open();
  f.resize(766); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  assert.equal(f.doc.activeElement, f.doc.body);
  assert.equal(f.input.value, 'Sok Dara');
  const next = new f.Element('input', f.scroller);
  next.focus(); f.resize(400); f.flush(); f.advance();
  assert.equal(f.doc.activeElement, next);
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.dispose();
});

test('keyboard: iOS visual offsets can exceed innerHeight minus the visible height', () => {
  const f = fixture({ ios: true }); f.input.focus();
  f.win.innerHeight = 430;
  f.resize(388, { top: 300 }); f.flush();
  assert.equal(f.root.styles.get('--keyboard-page-top'), '300px');
  assert.equal(f.root.styles.get('--keyboard-viewport-height'), '388px');
  f.dispose();
});

test('keyboard: field reveal uses the compensated screen rather than the stale iOS layout offset', () => {
  const f = fixture({ ios: true }); f.input.focus();
  f.doc.body.className = 'keyboard-page';
  f.doc.body.bounds = { top: 0, bottom: 388, height: 388 };
  f.win.innerHeight = 430;
  f.resize(388, { top: 300 });
  f.scroller.bounds = { top: 80, bottom: 388, height: 308 };
  f.flush(); f.advance();
  assert.equal(f.scroller.scrollTop, 264);
  assert.ok(f.field.getBoundingClientRect().top >= 92);
  assert.ok(f.input.getBoundingClientRect().bottom <= 376);
  assert.equal(f.doc.activeElement, f.input);
  f.dispose();
});

test('keyboard: a recovered focused viewport can grow when browser chrome retracts', () => {
  const f = fixture(); f.open();
  f.win.innerHeight = 900; f.resize(900); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  f.resize(450); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.resize(810); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true', 'actions must wait for the new baseline');
  f.resize(900); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  f.dispose();
});

test('keyboard: switching fields reveals the new field without an intermediate close', () => {
  const f = fixture(); f.open();
  const phone = new f.Element('input', f.scroller);
  phone.type = 'tel'; phone.bounds = { top: 200, bottom: 250, height: 50 };
  phone.focus(); f.flush(); f.advance();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  assert.equal(f.doc.activeElement, phone);
  assert.ok(phone.getBoundingClientRect().top >= 92);
  f.dispose();
});

test('keyboard: scrolling dismisses only after a deliberate vertical gesture', () => {
  const f = fixture(); f.open();
  touch(f, 'touchstart', f.scroller);
  touch(f, 'touchmove', f.scroller, 101, 204);
  assert.equal(f.doc.activeElement, f.input);
  touch(f, 'touchmove', f.scroller, 101, 220);
  assert.equal(f.doc.activeElement, f.doc.body);
  assert.equal(f.input.blurCount, 1);
  assert.equal(f.input.value, 'Sok Dara');
  f.dispose();
});

test('keyboard: horizontal swipes, selection, clear controls, and map gestures preserve editing', () => {
  const f = fixture(); f.open();
  const clear = new f.Element('button', f.field, { 'data-keep-keyboard': '' });
  const map = new f.Element('div', f.scroller, { 'data-keyboard-gesture-exempt': '' });
  const categories = new f.Element('div', f.doc.body);
  for (const target of [f.input, clear, map]) {
    touch(f, 'touchstart', target); touch(f, 'touchmove', target, 100, 240); touch(f, 'touchend', target, 100, 240);
    assert.equal(f.doc.activeElement, f.input);
  }
  touch(f, 'touchstart', categories); touch(f, 'touchmove', categories, 140, 202); touch(f, 'touchend', categories, 140, 202);
  assert.equal(f.doc.activeElement, f.input);
  touch(f, 'touchstart', f.scroller, 100, 200, 2);
  touch(f, 'touchend', f.scroller);
  assert.equal(f.doc.activeElement, f.input);
  f.dispose();
});

test('keyboard: background taps dismiss; touch cancellation does not become a tap', () => {
  const f = fixture(); f.open();
  touch(f, 'touchstart', f.scroller); emit(f.doc, 'touchcancel'); touch(f, 'touchend', f.scroller);
  assert.equal(f.doc.activeElement, f.input);
  touch(f, 'touchstart', f.scroller); touch(f, 'touchend', f.scroller);
  assert.equal(f.doc.activeElement, f.doc.body);
  f.dispose();
});

test('keyboard: wheel gestures dismiss only over the marked content', () => {
  const f = fixture(); f.open();
  emit(f.doc, 'wheel', { target: f.scroller, deltaX: 30, deltaY: 1 });
  assert.equal(f.doc.activeElement, f.input);
  emit(f.doc, 'wheel', { target: f.scroller, deltaX: 1, deltaY: 30 });
  assert.equal(f.doc.activeElement, f.doc.body);
  f.dispose();
});

test('keyboard: mouse taps dismiss on release, without treating a drag as a tap', () => {
  const f = fixture(); f.open();
  const pointer = (name, x = 100, y = 200) => emit(f.doc, name, { target: f.scroller, pointerType: 'mouse', isPrimary: true, button: 0, pointerId: 1, clientX: x, clientY: y });
  pointer('pointerdown');
  assert.equal(f.doc.activeElement, f.input);
  pointer('pointermove', 140, 202); pointer('pointerup', 140, 202);
  assert.equal(f.doc.activeElement, f.input);
  pointer('pointerdown'); pointer('pointerup');
  assert.equal(f.doc.activeElement, f.doc.body);
  f.dispose();
});

test('keyboard: read-only clipboard fields do not count as keyboard editing', () => {
  const f = fixture();
  f.input.readOnly = true;
  f.input.focus(); f.resize(400); f.flush(); f.advance();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  dismissKeyboard(f.doc);
  assert.equal(f.doc.activeElement, f.input);
  f.dispose();
});

test('keyboard: missing visualViewport falls back to native window dimensions', () => {
  const f = fixture({ visualViewport: false }); f.open();
  assert.equal(f.root.styles.get('--keyboard-viewport-height'), '400px');
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.resize(800); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  f.dispose();
});

test('keyboard: rotation resets the baseline and subsequent keyboard openings still work', () => {
  const f = fixture(); f.open();
  f.win.innerWidth = 800; f.resize(360, { native: true }); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  assert.equal(f.doc.activeElement, f.doc.body);
  f.input.focus(); f.resize(200, { native: true }); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.dispose();
});

test('keyboard: route changes commit editing and cancel pending field scrolling', () => {
  const f = fixture(); f.input.focus(); f.resize(400); f.flush();
  emit(f.win, 'hashchange'); f.flush(); f.advance();
  assert.equal(f.doc.activeElement, f.doc.body);
  assert.equal(f.scroller.scrollTop, 0);
  assert.equal(f.root.dataset.keyboardOpen, 'true');
  f.resize(800); f.flush(); f.advance(); f.flush();
  assert.equal(f.root.dataset.keyboardOpen, 'false');
  f.dispose();
});

test('keyboard: cleanup removes listeners, CSS state, pending frames, and timers', () => {
  const f = fixture(); f.input.focus(); f.resize(400); f.flush();
  emit(f.win, 'resize');
  f.dispose(); f.flush(); f.advance();
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
  for (const target of [f.win, f.doc, f.win.visualViewport]) assert.equal(target.listeners.size, 0);
  assert.equal(f.root.styles.size, 0);
  assert.equal(f.root.dataset.keyboardOpen, undefined);
  assert.equal(f.root.dataset.keyboardActionsHidden, undefined);
  const dispose = attachKeyboardViewport(f.win);
  assert.equal(f.root.styles.get('--keyboard-viewport-height'), '400px');
  dispose();
});
