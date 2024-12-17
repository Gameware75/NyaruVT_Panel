// Global variables
let productIdToBuy, currentCategory, currentPage, username;

// Function to hide all the UI elements by setting their display style to 'none'
function hideAllElements() {
    const elements = ["link", "offline", "error", "panel", "profil", "product", "rangliste", "nyaruhinweis", "banned", "loading"]
    elements.forEach(id => document.getElementById(id).style.display = "none");
}

// Function to show a specific UI element and hide all others
function showElement(site) {
    hideAllElements();
    document.getElementById(site).style.display = "block";
}

// Function to change the visible site (UI panel) and load relevant data based on the site parameter
function changeSite(site, productId, category) {
    console.log("panel"); // Logging "panel" for debugging purposes
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
        default:
            showElement(site);
            break;
    }
}

// Function to fetch data from an API, optionally using provided data instead of making a network request
function fetchData(data = null) {
    return new Promise((resolve, reject) => {
        if (data !== null) {
            resolve(data); // If data is provided, resolve the promise with this data
        } else {
            Twitch.ext.onAuthorized(auth => { // Use Twitch's extension API to get authorization
                const headers = {
                    'Content-Type': 'application/json',
                    'x-extension-jwt': auth.token
                };
                fetch('https://api.nyaru.de/panel/update?location=twitch', { headers }) // Fetch data from the API
                    .then(response => response.json())
                    .then(resolve)
                    .catch(reject); // Handle errors if the fetch fails
            });
        }
    });
}

// Function to update user info by fetching or using provided data
function updateInfo(user, data = null) {
    console.log(data); // Log the data for debugging purposes
    fetchData(data)
        .then(data => {
            const diamonds = data.diamonds[user];
            document.getElementById("dias").textContent = diamonds > 99999999 ? "∞" : diamonds;
        })
        .catch(() => changeSite("error")); // If fetching data fails, switch to the error site
}

// Function to load products for a given category and page, and display them
function loadProducts(category, page = 1, data = null) {
    fetchData(data)
        .then(data => {
            const products = data.products.product_categories[category];
            const start = (page - 1) * 4;
            const end = start + 4;

            const container = document.querySelector('.menü3');
            container.innerHTML = ''; // Clear the container before loading new products

            // Loop through the products and display them in the container
            products.slice(start, end).forEach((product, index) => {
                const productElement = document.createElement('a');
                productElement.classList.add('produkt');
                productElement.onclick = () => changeSite('product', product.product_id, category); // Set click event to change site to product
                productElement.innerHTML = `<img src="${product.img}" alt="${product.name}" height="110" width="110" id="productimg ${index}">`;
                container.appendChild(productElement);
            });

            // Enable or disable pagination buttons based on the current page
            document.getElementById('back').disabled = page === 1;
            document.getElementById('next').disabled = start + 4 >= products.length;
        })
        .catch(console.error); // Log any errors that occur
}

// Function to initialize and start the main panel, loading user info and products
function startPanel() {
    updateInfo(username); // Update user info
    setTimeout(() => {
        currentPage = 1;
        currentCategory = "socken"; // Set default category
        loadProducts(currentCategory, currentPage); // Load products for the default category
    }, 500);
}

// Function to load and display the user's profile
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

// Function to update profile information like diamonds and ranking
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

// Function to handle product purchase
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
                'x-extension-jwt': auth.token
            }
        })
            .then(response => response.json())
            .then(data => {
                const success = data.message === 'Kauf erfolgreich';
                buyButton.textContent = success ? 'Purchase successful' : data.message;
                buyButton.style.color = success ? 'green' : 'red';
                setTimeout(() => changeSite('panel'), 2000); // Redirect to panel after 2 seconds
            })
            .catch(console.error);
    });
}

// Function to start loading a specific product's details
function startProduct(productId, category) {
    fetchData()
        .then(data => {
            const product = data.products.product_categories[category].find(p => p.product_id === productId);
            const imgElement = document.getElementById('img');
            const priceElement = document.getElementById('price');
            const buyButton = document.getElementById('buybtn');

            if (product) {
                imgElement.src = `${product.img}`;
                priceElement.textContent = `${product.price} Dias`;
                const canAfford = product.price <= data.diamonds[username];

                buyButton.textContent = canAfford ? `Jetzt Kaufen für ${product.price} Dias` : 'Not enough Dias';
                buyButton.disabled = !canAfford;
                buyButton.style.color = canAfford ? 'white' : 'red';
                if (canAfford) buyButton.setAttribute('data-product-id', productId); // Store product ID in button's data attribute
            } else {
                imgElement.src = 'error.png'; // Show error image if product is not found
                priceElement.textContent = 'N/A';
            }
        })
        .catch(console.error);
}

