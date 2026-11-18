FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node","live/server.mjs"]
