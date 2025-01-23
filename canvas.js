
// canvas.js
// Initialisation et gestion du canevas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

function resizeCanvas() {
    canvas.width = Math.max(800, window.innerWidth);
    canvas.height = Math.max(600, window.innerHeight);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

export { canvas, ctx, resizeCanvas };
