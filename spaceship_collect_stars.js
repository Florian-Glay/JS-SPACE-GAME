// INITIALISATION --------------------------------------------------

// Initialisation du canevas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

function resizeCanvas() {
    canvas.width = Math.max(800, window.innerWidth);
    canvas.height = Math.max(600, window.innerHeight);
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
    speed: 8,
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

// STARS

for (let i = 0; i < starNumber; i++) {
    createStar();
}

// Définition de la classe Planète
class Planet {
    constructor(x, y, textureSrc, size, gravity, orientation, rot_speed) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.gravity = gravity;
        this.orientation = orientation;
        this.rot_speed = rot_speed;
        this.image = new Image();
        this.image.src = textureSrc;
    }

    updateRotation() {
        this.orientation += this.rot_speed;
    }

    draw(ctx, camera) {
        const screenX = this.x - camera.smoothX + canvas.width / 2;
        const screenY = this.y - camera.smoothY + canvas.height / 2;
    
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.orientation);
    
        // Vérifier que l'image est bien chargée avant de dessiner
        if (this.image.complete && this.image.naturalWidth !== 0) {
            // Vérifier que la taille est bien prise en compte
            const width = this.size || this.image.width;
            const height = this.size || this.image.height;
    
            ctx.drawImage(this.image, -width / 2, -height / 2, width, height);
        } else {
            console.warn("L'image de la planète n'est pas encore chargée !");
        }
    
        ctx.restore();
    }
    
}

// Liste des planètes créées
const planets = [
    new Planet(1500, 1300, './img_file/planet1.png', 500, 9.81, 0, 0.01),
    new Planet(-600, -200, './img_file/planet2.png', 150, 5, Math.PI / 4, 0.02)
];


// UPDATE ----------------------------------------------------


// Mettre à jour la rotation des planètes
function updatePlanets() {
    planets.forEach(planet => planet.updateRotation());
}

// Mettre à jour la caméra pour suivre le vaisseau
function updateCamera() {
    const smoothingFactor = 0.02;

    // Ajuster la position de la caméra en fonction du vaisseau
    camera.smoothX += (spaceship.x - camera.smoothX) * smoothingFactor;
    camera.smoothY += (spaceship.y - camera.smoothY) * smoothingFactor;
}

