FROM node:20

# تثبيت ffmpeg من النظام
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY . .

RUN npm install

CMD ["node", "index.js"]
