// INITIALISATION --------------------------------------------------

// Création et ajustement du canevas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

function resizeCanvas() {
    canvas.width = Math.max(800, window.innerWidth);
    canvas.height = Math.max(600, window.innerHeight);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Variables globales du jeu
let gameStarted = false;
let gamePaused = false;
let renderSimulation = 10000;

// -----------------------------------------------------------------
// Configuration du vaisseau
// (x, y) : position dans le monde (en pixels)
// (vx, vy) : vitesse en pixels/s
// "thrust" : accélération apportée par le joueur (pixels/s²)
// "offset" : utilisé pour l'effet visuel (pour l'instant, uniquement en mode non collision)
const spaceship = {
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    thrust: 700,    // accélération apportée par le joueur (pixels/s²)
    vx: 0,
    vy: 0,
    offsetX: 0,
    offsetY: 0,
    targetOffsetX: 0,
    targetOffsetY: 0,
    boost: 0,
    currentAngle: 0
};
const shipRadius = spaceship.width / 2; // pour les collisions

// Chargement des images du vaisseau (animation)
const spaceshipFrames = [
    './img_file/spaceship_1.png',
    './img_file/spaceship_2.png',
    './img_file/spaceship_3.png'
].map(src => {
    const img = new Image();
    img.src = src;
    return img;
});
let frameIndex = 0;
const frameDuration = 100; // durée d'une frame en ms
let lastFrameTimeAnim = 0;

function lerpAngle(current, target, t) {
    let diff = target - current;
    // Normaliser la différence pour qu'elle soit comprise entre -PI et PI
    diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
    return current + diff * t;
}

function slerpAngle(current, target, t) {
    let diff = target - current;

    // Normaliser la différence pour qu'elle soit comprise entre -PI et PI
    diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;

    // Utiliser une interpolation exponentielle pour éviter une brusque inversion
    return current + diff * (1 - Math.exp(-t * 10));
}

function lerpAngleSafe(current, target, t) {
    let sinCurrent = Math.sin(current);
    let cosCurrent = Math.cos(current);
    let sinTarget = Math.sin(target);
    let cosTarget = Math.cos(target);

    // Effectuer une interpolation linéaire sur les composantes sin et cos
    let sinInterp = sinCurrent + (sinTarget - sinCurrent) * t;
    let cosInterp = cosCurrent + (cosTarget - cosCurrent) * t;

    // Recalculer l'angle pour rester toujours sur le bon cercle trigonométrique
    return Math.atan2(sinInterp, cosInterp);
}



// -----------------------------------------------------------------
// Caméra (toujours centrée sur le vaisseau)
const camera = {
    smoothX: 0,
    smoothY: 0
};

// -----------------------------------------------------------------
// Arrière-plan et étoiles
const background = new Image();
background.src = './img_file/background.png';

const stars = [];
const starSize = 10;
const starNumber = 100;
function createStar() {
    const star = {
        x: Math.random() * (renderSimulation*2) - renderSimulation,
        y: Math.random() * (renderSimulation*2) - renderSimulation,
        size: starSize
    };
    stars.push(star);
}
for (let i = 0; i < starNumber; i++) {
    createStar();
}

// -----------------------------------------------------------------
// Classe Planète
class Planet {
    /**
     * @param {number} x - Position x dans le monde.
     * @param {number} y - Position y dans le monde.
     * @param {string} textureSrc - Chemin de l'image.
     * @param {number} size - Taille en pixels (diamètre).
     * @param {number} gravity - Accélération à la surface (en m/s², ici 9.81).
     * @param {number} orientation - Orientation initiale (radians).
     * @param {number} rot_speed - Vitesse de rotation (radians/s).
     */
    constructor(x, y, textureSrc, size, gravity, orientation, rot_speed) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.gravity = gravity;  // On utilise 9.81 pour un effet réaliste
        this.orientation = orientation;
        this.rot_speed = rot_speed;
        this.image = new Image();
        this.image.src = textureSrc;
    }
    
    update(dt) {
        this.orientation += this.rot_speed * dt;
    }
    
    draw(ctx, camera) {
        // Coordonnées d'écran en fonction de la caméra
        const screenX = this.x - camera.smoothX + canvas.width / 2;
        const screenY = this.y - camera.smoothY + canvas.height / 2;

        ctx.imageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
    
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.orientation);
    
        if (this.image.complete && this.image.naturalWidth !== 0) {
            const width = this.size;
            const height = this.size;
            ctx.drawImage(this.image, -width / 2, -height / 2, width, height);
        }
        ctx.restore();
    }
}

