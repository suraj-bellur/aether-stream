FROM nginx:alpine

# Copy static frontend web assets
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY theme.css /usr/share/nginx/html/theme.css
COPY app.js /usr/share/nginx/html/app.js

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
