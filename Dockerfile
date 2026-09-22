FROM node:26.8.2-bookworm

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build

CMD ["npm", "run", "start"]
