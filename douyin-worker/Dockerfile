FROM mcr.microsoft.com/playwright:v1.40.0-jammy

ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers

COPY package*.json ./
RUN npm install
RUN npx playwright install chromium

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
