import { createContext, useContext, useState, type ReactNode } from 'react';
import { Link, useNavigate, type LinkProps, type To } from 'react-router-dom';
import { createNavigationGuard } from '../services/bridge/navigation';
import { useMiniAppStore } from '../store/miniAppStore';
import { dismissKeyboard } from '../utils/keyboardViewport';

interface NavigationActions {
  navigateTo: (to: To | number, replace?: boolean, state?: unknown) => void;
  exitMiniApp: () => void;
  isClosing: boolean;
  closeError: string | null;
}

const NavigationContext = createContext<NavigationActions | null>(null);

export function MiniAppNavigationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const bridge = useMiniAppStore((state) => state.superApp);
  const [guard] = useState(() => createNavigationGuard());
  const [isClosing, setIsClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const navigateTo = (to: To | number, replace = false, state?: unknown) => {
    guard.run(() => {
      dismissKeyboard();
      if (typeof to === 'number') void navigate(to); else void navigate(to, { replace, state });
    });
  };

  const exitMiniApp = () => {
    if (!bridge) return;
    try {
      guard.run(() => {
        dismissKeyboard();
        bridge.close();
        setCloseError(null);
        setIsClosing(true);
      }, true);
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <NavigationContext.Provider value={{ navigateTo, exitMiniApp, isClosing, closeError }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useMiniAppNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error('Mini-app navigation requires MiniAppNavigationProvider.');
  return navigation;
}

export function NavigationLink({ to, replace, state, onClick, target, ...props }: LinkProps) {
  const { navigateTo, isClosing } = useMiniAppNavigation();
  return (
    <Link {...props} to={to} replace={replace} state={state} target={target} aria-disabled={isClosing || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey || (target && target !== '_self')) return;
        event.preventDefault();
        navigateTo(to, replace, state);
      }} />
  );
}
