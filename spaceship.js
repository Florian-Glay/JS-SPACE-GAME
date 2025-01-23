
// spaceship.js
// Gestion du vaisseau spatial
class Spaceship {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 30;
        this.color = 'blue';
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
}

export default Spaceship;
