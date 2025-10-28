from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import User
from schemas import TokenData
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# Настройка для хеширования паролей (pbkdf2_sha256 — кроссплатформенно и без ограничений 72 байта)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Настройка для JWT токенов
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Хеширует пароль"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Создает JWT токен"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, credentials_exception):
    """Проверяет JWT токен"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    return token_data

def authenticate_user(username: str, password: str) -> Optional[User]:
    """Аутентифицирует пользователя"""
    try:
        # Пытаемся найти пользователя по username или email
        user = User.get((User.username == username) | (User.email == username))
        if not verify_password(password, user.hashed_password):
            return None
        return user
    except User.DoesNotExist:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Получает текущего пользователя из токена"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    token_data = verify_token(token, credentials_exception)
    
    try:
        user = User.get(User.username == token_data.username)
        if user is None:
            raise credentials_exception
        return user
    except User.DoesNotExist:
        raise credentials_exception

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Получает активного пользователя"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Неактивный пользователь")
    return current_user
