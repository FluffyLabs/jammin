# Service SDK Examples

## Using Docker images

This guide explains how to run the examples from [tomusdrw/jam-examples](https://github.com/tomusdrw/jam-examples) using docker images.

### JAM SDK

First, build the docker image.

```console
$ docker build -f jam-sdk.Dockerfile -t jam-sdk .
```

Then `cd` into the example code directory:

```console
$ cd jam-examples/empty-jamsdk
```

And build:

```console
$ docker run --rm -v $(pwd):/app jam-sdk jam-pvm-build -m service
```

#### Unit tests

To run unit tests:

```console
$ docker run --rm -v $(pwd):/app jam-sdk cargo test
```

### JamBrains SDK

The docker image provided by JamBrains is going to do all the work here:

Pull the image:

```console
$ docker pull ghcr.io/jambrains/service-sdk:latest
```

On Apple Silicon, you may need to add: `--platform linux/amd64`.

And build:

```console
$ cd jam-examples/empty-jambrains
$ docker run --rm -v $(pwd):/app ghcr.io/jambrains/service-sdk:latest single-file main.c
```

### Jade (Spacejam)

First, build the docker image.

```console
$ docker build -f jade.Dockerfile -t jade .
```

Then `cd` into the example code directory:

```console
$ cd jam-examples/empty-jade
```

And build:

```console
$ docker run --rm -v $(pwd):/app jade
```

Notice that "cargo" is set as the entry point of this docker image (and "build" as the default command).

#### Unit tests

To run unit tests:

```console
$ docker run --rm -v $(pwd):/app jade test
```

### as-lan

The as-lan docker image ships with Node.js, `wasm-pvm`, and the AssemblyScript toolchain pre-installed. Pull it:

```console
$ docker pull ghcr.io/tomusdrw/jammin-as-lan:0.0.6
```

Then `cd` into the example code directory and build:

```console
$ cd jammin-create-aslan/services/example
$ docker run --rm -v $(pwd):/app ghcr.io/tomusdrw/jammin-as-lan:0.0.6 npm run build
```

The image's entrypoint symlinks the global toolchain into `/app/node_modules` if no `node_modules` already exists in the mounted directory.

#### Unit tests

```console
$ docker run --rm -v $(pwd):/app ghcr.io/tomusdrw/jammin-as-lan:0.0.6 npm test
```

#### SDK ids accepted in jammin.build.yml

Use the `<name>@<version>` form:

- `aslan@0.0.6` (canonical wildcard)
- `as-lan@0.0.6` (separate wildcard entry pointing at the same image)
- `aslan@latest` — pulls the `latest` tag (not reproducible; pin a concrete version for shared projects)
- `aslan@0.1.0-rc.1` — pre-release tags work, the version segment is passed through verbatim
- `aslan@sha256:<64-hex-digest>` — sha-pinned form, available on every wildcard SDK. Resolves to `<repo>@sha256:<digest>` (no tag). Use this for images that only publish moving tags (e.g. `jambrains` publishes only `:latest`).

The version segment must match either `[A-Za-z0-9._-]+` (a docker tag) or
`sha256:` followed by exactly 64 lowercase hex chars (a digest). Partial
digests are rejected at config-load time.

> **Deprecated**: the pinned dash-style keys (`aslan-0.0.6`, `jam-sdk-0.1.26`,
> `jade-0.0.15-pre.1`, `ajanta-0.1.0`, `jamc3-1.1.2`, `jambrains-1cfc41c`) still
> resolve in 0.3.x but emit a one-time `console.warn` and will be removed in
> 0.4.0. Migrate to the `<name>@<version>` form. The `jambrains-1cfc41c` entry
> migrates to `jambrains@sha256:1cfc41c23f5c348aaee5f5c70aaa24f10c26baf903de4b4f6774e2032820ba87`.
