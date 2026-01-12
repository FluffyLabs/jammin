FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies including RISC-V toolchain
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    ca-certificates \
    gcc-riscv64-unknown-elf \
    binutils-riscv64-unknown-elf \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for ajanta-build-tool compatibility
# (it expects riscv64-elf-* but Debian provides riscv64-unknown-elf-*)
RUN ln -s /usr/bin/riscv64-unknown-elf-gcc /usr/local/bin/riscv64-elf-gcc && \
    ln -s /usr/bin/riscv64-unknown-elf-g++ /usr/local/bin/riscv64-elf-g++ && \
    ln -s /usr/bin/riscv64-unknown-elf-ld /usr/local/bin/riscv64-elf-ld && \
    ln -s /usr/bin/riscv64-unknown-elf-as /usr/local/bin/riscv64-elf-as && \
    ln -s /usr/bin/riscv64-unknown-elf-ar /usr/local/bin/riscv64-elf-ar

# Install Rust (needed for ajanta-build-tool)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install rust-src (required by polkavm tooling)
RUN rustup component add rust-src

# Fix rustup home path issue
RUN ln -s /usr/local/rustup /root/.rustup 2>/dev/null || true

RUN pip install --no-cache-dir uv

# Clone Ajanta 0.1.0 from GitHub
WORKDIR /opt
ARG AJANTA_COMMIT=3739e30
RUN git clone https://github.com/Chainscore/ajanta.git && \
    cd ajanta && \
    git checkout ${AJANTA_COMMIT} && \
    git submodule update --init --recursive

WORKDIR /opt/ajanta

# Build ajanta-build-tool
WORKDIR /opt/ajanta/ajanta-build-tool
RUN cargo build --release && \
    cp target/release/ajanta-build-tool /usr/local/bin/ajanta-build-tool

# Install Python packages
WORKDIR /opt/ajanta
RUN uv pip install --system -e ./aj-lang && \
    uv pip install --system -e .

VOLUME /app
WORKDIR /app
