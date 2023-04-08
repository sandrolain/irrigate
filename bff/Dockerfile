FROM node:18.15.0-alpine3.17
ENV NODE_ENV development
# Add a work directory
WORKDIR /app
# Copy app files
COPY . .
RUN npm ci

# Expose port
EXPOSE 8080
# Start nginx
CMD ["npm", "run", "serve"]
