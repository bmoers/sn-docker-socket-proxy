from node:16 AS base

# Setup SR networking
ENV HTTP_PROXY="http://gate-zrh.swissre.com:8080"
ENV http_proxy="http://gate-zrh.swissre.com:8080"
ENV HTTPS_PROXY="http://gate-zrh.swissre.com:8080"
ENV https_proxy="http://gate-zrh.swissre.com:8080"
ENV no_proxy=localhost,.swissre.com,.sccloud.swissre.com,.gwpnet.com
ENV NO_PROXY=localhost,.swissre.com,.sccloud.swissre.com,.gwpnet.com

ADD http://pki.swissre.com/aia/SwissReRootCA2.crt /usr/local/share/ca-certificates/
ADD http://pki.swissre.com/aia/SwissReSystemCA21.crt /usr/local/share/ca-certificates/
ADD http://pki.swissre.com/aia/SwissReSystemCA22.crt /usr/local/share/ca-certificates/
ADD http://pki.swissre.com/aia/SwissReSystemCA24.crt /usr/local/share/ca-certificates/
ADD http://pki.swissre.com/aia/SwissReSystemCA25.crt /usr/local/share/ca-certificates/

ADD http://pki.swissre.com/aia/SwissReRootCA1.crt /usr/local/share/ca-certificates/
ADD http://pki.swissre.com/aia/SwissReRootCA2.crt /usr/local/share/ca-certificates/
ADD http://pki.swissre.com/aia/SwissReSystemCA12.crt /usr/local/share/ca-certificates/
ADD http://pki.swissre.com/aia/SwissReSystemCA22.crt /usr/local/share/ca-certificates/

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
ADD ./app.js ./

EXPOSE 3000

CMD node app.js
