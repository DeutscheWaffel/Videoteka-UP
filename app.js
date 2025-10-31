document.addEventListener('DOMContentLoaded', function () {
    // --- Формы регистрации/входа ---
    function showForm(formId) {
        const forms = document.querySelectorAll('.form');
        forms.forEach(form => {
            if (form.classList.contains('active')) {
                form.classList.remove('active');
            }
        });
        const target = document.getElementById(formId);
        if (target) {
            target.classList.add('active');
        }
    }
    window.showForm = showForm;

    const API_BASE = (() => {
        if (window.location.protocol === 'file:') {
            return 'http://localhost:8000/api/v1';
        }
        return `${window.location.origin}/api/v1`;
    })();

    async function apiRequest(path, options = {}) {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
        const text = await res.text();
        let data;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
        if (!res.ok) {
            const message = (data && (data.detail || data.message)) || 'Ошибка запроса';
            throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
        }
        return data;
    }

    // --- Обработчики форм ---
    document.querySelector('.login-link a')?.addEventListener('click', function(e) {
        e.preventDefault();
        showForm('loginForm');
    });

    document.querySelector('.register-link a')?.addEventListener('click', function(e) {
        e.preventDefault();
        showForm('registerForm');
    });

    document.getElementById('register')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('error');

        if (password !== confirmPassword) {
            errorDiv.textContent = 'Пароли не совпадают!';
            errorDiv.classList.add('show');
            return;
        }

        try {
            await apiRequest('/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });
            errorDiv.classList.remove('show');
            errorDiv.textContent = '';
            showForm('loginForm');
        } catch (err) {
            errorDiv.textContent = err.message || 'Ошибка регистрации';
            errorDiv.classList.add('show');
        }
    });

    document.getElementById('login')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        if (!username || !password) {
            errorDiv.textContent = 'Заполните все поля!';
            errorDiv.classList.add('show');
            return;
        }

        try {
            const data = await apiRequest('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            if (data && data.access_token) {
                localStorage.setItem('token', data.access_token);
            }
            errorDiv.classList.remove('show');
            errorDiv.textContent = '';
            window.location.href = '/home.html';
        } catch (err) {
            errorDiv.textContent = err.message || 'Ошибка входа';
            errorDiv.classList.add('show');
        }
    });

    // --- Корзина и закладки ---
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];

    function updateStorage() {
        localStorage.setItem('cart', JSON.stringify(cart));
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    }

    async function fetchBookmarksFromServer() {
        try {
            const data = await apiRequest('/bookmarks');
            bookmarks = data.map(b => ({ id: b.movie_id, title: b.title, author: b.author || '', price: b.price || '' }));
            updateStorage();
            return bookmarks;
        } catch (e) {
            return bookmarks;
        }
    }

    async function addBookmarkOnServer(movie) {
        return apiRequest('/bookmarks', {
            method: 'POST',
            body: JSON.stringify({ movie_id: movie.id, title: movie.title, author: movie.author, price: movie.price })
        });
    }

    async function removeBookmarkOnServer(movieId) {
        return apiRequest(`/bookmarks/${movieId}`, { method: 'DELETE' });
    }

    async function fetchCartFromServer() {
        try {
            const data = await apiRequest('/cart');
            cart = data.map(c => ({ id: c.movie_id, title: c.title, author: c.author || '', price: c.price || '' }));
            updateStorage();
            return cart;
        } catch (e) {
            return cart;
        }
    }

    async function addCartOnServer(movie) {
        return apiRequest('/cart', {
            method: 'POST',
            body: JSON.stringify({ movie_id: movie.id, title: movie.title, author: movie.author, price: movie.price })
        });
    }

    async function removeCartOnServer(movieId) {
        return apiRequest(`/cart/${movieId}`, { method: 'DELETE' });
    }

    async function toggleCart(movie) {
        const index = cart.findIndex(item => String(item.id) === String(movie.id));
        const button = document.querySelector(`[data-id="${movie.id}"] .cart-btn`);

        try {
            if (index === -1) {
                await addCartOnServer(movie);
                cart.push(movie);
                button.textContent = '🗑️';
                alert(`Фильм "${movie.title}" добавлен в корзину!`);
            } else {
                await removeCartOnServer(movie.id);
                cart.splice(index, 1);
                button.textContent = '🛒';
                alert(`Фильм "${movie.title}" удалён из корзины!`);
            }
            updateStorage();
        } catch (e) {
            alert(e.message || 'Ошибка работы с корзиной');
        }
    }

    async function toggleBookmark(movie) {
        const index = bookmarks.findIndex(item => String(item.id) === String(movie.id));
        const button = document.querySelector(`[data-id="${movie.id}"] .bookmark-btn`);

        try {
            if (index === -1) {
                await addBookmarkOnServer(movie);
                bookmarks.push(movie);
                button.textContent = '🗑️';
                alert(`Фильм "${movie.title}" добавлен в закладки!`);
            } else {
                await removeBookmarkOnServer(movie.id);
                bookmarks.splice(index, 1);
                button.textContent = '🏷️';
                alert(`Фильм "${movie.title}" удалён из закладок!`);
            }
            updateStorage();
        } catch (e) {
            alert(e.message || 'Ошибка работы с закладками');
        }
    }

    document.body.addEventListener('click', async (e) => {
        const cartBtn = e.target.closest('.cart-btn');
        const bookmarkBtn = e.target.closest('.bookmark-btn');
        if (!cartBtn && !bookmarkBtn) return;

        const card = e.target.closest('.movie-card');
        if (!card) return;
        const title = card.querySelector('.movie-title')?.textContent || '';
        const author = card.querySelector('.movie-author')?.textContent || '';
        const price = card.querySelector('.movie-price')?.textContent || '';
        const id = card.getAttribute('data-id');
        const movie = { id, title, author, price };

        if (cartBtn) {
            await toggleCart(movie);
        }
        if (bookmarkBtn) {
            await toggleBookmark(movie);
        }
    });

    fetchCartFromServer();
    fetchBookmarksFromServer();

    // --- Жанры ---
    document.querySelectorAll('#genreList .genre-item').forEach(item => {
        item.addEventListener('click', function () {
            const genre = item.getAttribute('data-genre');
            if (!genre) return;
            window.location.href = `/genre-${genre}.html`;
        });
    });

    // ==============================
    // === СОРТИРОВКА ФИЛЬМОВ ===
    // ==============================

    // Глобальная переменная для хранения всех фильмов
    let allFilmsCache = [];

    // Функция сортировки
    function sortFilms(films, field) {
        return [...films].sort((a, b) => {
            let valA = a[field] ?? '';
            let valB = b[field] ?? '';

            if (field === 'price') {
                const numA = parseFloat(valA) || 0;
                const numB = parseFloat(valB) || 0;
                return numA - numB;
            }

            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (valA < valB) return -1;
            if (valA > valB) return 1;
            return 0;
        });
    }

    // Загрузка фильмов
    async function loadHomeMovies() {
        const allMoviesSection = document.getElementById('allMoviesSection');
        const randomMoviesSection = document.getElementById('randomMoviesSection');
        if (!allMoviesSection || !randomMoviesSection) return;

        try {
            const allFilms = await apiRequest('/films/all');
            allFilmsCache = allFilms; // ← сохраняем для сортировки
            renderMovies(allFilms, allMoviesSection);

            const randomFilms = await apiRequest('/films/random/4');
            renderMovies(randomFilms, randomMoviesSection);
        } catch (e) {
            console.error('Ошибка загрузки фильмов:', e);
        }
    }

    // Обработчик сортировки
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
        const field = e.target.value;
        const sorted = sortFilms(allFilmsCache, field);
        renderMovies(sorted, document.getElementById('allMoviesSection'));
    });

    // --- Рендеринг фильмов ---
    function renderMovies(films, container) {
        container.innerHTML = '';

        films.forEach(film => {
            let imageSrc;
            if (film.movie_base64) {
                if (film.movie_base64.startsWith('data:image/')) {
                    imageSrc = film.movie_base64;
                } else {
                    imageSrc = `data:image/jpeg;base64,${film.movie_base64}`;
                }
            } else {
                imageSrc = getImagePathForFilm(film.title);
            }

            const titleToDisplay = film.title_ru || film.title;
            const fallbackImage = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='220'%3E%3Crect fill='%23000' width='160' height='220'/%3E%3Ctext x='50%25' y='50%25' fill='white' text-anchor='middle' dominant-baseline='middle' font-size='14'%3E${encodeURIComponent(titleToDisplay)}%3C/text%3E%3C/svg%3E`;

            const card = document.createElement('div');
            card.className = 'movie-card';
            // ИСПРАВЛЕНО: используем film.id (или film.flim_id, если точно так в API)
            card.setAttribute('data-id', film.id || film.flim_id);

            const img = document.createElement('img');
            img.src = imageSrc;
            img.alt = titleToDisplay;
            img.onerror = function() {
                this.src = fallbackImage;
            };
            card.appendChild(img);

            const movieInfo = document.createElement('div');
            movieInfo.className = 'movie-info';

            const title = document.createElement('div');
            title.className = 'movie-title';
            title.textContent = titleToDisplay;

            const author = document.createElement('div');
            author.className = 'movie-author';
            author.textContent = film.author || 'Неизвестный режиссёр';

            const price = document.createElement('div');
            price.className = 'movie-price';
            if (film.price) {
                price.textContent = `${film.price} ₽/шт`;
            } else {
                price.textContent = 'Цена не указана';
            }

            const rating = document.createElement('div');
            rating.className = 'movie-rating';
            rating.textContent = '⭐⭐⭐⭐⭐';

            const buttons = document.createElement('div');
            buttons.className = 'movie-buttons';

            const buyBtn = document.createElement('button');
            buyBtn.className = 'movie-btn buy-btn';
            buyBtn.textContent = 'Купить';

            const bookmarkCartContainer = document.createElement('div');
            bookmarkCartContainer.className = 'bookmark-cart-container';

            const bookmarkBtn = document.createElement('button');
            bookmarkBtn.className = 'movie-btn bookmark-btn';
            bookmarkBtn.textContent = '🏷️';

            const cartBtn = document.createElement('button');
            cartBtn.className = 'movie-btn cart-btn';
            cartBtn.textContent = '🛒';

            bookmarkCartContainer.appendChild(bookmarkBtn);
            bookmarkCartContainer.appendChild(cartBtn);
            buttons.appendChild(bookmarkCartContainer);

            movieInfo.appendChild(title);
            movieInfo.appendChild(author);
            movieInfo.appendChild(price);
            movieInfo.appendChild(rating);
            movieInfo.appendChild(buttons);
            card.appendChild(movieInfo);
            container.appendChild(card);
        });
    }

    function getImagePathForFilm(title) {
        const titleMapping = {
            'The Dark Knight': '/images_for_movies/the_dark_knight.jpg',
            'Gladiator': '/images_for_movies/gladiator.jpg',
            'Mad Max: Fury Road': '/images_for_movies/mad_max_fury_road.jpg',
            'Forrest Gump': '/images_for_movies/forrest_gump.jpg',
            'Fight Club': '/images_for_movies/fight_club.jpg',
            'Alien': '/images_for_movies/alien.jpg',
            'Conjuring': '/images_for_movies/conjuring.jpg',
            'Conjuring 2': '/images_for_movies/conjuring_2.jpg',
            'Inception': '/images_for_movies/inception.jpg',
            'The Matrix': '/images_for_movies/the_matrix.jpg',
            'Interstellar': '/images_for_movies/interstellar.jpg',
            'Lord of the Rings: The Return of the King': '/images_for_movies/lord_of_the_rings_the_return_of_the_king.jpg',
            'Amelie': '/images_for_movies/amelie.jpg',
            'The Shawshank Redemption': '/images_for_movies/the_shawshank_redemption.jpg',
            'Star Wars': '/images_for_movies/star_wars.jpg'
        };

        if (titleMapping[title]) {
            return titleMapping[title];
        }
        const titleLower = title.toLowerCase();
        for (const [key, value] of Object.entries(titleMapping)) {
            if (key.toLowerCase() === titleLower) {
                return value;
            }
        }
        return '/images_for_movies/placeholder.jpg';
    }

    // Запуск загрузки фильмов
    if (document.getElementById('allMoviesSection')) {
        loadHomeMovies();
    }
});