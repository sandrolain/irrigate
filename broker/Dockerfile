FROM node:16.20.0-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY src ./src

RUN npm ci

EXPOSE 1883

CMD ["npm", "run", "serve"]
