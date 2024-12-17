let productIdToBuy, currentCategory, currentPage, username;
let cachedData = null;
let retryCount = 0;

const version = "1.0.1";
console.log("------------------------------- NyaruVT Panel -------------------------------");
console.log("Version: " + version);
console.log("Developer: Gameware75");
console.warn("© 2024 Gameware75. Dieses Panel wurde von Gameware75 entwickelt und darf ohne ausdrückliche Erlaubnis nicht kopiert oder weiterverwendet werden.");
console.log("----------------------------------------------------------------------------");

function showElement(site) {
    const elements = ["link", "error", "panel", "profil", "product", "rangliste", "Locked", "banned", "loading", "puscharecomfirm", "puschareerror", "no-internet-connection"];
    elements.forEach(id => document.getElementById(id).style.display = id === site ? "block" : "none");
}

function changeSite(site, productId, category) {
    switch (site) {
        case "rangliste":
            showElement("rangliste");
            loadRanking();
            break;
        case "panel":
            showElement("panel");
            startPanel();
            break;
        case "profil":
            showElement("profil");
            startProfile();
            break;
        case "product":
            showElement("product");
            startProduct(productId, category);
            break;
        case "puscharecomfirm":
            showElement("puscharecomfirm");
            break;
        case "puschareerror":
            showElement("puschareerror");
            break;
        case "banned":
            showElement("banned");
            // get the user id
            window.Twitch.ext.viewer.id
            document.getElementById("userid").textContent = window.Twitch.ext.viewer.id;
            break;
        default:
            showElement(site);
            break;
    }
}

function fetchData(data = null, noCache = false) {
    return new Promise((resolve, reject) => {
        if (data !== null) {
            resolve(data);
        } else if (cachedData !== null && !noCache) {
            resolve(cachedData);
        } else {
            Twitch.ext.onAuthorized(auth => {
                const headers = {
                    'Content-Type': 'application/json',
                    'x-extension-jwt': auth.token,
                    'Version': version,
                    'channelId': auth.channelId
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000); // Timeout nach 4 Sekunden

                fetch('https://api.nyaru.de/panel/update?location=twitch', {
                    headers,
                    signal: controller.signal
                })
                    .then(response => {
                        clearTimeout(timeoutId); // Timeout abbrechen, wenn erfolgreich
                        if (!response.ok) {
                            throw new Error("Network response was not ok");
                        }
                        return response.json();
                    })
                    .then(data => {
                        retryCount = 0; // Reset retry count on success
                        cachedData = data; // Cache the fetched data
                        resolve(data);
                    })
                    .catch(err => {
                        clearTimeout(timeoutId); // Timeout abbrechen
                        retryCount++;
                        if (retryCount >= 3) {
                            retryCount = 0; // Reset counter after reaching max retries
                            // check if the user is online
                            fetch('https://api.twitch.tv/helix/users?id=' + window.Twitch.ext.viewer.id, {
                                headers: {
                                    'Client-ID': auth.clientId,
                                    'Authorization': 'Extension ' + auth.helixToken

                                }
                            }).then(response => changeSite('error')).catch( // if the user is offline
                                () => changeSite('no-internet-connection') // if the user is online
                            );
                        } else {
                            setTimeout(() => fetchData(data, noCache).then(resolve).catch(reject), 1000); // Retry after 1 second
                        }
                    });
            });
        }
    });
}

function updateInfo(user, data = cachedData) {
    const diamonds = data.diamonds[user];
    document.getElementById("dias").textContent = diamonds > 9999999999 ? "∞" : diamonds;
}

