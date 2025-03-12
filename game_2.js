function showMainMenu() {
    // Set font style
    ctx.fillStyle = 'black';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Main Menu', canvas.width / 2, canvas.height / 4);

    // Create play button
    const buttonWidth = 200;
    const buttonHeight = 80;
    const buttonX = (canvas.width - buttonWidth) / 2;
    const buttonY = (canvas.height - buttonHeight) / 2;

    let buttonColor = '#FF5733'; // Initial button color

    function updateButtonColor(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Change color based on mouse position
        if (x >= buttonX && x <= buttonX + buttonWidth && y >= buttonY && y <= buttonY + buttonHeight) {
            buttonColor = `rgb(${Math.floor(255 * (x / canvas.width))}, ${Math.floor(255 * (y / canvas.height))}, 100)`;
        } else {
            buttonColor = '#FF5733';
        }

        drawButton();
    }

    canvas.addEventListener('mousemove', updateButtonColor);

    function drawButton() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        ctx.fillStyle = 'black';
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Main Menu', canvas.width / 2, canvas.height / 4);
        ctx.fillStyle = buttonColor; // Button color
        ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        ctx.fillStyle = 'white';
        ctx.font = '36px sans-serif';
        ctx.fillText('Play', canvas.width / 2, canvas.height / 2 + 20);
    }

    drawButton();

    // Add event listener for the play button
    canvas.addEventListener('click', function onClick(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (x >= buttonX && x <= buttonX + buttonWidth && y >= buttonY && y <= buttonY + buttonHeight) {
            canvas.removeEventListener('click', onClick);
            canvas.removeEventListener('mousemove', updateButtonColor);
            canvas.addEventListener('click', startGame, { once: true });
        }
    });
}