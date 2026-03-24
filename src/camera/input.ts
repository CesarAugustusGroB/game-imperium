import type { Camera } from './camera';

export function setupInput(canvas: HTMLCanvasElement, camera: Camera): void {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  camera.setAspect(canvas.width, canvas.height);

  // Pan via mouse drag
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 || e.button === 2) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = -(e.clientX - lastX) / canvas.width;
    const dy = (e.clientY - lastY) / canvas.height;
    camera.pan(dx * 2, dy * 2);
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Zoom via scroll wheel
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    camera.zoomAt(factor, e.clientX, e.clientY, canvas.width, canvas.height);
  }, { passive: false });

  // Prevent context menu
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Handle resize
  const observer = new ResizeObserver(() => {
    camera.setAspect(canvas.width, canvas.height);
  });
  observer.observe(canvas);

  // Touch support
  let lastTouchDist = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const dx = -(e.touches[0].clientX - lastTouchX) / canvas.width;
      const dy = (e.touches[0].clientY - lastTouchY) / canvas.height;
      camera.pan(dx * 2, dy * 2);
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastTouchDist > 0) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        camera.zoomAt(dist / lastTouchDist, midX, midY, canvas.width, canvas.height);
      }
      lastTouchDist = dist;
    }
  }, { passive: false });
}