function loadProducts(category, page = 1, data = cachedData) {
    if (document.getElementById('panel').style.display === 'none') {
        return;
    }
    const products = data.products.product_categories[category];
    const start = (page - 1) * (category === 'socken' ? 2 : 4);
    const largebild = (category === 'socken' || category === 'Ganzes Outfit');
    const end = start + (largebild ? 2 : 4);
    const container = document.querySelector('.menü3');
    container.innerHTML = '';
    products.slice(start, end).forEach((product, index) => {
        const productElement = document.createElement('a');
        productElement.classList.add('produkt');
        productElement.onclick = () => changeSite('product', product.product_id, category);
        productElement.innerHTML = `
            <img src="${product.img}" alt="${product.name}" style="width: 110px; height: ${largebild ? 220 : 110}px; object-fit: contain; background-color: rgba(255,255,255,0.53)" id="productimg ${index}" title="${product.name} (${product.price} Dias)">
        `;
        // wen user diamanten unter preis sind dan rot
        if (product.price > data.diamonds[username]) {
            // rote schrift mit weissem starken text umrandung
            productElement.innerHTML += `<div class="price-label" style="color: red; text-shadow: -1px 0 white, 0 1px white, 1px 0 white, 0 -1px white;">${product.price} Dias</div>`;
        } else {
        productElement.innerHTML += `<div class="price-label">${product.price} Dias</div>`;
        }
        container.appendChild(productElement);
    });

    document.getElementById('back').disabled = page === 1;
    document.getElementById('next').disabled = start + (category === 'socken' ? 2 : 4) >= products.length;

    const kategorien = data.products.product_categories;
    const kategorienname = Object.keys(kategorien);
    const index = kategorienname.indexOf(category);

    document.getElementById('Lcategorie').src = `https://api.nyaru.de/img/kategorien/${kategorienname[(index + kategorienname.length - 1) % kategorienname.length]}.png?location=twitch`;
    document.getElementById('Mcategorie').src = `https://api.nyaru.de/img/kategorien/${kategorienname[index]}.png?location=twitch`;
    document.getElementById('Rcategorie').src = `https://api.nyaru.de/img/kategorien/${kategorienname[(index + 1) % kategorienname.length]}.png?location=twitch`;
}

function startPanel() {
    updateInfo(username); // Update user info
    setTimeout(() => {
        currentPage = 1;
        currentCategory = "socken"; // Set default category
        loadProducts(currentCategory, currentPage); // Load products for the default category
    }, 50);

    // ändere profilicon bild zu user profilbild
    Twitch.ext.onAuthorized(auth => {
        fetch(`https://api.twitch.tv/helix/users?id=` + window.Twitch.ext.viewer.id, {
            headers: {
                'Client-ID': auth.clientId,
                'Authorization': 'Extension ' + auth.helixToken
            }
        })
            .then(response => response.json())
            .then(data => {
                // Display user's profile image and username
                document.getElementById('profilicon').src = data.data[0].profile_image_url;
            })
            .catch(console.error);
    });
}

function startProfile() {
    Twitch.ext.onAuthorized(auth => {
        fetch(`https://api.twitch.tv/helix/users?id=` + window.Twitch.ext.viewer.id, {
            headers: {
                'Client-ID': auth.clientId,
                'Authorization': 'Extension ' + auth.helixToken
            }
        })
            .then(response => response.json())
            .then(data => {
                // Display user's profile image and username
                document.getElementById('profilbild').src = data.data[0].profile_image_url;
                document.getElementById('username').textContent = data.data[0].display_name;
                updateProfileInfo(username); // Update profile-specific information
            })
            .catch(console.error);
    });
}

function updateProfileInfo(user) {
    fetchData()
        .then(data => {
            const diamonds = data.diamonds[user] || 0;
            document.getElementById("diaspanel").textContent = diamonds > 99999999 ? "∞" : diamonds;

            const sortedUsers = Object.entries(data.diamonds)
                .sort((a, b) => b[1] - a[1]) // Sort users by their diamond count
                .filter(item => item[1] < 99999999);

            const rank = sortedUsers.findIndex(([name]) => name === user) + 1;
            document.getElementById("rang").textContent = rank; // Display user's rank
        })
        .catch(() => changeSite("error")); // Handle errors by switching to the error site
}

