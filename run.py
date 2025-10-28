#!/usr/bin/env python3
"""
Скрипт для запуска Videoteka API
"""
import uvicorn
from config import HOST, PORT, DEBUG

if __name__ == "__main__":
    print("🚀 Запуск Videoteka API...")
    print(f"📍 Адрес: http://{HOST}:{PORT}")
    print(f"📚 Документация: http://{HOST}:{PORT}/docs")
    print(f"🔄 Режим отладки: {'Включен' if DEBUG else 'Выключен'}")
    print("-" * 50)
    
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG,
        log_level="info"
    )
