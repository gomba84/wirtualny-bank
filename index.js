const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const app = express();
const system = require("./system.js");
const argv = require("yargs").argv;

const bank = new system.Bank("seed.json");

console.log("Playing back the system from file seed.json");
let playback = bank.parseJSONAndPlaybackActions("seed.json");
if(playback) {
    console.log("Playback complete!");
}
else {
    console.log("Playback did not succeed!");
    process.exit(1);
}

// Oczekuj parameteru --port, jesli nie zostanie podany wybierz 3009
let port = 3009;
if(argv.port != null) {
    port = argv.port;
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true, type: "application/x-www-form-urlencoded"}));
app.use(cookieParser());

app.set('view engine', 'pug');
app.use(express.static('public'));

// Strona glowna
app.get('/', (req, res) => {


    // Sprawdz parametr GET, jesli jest w nim pole login z wartoscia failed wyswietl alert o nieudanym logowaniu
    let alert = "";
    if(req.query.login) {
        alert = (req.query.login == "failed") ? "Nieudane logowanie" : "";
    }
    else if(req.query.newuser) {
        alert = (req.query.newuser == "failed") ? "Dodanie nowego użytkownika nie powiodło się!" : "Dodano nowego użytkownika!";
    }

    res.render('index', {
        title: "Wirtualny Bank",
        message: "Witaj w Wirtualnym Banku",
        loginUrl: "/login",
        addUserUrl: "/adduser",
        users: bank.agents,
        alert: alert
    });
});

// Wykonuje operacje logowania porownujac podanych numer rachunku z numerami w systemie
app.post('/login', (req, res) => {
    let loginNumber = req.body.loginNumber;
    console.log("probuje zalogowac uzytkownika", loginNumber);
    console.log("uzytkownicy banku:", bank.agents);

    let user = bank.getUserByBankNumber(loginNumber);
    if(user != null) {
        console.log("logowanie powiodlo sie dla", loginNumber);
        // Utworz plik cookie z numerem rachunku, na ktory sie zalogowano
        res.cookie("bankNumber", loginNumber);
        res.redirect('/dashboard');
    }
    else {
        console.log("nie udalo sie zalogowac", loginNumber, ", uzytownik nie istnieje w systemie");
        res.redirect('/?login=failed');
    }
});

// Strona glowna po zalogowaniu wyswietlajaca stan konta
app.get('/dashboard', (req, res) => {
    // Znajdz plik cookie z numerem konta bankowego zalogowanego uzytkownika i podaj jego dane do dashboard
    if(req.cookies == null || req.cookies.bankNumber == null) {
        res.redirect('/');
    }

    let userNumber = req.cookies.bankNumber;
    let user = null;

    if(userNumber != null) {
        user = bank.getUserByBankNumber(userNumber);
    }

    // Sprawdz czy w url przeslany zostal parametr transfer i jaka jest jego wartosc (success/failed)
    let transferAlert = "";
    if(req.query.transfer == "success") transferAlert = "Transfer środków powiódł się!";
    else if(req.query.transfer == "failed") transferAlert = "Transfer środków nie powiódł się!";

    // Jesli nie znaleziono danych uzytkownika z numerem rachunku, ktory podano w pliku cookie przejdz do strony glownej
    // i usun plik cookie
    if(user == null) {
        res.clearCookie("bankNumber");
        res.redirect('/');
    }
    else {
        console.log("historia:", bank.listHistoryForUser(user));
        res.render('dashboard', {
            title: "Twoje konto",
            userName: user.name,
            bankNumber: user.number,
            moneyAmount: user.amount,
            history: bank.listHistoryForUser(user),
            transferLink: "/transfer",
            logoutLink: "/logout",
            transferAlert: transferAlert
        });
    }
});

// Strona wyswietlajaca opcje operacji transferu pienieznego
app.get('/transfer', (req, res) => {

    // Znajdz plik coookie z numerem konta
    if(req.cookies == null || req.cookies.bankNumber == null) {
        res.redirect('/');
    }

    let user = bank.getUserByBankNumber(req.cookies.bankNumber);

    if(user == null) {
        res.redirect('/');
    }

    res.render('transfer', {
        title: "Transfer pieniężny",
        moneyAmount: user.amount,
        moneySendUrl: '/moneysend'
    });
});

// Wykonuje operacje transferu na podstawie parametrow podanych w POST i przekierowuje na dashboard
app.post('/moneysend', (req, res) => {
    // Znajdz plik coookie z numerem konta
    if(req.cookies == null || req.cookies.bankNumber == null) {
        res.redirect('/');
    }

    let user = bank.getUserByBankNumber(req.cookies.bankNumber);

    if(user == null) {
        res.redirect('/');
    }

    let moneyTransfer = {
        target: req.body.targetNumber,
        amount: req.body.moneyAmount,
        title: req.body.title
    };

    let action = bank.createAction("transfer", {
        origin: user.number,
        target: parseInt(moneyTransfer.target),
        amount: parseInt(moneyTransfer.amount),
        title: moneyTransfer.title
    });

    // Jesli createAction zwrocilo akcje to transfer sie powiodl
    if(action != null) {
        res.redirect("/dashboard?transfer=success");
    }
    else {
        res.redirect("/dashboard?transfer=failed");
    }
});

app.post('/adduser', (req, res) => {
    // Powinnismy dostac number, name i amount
    let userData = {
        number: parseInt(req.body.number),
        name: req.body.name,
        initialAmount: parseInt(req.body.amount)
    };

    let action = null;
    if(userData.number != null && userData.name != null && userData.initialAmount != null) {
        action = bank.createAction('create_agent', userData);
    }

    // Jesli action nie jest null to operacja dodania uzytkownika powiodla sie
    if(action) {
        res.redirect('/?newuser=success');
    }
    // Jesli action jest null to operacja dodania uzytkownika nie powiodla sie lub podane dane byly bledne
    else {
        console.error("invalid add user parameters");
        res.redirect('/?newuser=failed');
    }
});

app.get('/logout', (req, res) => {
    console.log("wylogowuje uzytkownika");
    // Wyczysc plik cookie z numerem konta
    res.clearCookie("bankNumber");
    res.redirect('/');
});

// Wystartuj serwer
app.listen(port, () => {
    console.log("Wirtualny Bank wystartowany na porcie", port);
    console.log("Uzytkownicy banku:", bank.agents);
});

