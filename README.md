# Distributed Key-Value Store

A resilient, highly available distributed key-value store implemented in Node.js, featuring dynamic membership, consistent hashing, replication, quorum-based operations, and automatic stabilization.

## Features

- **SWIM-Based Membership**: Gossip-style failure detection and membership protocol for robust cluster management.
- **Consistent Hashing**: Even data distribution across nodes with a virtual ID ring.
- **Replication Factor**: 3-way replication with quorum writes (2) and quorum reads (2) for fault tolerance.
- **Read-Repair**: Ensures data consistency by repairing stale replicas during read operations.
- **Automatic Stabilization**: Rebalances data on node join/leave events via redistribution and garbage collection.
- **RESTful API**: Simple HTTP endpoints (`POST /s/key`, `GET /s/key`, `DELETE /s/key`) for client interactions.
- **Benchmarking Tools**: Python scripts to measure latency, throughput, and response-time distributions.

## Architecture Overview

1. **kernel.js**: Utility layer for HTTP communication, hashing (keys & ports), randomization, and shuffling.
2. **membership.js**: SWIM-inspired protocol implementing join, ping, ping-req, failure detection, and gossip.
3. **datastore.js**: In-memory key-value store with timestamped entries, stable-key cleanup, and remapping support.
4. **topology.js**: Consistent-hashing ring, replication/quorum logic, read-repair, stabilization on churn, and exposes internal `d/read`, `d/write`, `d/delete`, `d/stabilization` APIs.
5. **server.js**: Express server binding, public `/s/key` REST endpoints, integrates `Topology` for client-facing operations.
6. **index.js**: Entry point to spawn a node at a given port (and optional introducer) to join or form a cluster.

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/distributed-kv-store.git
cd distributed-kv-store

# Install dependencies
npm install
```

## Running the Cluster

1. **Start the first node (no introducer):**
   ```bash
   node index.js 8080
   ```
2. **Start additional nodes (point to introducer port):**
   ```bash
   node index.js 8081 8080
   node index.js 8082 8080
   ```

Each node logs membership events and stabilization actions on join/leave.

## API Usage

- **Set a key:**
  ```bash
  curl -X POST http://localhost:8080/s/key -d '{"key":"foo","value":"bar"}'
  ```
- **Get a key:**
  ```bash
  curl http://localhost:8081/s/key?key=foo
  ```
- **Delete a key:**
  ```bash
  curl -X DELETE http://localhost:8082/s/key?key=foo
  ```

## Testing & Benchmarking

Two Python scripts (`API_TEST_5.py`, `API_TEST_20.py`) benchmark end-to-end latency, throughput, and success rates across a port range. Results are written to `results.json`.

```bash
# Run a quick benchmark
env PORT_RANGE_START=8080 PORT_RANGE_END=8084 python API_TEST_5.py
```

### Sample Performance Metrics

- **Mean Latency:** 11.54 ms
- **Median Latency:** 10.60 ms
- **90th Percentile:** 13.01 ms
- **99th Percentile:** 24.73 ms
- **Throughput:** 0.50 req/s
- **Success Rate:** 100 %

*(Metrics depend on workload pattern: current scripts include 2 s delays between requests.)*

## License

This project is licensed under the MIT License.

---