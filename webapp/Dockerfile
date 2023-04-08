FROM node:18.15.0-alpine3.17 AS builder
ENV NODE_ENV development
# Add a work directory
WORKDIR /app
# Copy app files
COPY . .
RUN npm ci

# Build the app
RUN npm run build

# Bundle static assets with nginx
FROM nginx:stable-alpine3.17-slim as production
ENV NODE_ENV production
# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html
# Add your nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose port
EXPOSE 9080
# Start nginx
CMD ["nginx", "-g", "daemon off;"]
