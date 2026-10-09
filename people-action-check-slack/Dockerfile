FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && mkdir /app/data && chown node:node /app/data
COPY --chown=node:node src ./src
USER node
ENV DATA_PATH=/app/data/pac.sqlite
CMD ["node", "src/app.js"]