// Nous utilisons ici 9.81 pour chacune des planètes (attention aux unités, ici le gravity est exprimé en "pixels/s²" via un facteur multiplicatif)
const planets = [
    new Planet(1500, 1300, './img_file/planet1.png', 500, 9810, 0, 0.1),
    new Planet(-600, -200, './img_file/planet2.png', 150, 1081, Math.PI / 4, 0.2),
    new Planet(2000, -1500, './img_file/planet2.png', 700, 5000, Math.PI / 4, 1.5)
];

// -----------------------------------------------------------------
// Gestion des entrées clavier
// Ajout de la touche "Space" pour le boost
const keys = {
    ArrowRight: false,
    ArrowLeft: false,
    ArrowUp: false,
    ArrowDown: false,
    KeyD: false,
    KeyA: false,
    KeyW: false,
    KeyS: false,
    Space: false
};

// Flag pour empêcher de répéter le boost tant que la barre espace est maintenue
let spaceBoostReady = true;

// VARIABLE POUR L'ORIENTATION EN COLLISION
// Lorsqu'une collision (vaisseau à bord d'une planète) est détectée,
// cette variable contiendra la planète concernée
let collidingPlanet = null;

function keyDown(e) {
    if (e.code === 'KeyT') {
        togglePause();
        return;
    }
    // Gestion de la touche espace pour le boost
    if (e.code === 'Space') {
        if (spaceBoostReady) {
            boostIfNearPlanet();
            spaceBoostReady = false;
        }
        keys[e.code] = true;
        return;
    }
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
    }
}

function keyUp(e) {
    if (e.code === 'Space') {
        // Réactivation du boost dès que la barre espace est relâchée
        spaceBoostReady = true;
        keys[e.code] = false;
        return;
    }
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
    }
}
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

// -----------------------------------------------------------------
// Fonction de boost : si le vaisseau est proche d'une planète,
// il reçoit une impulsion pour décrocher.
function boostIfNearPlanet() {
    const BOOST_THRESHOLD_FACTOR = 1.1; // seuil = planet.size * BOOST_THRESHOLD_FACTOR
    if(keys.ArrowRight || keys.KeyD || keys.ArrowLeft || keys.KeyA || keys.ArrowUp || keys.KeyW || keys.ArrowDown || keys.KeyS){
        for (let planet of planets) {
            // Le boost est défini ici en fonction de la gravité de la planète
            const BOOST_MAGNITUDE = planet.gravity; // valeur du boost (pixels/s)
            const dx = spaceship.x - planet.x;
            const dy = spaceship.y - planet.y;
            const distance = Math.hypot(dx, dy);
            // Si le vaisseau est proche (dans le diamètre de la planète, avec une marge)
            if (distance < planet.size * BOOST_THRESHOLD_FACTOR) {
                // Calcul de la direction radiale sortante (du centre de la planète vers le vaisseau)
                const nx = dx; //distance;
                const ny = dy; //distance;
                // Application du boost
                spaceship.boost += BOOST_MAGNITUDE;// * nx;
                // On arrête dès le premier boost appliqué
                break;
            }
        }
    }
    
}


