# Imagen base
FROM node:18

# Directorio de trabajo
WORKDIR /app

# Copiar archivos
COPY package*.json ./
RUN npm ci

COPY . .

# Exponer puerto (ajustá si usás otro)
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]