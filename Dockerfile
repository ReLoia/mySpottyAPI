FROM node:22-slim

LABEL authors="reloia"

WORKDIR /app

COPY package.json /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libtool autoconf automake

RUN npm install

RUN apt-get remove -y build-essential autoconf automake libtool && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN npm cache clean --force

COPY . /app

EXPOSE 3000

CMD ["npm", "start"]
