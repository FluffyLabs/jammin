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
$ docker run --rm -v "$PWD":/app jam-sdk jam-pvm-build -m service
```

### JamBrains SDK

The docker image provided by JamBrains is going to do all the work here:

```console
$ cd jam-examples/empty-jambrains
$ docker run -v $(pwd):/app ghcr.io/jambrains/service-sdk:latest single-file main.c
```

Should you have trouble running this image on Apple Silicon add the following flag: `--platform linux/amd64`.
