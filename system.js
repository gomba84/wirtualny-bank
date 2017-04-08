const action = require("./action.js");
const fs = require("fs");

/**
 * Klasa, ktora zawiera funkcje rejestrujace i wykonujace akcje, przechowuje stan systemu.
 */
class Bank {
    constructor(historyFilename) {
        this.historyJSONFile = historyFilename; // Plik JSON, w ktorym zapisane maja byc wykonane operacje
        this.possibleActions = action.actions;  // Tablica przechowujaca wszystkie mozliwe identyfikatory akcji
        this.actions = [];  // Tablica przechowujaca wszystkie akcje, ktore zostaly wykonane przez system
        this.agents = [];   // Tablica przechowujaca wszystkich agentow (uzytkownikow systemu posiadajacych numer konta)
        this.transfers = [];    // Tablica przechowujaca wszystkie transfery wykonane w systemie
    }

    getUserByBankNumber(number) {
        for(let i = 0; i < this.agents.length; i++) {
            if(number == this.agents[i].number) return this.agents[i];
        }

        return null;
    }

    /**
     * Tworzy obiekt wybranej na podstawie argumentu name klasy akcji i przekazuje argument data do konstruktora klasy akcji.
     * @param {string} name Identyfikator akcji (nazwa klasy akcji bez przedrostka "action_")
     * @param {Object} data Obiekt z polami danych, ktory zostanie uzyty w konstruktorze akcji
     * @param {bool} isPlaybackMode Jesli ten argument to true, nie zapisuj akcji w historii - jestesmy w trybie odtwarzania historii
     */
    createAction(name, data, isPlaybackMode = false) {
        if(name == null) return null;

        // Znajdz identyfikator akcji zgodny z podanym w argumencie name
        let action_name = null;
        for(let i = 0; i < this.possibleActions.length; i++) {
            if(this.possibleActions[i] == name) {
                action_name = this.possibleActions[i];
                break;
            }
        }

        // Jesli podany identyfikator akcji nie zostal odnaleziony, zwroc null
        if(action_name == null) return null;

        // Dodaj aktualny timestamp do obiektu data
        data.timestamp = Date.now();

        // Skonstruuj obiekt klasy podanej akcji podajac mu dane z argumentu wywolania funkcji
        let actionName = "action_" + action_name;
        let newAction = new action[actionName](data);
        console.log("new action:", newAction);

        // Zarejestruj akcje w systemie
        return this.registerAction(newAction);
    }

    /**
     * Tworzy akcje logu (LoggedAction), zapisuje ja oraz sama akcje zapisuje w odpowiedniej tablicy
     * @param {Object} action Obiekt akcji
     * @param {bool} isPlaybackMode Jesli ten argument to true, nie zapisuj akcji w historii - jestesmy w trybie odtwarzania historii
     */
    registerAction(action, isPlaybackMode = false) {
        if(action == null) return;

        // Dodaj akcje do tablicy akcji systemu. Ten obiekt akcji enkapsuluje cale dane akcji w polu action_data
        // oraz posiada timestamp z wartoscia czasu w momencie wykonywania tej funkcji
        let actionLogElement = {
            timestamp: Date.now(),
            action_data: action
        };
        this.actions.push(action);

        // Dodaj akcje do odpowiedniej tablicy
        switch(action.action) {
            case "create_agent": {
                let userCreation = this.createUser(action);
                console.log("user creation:", userCreation);

                // Zapisz dodanie uzytkownika w historii operacji
                if(isPlaybackMode == false) {
                    if(this.serializeActionInHistoryJSONFile(this.historyJSONFile, userCreation) == false) {
                        console.error("unable to save user creation in history!");
                    }
                }

                return userCreation;
                break;
            }
            case "transfer": {
                let transfer = this.processTransfer(action);
                if(transfer != null) {
                    // Zapisz wykonany transfer w historii operacji
                    if(isPlaybackMode == false) {
                        if(this.serializeActionInHistoryJSONFile(this.historyJSONFile, transfer) == false) {
                            console.error("unable to save action in history!");
                        }
                    }

                    return transfer;
                }
                else {
                    console.log("could not transfer!");
                    return null;
                }
                break;
            }
            default: {
                return null;
                break;
            }
        }
    }

