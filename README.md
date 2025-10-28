# Videoteka API

Бэкенд для системы видеотеки с аутентификацией пользователей, построенный на FastAPI и Peewee.

## Возможности

- ✅ Регистрация пользователей
- ✅ Вход в систему с JWT токенами
- ✅ Защищенные маршруты
- ✅ Валидация данных с Pydantic
- ✅ Поддержка SQLite (по умолчанию) и других БД
- ✅ Автоматическая документация API

## Установка

1. Установите зависимости:
```bash
pip install -r requirements.txt
```

2. Создайте файл `.env` (опционально):
```env
DATABASE_URL=sqlite:///videoteka.db
SECRET_KEY=your-super-secret-jwt-key
DEBUG=True
HOST=0.0.0.0
PORT=8000
```

## Запуск

```bash
python main.py
```

Или с uvicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API будет доступен по адресу: http://localhost:8000

## Документация API

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Аутентификация

- `POST /api/v1/register` - Регистрация нового пользователя
- `POST /api/v1/login` - Вход в систему
- `GET /api/v1/me` - Получить информацию о текущем пользователе

### Пользователи

- `GET /api/v1/users` - Получить список всех пользователей (требует аутентификации)

## Примеры использования

### Регистрация
```bash
curl -X POST "http://localhost:8000/api/v1/register" \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testuser",
       "email": "test@example.com",
       "password": "password123"
     }'
```

### Вход
```bash
curl -X POST "http://localhost:8000/api/v1/login" \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testuser",
       "password": "password123"
     }'
```

### Получение информации о пользователе
```bash
curl -X GET "http://localhost:8000/api/v1/me" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Структура проекта

```
├── main.py          # Основной файл приложения
├── config.py        # Конфигурация
├── database.py      # Модели базы данных
├── schemas.py       # Pydantic схемы
├── auth.py          # Аутентификация и авторизация
├── routers.py       # API маршруты
├── requirements.txt # Зависимости
└── README.md        # Документация
```

## Технологии

- **FastAPI** - веб-фреймворк
- **Peewee** - ORM для работы с БД
- **Pydantic** - валидация данных
- **JWT** - токены аутентификации
- **Bcrypt** - хеширование паролей
