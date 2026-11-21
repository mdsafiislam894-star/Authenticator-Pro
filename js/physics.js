// Specular Highlight Light Tracking Engine (Flat Liquid Glass - No 3D Tilt/Bending)
// Highly optimized using requestAnimationFrame and direct CSS variable injection.

export function initPhysics() {
  let activeCard = null;
  let rafId = null;
  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;

  function update() {
    if (activeCard) {
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      activeCard.style.setProperty('--mouse-x', `${currentX.toFixed(1)}px`);
      activeCard.style.setProperty('--mouse-y', `${currentY.toFixed(1)}px`);
    }
    rafId = requestAnimationFrame(update);
  }

  // Pointer move tracking for smooth liquid highlight
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card, .topbar, .theme-card, .fab');
    if (card) {
      activeCard = card;
      const rect = card.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      if (!rafId) rafId = requestAnimationFrame(update);
    } else if (activeCard) {
      activeCard = null;
    }
  }, { passive: true });

  // Reset when pointer leaves
  document.addEventListener('pointerleave', () => {
    activeCard = null;
  });
}
