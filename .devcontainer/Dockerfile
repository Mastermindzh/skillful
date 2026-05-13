FROM oven/bun:1-debian

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  ca-certificates \
  curl \
  dbus \
  libgtk-3-0 \
  libnss3 \
  libxss1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libgbm1 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxshmfence1 \
  libpango-1.0-0 \
  libcairo2 \
  libatspi2.0-0 \
  xvfb \
  && rm -rf /var/lib/apt/lists/*

USER bun