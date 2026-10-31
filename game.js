const player = document.getElementById("player");

let x = 0;

document.addEventListener("keydown", function(event) {
  if (event.key === "ArrowRight" || event.key === "d") {
    x += 20;
  }

  if (event.key === "ArrowLeft" || event.key === "a") {
    x -= 20;
  }

  player.style.transform = `translateX(${x}px)`;
});

function jugar() {
  alert("¡Bienvenido al mundo de BOBLOX!");
}
