FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    tar \
    libsdl2-2.0-0 \
    libsdl2-ttf-2.0-0 \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/polkajam

ARG POLKAJAM_TAG=v0.1.27
ARG TARGETARCH

RUN set -eux; \
    case "$TARGETARCH" in \
      amd64)  POLKAJAM_ARCH="polkajam-${POLKAJAM_TAG}-linux-x86_64.tgz" ;; \
      arm64)  POLKAJAM_ARCH="polkajam-${POLKAJAM_TAG}-linux-aarch64.tgz" ;; \
      *) echo "Unsupported arch: $TARGETARCH" && exit 1 ;; \
    esac; \
    curl -fL \
      "https://github.com/paritytech/polkajam-releases/releases/download/${POLKAJAM_TAG}/${POLKAJAM_ARCH}" \
      -o release.tgz; \
    tar -xzf release.tgz --strip-components=1; \
    rm release.tgz

RUN chmod +x /opt/polkajam/polkajam /opt/polkajam/polkajam-testnet /opt/polkajam/polkajam-repl || true

COPY docker/polkajam/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
