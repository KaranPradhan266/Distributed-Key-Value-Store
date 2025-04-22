import requests
import json
import time
import random
import numpy as np

def get_text_response(response):
    try:
        return {"text": response.text}
    except requests.exceptions.RequestException as e:
        return {"error": "Invalid response", "text": str(e)}

def measure_latency_and_throughput(start_time, end_time, total_requests):
    elapsed_time = end_time - start_time
    throughput = total_requests / elapsed_time if elapsed_time > 0 else 0
    return elapsed_time, throughput

def calculate_response_time_distribution(response_times):
    response_times_np = np.array(response_times)
    mean = np.mean(response_times_np)
    median = np.median(response_times_np)
    percentile_90th = np.percentile(response_times_np, 90)
    percentile_99th = np.percentile(response_times_np, 99)
    return {
        "mean": mean,
        "median": median,
        "90th_percentile": percentile_90th,
        "99th_percentile": percentile_99th
    }

def main():
    # Define the key-value pairs
    key_values = [
        {"key": "A", "value": "1"},
        {"key": "B", "value": "2"},
        {"key": "C", "value": "3"},
        {"key": "D", "value": "4"},
        {"key": "E", "value": "5"},
        {"key": "F", "value": "6"},
        {"key": "G", "value": "7"},
    ]

    # Define the port range
    port_range = list(range(8080, 8100))

    # List to store the combined results
    results = []

    total_requests = 0
    total_successful_requests = 0
    total_failed_requests = 0
    response_times = []

    start_time = time.time()

    for kv in key_values:
        key = kv["key"]
        value = kv["value"]

        # Measure latency for POST request
        post_port = random.choice(port_range)
        post_start_time = time.time()
        post_response = requests.post(f'http://localhost:{post_port}/s/key', json={"key": key, "value": value})
        post_end_time = time.time()
        post_latency = post_end_time - post_start_time
        response_times.append(post_latency)
        post_response_text = {"text": post_response.text}
        print("-------------------------------------------------------------------------------------------")
        print(f"POST Response for {key} on port {post_port}: {post_response_text}")
        print(f"POST Latency for {key} on port {post_port}: {post_latency:.6f} seconds")

        if post_response.status_code == 200:
            total_successful_requests += 1
        else:
            total_failed_requests += 1

        # Wait for 2 seconds
        time.sleep(2)

        # Measure latency for GET request
        get_port = random.choice(port_range)
        get_start_time = time.time()
        get_response = requests.get(f'http://localhost:{get_port}/s/key?key={key}')
        get_end_time = time.time()
        get_latency = get_end_time - get_start_time
        response_times.append(get_latency)
        get_response_text = {"text": get_response.text}
        print(f"GET Response for {key} on port {get_port}: {get_response_text}")
        print(f"GET Latency for {key} on port {get_port}: {get_latency:.6f} seconds")

        if get_response.status_code == 200:
            total_successful_requests += 1
        else:
            total_failed_requests += 1

        # Wait for 2 seconds
        time.sleep(2)

        # Measure latency for DELETE request
        delete_port = random.choice(port_range)
        delete_start_time = time.time()
        delete_response = requests.delete(f'http://localhost:{delete_port}/s/key?key={key}')
        delete_end_time = time.time()
        delete_latency = delete_end_time - delete_start_time
        response_times.append(delete_latency)
        delete_response_text = {"text": delete_response.text}
        print(f"DELETE Response for {key} on port {delete_port}: {delete_response_text}")
        print(f"DELETE Latency for {key} on port {delete_port}: {delete_latency:.6f} seconds")
        print("-------------------------------------------------------------------------------------------")
        if delete_response.status_code == 200:
            total_successful_requests += 1
        else:
            total_failed_requests += 1

        # Wait for 2 seconds
        time.sleep(2)

        # Combine results
        combined_result = {
            "key": key,
            "POST Response": post_response_text,
            "POST Latency": post_latency,
            "GET Response": get_response_text,
            "GET Latency": get_latency,
            "DELETE Response": delete_response_text,
            "DELETE Latency": delete_latency
        }

        # Append the combined result to the results list
        results.append(combined_result)
        total_requests += 3  # Increment total requests by 3 (POST, GET, DELETE)

    end_time = time.time()
    elapsed_time, throughput = measure_latency_and_throughput(start_time, end_time, total_requests)
    success_rate = total_successful_requests / total_requests if total_requests > 0 else 0
    error_rate = total_failed_requests / total_requests if total_requests > 0 else 0

    response_time_distribution = calculate_response_time_distribution(response_times)

    print(f"Total elapsed time: {elapsed_time:.2f} seconds")
    print(f"Throughput: {throughput:.2f} requests per second")
    print(f"Success rate: {success_rate:.2%}")
    print(f"Error rate: {error_rate:.2%}")
    print("Response Time Distribution:")
    print(f"Mean: {response_time_distribution['mean']:.6f} seconds")
    print(f"Median: {response_time_distribution['median']:.6f} seconds")
    print(f"90th Percentile: {response_time_distribution['90th_percentile']:.6f} seconds")
    print(f"99th Percentile: {response_time_distribution['99th_percentile']:.6f} seconds")

    # Add performance metrics to results
    performance_metrics = {
        "Total elapsed time": elapsed_time,
        "Throughput": throughput,
        "Success rate": success_rate,
        "Error rate": error_rate,
        "Response Time Distribution": response_time_distribution
    }

    final_results = {
        "results": results,
        "performance_metrics": performance_metrics
    }

    # Write the results to a file
    with open('results.json', 'w') as f:
        json.dump(final_results, f, indent=4)

    print("Results have been written to results.json")

if __name__ == "__main__":
    main()
