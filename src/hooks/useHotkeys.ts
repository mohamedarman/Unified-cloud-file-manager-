import { useEffect } from 'react';

export interface HotkeyDefinition {
  combo: string; // e.g. 'meta+k', 'ctrl+k', '?', 't', 'm', '1', '2'
  handler: (e: KeyboardEvent) => void;
  allowInInputs?: boolean;
  preventDefault?: boolean;
}

/**
 * Enterprise Hotkey Registry Hook
 * Safely registers, intercepts, and cleans up keyboard shortcuts
 * with automatic input element suppression and Mac/Windows metaKey normalization.
 */
export function useHotkeys(definitions: HotkeyDefinition[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.getAttribute('contenteditable') === 'true';

      const key = e.key.toLowerCase();
      const isMeta = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      for (const def of definitions) {
        if (isInput && !def.allowInInputs) {
          continue;
        }

        const comboParts = def.combo.toLowerCase().split('+');
        const expectsMeta = comboParts.includes('meta') || comboParts.includes('ctrl') || comboParts.includes('cmd');
        const expectsShift = comboParts.includes('shift');
        const expectsAlt = comboParts.includes('alt');
        const targetKey = comboParts[comboParts.length - 1];

        const metaMatch = expectsMeta ? isMeta : !isMeta;
        const shiftMatch = expectsShift ? isShift : true;
        const altMatch = expectsAlt ? isAlt : !isAlt;
        const keyMatch =
          targetKey === key ||
          (targetKey === '?' && e.key === '?') ||
          (targetKey === 'space' && (e.key === ' ' || e.code === 'Space'));

        if (metaMatch && shiftMatch && altMatch && keyMatch) {
          if (def.preventDefault !== false) {
            e.preventDefault();
          }
          def.handler(e);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [definitions]);
}
