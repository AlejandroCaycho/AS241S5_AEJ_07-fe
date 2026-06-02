FROM node:20 AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/as241s5-aej-07-fe/browser /usr/share/nginx/html
EXPOSE 80