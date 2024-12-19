FROM node:23.4.0

WORKDIR /app
COPY package*.json ./
RUN npm install
# COPY . .

CMD ["npm", "run", "start"]
