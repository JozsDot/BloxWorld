
const player = document.getElementById("player");
const message = document.getElementById("message");

let x = 0;

function move(direction) {
  x += direction;

  if (x > 120) x = 120;
  if (x < -120) x = -120;

  player.style.transform = `translateX(${x}px)`;
  message.textContent = "¡Estás jugando BOBLOX!";
}

document.addEventListener("keydown", function(event) {
  if (event.key === "ArrowRight" || event.key === "d") {
    move(20);
  }

  if (event.key === "ArrowLeft" || event.key === "a") {
    move(-20);
  }
});
