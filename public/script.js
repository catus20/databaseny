function toggleForm() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    // Bytte mellom login og register skjema
    if (loginForm.classList.contains("hidden")) {
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
    } else {
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
    }
}

function toggleMenu() {
    const navLinks = document.querySelector('.navlinks');
    navLinks.classList.toggle('active');
}

// Bekreft sletting før det sendes
function confirmDelete(event) {
    event.preventDefault();  // Hindrer formens standard oppførsel
    const userConfirmed = confirm("Er du sikker på at du vil slette denne filmen?");
    
    if (userConfirmed) {
      event.target.submit();  // Sender formen hvis brukeren bekrefter
    }
    return false;  // Sørg for at ingen ytterligere handling skjer hvis ikke bekreftet
  }