function updateSpaceship() {
    let newX = spaceship.x + spaceship.dx;
    let newY = spaceship.y + spaceship.dy;

    // Vérifier la collision avant de déplacer
    if (!isColliding(newX, spaceship.y)) {
        spaceship.x = newX;
    }
    if (!isColliding(spaceship.x, newY)) {
        spaceship.y = newY;
    }

    const smoothingFactor = 0.02;
    if (spaceship.dx !== 0 || spaceship.dy !== 0) {
        const magnitude = Math.sqrt(spaceship.dx ** 2 + spaceship.dy ** 2);
        spaceship.targetOffsetX = (spaceship.dx / magnitude) * maxOffset;
        spaceship.targetOffsetY = (spaceship.dy / magnitude) * maxOffset;
    } else {
        spaceship.targetOffsetX = 0;
        spaceship.targetOffsetY = 0;
    }
    if (!isColliding(newX, spaceship.y)) {
        spaceship.offsetX += (spaceship.targetOffsetX - spaceship.offsetX) * smoothingFactor;
    }
    if (!isColliding(spaceship.x, newY)) {
        spaceship.offsetY += (spaceship.targetOffsetY - spaceship.offsetY) * smoothingFactor;
    }
    
    spaceship.x = Math.max(-renderSimulation, Math.min(renderSimulation, spaceship.x));
    spaceship.y = Math.max(-renderSimulation, Math.min(renderSimulation, spaceship.y));

    camera.x = spaceship.x - canvas.width / 2;
    camera.y = spaceship.y - canvas.height / 2;
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


// PHYSIQUE ----------------------------------------------------

// GRAVITY !!!!!!
function applyGravity(spaceship) {
    let totalGravityX = 0;
    let totalGravityY = 0;

    for (const planet of planets) {
        // Prendre en compte l'offset du vaisseau
        const spaceshipActualX = spaceship.x + spaceship.offsetX;
        const spaceshipActualY = spaceship.y + spaceship.offsetY;

        const dx = planet.x - spaceshipActualX;
        const dy = planet.y - spaceshipActualY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const planetRadius = planet.size / 2;
        const spaceshipRadius = spaceship.width / 2;
        const minDistance = planetRadius + spaceshipRadius; // Distance où le contact est établi
        const maxGravityDistance = minDistance + planet.gravity * 500; // Distance maximale d'effet de la gravité

        if (distance > minDistance && distance < maxGravityDistance) {
            // Appliquer une gravité proportionnelle à la distance
            const gravityForce = planet.gravity / (distance * 0.1);
            totalGravityX += (dx / distance) * gravityForce;
            totalGravityY += (dy / distance) * gravityForce;
        } else if (distance <= minDistance) {
            // Arrêter le vaisseau à la surface de la planète en tenant compte de l'offset
            const angle = Math.atan2(dy, dx);
            spaceship.x = planet.x - Math.cos(angle) * minDistance - spaceship.offsetX;
            spaceship.y = planet.y - Math.sin(angle) * minDistance - spaceship.offsetY;
            spaceship.dx *= 0.5; // Réduction progressive de la vitesse
            spaceship.dy *= 0.5;
            if (Math.abs(spaceship.dx) < 0.1 && Math.abs(spaceship.dy) < 0.1) {
                spaceship.dx = 0;
                spaceship.dy = 0;
            }
            return; // Sortie immédiate pour éviter d'autres forces gravitationnelles
        }
    }

    // Appliquer la force calculée sur le vaisseau
    spaceship.dx += totalGravityX;
    spaceship.dy += totalGravityY;
}


const collisionObjects = [/*
    { x: -600, y: -200, width: 150, height: 150 }, // Exemple d'un objet de collision
    { x: 500, y: 300, width: 100, height: 100 }*/
];

function isColliding(newX, newY) {
    // Vérifier la collision avec les objets statiques (si présents)
    for (let obj of collisionObjects) {
        if (
            newX < obj.x + obj.width &&
            newX + spaceship.width > obj.x &&
            newY < obj.y + obj.height &&
            newY + spaceship.height > obj.y
        ) {
            return true; // Collision détectée
        }
    }

    return false; // Pas de collision
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



// DRAW ----------------------------------------------------

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

// Dessiner toutes les planètes
function drawPlanets(ctx, camera) {
    planets.forEach(planet => planet.draw(ctx, camera));
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
    ctx.fillText(`Mouse: (${Math.round(mouseX + camera.smoothX)}, ${Math.round(mouseY + camera.smoothY)})`, canvas.width - 10, 90);
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


// MAIN ----------------------------------------------------

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

// Démarrer le jeu
function startGame() {
    gameStarted = true;
    spaceship.x = 0;
    spaceship.y = 0;
    camera.x = spaceship.x;
    camera.y = spaceship.y;
}

// Fonction d'exécution du jeu
function staticGame() {
    drawBackground();
    drawStars();
    drawPlanets(ctx, camera);
    drawSpaceship();
    drawScore();
    drawCameraCoordinates();
}

// Fonction d'exécution du jeu
function runGame() {
    updateCamera();
    updateSpaceship();
    updatePlanets();
    checkCollision();
    applyGravity(spaceship);
    drawBackground();
    drawStars();
    drawPlanets(ctx, camera);
    drawSpaceship();
    drawScore();
    drawCameraCoordinates();
}


// EVENT --------------------------------------------------

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

let mouseX = 0;
let mouseY = 0;

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Conversion pour que (0,0) soit au centre du canvas
    mouseX = event.clientX - rect.left - centerX;
    mouseY = event.clientY - rect.top - centerY;
});

