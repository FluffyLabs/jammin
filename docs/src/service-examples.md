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
$ docker pull ghcr.io/tomusdrw/jammin-as-lan:0.0.4
```

Then `cd` into the example code directory and build:

```console
$ cd jammin-create-aslan/services/example
$ docker run --rm -v $(pwd):/app ghcr.io/tomusdrw/jammin-as-lan:0.0.4 npm run build
```

The image's entrypoint symlinks the global toolchain into `/app/node_modules` if no `node_modules` already exists in the mounted directory.

#### Unit tests

```console
$ docker run --rm -v $(pwd):/app ghcr.io/tomusdrw/jammin-as-lan:0.0.4 npm test
```

#### SDK names accepted in jammin.build.yml

Any of the following resolve to the same image and commands:

- `aslan-0.0.4` (canonical key in `SDK_CONFIGS`)
- `as-lan-0.0.4` (versioned alias matching the framework's spelling)
- `as-lan` (bare alias — follows the current default version)
