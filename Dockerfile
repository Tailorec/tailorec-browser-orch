FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["node", "dist/server.js"]
