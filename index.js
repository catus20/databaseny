import express from 'express';
import session from 'express-session';
import { open } from "sqlite";
import sqlite3 from 'sqlite3'
import bcrypt from 'bcrypt'

// BRUKERNAVN OG PASSORD TIL ADMIN-BRUKER: 
// admin@test.no
// 123456

// Opnar databasen database.db
const dbPromise = open({
    filename: 'database.db',
    driver: sqlite3.Database
});

const app = express();
const port = 3000;

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));


// Startar ein express applikasjon, og gjer den port 3000 
app.listen(port, () => {
    console.log(`Server er startet her: http://localhost:${port}`);
});

// Henter fila index.ejs 
app.get('/', (req, res) => {
    res.render('index');
});

// Henter fila login.ejs
app.get("/login", async (req, res) => {
    res.render("login");
})

// Vert kjørt når brukaren klikker "Registrer deg"
// Denne ligg i action på <form> 

app.post("/register", async (req, res) => {
    const db = await dbPromise;
    const { fname, lname, email, password, confirmPassword } = req.body;

    if (password != confirmPassword) {
        res.render("register", { error: "Password must match." })
        return;
    }
    const passwordHash = await bcrypt.hash(confirmPassword, 10);

    // Tabellen eg bruker heiter "users" og har kolonnene "firstname", "lastname", "email" og "password"
    await db.run("INSERT INTO users (firstname, lastname, email, password) VALUES (?, ?, ?, ?)", fname, lname, email, passwordHash);
    res.redirect("/login");

})

// Denne vert kjørt når brukaren trykker "Logg inn", i fila login.ejs
// Ref: <form action="/auth" method="post"> 
// Denne sjekker om brukaren finnes i databasen, og om passord dei skriv inn er rett.

app.post('/auth', async function (req, res) {

    const db = await dbPromise;
    const { email, password } = req.body;
    let getUserDetails = `SELECT * FROM users WHERE email = '${email}'`;
    let checkInDb = await db.get(getUserDetails);

    if (checkInDb === undefined) {
        res.status(400);
        res.send("Invalid user");
    } else {
        const isPasswordMatched = await bcrypt.compare(
            password,
            checkInDb.password
        );

        if (isPasswordMatched) {
            res.status(200);
            if (checkInDb.role == 1) { // Sjekker om brukaren er admin. Admin = 1
                req.session.admin = true;

            }
            // Dersom brukaren finnes, logg inn
            req.session.loggedin = true;
            req.session.email = email;
            req.session.userid = checkInDb.id;
            // Redirect til heimesida
            res.redirect('/home');
        } else {
            res.status(400);
            res.send("Invalid password");
            res.redirect("/");
        }

    }

});

// Henter fila home.ejs (heimesida)
app.get("/home", async (req, res) => {
    const admin = req.session.admin;
    const userid = req.session.userid; // Hent brukerens ID fra session

    // Hvis ikke bruker er logget inn
    if (!userid) {
        return res.redirect("/login"); // Eller en annen rute for å logge inn
    }

    const db = await dbPromise;
    const movies = await db.all("SELECT * FROM movies"); // Hent alle filmer fra databasen

    res.render("home", { movies, admin, userid }); // Send både movies, admin og userid til EJS-filen
});


app.get("/logout", async (req, res) => {

    req.session.loggedin = false;
    req.session.username = '';
    req.session.admin = false; // ADMIN SYSTEM
    res.redirect("/")
})

// ADMIN SYSTEM
app.get('/profile', async function (req, res) {
    if (req.session.loggedin) {
        const userid = req.session.userid;
        const admin = req.session.admin;
        const db = await dbPromise;
        let getUserDetails = `SELECT * FROM users WHERE id = ?`;
        let user = await db.get(getUserDetails, [userid]);

        if (user === undefined) {
            res.status(400);
            res.send("Invalid user");
        } else {
            res.status(200);
            // Hent filmer som er favoritter for denne brukeren
            res.render('profile', { userid, user, admin });
        }
    }
    else {
        return res.render(403);
    }
});


// Rute for å håndtere POST-forespørsler til '/admin/delete/:id'.
app.post('/profile/delete/:id', async (req, res) => {
    const id = req.params.id;  // Henter ID fra URL-parameteren.
    const db = await dbPromise; // Venter på at databasetilkoblingen skal være klar.
    const query = 'DELETE FROM users WHERE id = ?';

    try {
        await db.run(query, id); // Utfører sletting av brukeren fra databasen.
        console.log('Deleted user with ID:', id); // Logger ID-en til brukeren som ble slettet.
        res.redirect('/');  // Omdirigerer tilbake til admin-siden etter sletting.
    } catch (error) {
        console.error('Error when deleting:', error); // Logger eventuelle feil under sletting.
        res.status(500).send("Unable to delete user.");  // Sender feilmelding hvis sletting feiler.
    }
});


