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