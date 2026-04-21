FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Prisma generate
RUN npx prisma format
RUN npx prisma generate
RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]