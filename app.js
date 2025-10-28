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
    // Делаем функцию доступной глобально для inline-обработчиков в HTML
    window.showForm = showForm;

	const API_BASE = (() => {
		// Если страница открыта как file:// — используем локальный сервер FastAPI
		if (window.location.protocol === 'file:') {
			return 'http://localhost:8000/api/v1';
		}
		// Иначе — работаем от текущего origin
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

    // Привязываем обработчики к ссылкам
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
            // Покажем форму логина после успешной регистрации
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
			// После входа — на главную (корень статики)
			window.location.href = '/home.html';
        } catch (err) {
            errorDiv.textContent = err.message || 'Ошибка входа';
            errorDiv.classList.add('show');
        }
    });

    // --- Логика для корзины и закладок ---
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];

    // Функция для обновления localStorage
    function updateStorage() {
        localStorage.setItem('cart', JSON.stringify(cart));
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    }

    // --- Работа с серверными закладками ---
    async function fetchBookmarksFromServer() {
        try {
            const data = await apiRequest('/bookmarks');
            // Конвертируем к прежнему формату для совместимости UI
            bookmarks = data.map(b => ({ id: b.movie_id, title: b.title, author: b.author || '', price: b.price || '' }));
            updateStorage();
            return bookmarks;
        } catch (e) {
            // Если не авторизованы — молча игнорируем, оставляем локальные
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

    // --- Работа с серверной корзиной ---
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

    // Функция для добавления/удаления из корзины
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

    // Функция для добавления/удаления из закладок
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

    // Делегирование событий для динамически загружаемых карточек
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

    // При загрузке страницы подтянем корзину и закладки для корректной иконки
    fetchCartFromServer();
    fetchBookmarksFromServer();

    // --- Каталог жанров: переход на страницу жанра ---
    document.querySelectorAll('#genreList .genre-item').forEach(item => {
        item.addEventListener('click', function () {
            const genre = item.getAttribute('data-genre');
            if (!genre) return;
            // Страница жанра: /genre-<name>.html
            window.location.href = `/genre-${genre}.html`;
        });
    });

    // --- Загрузка фильмов на главной странице ---
    async function loadHomeMovies() {
        const allMoviesSection = document.getElementById('allMoviesSection');
        const randomMoviesSection = document.getElementById('randomMoviesSection');
        
        if (!allMoviesSection || !randomMoviesSection) return;

        try {
            // Загружаем все фильмы
            const allFilms = await apiRequest('/films/all');
            console.log('Загружено фильмов:', allFilms.length);
            if (allFilms.length > 0) {
                console.log('Пример фильма:', {
                    title: allFilms[0].title,
                    movie_base64: allFilms[0].movie_base64 ? `base64 данные (${allFilms[0].movie_base64.length} символов)` : 'нет'
                });
            }
            renderMovies(allFilms, allMoviesSection);

            // Загружаем 4 случайных фильма
            const randomFilms = await apiRequest('/films/random/4');
            console.log('Загружено случайных фильмов:', randomFilms.length);
            renderMovies(randomFilms, randomMoviesSection);
        } catch (e) {
            console.error('Ошибка загрузки фильмов:', e);
        }
    }

    function renderMovies(films, container) {
        container.innerHTML = '';
        
        films.forEach(film => {
            // Определяем изображение из БД или используем fallback
            let imageSrc;
            
            if (film.movie_base64) {
                // Проверяем, есть ли уже префикс data:
                if (film.movie_base64.startsWith('data:image/')) {
                    imageSrc = film.movie_base64;
                    console.log(`Используем base64 с префиксом для: ${film.title}`);
                } else if (film.movie_base64.startsWith('data:')) {
                    imageSrc = film.movie_base64;
                    console.log(`Используем base64 data: для: ${film.title}`);
                } else {
                    // Добавляем префикс для base64
                    imageSrc = `data:image/jpeg;base64,${film.movie_base64}`;
                    console.log(`Добавляем префикс base64 для: ${film.title} (длина: ${film.movie_base64.length})`);
                }
            } else {
                // Fallback на локальные файлы
                imageSrc = getImagePathForFilm(film.title);
                console.log(`Используем локальный путь для: ${film.title} -> ${imageSrc}`);
            }
            
            const titleToDisplay = film.title_ru || film.title;
            const fallbackImage = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='220'%3E%3Crect fill='%23000' width='160' height='220'/%3E%3Ctext x='50%25' y='50%25' fill='white' text-anchor='middle' dominant-baseline='middle' font-size='14'%3E${encodeURIComponent(titleToDisplay)}%3C/text%3E%3C/svg%3E`;
            
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.setAttribute('data-id', film.flim_id);
            
            const img = document.createElement('img');
            img.src = imageSrc;
            img.alt = titleToDisplay;
            
            // Двойной fallback
            img.onerror = function() {
                console.log('Ошибка загрузки изображения для:', titleToDisplay, 'src:', imageSrc ? imageSrc.substring(0, 50) : 'null');
                // Пробуем local file path
                const localPath = getImagePathForFilm(film.title);
                if (this.src !== localPath && localPath !== imageSrc) {
                    console.log('Пробуем локальный путь:', localPath);
                    this.src = localPath;
                    this.onerror = function() { 
                        console.log('Используем SVG fallback');
                        this.src = fallbackImage; 
                    };
                } else {
                    console.log('Используем SVG fallback напрямую');
                    this.src = fallbackImage;
                }
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
        // Маппинг названий фильмов на пути к изображениям (абсолютные пути для FastAPI)
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
        
        // Проверяем точное совпадение
        if (titleMapping[title]) {
            return titleMapping[title];
        }
        
        // Проверяем неточное совпадение (case insensitive)
        const titleLower = title.toLowerCase();
        for (const [key, value] of Object.entries(titleMapping)) {
            if (key.toLowerCase() === titleLower) {
                return value;
            }
        }
        
        // Возвращаем путь по умолчанию
        return '/images_for_movies/placeholder.jpg';
    }

    // Загружаем фильмы при загрузке главной страницы
    if (document.getElementById('allMoviesSection')) {
        loadHomeMovies();
    }
});