// Function to load and display the ranking of users based on their diamond count
function loadRanking() {
    fetchData()
        .then(data => {
            const table = document.querySelector("table");
            table.innerHTML = "<tr><th>Platz</th><th>Username</th><th>Dias</th></tr>";

            const sortedUsers = Object.entries(data.diamonds)
                .sort((a, b) => b[1] - a[1]) // Sort users by diamonds, highest first
                .filter(item => item[1] < 99999999);

            sortedUsers.forEach(([user, diamonds], index) => {
                const row = table.insertRow();
                row.insertCell(0).textContent = index + 1;
                row.insertCell(1).textContent = user;
                row.insertCell(2).textContent = diamonds;

            });
        })
        .catch(console.error); // Log errors if they occur
}
function message(title, message) {
    showElement("message");
    document.getElementById("message-title").textContent = title;
    document.getElementById("message-text").textContent = message;
}



// Function to initialize the app by setting up event listeners and checking the user's status
function initialize() {
    document.getElementById('buybtn').addEventListener('click', buyProduct);
    document.getElementById('exit1').addEventListener('click', function() {changeSite('panel');});
    document.getElementById('exit2').addEventListener('click', function()

    {
        const buyButton = document.getElementById('buybtn');
        buyButton.textContent = 'Loading...';
        buyButton.disabled = true;
        buyButton.style.color = 'white';
        const imgElement = document.getElementById('img');
        const priceElement = document.getElementById('price');
        imgElement.src = 'loading.gif';
        priceElement.textContent = 'loading...';
        changeSite('panel');
    });
    document.getElementById('exit3').addEventListener('click', function() {changeSite('panel');});
    document.getElementById('login').addEventListener('click', function() {window.Twitch.ext.actions.requestIdShare();});
    document.getElementById('ranglisteicon').addEventListener('click', function() {changeSite('rangliste');});
    document.getElementById('profilicon').addEventListener('click', function() {changeSite('profil');});

    document.querySelectorAll('.menü2 a').forEach(link => {
        link.addEventListener('click', () => {
            currentCategory = link.id;
            currentPage = 1;
            loadProducts(currentCategory, currentPage); // Load products for the selected category
        });
    });

    document.getElementById('back').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadProducts(currentCategory, currentPage); // Load previous page of products
        }
    });

    document.getElementById('next').addEventListener('click', () => {
        fetchData().then(data => {
            const products = data.products.product_categories[currentCategory];
            if (currentPage * 4 < products.length) {
                currentPage++;
                loadProducts(currentCategory, currentPage); // Load next page of products
            }
        });
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
            fetchData().then(data => {
                const status = data.status;
                const panel = document.getElementById('panel');
                const rangliste = document.getElementById('rangliste');
                const profil = document.getElementById('profil');
                const product = document.getElementById('product');
                const isElementVisible = panel.style.display === 'block' || rangliste.style.display === 'block' || profil.style.display === 'block' || product.style.display === 'block';

                // update info
                updateInfo(username, data); // Update user info
                loadProducts(currentCategory, currentPage, data); // Load products for the current category and page

                if (status === 'online' && !isElementVisible) {
                    changeSite('panel'); // Show panel if the status is online and no other site is visible
                } else if (status === 'offline') {
                    changeSite('offline'); // Show offline site if the status is offline
                } else if (status === 'banned') {
                    changeSite('banned'); // Show banned site if the user is banned
                }
            });
        }, 10000);      // Check status every 10 seconds

        setTimeout(() => {
            fetchData().then(data => {
                const status = data.status;
                const panel = document.getElementById('panel');
                const rangliste = document.getElementById('rangliste');
                const profil = document.getElementById('profil');
                const product = document.getElementById('product');
                const isElementVisible = panel.style.display === 'block' || rangliste.style.display === 'block' || profil.style.display === 'block' || product.style.display === 'block';
                if (status === 'online' && !isElementVisible) {
                    changeSite('panel'); // Show panel if the status is online and no other site is visible
                } else if (status === 'offline') {
                    changeSite('offline'); // Show offline site if the status is offline
                } else if (status === 'banned') {
                    changeSite('banned'); // Show banned site if the user is banned
                }
            });
        }, 500); // Check status after 500ms
    });
}











// Call the initialize function to set everything up when the script loads
initialize();