function buyProduct() {
    const buyButton = document.getElementById('buybtn');
    productIdToBuy = buyButton.getAttribute('data-product-id'); // Get the product ID from the button's data attribute
    buyButton.textContent = 'Loading...';
    buyButton.disabled = true;
    buyButton.style.color = 'white';

    Twitch.ext.onAuthorized(auth => {
        fetch(`https://api.nyaru.de/panel/purchases?product=${productIdToBuy}&location=twitch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-extension-jwt': auth.token,
                'Version': version,
                'channelId': auth.channelId
            }
        })
            .then(response => response.json())
            .then(data => {
                const success = data.message === 'Kauf erfolgreich';
                if (success) {
                    changeSite('puscharecomfirm');
                } else {
                    changeSite('puschareerror');
                    document.getElementById('puschareerror-text').textContent = data.message;
                }
                setTimeout(() => changeSite('panel'), 5000); // Redirect to panel after 2 seconds
            })
            .catch(
                () => {
                    changeSite('puschareerror');
                    document.getElementById('puschareerror-text').textContent = 'Beim Kaufprozess ist ein unbekannter Fehler aufgetreten :(';
                    setTimeout(() => changeSite('panel'), 5000); // Redirect to panel after 2 seconds

                }
            );

    });

}

function startProduct(productId, category) {
    fetchData()
        .then(data => {
            // clear start page
            const menü3 = document.querySelector('.menü3');
            menü3.innerHTML = "<p>Die Produkte werden geladen</p> <img src=\"https://api.nyaru.de/img/icons/loading.gif\" alt=\"loading\" style=\"width: 50%\">";
            document.getElementById('Lcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';
            document.getElementById('Mcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';
            document.getElementById('Rcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';


            const product = data.products.product_categories[category].find(p => p.product_id === productId);
            const imgElement = document.getElementById('img');
            const priceElement = document.getElementById('price');
            const buyButton = document.getElementById('buybtn');
            const nameElement = document.getElementById('name');

            if (product) {
                imgElement.src = `${product.img}`;
                priceElement.textContent = `${product.price} Dias`;
                nameElement.textContent = `${product.name}`;
                const canAfford = product.price <= data.diamonds[username];

                buyButton.textContent = canAfford ? `Jetzt Kaufen für ${product.price} Dias` : 'Du hast nicht genug Dias';
                buyButton.style.color = canAfford ? 'white' : 'red';
                buyButton.disabled = !canAfford;
                buyButton.setAttribute('data-product-id', productId);
            } else {
                imgElement.src = 'https://api.nyaru.de/img/icons/error.gif';
                priceElement.textContent = 'N/A';
            }
        })
        .catch(console.error);
}

function loadRanking() {

    fetchData()
        .then(data => {

            const table = document.getElementById("ranglistetabele")


            table.innerHTML = "<tr><th>Platz</th><th>Username</th><th>Dias</th></tr>";

            const sortedUsers = Object.entries(data.diamonds)
                .sort((a, b) => b[1] - a[1]) // Sort users by diamonds, highest first
                .filter(item => item[1] < 99999999);

            sortedUsers.forEach(([user, diamonds], index) => {
                const row = table.insertRow();

                if (index + 1 === 1) {
                    row.insertCell(0).textContent = "1";
                    row.style.fontWeight = "bold";
                }
                else if (index + 1 === 2) {
                    row.insertCell(0).textContent = "2";
                    row.style.fontWeight = "bold";
                }
                else if (index + 1 === 3) {
                    row.insertCell(0).textContent = "3";
                    row.style.fontWeight = "bold";
                } else {
                    row.insertCell(0).textContent = index + 1;
                }
                row.insertCell(1).textContent = user;
                row.insertCell(2).textContent = diamonds;
                // ist der user der viewer
                if (user === username) {
                    row.style.backgroundColor = "rgba(0, 255, 0, 0.3)";
                }

            });
        })
        .catch(console.error); // Log errors if they occur
}

function initialize() {
    document.getElementById('buybtn').addEventListener('click', buyProduct);
    document.getElementById('exit1').addEventListener('click', function() { changeSite('panel'); });
    document.getElementById('exit2').addEventListener('click', function() { changeSite('panel'); });
    document.getElementById('exit3').addEventListener('click', function() { changeSite('panel'); });
    document.getElementById('login').addEventListener('click', function() { window.Twitch.ext.actions.requestIdShare(); });
    document.getElementById('ranglisteicon').addEventListener('click', function() { changeSite('rangliste'); });
    document.getElementById('profilicon').addEventListener('click', function() { changeSite('profil'); });

    document.getElementById('back').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadProducts(currentCategory, currentPage);
        }
    });

    document.getElementById('next').addEventListener('click', () => {
        if (currentPage * 4 < cachedData.products.product_categories[currentCategory].length) {
            currentPage++;
            loadProducts(currentCategory, currentPage);
        }
    });

    function getNextCategory(category) {
        // change category img to blank
        document.getElementById('Lcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';
        document.getElementById('Mcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';
        document.getElementById('Rcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';

        const categories = Object.keys(cachedData.products.product_categories);
        const index = categories.indexOf(category);
        return categories[(index + 1) % categories.length];
    }

    function getPreviousCategory(category) {
        document.getElementById('Lcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';
        document.getElementById('Mcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';
        document.getElementById('Rcategorie').src = 'https://api.nyaru.de/img/icons/loading.gif';
        const categories = Object.keys(cachedData.products.product_categories);
        const index = categories.indexOf(category);
        return categories[(index + categories.length - 1) % categories.length];
    }



    document.getElementById('categorieswitchr').addEventListener('click', () => {
        currentCategory = getNextCategory(currentCategory);
        currentPage = 1;
        loadProducts(currentCategory, currentPage);
    });

    document.getElementById('categorieswitchl').addEventListener('click', () => {
        currentCategory = getPreviousCategory(currentCategory);
        currentPage = 1;
        loadProducts(currentCategory, currentPage);
    });

    document.getElementById('Rcategorie').addEventListener('click', () => {
        currentCategory = getNextCategory(currentCategory);
        currentPage = 1;
        loadProducts(currentCategory, currentPage);
    });

    document.getElementById('Lcategorie').addEventListener('click', () => {
        currentCategory = getPreviousCategory(currentCategory);
        currentPage = 1;
        loadProducts(currentCategory, currentPage);
    });

    Twitch.ext.onAuthorized(auth => {
        const viewerId = window.Twitch.ext.viewer.id;
        if (!viewerId) {
            changeSite('link');
            return;
        }

        fetch(`https://api.twitch.tv/helix/users?id=${viewerId}`, {
            headers: {
                'Client-ID': auth.clientId,
                'Authorization': `Extension ${auth.helixToken}`
            }
        })
            .then(response => response.json())
            .then(data => {
                username = data.data[0].login;
            })
            .catch(console.error);

        setInterval(() => {
            fetchData(null, true).then(data => {
                cachedData = data; // Aktualisiere die globalen Daten
                updateInfo(username, data);
                loadProducts(currentCategory, currentPage, data);
                const status = data.status;
                const panel = document.getElementById('panel');
                const rangliste = document.getElementById('rangliste');
                const profil = document.getElementById('profil');
                const product = document.getElementById('product');
                const isElementVisible = panel.style.display === 'block' || rangliste.style.display === 'block' || profil.style.display === 'block' || product.style.display === 'block' || document.getElementById('puscharecomfirm').style.display === 'block' || document.getElementById('puschareerror').style.display === 'block';
                if (status === 'online' && !isElementVisible) {
                    changeSite('panel'); // Show panel if the status is online and no other site is visible
                } else if (status === 'banned') {
                    changeSite('banned'); // Show banned site if the user is banned
                } else if (status === 'error') {
                    changeSite('error'); // Show error site if an error occurred
                } else if (status === 'Locked') {
                    document.getElementById('locked-text').innerHTML = data.lockedReason;
                    changeSite('Locked'); }
            })
            ;
        }, 5000);
        setTimeout(() => {
            fetchData().then(data => {
                cachedData = data; // Initialisiere die globalen Daten online
                const status = data.status;
                if (status === 'online') {
                    changeSite('panel');
                } else if (status === 'banned') {
                    changeSite('banned');
                } else if (status === 'error') {
                    changeSite('error');
                } else if (status === 'Locked') {
                    document.getElementById('locked-text').innerHTML = data.lockedReason;
                    changeSite('Locked');
                }
            });
        }, 100);
    });
}

initialize();