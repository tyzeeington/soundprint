FROM nginx:alpine
COPY landing-page/ /usr/share/nginx/html/
EXPOSE 8001
CMD ["nginx", "-g", "daemon off;"]
