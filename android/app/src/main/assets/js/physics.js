// Interactive 3D Liquid Lens Physics, Specular Highlight Light Tracking & Tilt Engine
// Highly optimized using requestAnimationFrame and direct CSS variable injection.

export function initPhysics() {
  let activeCard = null;
  let rafId = null;
  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;

  function update() {
    if (activeCard) {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      activeCard.style.setProperty('--mouse-x', `${currentX}px`);
      activeCard.style.setProperty('--mouse-y', `${currentY}px`);

      const rect = activeCard.getBoundingClientRect();
      const normX = (currentX / rect.width - 0.5) * 2; // -1 to 1
      const normY = (currentY / rect.height - 0.5) * 2;
      const tiltX = -normY * 4.5; // Max 4.5deg tilt
      const tiltY = normX * 4.5;
      activeCard.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
      activeCard.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
    }
    rafId = requestAnimationFrame(update);
  }

  // Pointer move tracking for desktop and tablet
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card, .topbar, .theme-card, .fab');
    if (card) {
      if (activeCard && activeCard !== card) {
        activeCard.style.removeProperty('--tilt-x');
        activeCard.style.removeProperty('--tilt-y');
      }
      activeCard = card;
      const rect = card.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      if (!rafId) rafId = requestAnimationFrame(update);
    } else if (activeCard) {
      activeCard.style.removeProperty('--tilt-x');
      activeCard.style.removeProperty('--tilt-y');
      activeCard = null;
    }
  }, { passive: true });

  // Reset when pointer leaves
  document.addEventListener('pointerleave', () => {
    if (activeCard) {
      activeCard.style.removeProperty('--tilt-x');
      activeCard.style.removeProperty('--tilt-y');
      activeCard = null;
    }
  });

  // Mobile Device Orientation (Subtle 3D Parallax Gyro)
  if (globalThis.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', (e) => {
      if (!e.gamma || !e.beta) return;
      const gx = Math.max(-25, Math.min(25, e.gamma)); // Left/Right
      const gy = Math.max(-25, Math.min(25, e.beta));  // Front/Back
      document.documentElement.style.setProperty('--gyro-x', `${(gx / 25).toFixed(2)}`);
      document.documentElement.style.setProperty('--gyro-y', `${(gy / 25).toFixed(2)}`);
    }, { passive: true });
  }
}
