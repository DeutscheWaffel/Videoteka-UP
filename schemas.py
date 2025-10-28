from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Имя пользователя")
    email: EmailStr = Field(..., description="Email адрес")

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100, description="Пароль")

class UserLogin(BaseModel):
    username: str = Field(..., description="Имя пользователя или email")
    password: str = Field(..., description="Пароль")

class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    
    class Config:
        from_attributes = True

class UserResponse(UserBase):
    id: int
    is_active: bool
    avatar_base64: str | None = None
    role: RoleResponse | None = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    username: Optional[str] = None

class AvatarUpdate(BaseModel):
    avatar_base64: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
