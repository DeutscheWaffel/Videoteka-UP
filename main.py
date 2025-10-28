from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pathlib import Path
from contextlib import asynccontextmanager
from database import init_database, database
from routers import router
from config import HOST, PORT, DEBUG

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация базы данных при запуске
    init_database()
    yield
    # Очистка при завершении (если необходимо)
    pass

# Создание экземпляра FastAPI
app = FastAPI(
    title="Videoteka API",
    description="API для системы видеотеки с аутентификацией",
    version="1.0.0",
    lifespan=lifespan
)

# Кастомный обработчик ошибок валидации для более понятных сообщений
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = err.get("loc", [])
        field = loc[-1] if loc else "field"
        err_type = err.get("type")
        ctx = err.get("ctx", {}) or {}

        # Локализация для часто встречающихся кейсов
        if field == "password" and err_type == "string_too_short":
            min_len = ctx.get("min_length", 6)
            errors.append(f"Пароль должен быть не короче {min_len} символов")
            continue
        if field == "username" and err_type == "string_too_short":
            min_len = ctx.get("min_length", 3)
            errors.append(f"Имя пользователя должно быть не короче {min_len} символов")
            continue
        if field == "email" and err_type == "value_error.email":
            errors.append("Укажите корректный email")
            continue

        # Фолбэк — оригинальное сообщение Pydantic (может быть на английском)
        msg = err.get("msg") or "Ошибка валидации"
        errors.append(msg)

    # Если одна ошибка — вернём строку, чтобы фронт показал её как текст
    detail = errors[0] if len(errors) == 1 else errors
    return JSONResponse(status_code=422, content={"detail": detail})

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене укажите конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение/закрытие БД на каждый запрос (для Peewee)
@app.middleware("http")
async def db_session_middleware(request, call_next):
    try:
        if database.is_closed():
            database.connect(reuse_if_open=True)
        response = await call_next(request)
        return response
    finally:
        if not database.is_closed():
            database.close()

base_dir = Path(__file__).resolve().parent

# Подключение роутеров
app.include_router(router, prefix="/api/v1")

# Отдаём статику: CSS/изображения — отдельными маунтами, затем корень с HTML
app.mount("/all_css", StaticFiles(directory=str(base_dir / "all_css")), name="all_css")
app.mount("/images", StaticFiles(directory=str(base_dir / "images")), name="images")
app.mount("/images_for_buttons", StaticFiles(directory=str(base_dir / "images_for_buttons")), name="images_for_buttons")
app.mount("/images_for_movies", StaticFiles(directory=str(base_dir / "images_for_movies")), name="images_for_movies")


@app.get("/app.js")
def get_app_js():
    return FileResponse(str(base_dir / "app.js"))


# В самом конце — корневой маунт с HTML, чтобы не перехватывать пути статики выше
app.mount("/", StaticFiles(directory=str(base_dir / "all_html"), html=True), name="static_html")

@app.get("/health")
async def health_check():
    """Проверка состояния API"""
    return {"status": "healthy", "message": "API работает корректно"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG
    )
