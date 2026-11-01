FROM nginx:alpine

# The web files are mounted from ./frontend by docker-compose.yml, so only the config is copied
# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
