FROM rust:1.90-slim-bookworm

# Install rust-src as required by jade
RUN rustup component add rust-src

# This fixes an issue where jade doesn't respect RUSTUP_HOME when looking up rust-src
RUN ln -s /usr/local/rustup /root/.rustup

VOLUME /app
WORKDIR /app

ENTRYPOINT ["cargo"]
CMD ["build"]
