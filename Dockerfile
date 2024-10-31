FROM node:22

LABEL authors="reloia"

WORKDIR /app

COPY package.json /app

RUN apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libtool autoconf automake && rm -rf /var/lib/apt/lists/*

RUN npm install

COPY . /app

EXPOSE 3000

CMD ["npm", "start"]