// -----------------------------------------------------------------
// Physique réaliste avec intégration temporelle
// Ordre d'application :
// 1. Poussée du joueur (uniquement translation, sans orientation)
// 2. Gravité de chaque planète
// 3. Détection de collision (poussée d'Archimède) :
//    - Si collision, le vaisseau est replacé sur le bord de la planète,
//      la vitesse est annulée et la variable globale collidingPlanet est définie.
// 4. Intégration de la vitesse et de la position
// 5. Application du frottement (plus fort en l'absence d'input)
// 6. Limitation de la vitesse maximale
// 7. Calcul de l'offset pour l'effet visuel (uniquement en mode non collision)
function updatePhysics(dt) {
    // Réinitialiser la variable de collision
    collidingPlanet = null;
    
    // --- 1. Poussée du joueur (translation uniquement)
    let thrustAx = 0, thrustAy = 0;
    if (keys.ArrowRight || keys.KeyD) thrustAx += 1;
    if (keys.ArrowLeft  || keys.KeyA) thrustAx -= 1;
    if (keys.ArrowUp    || keys.KeyW) thrustAy -= 1;
    if (keys.ArrowDown  || keys.KeyS) thrustAy += 1;
    let inputMag = Math.hypot(thrustAx, thrustAy);
    if (inputMag > 0) {
        thrustAx = (thrustAx / inputMag) * spaceship.thrust;
        thrustAy = (thrustAy / inputMag) * spaceship.thrust;
    }
    const steeringPriorityFactor = 3;
    
    // --- 2. Gravité et détection de collision
    let totalAx = 0, totalAy = 0;
    let collisionDetected = false;
    for (let planet of planets) {
        let dx = planet.x - spaceship.x;
        let dy = planet.y - spaceship.y;
        let distance = Math.hypot(dx, dy);
        const planetRadius = planet.size / 2;
        const minDistance = planetRadius*1.1 + shipRadius;
        
        if (distance < minDistance) {
            // Collision : repositionnement sur le bord, annulation de la vitesse.
            collisionDetected = true;
            collidingPlanet = planet;  // Sauvegarde de la planète en collision
            if (distance === 0) { dx = 1; dy = 0; distance = 1; }
            const nx = dx / distance;
            const ny = dy / distance;
            spaceship.x = collidingPlanet.x - nx * minDistance;
            spaceship.y = collidingPlanet.y - ny * minDistance;
            angle = Math.atan2(spaceship.y - collidingPlanet.y, spaceship.x - collidingPlanet.x);
            if(spaceBoostReady){
                if(spaceship.boost > 1){
                    spaceship.vx += Math.cos(angle)*spaceship.boost;
                    spaceship.vy += Math.sin(angle)*spaceship.boost;
                }
            }
        } else {
            // Accélération gravitationnelle :
            // a = 9.81 * (planetRadius / distance)²
            const a = planet.gravity * (planetRadius / distance) ** 2;
            if(a > 100){
                force = a;
                totalAx += a * (dx / distance);
                totalAy += a * (dy / distance);
            }
        }
    }
    
    // --- 3. Intégration de la gravité (uniquement si aucune collision n'est détectée)
    if (!collisionDetected) {
        spaceship.vx += totalAx * dt;
        spaceship.vy += totalAy * dt;
        spaceship.boost *= 0.5;
    }
    
    // --- 4. Ajout de la poussée du joueur (uniquement si aucune collision n'est détectée)
    if (!collisionDetected) {
        spaceship.vx += thrustAx * steeringPriorityFactor * dt;
        spaceship.vy += thrustAy * steeringPriorityFactor * dt;
    }
    
    // --- 5. Intégration de la position
    spaceship.x += spaceship.vx * dt;
    spaceship.y += spaceship.vy * dt;
    
    // --- 6. Application du frottement et réglage du lissage de l'offset
    let offsetSmoothingFactor;
    if (inputMag === 0) {
        // Sans input : frottement marqué
        spaceship.vx *= 0.98;
        spaceship.vy *= 0.98;
        offsetSmoothingFactor = 0.1;  // En mode collision, l'offset n'est pas utilisé
    } else {
        spaceship.vx *= 0.999;
        spaceship.vy *= 0.999;
        offsetSmoothingFactor = 0.1;
    }
    
    // --- 7. Limitation de la vitesse maximale (facultatif)
    let currentSpeed = Math.hypot(spaceship.vx, spaceship.vy);
    
    // const maxSpeed = 1000;
    const maxSpeed = force;
    if (currentSpeed > maxSpeed) {
        if(spaceship.boost > 700 ){
            spaceship.vx = (spaceship.vx / currentSpeed) * maxSpeed;
            spaceship.vy = (spaceship.vy / currentSpeed) * maxSpeed;
        }
        else if(currentSpeed > 700){
            spaceship.vx = (spaceship.vx / currentSpeed) * 700;
            spaceship.vy = (spaceship.vy / currentSpeed) * 700;
        }
        
    }
    
    // --- 8. Calcul de l'offset pour l'effet visuel (uniquement si non en collision)
    if (!collidingPlanet) {
        if (currentSpeed > 0) {
            spaceship.targetOffsetX = (spaceship.vx / currentSpeed) * 50;
            spaceship.targetOffsetY = (spaceship.vy / currentSpeed) * 50;
        } else {
            spaceship.targetOffsetX = 0 ;
            spaceship.targetOffsetY = 0;
        }
        spaceship.offsetX += (spaceship.targetOffsetX - spaceship.offsetX) * offsetSmoothingFactor;
        spaceship.offsetY += (spaceship.targetOffsetY - spaceship.offsetY) * offsetSmoothingFactor;
    }
    else{
        spaceship.targetOffsetX = (spaceship.vx / currentSpeed) * 50;
        spaceship.targetOffsetY = (spaceship.vy / currentSpeed) * 50;
        spaceship.offsetX += (0 - spaceship.offsetX) * offsetSmoothingFactor;
        spaceship.offsetY += (0 - spaceship.offsetY) * offsetSmoothingFactor;
    }

    // --- 9. Si le vaisseau est attaché à une planète, le faire suivre sa rotation
    if (spaceship.boost < 5 && collidingPlanet ) {
        // Calcul de l'angle relatif actuel
        let angleRel = Math.atan2(spaceship.y - collidingPlanet.y, spaceship.x - collidingPlanet.x);
        // Ajout de l'incrément de rotation de la planète
        angleRel += collidingPlanet.rot_speed * dt;
        const minDistance = collidingPlanet.size / 2 + shipRadius;
        // Mise à jour de la position pour suivre la rotation
        spaceship.x = collidingPlanet.x + Math.cos(angleRel) * minDistance;
        spaceship.y = collidingPlanet.y + Math.sin(angleRel) * minDistance;
    }

    // PROTECTION POUR NE PAS DEPASSER LA LIMITE
    spaceship.x = Math.max(-renderSimulation, Math.min(renderSimulation, spaceship.x));
    spaceship.y = Math.max(-renderSimulation, Math.min(renderSimulation, spaceship.y));
}

