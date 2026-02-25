import { useRef, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Adds drag-to-dismiss to a bottom sheet.
 * Attach `handleProps` to the drag-handle element and pass `sheetRef` to the sheet panel.
 */
export function useSheetDrag(
  sheetRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  const startY = useRef(0);
  const currentY = useRef(0);
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    currentY.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !sheetRef.current) return;
    const dy = Math.max(0, e.clientY - startY.current); // only allow downward drag
    currentY.current = dy;
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  }, [sheetRef]);

  const onPointerUp = useCallback(() => {
    if (!dragging.current || !sheetRef.current) return;
    dragging.current = false;

    if (currentY.current > 100) {
      // Dragged far enough — dismiss
      gsap.to(sheetRef.current, {
        y: '100%',
        duration: 0.25,
        ease: 'power2.in',
        onComplete: onClose,
      });
    } else {
      // Snap back
      gsap.to(sheetRef.current, {
        y: 0,
        duration: 0.25,
        ease: 'power2.out',
      });
    }
  }, [sheetRef, onClose]);

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    style: { touchAction: 'none' as const, cursor: 'grab' },
  };

  return { handleProps };
}
