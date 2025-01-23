// Initialisation du canevas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

function resizeCanvas() {
    canvas.width = Math.max(800, window.innerWidth);
    canvas.height = Math.max(600, window.innerHeight);
}

// Fonction pour dessiner une croix rouge au centre
function drawRedCross() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const crossSize = 20; // Taille de la croix en pixels

    ctx.strokeStyle = 'red'; // Couleur de la croix
    ctx.lineWidth = 2; // Épaisseur de la croix

    // Ligne horizontale
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize / 2, centerY);
    ctx.lineTo(centerX + crossSize / 2, centerY);
    ctx.stroke();

    // Ligne verticale
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - crossSize / 2);
    ctx.lineTo(centerX, centerY + crossSize / 2);
    ctx.stroke();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Variables globales
let gameStarted = false;
let gamePaused = false;
const spaceship = {
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    speed: 5,
    dx: 0,
    dy: 0,
    smoothX: 0,
    smoothY: 0,
    offsetX: 0,
    offsetY: 0,
    targetOffsetX: 0,
    targetOffsetY: 0,
};

// Charger les images dans un tableau
const spaceshipFrames = [
    './img_file/spaceship_1.png',
    './img_file/spaceship_2.png',
    './img_file/spaceship_3.png'
].map((src) => {
    const img = new Image();
    img.src = src;
    return img;
});


let frameIndex = 0; // Index actuel de l'image
const frameDuration = 100; // Durée d'affichage de chaque frame en millisecondes
let lastFrameTime = 0;
let currentTime = 0;

const camera = {
    x: 0,
    y: 0,
    smoothX: 0,
    smoothY: 0
};

const stars = [];
const starSize = 10;
const starNumber = 100;
let score = 0;

// Définir les limites de la simulation
const renderSimulation = 5000;
const maxOffset = spaceship.speed * 20; // Max offset for smooth movement

// Charger l'arrière-plan
const background = new Image();
background.src = './img_file/background.png';

// Génération des étoiles
function createStar() {
    const star = {
        x: Math.random() * (renderSimulation * 2) - renderSimulation,
        y: Math.random() * (renderSimulation * 2) - renderSimulation,
        size: starSize
    };
    stars.push(star);
}

for (let i = 0; i < starNumber; i++) {
    createStar();
}

// Fonction principale de mise à jour
function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameStarted) {
        showMainMenu();
    } else if (gamePaused) {
        staticGame();
        showPauseMenu();
    } else {
        runGame();
    }
    // drawRedCross();// To center object
    currentTime = performance.now(); // Initialisation du temps
    requestAnimationFrame(update);
}

// Fonction d'exécution du jeu
function staticGame() {
    drawBackground();
    drawSpaceship();
    drawStars();
    drawScore();
    drawCameraCoordinates();
}

// Fonction d'exécution du jeu
function runGame() {
    updateCamera();
    drawBackground();
    drawSpaceship();
    drawStars();
    updateSpaceship();
    checkCollision();
    drawScore();
    drawCameraCoordinates();
}

// Mettre à jour la caméra pour suivre le vaisseau
function updateCamera() {
    const smoothingFactor = 0.02;

    // Ajuster la position de la caméra en fonction du vaisseau
    camera.smoothX += (spaceship.x - camera.smoothX) * smoothingFactor;
    camera.smoothY += (spaceship.y - camera.smoothY) * smoothingFactor;
}

// Dessiner l'arrière-plan répétitif
function drawBackground() {
    const bgWidth = background.width;
    const bgHeight = background.height;

    const startX = Math.floor(camera.smoothX / bgWidth) * bgWidth;
    const startY = Math.floor(camera.smoothY / bgHeight) * bgHeight;

    for (let x = startX; x < camera.smoothX + canvas.width; x += bgWidth) {
        for (let y = startY; y < camera.smoothY + canvas.height; y += bgHeight) {
            ctx.drawImage(background, x - camera.smoothX, y - camera.smoothY, bgWidth, bgHeight);
        }
    }
}

// Dessiner le vaisseau
function drawSpaceship() {
    const angle = Math.atan2(spaceship.offsetY, spaceship.offsetX);

    // Animation : changer de frame toutes les 0,1s
    if (currentTime - lastFrameTime >= frameDuration && !gamePaused) {
        frameIndex = (frameIndex + 1) % spaceshipFrames.length; // Passer à l'image suivante
        lastFrameTime = currentTime;
    }

    const spaceshipImage = spaceshipFrames[frameIndex]; // Sélectionner l'image actuelle

    ctx.save();
    ctx.translate(canvas.width / 2 + spaceship.offsetX,
        canvas.height / 2 + spaceship.offsetY); // Position du vaisseau
    ctx.rotate(angle); // Orientation selon offsetX, offsetY
    ctx.drawImage(spaceshipImage, -spaceshipImage.width / 2, -spaceshipImage.height / 2); // 
    ctx.restore();
}