// -----------------------------------------------------------------
// Mise à jour de la caméra (suivi fluide du vaisseau)
function updateCamera(dt) {
    const smoothing = 0.05;
    camera.smoothX += (spaceship.x - camera.smoothX) * smoothing;
    camera.smoothY += (spaceship.y - camera.smoothY) * smoothing;
}

// Mise à jour des planètes (rotation)
function updatePlanets(dt) {
    for (let planet of planets) {
        planet.update(dt);
    }
}

// -----------------------------------------------------------------
// Dessin -----------------------------------------------------------------

// Arrière-plan répétitif
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

// Dessin du vaisseau avec animation et orientation
function drawSpaceship() {
    const now = performance.now();
    if (now - lastFrameTimeAnim >= frameDuration && !gamePaused) {
        frameIndex = (frameIndex + 1) % spaceshipFrames.length;
        lastFrameTimeAnim = now;
    }
    const spaceshipImage = spaceshipFrames[frameIndex];
    
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.save();
    // Le vaisseau est dessiné au centre de l'écran
    ctx.translate(canvas.width / 2 + spaceship.offsetX,canvas.height / 2 + spaceship.offsetY); // Position du vaisseau
    ctx.rotate(spaceship.currentAngle);
    // Dessiner le sprite centré sur son axe
    ctx.drawImage(spaceshipImage, -spaceshipImage.width / 2, -spaceshipImage.height / 2);
    ctx.restore();
}

function updateShipRotate(){
    // Calcul de l'angle cible (targetAngle)
    let targetAngle;
    if (collidingPlanet) {
        // Si en collision, l'angle cible est celui de la normale sortante
        targetAngle = Math.atan2(spaceship.y - collidingPlanet.y, spaceship.x - collidingPlanet.x);
    } else {
        let speed = Math.hypot(spaceship.vx, spaceship.vy);
        if (speed > 0.1) {
            targetAngle = Math.atan2(spaceship.vy, spaceship.vx);
        } else {
            // Si le vaisseau est quasi immobile, conserver l'angle courant
            targetAngle = spaceship.currentAngle;
        }
    }
    
    // Interpolation progressive de l'angle courant vers l'angle cible.
    // Le coefficient (ici 0.1) définit la rapidité de la transition (ajustez-le selon vos besoins).
    //spaceship.currentAngle = lerpAngle(spaceship.currentAngle, targetAngle, 0.05);
    //spaceship.currentAngle = slerpAngle(spaceship.currentAngle, targetAngle, 0.05);
    spaceship.currentAngle = lerpAngleSafe(spaceship.currentAngle, targetAngle, 0.08);

}


