# Stage 1: Build the static Expo Web assets
FROM node:20-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Install dependencies (frozen-lockfile ensures exact matching of lockfile)
RUN pnpm install --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Declare build arguments (Expo public variables are baked in during compilation)
ARG EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
ARG EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
ARG EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
ARG EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
ARG EXPO_PUBLIC_BACKEND_URL

# Set environment variables for the build process
ENV EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=$EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
ENV EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=$EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
ENV EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
ENV EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
ENV EXPO_PUBLIC_BACKEND_URL=$EXPO_PUBLIC_BACKEND_URL

# Export the React Native / Expo web bundle (outputs to '/app/dist')
RUN pnpm exec expo export --platform web

# Stage 2: Serve the files using high-performance Nginx
FROM nginx:alpine

# Remove default index file
RUN rm -rf /usr/share/nginx/html/*

# Copy our custom Nginx config supporting SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
