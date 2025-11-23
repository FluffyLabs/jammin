# jammin suite

#### jammin cli
1. Bootstrap new project
	1. should allow using various jam sdks for services
	2. multi-service deployment
2. Project is configured in a yaml file. That YAML contains:
	1. SDK framework used (global + per-service override)
	2. list of services and their destinations
3. **Build**
	1. Each service is being built with its SDK-specific instructions.
	2. We provide docker images for JAM-SDK, later maybe JADE or other services.
	3. Defining a "custom" service type with a bunch of commands is possible.
	4. Building ends with `*.jam` file being produced for the service. 
4. **Deploy**
	1. Preparing genesis state
		1. Each service that we built is put to the genesis state and that's what the nodes are initialised with.
	2. Using bootstrap service (polkajam's or our custom)
		1. We can connect to an already running network and just deploy the services using some `new` API of the bootstrap service.
	3. Configuration file for testnet spawning:
		1. Node definitions (we can have a bunch pre-defined ones)
		2. Number of instances of each node definition
		3. Node definition should probably tell us how to map some parameters (like separate networking/rpc ports, etc) we may decide on the common CLI flags required or some sort of mapping between jammin option and the node option
		4. Genesis file should be passed to all of the nodes and there should be some bootnodes so that the network can stay connected.
		5. Focus on typeberry initially.
	4. Support upgradable services pattern. We could allow the user, instead of deploying a fresh set of services, to just upgrade the existing ones.
5. **Unit (Service) Testing**
	1. CLI should have a way to run unit tests from each of the service. Note that these tests will be written in SDK-specific way, we don't care about them any more than whether the command exits with `0` or something else.
6. **Integration (Project) Testing**
	1. We should provide an SDK to interact with the deployed services in a deterministic way.
	2. For instance:
		1. Create a work item and pass it through refine
		2. Create another work item and pass it through refine
		3. Take two work results and put them into a package.
		4. Send the package for accumulation.
		5. Assert that specific changes happened.
7. **Interacting**
	1. Interacting should basically be the same as integration testing, with that difference that interacting allows more dynamic actions. Perhaps that could be just a REPL if the API is good enough.
	2. Interacting will require some encoding of input arguments for refine, so the user needs to tell us what's the shape of the objects its service expects - a bit of duplication between Service SDK and our format, presumably @typeberry/codec. In the future perhaps we could have a common source of these, but it's not a priority for now.
#### jammin studio
1. Electron app or VS Code extension
2. The main goal is to make it easy to start with JAM development without needing to touch the CLI.
3. Electron app would need to observe the filesystem to make sure that AI agents can alter the code.
4. The studio responsibility pretty much ends after the **Build** step. When we build the contracts, we should later be able to deploy them and that's it.
#### jammin inspect
1. The inspector could be part of the studio, especially if it's an electron app, but can easily be also just a separate web app.
2. The inspector is mostly useful after **Deployment** step. After that:
	1. We can see the network running, maybe even some sort of simplified topology.
	2. We can inspect the state of the services (something like `state-viewer`)
	3. We should probably see incoming blocks and be able to inspect what's in them (work packages)
	4. We may want to inspect the refinement? Although maybe just running `jamtop` would suffice.
3. From the service inputs/outputs encoding definition we should provide components so that the user can build a simple UI with the help of AI agents. From this UI we would want to interact with the service, i.e.:
	1. Pass some data to work items and submit them for refinement.
	2. Inspect services and view accumulated results.
4. Ideally the `inspector` SHOULD not use RPC to contact with the nodes, we should rather embed a typeberry node that is simply part of the network and read all of the data from it.
5. Surely the topology or refinement inspection would require some extra data (maybe from telemetry or just configuration and RPC to query if nodes are up and running), but majority of the interactions should be just using the embedded node.
6. If we plan to run in the browser (my preference) we are going to need WebSockets interface.
	1. The idea is to basically run a separate typeberry node in your terminal that exposes custom WebSocket interface.
	2. That WebSocket interface should be super simple and possibly even based on the JAMNP protocol handlers.
		1. Handshake should involve making sure we have the same genesis state.
		2. Upon connection we need to learn about the difference of blocks between "BridgeNode" and "BrowserNode"
		3. Then the bridge node should simply send all of the blocks to the browser node.
		4. When the browser node receives them it should be able to have the same state.
		5. In the future we would probably rather warp-sync the browser node from the bridge node (to avoid excessive cpu in the browser), however for small deployments this should be good enough.
