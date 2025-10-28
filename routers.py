from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from database import User, Bookmark, CartItem, database, Film, Role
from schemas import UserCreate, UserResponse, Token, UserLogin, AvatarUpdate
from auth import (
    authenticate_user, 
    create_access_token, 
    get_password_hash, 
    get_current_active_user
)
from config import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Регистрация нового пользователя"""
    try:
        # Проверяем, существует ли пользователь с таким username
        existing_user = User.get_or_none(User.username == user_data.username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким именем уже существует"
            )
        
        # Проверяем, существует ли пользователь с таким email
        existing_email = User.get_or_none(User.email == user_data.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        
        # Создаем нового пользователя в транзакции
        hashed_password = get_password_hash(user_data.password)
        # Получаем роль "user" по умолчанию
        default_role = Role.get(Role.name == "user")
        
        with database.atomic():
            user = User.create(
                username=user_data.username,
                email=user_data.email,
                hashed_password=hashed_password,
                role=default_role
            )
            # Повторно читаем из БД, чтобы получить значения полей по умолчанию
            user = User.get(User.id == user.id)
        
        return UserResponse.model_validate(user, from_attributes=True)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании пользователя: {str(e)}"
        )

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    """Вход в систему"""
    user = authenticate_user(user_credentials.username, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Получить информацию о текущем пользователе"""
    # Загружаем связанную роль
    user_with_role = User.get(User.id == current_user.id)
    return UserResponse.model_validate(user_with_role, from_attributes=True)

@router.put("/me/avatar", response_model=UserResponse)
async def update_avatar(payload: AvatarUpdate, current_user: User = Depends(get_current_active_user)):
    """Обновить аватар текущего пользователя (base64)"""
    # Небольшая валидация: ограничим размер строки, чтобы не переполнять БД случайно
    if not payload.avatar_base64 or len(payload.avatar_base64) > 5_000_000:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный размер изображения")
    current_user.avatar_base64 = payload.avatar_base64
    current_user.save()
    return UserResponse.model_validate(current_user, from_attributes=True)

# --- Закладки ---
from pydantic import BaseModel
from typing import List

class BookmarkCreate(BaseModel):
    movie_id: str
    title: str
    author: str | None = None
    price: str | None = None

class BookmarkResponse(BaseModel):
    id: int
    movie_id: str
    title: str
    author: str | None = None
    price: str | None = None

    class Config:
        from_attributes = True

@router.get("/bookmarks", response_model=List[BookmarkResponse])
async def list_bookmarks(current_user: User = Depends(get_current_active_user)):
    items = Bookmark.select().where(Bookmark.user == current_user)
    return [BookmarkResponse.model_validate(item, from_attributes=True) for item in items]

