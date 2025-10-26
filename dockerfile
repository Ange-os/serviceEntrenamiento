# Imagen base
FROM node:18-bullseye

# Instalar dependencias necesarias para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libnss3 \
    libxss1 \
    libasound2 \
    libx11-xcb1 \
    libxcomposite1 \
    libxrandr2 \
    libxcursor1 \
    libxdamage1 \
    libgbm1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Establecer variable para que puppeteer use el Chromium instalado
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Directorio de trabajo
WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
