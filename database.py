import os
from peewee import *
from config import DATABASE_URL

# Всегда используем SQLite
def _resolve_sqlite_path(url: str) -> str:
    """Возвращает путь к SQLite файлу из DATABASE_URL или значение по умолчанию."""
    if not url:
        return "videoteka.db"
    # Поддержка форматов: sqlite:///path/to/file.db или просто имя файла
    if url.startswith("sqlite:///"):
        return url.split("sqlite:///")[-1]
    return url

database = SqliteDatabase(_resolve_sqlite_path(DATABASE_URL))

class BaseModel(Model):
    class Meta:
        database = database

class Role(BaseModel):
    id = AutoField(primary_key=True)
    name = CharField(max_length=50, unique=True)
    description = CharField(max_length=255, null=True)
    
    class Meta:
        table_name = 'roles'

class User(BaseModel):
    id = AutoField(primary_key=True)
    username = CharField(max_length=50, unique=True, index=True)
    email = CharField(max_length=100, unique=True, index=True)
    hashed_password = CharField(max_length=255)
    is_active = BooleanField(default=True)
    avatar_base64 = TextField(null=True)
    role = ForeignKeyField(Role, backref='users', default=1)
    created_at = DateTimeField(constraints=[SQL('DEFAULT CURRENT_TIMESTAMP')])
    updated_at = DateTimeField(constraints=[SQL('DEFAULT CURRENT_TIMESTAMP')])
    
    class Meta:
        table_name = 'users'

class Bookmark(BaseModel):
    id = AutoField(primary_key=True)
    user = ForeignKeyField(User, backref='bookmarks', on_delete='CASCADE')
    movie_id = CharField(max_length=100, index=True)
    title = CharField(max_length=255)
    author = CharField(max_length=255, null=True)
    price = CharField(max_length=50, null=True)
    created_at = DateTimeField(constraints=[SQL('DEFAULT CURRENT_TIMESTAMP')])

    class Meta:
        table_name = 'bookmarks'
        indexes = (
            # Уникальность закладки по пользователю и идентификатору фильма
            (('user', 'movie_id'), True),
        )

class CartItem(BaseModel):
    id = AutoField(primary_key=True)
    user = ForeignKeyField(User, backref='cart_items', on_delete='CASCADE')
    movie_id = CharField(max_length=100, index=True)
    title = CharField(max_length=255)
    author = CharField(max_length=255, null=True)
    price = CharField(max_length=50, null=True)
    created_at = DateTimeField(constraints=[SQL('DEFAULT CURRENT_TIMESTAMP')])

    class Meta:
        table_name = 'cart_items'
        indexes = (
            (('user', 'movie_id'), True),
        )

class Film(BaseModel):
    flim_id = AutoField(primary_key=True, column_name='flim_id')
    title = CharField(max_length=255)
    title_ru = CharField(max_length=255, null=True, column_name='title-ru')
    author = CharField(max_length=255, null=True)
    price = CharField(max_length=50, null=True)
    created_at = DateTimeField(constraints=[SQL('DEFAULT CURRENT_TIMESTAMP')])
    genre_title = CharField(max_length=100, column_name='genre-title')
    movie_base64 = TextField(null=True, column_name='movie_base64')

    class Meta:
        table_name = 'film_list'

def create_tables():
    """Создает все таблицы в базе данных"""
    database.connect()
    database.create_tables([Role, User, Bookmark, CartItem, Film], safe=True)
    database.close()

def init_database():
    """Инициализирует базу данных"""
    create_tables()
    database.connect(reuse_if_open=True)
    try:
        # Создаем роли, если их еще нет
        try:
            user_role = Role.get(Role.name == "user")
        except Role.DoesNotExist:
            Role.create(name="user", description="Обычный пользователь")
        
        try:
            admin_role = Role.get(Role.name == "administrator")
        except Role.DoesNotExist:
            Role.create(name="administrator", description="Администратор системы")
        
        # Проверяем и добавляем поле role_id, если его нет
        info = database.execute_sql("PRAGMA table_info(users)").fetchall()
        columns = {row[1] for row in info}
        
        if 'role_id' not in columns:
            database.execute_sql("ALTER TABLE users ADD COLUMN role_id INTEGER DEFAULT 1")
        
        if 'avatar_base64' not in columns:
            database.execute_sql("ALTER TABLE users ADD COLUMN avatar_base64 TEXT")
        
        # Создадим таблицу корзины, если её нет
        database.create_tables([CartItem, Film], safe=True)
 
        # Миграция: добавить колонку title-ru и movie_base64, если их нет
        film_info = database.execute_sql("PRAGMA table_info(film_list)").fetchall()
        film_columns = {row[1] for row in film_info}
        if 'title-ru' not in film_columns:
            database.execute_sql("ALTER TABLE film_list ADD COLUMN \"title-ru\" TEXT")
        if 'movie_base64' not in film_columns:
            database.execute_sql("ALTER TABLE film_list ADD COLUMN movie_base64 TEXT")
    finally:
        if not database.is_closed():
            database.close()