// Dessiner les étoiles
function drawStars() {
    ctx.fillStyle = 'yellow';
    stars.forEach(star => {
        const screenX = star.x - camera.smoothX + canvas.width / 2;
        const screenY = star.y - camera.smoothY + canvas.height / 2;

        if (
            screenX >= -star.size &&
            screenX <= canvas.width + star.size &&
            screenY >= -star.size &&
            screenY <= canvas.height + star.size
        ) {
            ctx.beginPath();
            ctx.arc(screenX, screenY, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

// Mettre à jour la position du vaisseau
function updateSpaceship() {
    spaceship.x += spaceship.dx;
    spaceship.y += spaceship.dy;


    const smoothingFactor = 0.02;
    // Mise à jour des cibles d'offset pour un décalage fluide
    if (spaceship.dx !== 0 || spaceship.dy !== 0) {
        const magnitude = Math.sqrt(spaceship.dx ** 2 + spaceship.dy ** 2);
        spaceship.targetOffsetX = (spaceship.dx / magnitude) * maxOffset;
        spaceship.targetOffsetY = (spaceship.dy / magnitude) * maxOffset;
    } else {
        spaceship.targetOffsetX = 0;
        spaceship.targetOffsetY = 0;
    }

    // Ajustement fluide vers les cibles d'offset
    spaceship.offsetX += (spaceship.targetOffsetX - spaceship.offsetX) * smoothingFactor;
    spaceship.offsetY += (spaceship.targetOffsetY - spaceship.offsetY) * smoothingFactor;


    // Limites de l'espace simulé
    spaceship.x = Math.max(-renderSimulation, Math.min(renderSimulation, spaceship.x));
    spaceship.y = Math.max(-renderSimulation, Math.min(renderSimulation, spaceship.y));

    // Mise à jour de la caméra pour suivre le vaisseau avec fluidité
    camera.x = spaceship.x - canvas.width / 2;
    camera.y = spaceship.y - canvas.height / 2;
}

// Vérifier les collisions
function checkCollision() {
    stars.forEach((star, index) => {
        const dx = Math.abs(spaceship.x - spaceship.offsetX*1.5 - star.x);
        const dy = Math.abs(spaceship.y - spaceship.offsetY*1.5 - star.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (star.size + spaceship.width / 2)) {
            stars.splice(index, 1);
            score++;
            createStar();
        }
    });
}

// Dessiner le score
function drawScore() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 30);
}

// Dessiner les coordonnées de la caméra
function drawCameraCoordinates() {
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Camera: (${Math.round(camera.smoothX)}, ${Math.round(camera.smoothY)})`, canvas.width - 10, 30);
    ctx.fillText(`Offset Ship: (${Math.round(spaceship.offsetX)}, ${Math.round(spaceship.offsetY)})`, canvas.width - 10, 60);
}

// Afficher le menu principal
function showMainMenu() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PLAY', canvas.width / 2, canvas.height / 2);

    canvas.addEventListener('click', startGame, { once: true });
}

// Afficher le menu pause
function showPauseMenu() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 3);
    ctx.fillText('Press T to Resume', canvas.width / 2, canvas.height / 2);
}

// Démarrer le jeu
function startGame() {
    gameStarted = true;
    spaceship.x = 0;
    spaceship.y = 0;
    camera.x = spaceship.x;
    camera.y = spaceship.y;
}

// Gestion des entrées clavier
const keys = {
    ArrowRight: false,
    ArrowLeft: false,
    ArrowUp: false,
    ArrowDown: false,
    KeyD: false,
    KeyA: false,
    KeyW: false,
    KeyS: false
};

function keyDown(e) {
    if (e.code === 'KeyT') {
        togglePause();
        return;
    }
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
    updateDirection();
}

function keyUp(e) {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
    updateDirection();
}

function updateDirection() {
    spaceship.dx = 0;
    spaceship.dy = 0;
    let horizontal = 0;
    let vertical = 0;

    if (keys.ArrowRight || keys.KeyD) horizontal += 1;
    if (keys.ArrowLeft || keys.KeyA) horizontal -= 1;
    if (keys.ArrowUp || keys.KeyW) vertical -= 1;
    if (keys.ArrowDown || keys.KeyS) vertical += 1;

    const magnitude = Math.sqrt(horizontal * horizontal + vertical * vertical);

    if (magnitude > 0) {
        spaceship.dx = (horizontal / magnitude) * spaceship.speed;
        spaceship.dy = (vertical / magnitude) * spaceship.speed;
    }
}

function togglePause() {
    gamePaused = !gamePaused;
}

// Écoute des événements clavier
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

// Lancer la mise à jour continue
background.onload = () => {
    update();
};