// Bruker kan redigere sin egen profil
app.get('/profile/edit', async function (req, res) {
    const admin = req.session.admin;
    const db = await dbPromise;
    const loggedInUserId = req.session.userid; // Henter ID-en til den innloggede brukeren


    // Sørger for at en vanlig bruker kun kan redigere sin egen profil
    if (!loggedInUserId) {
        return res.status(403).send("Du har ikke tilgang til å redigere denne profilen.");
    }

    const query = "SELECT * FROM users WHERE id = ?";
    const user = await db.get(query, loggedInUserId);

    if (!user) {
        return res.status(404).send("Bruker ikke funnet.");
    }

    res.render('edit', { user, admin });
});

app.post('/profile/edit/:id', async function (req, res) {
    const id = req.params.id;  // Henter ID fra URL-parameteren.

    // Sjekker om brukaren er logga inn, hvis ikkje - vart den sendt til fila 403.ejs i mappa errors
    if (!req.session.loggedin) {
        return res.render(403);
    }

    const db = await dbPromise;
    const loggedInUserId = req.session.userid; // finner userid til innlogga brukar
    const admin = req.session.admin; // finner ut om brukaren som er logga inn er admin

    // Sjekker om brukaren som prøver å redigere profilen, er den same som er logga inn, eller om admin
    if (parseInt(id) !== loggedInUserId) {
        return res.render(403);
    }

    // henter ut firstname og lastname frå <form> i edit.ejs 
    // desse er "name" i <input> feltet, og må skrives på same måte 
    const { firstname, lastname } = req.body; 

    const query = "UPDATE users SET firstname = ?, lastname = ? WHERE id = ?";

    try {
        await db.run(query, [firstname, lastname, loggedInUserId]); // kjører SQL spørringen
        //console.log(`Profil oppdatert for bruker-ID: ${loggedInUserId}`);
        res.redirect('/profile'); // Tilbake til profilsiden
    } catch (error) {
        //console.error('Feil ved oppdatering:', error);
        res.status(500).send("Kunne ikke oppdatere profilen.");
    }
});

// ADMIN SYSTEM - opner admin.ejs
app.get('/admin', async function (req, res) {
    if (req.session.loggedin) {
        const user = req.session.email;
        const db = await dbPromise;
        let getUserDetails = `SELECT * FROM users WHERE email = '${user}' AND role = 1`;
        let checkInDb = await db.get(getUserDetails);
        const query = 'SELECT * FROM users';
        const users = await db.all(query); // kjører SQL spørringen

        if (checkInDb === undefined) {
            res.status(400);
            res.send("Invalid user");
        } else {
            let admin = true;
            res.status(200);
            res.render('admin', { user, admin, users });
        }
    }
});


// Rute for å håndtere POST-forespørsler til '/admin/delete/:id'.
app.post('/admin/delete/:id', async (req, res) => {
    const id = req.params.id;  // Henter ID fra URL-parameteren.
    const db = await dbPromise; // Venter på at databasetilkoblingen skal være klar.
    const query = 'DELETE FROM users WHERE id = ?';

    try {
        await db.run(query, id); // Utfører sletting av brukeren fra databasen.
        //console.log('Deleted user with ID:', id); // Logger ID-en til brukeren som ble slettet.
        res.redirect('/admin');  // Omdirigerer tilbake til admin-siden etter sletting.
    } catch (error) {
        //console.error('Error when deleting:', error); // Logger eventuelle feil under sletting.
        res.status(500).send("Unable to delete user.");  // Sender feilmelding hvis sletting feiler.
    }
});

app.get("/admin/edit/:id", async (req, res) => {
    const admin = req.session.admin;
    if (!req.session.admin) {
        return res.redirect("/home"); // Sikrer at kun admin har tilgang
    }

    const db = await dbPromise;
    const movieId = req.params.id; // Henter filmens ID fra URL

    console.log("MovieID from URL:", movieId); // Logg for å se om ID-en kommer med korrekt

    // Hent filmen basert på filmens ID, og sjekk om brukeren har tilgang til å redigere den
    const movie = await db.get("SELECT * FROM movies WHERE id = ?", [movieId]);

    console.log("Fetched movie:", movie); // Logg for å sjekke om filmen er hentet

    if (!movie) {
        return res.status(404).send("Film ikke funnet");
    }

    // Hvis admin er logget inn, eller filmen tilhører den innloggede brukeren, send til editMovie.ejs
    if (admin || movie.user_id === req.session.userid) {
        res.render("editMovie", { movie, admin }); // Sender filmen til editMovie.ejs
    } else {
        return res.status(403).send("Du har ikke tilgang til å redigere denne filmen");
    }
});


