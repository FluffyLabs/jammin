# jammin API/config proposal

## Open problems
 
### How the services should reference each other?

- do we hardcoded service ids in service code?
- do we pass service ids during deployment (deployment order issues?)
- do we initialize services after they are deployed (authorization issues?)


## Directory structure
```text
.
├── services/
│   ├── service a
│   └── service b
├── tests/
│   └── a-b-interaction.ts
├── types/
│   └── service-a-types.ts
├── jammin.build.yml
├── jammin.networks.yml
├── package.json
└── README.md
```

## `jammin.build.yml`

```yaml
services:
	# we simply list paths to all services and declare what sdk their using	 
	- path: ./services/service a
		name: a
		# built-in sdk
		sdk: jam-sdk-0.1.26
	- path: ./services/service b
		name: serviceB
		sdk: custom

sdks:
	# custom sdks need to provide docker image to pull and build & test commands
	custom:
		image: customservice/buildimage
		build: build
		test: test

deployment:
	# name of the network to spawn?
	spawn: local 
	# bootstrap-service or genesis
	# NOTE that we cannot upgrade when doing genesis
	# for bootstrap-service or upgrade we probably expect the network to be already running?
	deploy_with: bootstrap-service 
	upgrade: true

```

## `jammin.networks.yml`

This looks a lot like docker-compose wrapper - we will be running multiple containers
and inter-connecting them, but we also need to pass some configuration details.

Perhaps it would be better to provide templates of docker compose files?

```yaml
networks:
	# possibility to specify multiple different network configurations in one file
	local:
		# spawn two instances of typeberry dev nodes.
		# TODO: figure out how to pass config (with bootnodes) and indexes? 
		- image: typeberry-0.4.1
			args: dev
			instances: 2

		- image: polkajam
			instances: 2
	# perhaps this should just point to docker compose files?
	other:
		compose: ./docker-compose-other.yml

	# Do we want to allow running the nodes locally as well?
	# could be useful to have one node running locally (for easier debugging) 
	# and connect to the docker-composed network?
```

## `types/service-a-types.ts`

```ts

import { codec } from "@typeberry/lib";

export const RefineInputParams = codec.object({
	slot: codec.u32,
	myHash: codec.bytes(32),
	myData: codec.blob,
});

```

## `tests/a-b-interaction.ts`

```ts

import { describe, it } from 'node:test';
import { assert } from 'node:assert';

import { encode, u32, bytes, blob, client, query } from 'jammin-sdk';

import { RefineInputParams } from '../types/service-a-types.js';


describe('A - B interaction', () => {
	// TODO [ToDr] Are the services already deployed?
	it('should send tokens from A to B', async () => {
		const encoded = encode(RefineInputParams, {
			slot: u32(5),
			myHash: bytes.parse(32, "0x1234...ffff"),
			myData: blob.text("abc")
		});

		const item1 = await client.refine(
			services.a, // name coming from config
			encoded
		);
		const item2 = await client.refine(
			services.a,
			encoded
		);

		const accountInfoBefore = await query.serviceInfo(services.serviceB)

		const result = await client.accumulate(
			client.package(item1, item2),
		);

		assert.strictEqual(result, true);

		const accountInfoAfter = await query.serviceInfo(services.serviceB)

		// should fail, because we expect the balance to be changed
		assert.deepEqual(accountInfoBefore, accountInfoAfter);
	});
});



```
