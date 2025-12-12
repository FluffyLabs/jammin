# Developer Docs

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

Pull the image from official source:

```console
$ docker pull ghcr.io/jambrains/service-sdk:latest
```

If you have trouble pulling this image on Apple Silicon add the following flag: `--platform linux/amd64`.

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
