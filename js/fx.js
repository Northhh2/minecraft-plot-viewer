// Visual effects only: a soft light follows the pointer across glass surfaces (css/theme.css reads --mx/--my).
const GLASS = '#modal, #login-modal > div, button.control-button, #search-bar, #login-button, #modal-content .bg-gray-700, #search-suggestions > *, .fixed.inset-0.z-50 > div';

export function initializeFx() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0, last = null;
    document.addEventListener('pointermove', e => {
        last = e;
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            const target = last.target instanceof Element ? last.target.closest(GLASS) : null;
            if (!target) return;
            const r = target.getBoundingClientRect();
            target.style.setProperty('--mx', `${last.clientX - r.left}px`);
            target.style.setProperty('--my', `${last.clientY - r.top}px`);
        });
    }, { passive: true });
}
