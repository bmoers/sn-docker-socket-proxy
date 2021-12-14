FROM node:16


ENV NODE_ENV production
ENV NODE_EXTRA_CA_CERTS /etc/ssl/certs/ca-certificates.crt

RUN apt-get clean && \
    apt-get update -y && \
    apt-get upgrade -y && \
    apt-get install -y curl ca-certificates vim && \
    rm -rf /var/lib/apt/lists/* && \ 
    update-ca-certificates && \
    npm install -g --no-update-notifier --no-audit --no-fund npm@^8.1.0

WORKDIR /usr/src/app

RUN chown -R node:node /usr/src/app && \
    chmod 755 /usr/src/app

ADD --chown=node:node ./package*.json ./
RUN npm ci --only=production --no-optional --no-audit --no-fund 

ADD ./mw ./mw
ADD ./strategies ./strategies
ADD ./lib ./lib

ADD ./app.js ./debug.js ./

EXPOSE 8080

CMD node app.js