app.post("/admin/edit/:id", async (req, res) => {
    const admin = req.session.admin;
    if (!req.session.admin) {
        return res.status(403).send("Access Denied");
    }

    const db = await dbPromise;
    const { firstname, lastname, role } = req.body;
    const userId = req.params.id;

    try {
        await db.run(
            "UPDATE users SET firstname = ?, lastname = ?, role = ? WHERE id = ?",
            [firstname, lastname, role, userId]
        );

        res.redirect("/admin"); // Gå tilbake til admin-panelet etter oppdatering
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send("Error updating user.");
    }
});

app.get('/movies/add', async (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login'); // Brukeren må være logget inn for å legge til filmer
    }
    const admin = req.session.admin || false; // Sjekk om brukeren er admin
    res.render('addMovie', { admin }); // Send admin-status til EJS
});


// POST-forespørsel for å legge til filmen
app.post('/movies/add', async (req, res) => {
    try {
        const db = await dbPromise;
        const { tittel, årstall, rating, regissør, sjanger, image_url } = req.body;
        const userId = req.session.userid; // Hente brukerens ID

        // Sjekk at alle nødvendige data er sendt
        if (!tittel || !årstall || !rating || !regissør || !sjanger || !image_url) {
            return res.status(400).send('Alle felt må fylles ut'); // Returner feilmelding hvis noen felter mangler
        }

        // Sett inn dataene i "movies" tabellen
        await db.run('INSERT INTO movies (tittel, årstall, rating, regissør, sjanger, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [tittel, årstall, rating, regissør, sjanger, image_url, userId]);

        // Omdiriger brukeren tilbake til hjemmesiden etter at filmen er lagt til
        res.redirect('/home'); 
    } catch (error) {
        console.error('Error while adding movie:', error);
        res.status(500).send('Noe gikk galt. Vennligst prøv igjen senere.');
    }
});


// Rediger en film
app.get('/movies/edit/:id', async (req, res) => {
    const db = await dbPromise;
    const movieId = req.params.id;
    const movie = await db.get('SELECT * FROM movies WHERE id = ?', [movieId]);

    if (!movie) {
        return res.status(404).send('Film ikke funnet');
    }

    if (req.session.admin || movie.user_id === req.session.userid) {
        res.render('editMovie', { movie });
    } else {
        return res.status(403).send('Du har ikke tilgang til å redigere denne filmen');
    }
});

// POST-forespørsel for å oppdatere filmen
app.post('/movies/edit/:id', async (req, res) => {
    const db = await dbPromise;
    const { tittel, årstall, rating, regissør, sjanger, image_url } = req.body;
    const movieId = req.params.id;

    const movie = await db.get('SELECT * FROM movies WHERE id = ?', [movieId]);
    
    if (!movie) {
        return res.status(404).send('Film ikke funnet');
    }

    // Sjekk om brukeren har tilgang
    if (req.session.admin || movie.user_id === req.session.userid) {
        await db.run('UPDATE movies SET tittel = ?, årstall = ?, rating = ?, regissør = ?, sjanger = ?, image_url = ? WHERE id = ?', [tittel, årstall, rating, regissør, sjanger, image_url, movieId]);
        res.redirect('/home');
    } else {
        res.status(403).send('Du har ikke tilgang til å redigere denne filmen');
    }
});

// Route for sletting av film (bruker)
app.post('/profile/delete_movie/:id', async (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');  // Sørger for at brukeren er logget inn
    }

    const movieId = req.params.id;
    const userId = req.session.userid;  // Brukerens ID fra sesjonen

    // Sjekk om filmen finnes i databasen
    const db = await dbPromise;
    const movie = await db.get('SELECT * FROM movies WHERE id = ?', [movieId]);

    // Hvis filmen finnes, sjekk om brukeren er eieren eller admin
    if (movie) {
        if (movie.user_id === userId || req.session.admin) {
            // Hvis filmen tilhører brukeren eller brukeren er admin, slett filmen
            await db.run('DELETE FROM movies WHERE id = ?', [movieId]);
            res.redirect('/home');  // Tilbake til forsiden etter sletting
        } else {
            res.status(403).send('Du kan ikke slette denne filmen');  // Hvis filmen ikke tilhører brukeren
        }
    } else {
        res.status(404).send('Film ikke funnet');
    }
});

// Route for sletting av film (admin)
app.post('/admin/delete/:id', async (req, res) => {
    if (!req.session.loggedin || !req.session.admin) {
        return res.redirect('/login');  // Sørger for at admin er logget inn
    }

    const movieId = req.params.id;

    // Slett filmen som admin
    const db = await dbPromise;
    const movie = await db.get('SELECT * FROM movies WHERE id = ?', [movieId]);

    if (movie) {
        await db.run('DELETE FROM movies WHERE id = ?', [movieId]);
        res.redirect('/admin');  // Send admin tilbake til admin-siden
    } else {
        res.status(404).send('Film ikke funnet');
    }
});