@router.post("/bookmarks", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def add_bookmark(payload: BookmarkCreate, current_user: User = Depends(get_current_active_user)):
    try:
        with database.atomic():
            item, created = Bookmark.get_or_create(
                user=current_user,
                movie_id=payload.movie_id,
                defaults={
                    'title': payload.title,
                    'author': payload.author,
                    'price': payload.price,
                }
            )
            if not created:
                # обновим данные, если менялись
                item.title = payload.title
                item.author = payload.author
                item.price = payload.price
                item.save()
        return BookmarkResponse.model_validate(item, from_attributes=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Не удалось добавить закладку: {e}")

@router.delete("/bookmarks/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bookmark(movie_id: str, current_user: User = Depends(get_current_active_user)):
    deleted = Bookmark.delete().where((Bookmark.user == current_user) & (Bookmark.movie_id == movie_id)).execute()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Закладка не найдена")
    return

# --- Корзина ---
class CartItemCreate(BaseModel):
    movie_id: str
    title: str
    author: str | None = None
    price: str | None = None

class CartItemResponse(BaseModel):
    id: int
    movie_id: str
    title: str
    author: str | None = None
    price: str | None = None

    class Config:
        from_attributes = True

@router.get("/cart", response_model=List[CartItemResponse])
async def list_cart(current_user: User = Depends(get_current_active_user)):
    items = CartItem.select().where(CartItem.user == current_user)
    return [CartItemResponse.model_validate(item, from_attributes=True) for item in items]

@router.post("/cart", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_cart(payload: CartItemCreate, current_user: User = Depends(get_current_active_user)):
    try:
        with database.atomic():
            item, created = CartItem.get_or_create(
                user=current_user,
                movie_id=payload.movie_id,
                defaults={
                    'title': payload.title,
                    'author': payload.author,
                    'price': payload.price,
                }
            )
            if not created:
                item.title = payload.title
                item.author = payload.author
                item.price = payload.price
                item.save()
        return CartItemResponse.model_validate(item, from_attributes=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Не удалось добавить в корзину: {e}")

@router.delete("/cart/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_cart(movie_id: str, current_user: User = Depends(get_current_active_user)):
    deleted = CartItem.delete().where((CartItem.user == current_user) & (CartItem.movie_id == movie_id)).execute()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")
    return

# --- Смена пароля ---
from schemas import PasswordChange
from auth import verify_password

@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(payload: PasswordChange, current_user: User = Depends(get_current_active_user)):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Текущий пароль неверен")
    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Новый пароль слишком короткий")
    current_user.hashed_password = get_password_hash(payload.new_password)
    current_user.save()
    return

# --- Фильмы по жанрам ---
class FilmResponse(BaseModel):
    flim_id: int
    title: str
    title_ru: str | None = None
    author: str | None = None
    price: str | None = None
    genre_title: str
    movie_base64: str | None = None

    class Config:
        from_attributes = True

@router.get("/genres/{genre}/films", response_model=List[FilmResponse])
async def get_films_by_genre(genre: str):
    # Приводим жанр к нижнему регистру для соответствия данным
    g = genre.strip().lower()
    q = Film.select().where(Film.genre_title == g)
    return [FilmResponse.model_validate(f, from_attributes=True) for f in q]

@router.get("/films/all", response_model=List[FilmResponse])
async def get_all_films():
    """Получить все фильмы из базы данных"""
    films = Film.select()
    return [FilmResponse.model_validate(f, from_attributes=True) for f in films]

@router.get("/films/random/{count}", response_model=List[FilmResponse])
async def get_random_films(count: int = 4):
    """Получить случайные фильмы из базы данных"""
    import random
    all_films = list(Film.select())
    random.shuffle(all_films)
    return [FilmResponse.model_validate(f, from_attributes=True) for f in all_films[:count]]

# --- Админ функционал ---
async def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Получает администратора из текущего пользователя"""
    # Проверяем роль пользователя
    if current_user.role.name != "administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуются права администратора"
        )
    return current_user

# Схемы для работы с фильмами
class FilmCreate(BaseModel):
    title: str
    title_ru: str | None = None
    author: str | None = None
    price: str | None = None
    genre_title: str
    movie_base64: str | None = None

@router.post("/admin/films", response_model=FilmResponse, status_code=status.HTTP_201_CREATED)
async def create_film(film_data: FilmCreate, admin: User = Depends(get_current_admin_user)):
    """Создать новый фильм (только для админов)"""
    try:
        film = Film.create(
            title=film_data.title,
            title_ru=film_data.title_ru,
            author=film_data.author,
            price=film_data.price,
            genre_title=film_data.genre_title.lower(),
            movie_base64=film_data.movie_base64
        )
        return FilmResponse.model_validate(film, from_attributes=True)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось создать фильм: {str(e)}"
        )

@router.delete("/admin/films/{film_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_film(film_id: int, admin: User = Depends(get_current_admin_user)):
    """Удалить фильм (только для админов)"""
    try:
        film = Film.get(Film.flim_id == film_id)
        film.delete_instance()
    except Film.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Фильм не найден"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось удалить фильм: {str(e)}"
        )
    return
