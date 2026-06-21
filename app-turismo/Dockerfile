# Stage 1: Build the admin Vite SPA
FROM node:20 AS admin-builder

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app
# Copy admin files
COPY admin/package*.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

# Stage 2: Build the static Expo Web assets
FROM node:20 AS expo-builder

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /app

# Copy dependency files
COPY app-turismo/package.json app-turismo/pnpm-lock.yaml* app-turismo/pnpm-workspace.yaml* ./

# Install dependencies
# --shamefully-hoist helps with Metro finding nested dependencies in Docker
RUN pnpm install --shamefully-hoist

# Copy the rest of the application files
COPY app-turismo/ ./

# Declare build arguments
ARG EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
ARG EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
ARG EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
ARG EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
ARG EXPO_PUBLIC_BACKEND_URL

# Set environment variables
ENV EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=$EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
ENV EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=$EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
ENV EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
ENV EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
ENV EXPO_PUBLIC_BACKEND_URL=$EXPO_PUBLIC_BACKEND_URL
ENV CI=1
ENV NODE_ENV=production

# Fix for SHA-1 error in Metro/Docker: pre-create the css-interop cache file
# and ensure it's within the watched folders.
RUN mkdir -p node_modules/react-native-css-interop/.cache && \
    touch node_modules/react-native-css-interop/.cache/web.css

# Export the React Native / Expo web bundle
RUN pnpm exec expo export --platform web --clear

# Stage 3: Serve the files using high-performance Nginx
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*
COPY app-turismo/nginx.conf /etc/nginx/conf.d/default.conf

# Copy Expo Web dist to root html
COPY --from=expo-builder /app/dist /usr/share/nginx/html

# Copy Admin SPA dist to /dev
COPY --from=admin-builder /app/dist /usr/share/nginx/html/dev

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
