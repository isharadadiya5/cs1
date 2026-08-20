FROM node:24-alpine

WORKDIR /app
COPY index.html styles.css app.js server.js package.json ./

RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=4173
ENV DATA_DIR=/app/data
EXPOSE 4173

CMD ["npm", "start"]
