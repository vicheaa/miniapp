const settleDelay = 140;
const gestureDistance = 8;
const keyboardStartTimeout = 500;

function editableElement(element: Element | null): HTMLElement | null {
  if (!element) return null;
  if (element.tagName === 'INPUT') {
    const input = element as HTMLInputElement;
    return !input.disabled && !input.readOnly && /^(text|search|tel|url|email|password|number)$/.test(input.type) ? input : null;
  }
  if (element.tagName === 'TEXTAREA') {
    const input = element as HTMLTextAreaElement;
    return !input.disabled && !input.readOnly ? input : null;
  }
  return (element as HTMLElement).isContentEditable ? element as HTMLElement : null;
}

export function dismissKeyboard(doc: Document = document) {
  editableElement(doc.activeElement)?.blur();
}

/** DOM controller kept independent of React so resize and gesture races can be tested. */
export function attachKeyboardViewport(win: Window & typeof globalThis = window): () => void {
  const doc = win.document;
  const root = doc.documentElement;
  const viewport = win.visualViewport;
  const userAgent = win.navigator?.userAgent ?? '';
  const isIOS = /iP(?:hone|ad|od)/.test(userAgent) || (/Macintosh/.test(userAgent) && win.navigator.maxTouchPoints > 1);
  const visibleHeight = () => Math.max(1, Math.round(Math.min(win.innerHeight, viewport?.height ?? win.innerHeight)));
  let baseline = visibleHeight();
  let previousHeight = baseline;
  let previousWidth = win.innerWidth;
  let appliedHeight = -1;
  let appliedTop = -1;
  let keyboardOpen = false;
  let hadEditableFocus = Boolean(editableElement(doc.activeElement));
  let frame = 0;
  let settleTimer = 0;
  let recoveryTimer = 0;
  let openingTimer = 0;
  let revealRequested = false;
  let focusReveal = false;
  let disposed = false;
  let focusTouch: { editor: HTMLElement; x: number; y: number; id: number } | null = null;
  let gesture: { x: number; y: number; editor: HTMLElement; scroller: Element | null; tapDismiss: boolean; id: number } | null = null;

  const hideActions = (hidden: boolean) => {
    const value = String(hidden);
    if (root.dataset.keyboardActionsHidden !== value) root.dataset.keyboardActionsHidden = value;
  };
  const clearOpening = () => {
    win.clearTimeout(openingTimer);
    openingTimer = 0;
  };
  const anticipateKeyboard = () => {
    // Remove actions before the first native resize, rather than fading a footer
    // that is already moving upward with the shrinking page. Focus by itself
    // is only provisional: hardware keyboards must not leave actions hidden.
    hideActions(true);
    clearOpening();
    openingTimer = win.setTimeout(() => {
      openingTimer = 0;
      schedule();
    }, keyboardStartTimeout);
  };

  const clearReveal = () => {
    win.clearTimeout(settleTimer);
    settleTimer = 0;
    revealRequested = false;
    focusReveal = false;
  };
  const dismiss = () => {
    clearReveal();
    gesture = null;
    focusTouch = null;
    dismissKeyboard(doc);
  };
  const reveal = () => {
    settleTimer = 0;
    revealRequested = false;
    focusReveal = false;
    const editor = editableElement(doc.activeElement);
    const scroller = editor?.closest<HTMLElement>('[data-keyboard-scroll]');
    if (disposed || !editor || !scroller) return;
    const bounds = scroller.getBoundingClientRect();
    const screenTop = editor.closest('.keyboard-page')?.getBoundingClientRect().top ?? viewport?.offsetTop ?? 0;
    const top = Math.max(bounds.top, screenTop) + 12;
    const bottom = Math.min(bounds.bottom, screenTop + visibleHeight()) - 12;
    if (bottom <= top) return;
    const field = editor.closest('[data-keyboard-field], .checkout-field, label')?.getBoundingClientRect();
    const target = field && field.height <= bottom - top ? field : editor.getBoundingClientRect();
    // Wait for keyboard geometry to settle, then glide only the form scroller.
    const delta = target.top < top ? target.top - top : Math.max(0, target.bottom - bottom);
    if (Math.abs(delta) > 1) scroller.scrollTo({
      top: scroller.scrollTop + delta,
      behavior: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };
  const update = () => {
    frame = 0;
    if (disposed) return;
    const height = visibleHeight();
    const editor = editableElement(doc.activeElement);
    hadEditableFocus ||= Boolean(editor);
    const gap = baseline - height;
    const openThreshold = Math.max(100, baseline * .15);
    // WKWebView can return 34px shorter after dismissal as its bottom safe area
    // settles. That is a closed viewport, rather than another keyboard frame.
    const recoveryTolerance = Math.min(80, openThreshold / 2);
    // Focus alone is not evidence of an on-screen keyboard (hardware keyboards).
    // Keep the state latched through blur and release it on viewport recovery,
    // including Android Back, which may leave the input focused.
    const nextOpen = keyboardOpen ? gap > recoveryTolerance : hadEditableFocus && gap >= openThreshold;
    if (nextOpen) {
      keyboardOpen = true;
      clearOpening();
    }
    else if (keyboardOpen) {
      // WebKit can report a recovered height before its keyboard animation and
      // focus panning finish. Restore the footer only after geometry is stable.
      recoveryTimer = win.setTimeout(() => {
        recoveryTimer = 0;
        keyboardOpen = false;
        baseline = visibleHeight();
        // UIKit can dismiss WKWebView's keyboard without blurring its DOM input.
        // End that editing session before another field is tapped; otherwise iOS
        // can reopen the old field using its stale caret/hit-test position.
        if (isIOS) dismissKeyboard(doc);
        if (root.dataset.keyboardPage === 'true' && (win.scrollY || win.scrollX)) win.scrollTo(0, 0);
        schedule();
      }, settleDelay);
    }
    // A recovered iOS viewport may retain a stale offsetTop. The fixed body
    // isolates the screen from document panning; follow only the visual offset.
    // iOS may shrink innerHeight while keeping offsetTop in layout coordinates;
    // clamping the offset to innerHeight - height clips the header on field switch.
    const top = hadEditableFocus && gap > recoveryTolerance ? Math.max(0, viewport?.offsetTop ?? 0) : 0;
    hideActions(keyboardOpen || Boolean(openingTimer));
    if (!keyboardOpen) baseline = Math.max(baseline, height);
    if (!keyboardOpen && !editor) {
      baseline = height;
      hadEditableFocus = false;
    }
    // Caret/viewport events can keep firing while typing. Identical writes can
    // invalidate WebKit's large composited layer even though nothing moved.
    if (height !== appliedHeight) {
      root.style.setProperty('--keyboard-viewport-height', `${height}px`);
      appliedHeight = height;
    }
    if (top !== appliedTop) {
      root.style.setProperty('--keyboard-viewport-top', `${top}px`);
      root.style.setProperty('--keyboard-page-top', `${top}px`);
      appliedTop = top;
    }
    const keyboardState = String(keyboardOpen);
    if (root.dataset.keyboardOpen !== keyboardState) root.dataset.keyboardOpen = keyboardState;
    if (keyboardOpen && editor && height < previousHeight) revealRequested = true;
    if (height > previousHeight && !focusReveal) revealRequested = false;
    previousHeight = height;
    if (revealRequested) settleTimer = win.setTimeout(reveal, settleDelay);
  };
  const schedule = () => {
    win.clearTimeout(settleTimer);
    settleTimer = 0;
    win.clearTimeout(recoveryTimer);
    recoveryTimer = 0;
    if (!frame) frame = win.requestAnimationFrame(update);
  };
  const resetOrientation = () => {
    dismiss();
    clearOpening();
    baseline = visibleHeight();
    previousHeight = baseline;
    previousWidth = win.innerWidth;
    hadEditableFocus = false;
    keyboardOpen = false;
    schedule();
  };
  const resize = () => {
    // Keyboard resizing changes height; rotation / window resizing changes width.
    if (Math.abs(win.innerWidth - previousWidth) > 80) resetOrientation();
    else schedule();
  };
  const focusIn = () => {
    if (editableElement(doc.activeElement)) {
      anticipateKeyboard();
      hadEditableFocus = true;
      revealRequested = true;
      focusReveal = true;
    }
    schedule();
  };
  const focusOut = () => { clearReveal(); schedule(); };
  const elementTarget = (target: EventTarget | null) => target instanceof win.Element ? target : null;
  const exempt = (target: Element) => target.closest('[data-keyboard-gesture-exempt]');
  const beginGesture = (target: EventTarget | null, x: number, y: number, id: number) => {
    gesture = null;
    const editor = editableElement(doc.activeElement);
    const element = elementTarget(target);
    if (!editor || !element || exempt(element) || element.closest('input, textarea, select, label, [contenteditable], [data-keep-keyboard]')) return;
    gesture = { x, y, editor, id, scroller: element.closest('[data-keyboard-scroll]'), tapDismiss: !element.closest('button, a, [role="button"]') };
  };
  const moveGesture = (x: number, y: number) => {
    if (!gesture) return;
    const dx = Math.abs(x - gesture.x);
    const dy = Math.abs(y - gesture.y);
    if (Math.max(dx, dy) < gestureDistance) return;
    if (dy > dx && gesture.scroller && doc.activeElement === gesture.editor) dismiss();
    // A horizontal category swipe must never become an outside tap.
    gesture = null;
  };
  const endGesture = () => {
    if (gesture?.tapDismiss && doc.activeElement === gesture.editor) dismiss();
    gesture = null;
  };
  const cancelGesture = () => { gesture = null; focusTouch = null; };
  const pointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' && event.isPrimary && event.button === 0) beginGesture(event.target, event.clientX, event.clientY, event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' && gesture?.id === event.pointerId) moveGesture(event.clientX, event.clientY);
  };
  const pointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' && gesture?.id === event.pointerId) {
      moveGesture(event.clientX, event.clientY);
      endGesture();
    }
  };
  // Pointer events are cancelled as soon as native touch scrolling takes over.
  // Passive touch listeners continue observing the gesture without blocking it.
  const touchStart = (event: TouchEvent) => {
    focusTouch = null;
    if (event.touches.length !== 1) { cancelGesture(); return; }
    const touch = event.touches[0];
    const target = elementTarget(event.target);
    const editor = editableElement(target) ?? editableElement((target?.closest('label') as HTMLLabelElement | null)?.control ?? null);
    if (isIOS && editor && editor !== doc.activeElement && editor.closest('.keyboard-page') && !exempt(editor)) {
      focusTouch = { editor, x: touch.clientX, y: touch.clientY, id: touch.identifier };
    }
    beginGesture(event.target, touch.clientX, touch.clientY, touch.identifier);
  };
  const touchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1) { cancelGesture(); return; }
    const touch = event.touches[0];
    if (focusTouch && (focusTouch.id !== touch.identifier || Math.max(Math.abs(touch.clientX - focusTouch.x), Math.abs(touch.clientY - focusTouch.y)) >= gestureDistance)) focusTouch = null;
    if (gesture?.id === touch.identifier) moveGesture(touch.clientX, touch.clientY);
  };
  const touchEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    const candidate = focusTouch;
    focusTouch = null;
    const target = elementTarget(event.target);
    const tappedEditor = editableElement(target) ?? editableElement((target?.closest('label') as HTMLLabelElement | null)?.control ?? null);
    // Android Back can leave a field focused. Tapping it opens another keyboard
    // without focusin, so protect the first resize of that cycle as well.
    if (tappedEditor && tappedEditor === doc.activeElement && !keyboardOpen) anticipateKeyboard();
    if (candidate && editableElement(candidate.editor) && touch?.identifier === candidate.id && event.cancelable && Math.max(Math.abs(touch.clientX - candidate.x), Math.abs(touch.clientY - candidate.y)) < gestureDistance) {
      // Native iOS tap focus pans the entire WKWebView before visualViewport
      // reports that movement. Focus inside the trusted gesture instead, with
      // scrolling disabled, then let the settled field reveal move only its form.
      // Already-focused fields keep native caret placement and selection gestures.
      event.preventDefault();
      candidate.editor.focus({ preventScroll: true });
    }
    if (touch && gesture?.id === touch.identifier) {
      moveGesture(touch.clientX, touch.clientY);
      endGesture();
    }
  };
  const wheel = (event: WheelEvent) => {
    const target = elementTarget(event.target);
    if (target && !exempt(target) && !target.closest('input, textarea, select, [contenteditable], [data-keep-keyboard]') && target.closest('[data-keyboard-scroll]') && Math.abs(event.deltaY) > Math.abs(event.deltaX)) dismiss();
  };

  const removeListeners: (() => void)[] = [];
  const listen = (target: EventTarget | null | undefined, type: string, listener: EventListener, options?: AddEventListenerOptions) => {
    target?.addEventListener(type, listener, options);
    removeListeners.push(() => target?.removeEventListener(type, listener, options));
  };
  const passiveCapture = { capture: true, passive: true };
  listen(win, 'resize', resize);
  listen(win, 'scroll', schedule, { passive: true });
  listen(win, 'orientationchange', resetOrientation);
  listen(viewport, 'resize', schedule);
  listen(viewport, 'scroll', schedule);
  listen(doc, 'focusin', focusIn);
  listen(doc, 'focusout', focusOut);
  listen(doc, 'pointerdown', pointerDown as EventListener, passiveCapture);
  listen(doc, 'pointermove', pointerMove as EventListener, passiveCapture);
  listen(doc, 'pointerup', pointerUp as EventListener, passiveCapture);
  listen(doc, 'pointercancel', cancelGesture, passiveCapture);
  listen(doc, 'touchstart', touchStart as EventListener, passiveCapture);
  listen(doc, 'touchmove', touchMove as EventListener, passiveCapture);
  listen(doc, 'touchend', touchEnd as EventListener, { capture: true, passive: !isIOS });
  listen(doc, 'touchcancel', cancelGesture, passiveCapture);
  listen(doc, 'wheel', wheel as EventListener, passiveCapture);
  listen(win, 'hashchange', dismiss);
  listen(win, 'popstate', dismiss);
  update();
  return () => {
    disposed = true;
    win.cancelAnimationFrame(frame);
    clearReveal();
    win.clearTimeout(recoveryTimer);
    clearOpening();
    gesture = null;
    focusTouch = null;
    removeListeners.forEach((remove) => remove());
    root.style.removeProperty('--keyboard-viewport-height');
    root.style.removeProperty('--keyboard-viewport-top');
    root.style.removeProperty('--keyboard-page-top');
    delete root.dataset.keyboardOpen;
    delete root.dataset.keyboardActionsHidden;
  };
}
