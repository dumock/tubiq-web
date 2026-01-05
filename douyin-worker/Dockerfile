FROM mcr.microsoft.com/playwright:v1.40.0-jammy

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package*.json ./
RUN npm install
# Ensure browsers are available and path is respected
RUN npx playwright install chromium

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