    /**
     * Wykonaj transfer pieniezny, jesli sie powiodl zwraca akcje transferu, jesli nie zwraca null
     * 
     * @param {any} transfer 
     * @returns 
     */
    processTransfer(transfer) {
        // Sprawdz czy uzytkownicy istnieja
        let originUser = this.getUserByBankNumber(transfer.origin);
        let targetUser = this.getUserByBankNumber(transfer.target);

        // Sprawdz czy uzytkownik wysylajacy jest inny niz otrzymujacy
        let isOriginOtherThanTarget = originUser.number != targetUser.number;

        // Sprawdz czy przesylana kwota jest wieksza od 0
        let isAmountGreaterThanZero = transfer.amount > 0;

        // Sprawdz czy przesylajacy ma wystarczajaca ilosc srodkow
        let originHasEnoughMoney = originUser.amount >= transfer.amount;

        // Przetransferuj srodki
        if(originUser != null && targetUser != null && 
            isAmountGreaterThanZero && originHasEnoughMoney && isOriginOtherThanTarget) {
            originUser.amount -= transfer.amount;
            targetUser.amount += transfer.amount;

            this.updateUser(originUser);
            this.updateUser(targetUser);
            this.transfers.push(transfer);

            return transfer;
        }
        else {
            return null;
        }
    }

    createUser(action) {
        console.log(action);
        // Sprawdz czy uzytkownik z tym numerem istnieje w systemie
        if(this.getUserByBankNumber(action.number) != null) {
            console.error("cannot create user with number", action.number, "it already exists!");
            return null;
        }

        // Jesli startowe srodki sa mniejsze niz 0 ustaw je na 0
        if(action.amount < 0) action.amount = 0;

        console.log('successfully added new user:', action);
        this.agents.push(action);
        return action;
    }

    updateUser(user) {
        if(user == null) return;

        for(let i = 0; i < this.agents.length; i++) {
            if(user.number == this.agents[i].number) {
                this.agents[i] = user;
            }
        }
    }

    listHistoryForUser(user) {
        let historyTransfers = [];
        
        for(let i = 0; i < this.transfers.length; i++) {
            let transfer = this.transfers[i];
            if(this.transfers[i].origin == user.number || this.transfers[i].target == user.number) {
                historyTransfers.push(this.transfers[i]);
            }
        }

        // Posortuj historie malejaco ze wzgledu na timestamp
        historyTransfers.sort((a, b) => {
            if(a.timestamp < b.timestamp) return -1;
            if(a.timestamp > b.timestamp) return 1;
            if(a.timestamp == b.timestamp) return 0;
        });

        return historyTransfers;
    }

    serializeActionInHistoryJSONFile(filename, action) {
        // Sprawdz czy plik podany w filename istnieje
        if(fs.existsSync(filename) == false) return false;

        // Sprawdz czy akcja nie jest null
        if(action == null) return false;

        // Dodaj nową linię przed JSONem akcji
        let entryForHistory = "\n";
        let historyObject = {
            timestamp: Date.now(),
            action_data: action
        };

        try {
            entryForHistory += JSON.stringify(historyObject);
        }
        catch(e) {
            return false;
        }

        fs.appendFileSync(filename, entryForHistory);
        return true;
    }

    /**
     * Parsuje plik linia po linii w poszukiwaniu obiektow LoggedAction i wykonuje je z uzyciem registerAction. W efekcie odtwarza stan systemu.
     * @param {string} filename Nazwa pliku, ktory ma byc sparsowany linia po linii jako obiekt LoggedAction i wykonany z uzyciem registerAction
     */
    parseJSONAndPlaybackActions(filename) {
        // Synchronicznie przeczytaj ciag znakow w pliku
        let data = fs.readFileSync(filename, {encoding: "utf-8", flag: "r"});
        let readArray = data.split("\n");

        // Sprobuj parsowac kazda linie na obiekt LoggedAction i odtworzyc kazda akcje
        for(let i = 0; i < readArray.length; i++) {
            let parsedAction = null;
            try {
                parsedAction = JSON.parse(readArray[i]);
                if(parsedAction.action_data != null) {
                    this.registerAction(parsedAction.action_data, true);
                }
            }
            catch(e) {
                continue;
            }   
        }

        return true;
    }
}

exports.Bank = Bank;
