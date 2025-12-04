FROM debian:bookworm-slim

ARG TOOLCHAIN=nightly-2025-05-10
ARG SDK_VERSION=0.1.26

# Install dependencies needed for rustup and cargo builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    build-essential 
        
# Create a non-root user for building
RUN useradd --create-home --shell /bin/bash builder
USER builder

# Install rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${TOOLCHAIN} -c rust-src
ENV PATH="/home/builder/.cargo/bin:${PATH}"

# Install the JAM PVM build tool
RUN cargo install jam-pvm-build@${SDK_VERSION}

# Mount point for user's source code
WORKDIR /home/builder/workdir
VOLUME ["/home/builder/workdir"]
