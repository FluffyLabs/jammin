FROM rust:1.89-slim-bookworm

# Install rust-src as required by jam-pvm-build
RUN rustup component add rust-src --toolchain nightly-2025-05-10

# Install the JAM PVM build tool
RUN cargo install jam-pvm-build@0.1.26

# This fixes an issue where jam-pvm-build looks for rustup home in the wrong place
RUN ln -s /usr/local/rustup /root/.rustup