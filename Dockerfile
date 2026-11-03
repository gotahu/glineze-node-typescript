FROM node:26.13.0-bookworm

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build

CMD ["npm", "run", "start"]
