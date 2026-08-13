FROM eclipse-temurin:21-jdk-jammy

ARG NODE_VERSION=24.11.1
ARG PNPM_VERSION=11.8.0
ARG GH_VERSION=2.95.0
ARG GH_LINUX_AMD64_SHA256=25d1e4729e8808c9ed3d613e96ebd3f3e44446f2d368c89d878a71a36ddb3d8c
ARG GH_LINUX_ARM64_SHA256=d41e0b3b6218e5741c8bb4db39b16e53a59e0e06299a8489bd38f623ef7ebaae
ARG ANDROID_CMDLINE_TOOLS_VERSION=12266719
ARG ANDROID_PLATFORM=android-36
ARG ANDROID_BUILD_TOOLS_VERSION=36.0.0
ARG ANDROID_LEGACY_BUILD_TOOLS_VERSION=35.0.0
ARG ANDROID_NDK_VERSION=27.1.12297006
ARG ANDROID_CMAKE_VERSION=3.22.1

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_NDK_HOME=/opt/android-sdk/ndk/${ANDROID_NDK_VERSION}
ENV PNPM_HOME=/pnpm
ENV GRADLE_OPTS=-Dorg.gradle.vfs.watch=false
ENV PATH=${PNPM_HOME}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}

RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    make \
    openssh-client \
    python3 \
    unzip \
    xz-utils \
    g++; \
  rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
    amd64) node_arch="x64" ;; \
    arm64) node_arch="arm64" ;; \
    *) echo "Unsupported architecture for Node.js: $arch" >&2; exit 1 ;; \
  esac; \
  curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"; \
  tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1; \
  rm /tmp/node.tar.xz; \
  node --version; \
  npm --version

RUN set -eux; \
  npm install -g "pnpm@${PNPM_VERSION}"; \
  mkdir -p "${PNPM_HOME}/store"; \
  pnpm config set store-dir "${PNPM_HOME}/store"; \
  pnpm --version

RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
    amd64) gh_arch="amd64"; gh_sha256="${GH_LINUX_AMD64_SHA256}" ;; \
    arm64) gh_arch="arm64"; gh_sha256="${GH_LINUX_ARM64_SHA256}" ;; \
    *) echo "Unsupported architecture for GitHub CLI: $arch" >&2; exit 1 ;; \
  esac; \
  archive="gh_${GH_VERSION}_linux_${gh_arch}.tar.gz"; \
  curl -fsSLo "/tmp/${archive}" \
    "https://github.com/cli/cli/releases/download/v${GH_VERSION}/${archive}"; \
  echo "${gh_sha256}  /tmp/${archive}" | sha256sum -c -; \
  tar -xzf "/tmp/${archive}" -C /tmp; \
  install -m 0755 "/tmp/gh_${GH_VERSION}_linux_${gh_arch}/bin/gh" /usr/local/bin/gh; \
  rm -rf "/tmp/${archive}" "/tmp/gh_${GH_VERSION}_linux_${gh_arch}"; \
  gh --version

RUN set -eux; \
  mkdir -p "${ANDROID_HOME}/cmdline-tools"; \
  curl -fsSLo /tmp/android-commandline-tools.zip \
    "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip"; \
  unzip -q /tmp/android-commandline-tools.zip -d /tmp/android-commandline-tools; \
  mv /tmp/android-commandline-tools/cmdline-tools "${ANDROID_HOME}/cmdline-tools/latest"; \
  rm -rf /tmp/android-commandline-tools /tmp/android-commandline-tools.zip; \
  yes | sdkmanager --licenses >/dev/null; \
  sdkmanager --install \
    "platform-tools" \
    "platforms;${ANDROID_PLATFORM}" \
    "build-tools;${ANDROID_BUILD_TOOLS_VERSION}" \
    "build-tools;${ANDROID_LEGACY_BUILD_TOOLS_VERSION}" \
    "cmake;${ANDROID_CMAKE_VERSION}" \
    "ndk;${ANDROID_NDK_VERSION}"; \
  sdkmanager --list_installed

WORKDIR /workspace

CMD ["bash"]
