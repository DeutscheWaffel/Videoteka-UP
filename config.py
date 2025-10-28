import os
from dotenv import load_dotenv

load_dotenv()

# Настройки базы данных
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///videoteka.db")

# JWT настройки
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Настройки приложения
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
