FROM node:18 AS BUILD_IMAGE

RUN curl -sf https://gobinaries.com/tj/node-prune | bash -s -- -b /usr/local/bin

RUN mkdir -p /srv/api
WORKDIR /srv/api
ENV NODE_ENV production

ADD ./dist/apps/api /srv/api
ADD ./dist/apps/public /srv/public
ADD ./package.json /srv/api

RUN npm install --production
RUN npm prune --production
RUN /usr/local/bin/node-prune

FROM node:18-alpine

ENV NODE_ENV production
COPY --from=BUILD_IMAGE /srv/api /srv/api
COPY --from=BUILD_IMAGE /srv/public /srv/public

WORKDIR /srv/api
CMD node /srv/api/main.js