
// main.js
// Fichier central pour orchestrer le jeu
import { canvas, ctx, resizeCanvas } from './canvas.js';
import Spaceship from './spaceship.js';
import Star from './stars.js';

// Initialisation des objets
const spaceship = new Spaceship(canvas.width / 2, canvas.height - 50);
const stars = [];

for (let i = 0; i < 10; i++) {
    stars.push(new Star(Math.random() * canvas.width, Math.random() * canvas.height, 5));
}

// Boucle de jeu
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner les étoiles
    stars.forEach(star => star.draw(ctx));

    // Dessiner le vaisseau spatial
    spaceship.draw(ctx);

    requestAnimationFrame(gameLoop);
}

// Lancer la boucle de jeu
gameLoop();