// Dessin des étoiles
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

// Dessin des planètes
function drawPlanets() {
    planets.forEach(planet => planet.draw(ctx, camera));
}


// Update du score
function increaseScoreOnStarCollision() {
    stars.forEach((star, index) => {
        const dx = Math.abs(spaceship.x - spaceship.offsetX*1.5 - star.x);
        const dy = Math.abs(spaceship.y - spaceship.offsetY*1.5 - star.y);
        let distance = Math.hypot(dx, dy);
        const starRadius = star.size / 2;
        const minDistance = starRadius + shipRadius;

        if (distance < minDistance) {
            stars.splice(index, 1); // Supprime l'étoile touchée
            score++; // Augmente le score
            createStar(); // Remplace l'étoile par une nouvelle
        }
    });
}


// Affichage du score (ou d'autres infos)
let score = 0;
function drawScore() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 30);
}

// Affichage des coordonnées utiles (caméra et vaisseau)
function drawCameraCoordinates() {
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Camera: (${Math.round(camera.smoothX)}, ${Math.round(camera.smoothY)})`, canvas.width - 10, 30);
    ctx.fillText(`Ship: (${Math.round(spaceship.x)}, ${Math.round(spaceship.y)})`, canvas.width - 10, 60);
    ctx.fillText(`Ship_boost: ${Math.round(spaceship.boost)}, Ship_vel: ${Math.round(spaceship.vx)}`, canvas.width - 10, 90);
}

// (Optionnel) Dessiner une croix rouge au centre
function drawRedCross() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const crossSize = 20;
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize / 2, centerY);
    ctx.lineTo(centerX + crossSize / 2, centerY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - crossSize / 2);
    ctx.lineTo(centerX, centerY + crossSize / 2);
    ctx.stroke();
}

// -----------------------------------------------------------------
// Menus (Play / Pause)
function showMainMenu() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PLAY', canvas.width / 2, canvas.height / 2);
    canvas.addEventListener('click', startGame, { once: true });
}



function showPauseMenu() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 3);
    ctx.fillText('Press T to Resume', canvas.width / 2, canvas.height / 2);
}

// -----------------------------------------------------------------
// Boucle principale et intégration temporelle
let lastFrameTime = performance.now();
function update() {
    const now = performance.now();
    let dt = (now - lastFrameTime) / 1000; // dt en secondes
    lastFrameTime = now;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!gameStarted) {
        showMainMenu();
    } else if (gamePaused) {
        drawBackground();
        drawStars();
        drawPlanets();
        drawSpaceship();
        drawScore();
        drawCameraCoordinates();
        showPauseMenu();
    } else {
        updatePhysics(dt);
        updateCamera(dt);
        updatePlanets(dt);
        updateShipRotate();
        increaseScoreOnStarCollision();
        
        drawBackground();
        drawStars();
        drawPlanets();
        drawSpaceship();
        drawScore();
        drawCameraCoordinates();
        // Optionnel : drawRedCross();
    }
    
    requestAnimationFrame(update);
}

// Démarrer le jeu
function startGame() {
    gameStarted = true;
    spaceship.x = 0;
    spaceship.y = 0;
    spaceship.vx = 0;
    spaceship.vy = 0;
    camera.smoothX = spaceship.x;
    camera.smoothY = spaceship.y;
}

// -----------------------------------------------------------------
// Suivi de la souris (pour affichage éventuel)
let mouseX = 0, mouseY = 0;
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    mouseX = event.clientX - rect.left - centerX;
    mouseY = event.clientY - rect.top - centerY;
});

// Lancement de la boucle principale une fois l'arrière-plan chargé
background.onload = () => {
    update();
};

// -----------------------------------------------------------------
// Fonction pour basculer le mode pause
function togglePause() {
    gamePaused = !gamePaused;
}
