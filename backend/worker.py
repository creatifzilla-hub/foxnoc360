import multiprocessing
import subprocess
import sys
import os
import time
import logging

# Configure basic logging for the manager
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("worker_manager")

def start_rq_worker():
    """Starts a single RQ worker process."""
    # Use 'rq worker' CLI command. 
    # We target the 'device_pings' queue.
    # --with-scheduler handles any scheduled jobs in the queue
    rq_path = os.path.join(os.path.dirname(sys.executable), "rq")
    cmd = [rq_path, "worker", "device_pings"]
    
    # We set PYTHONPATH to ensures the worker can find 'app'
    env = os.environ.copy()
    env["PYTHONPATH"] = env.get("PYTHONPATH", "") + ":" + os.getcwd()
    
    return subprocess.Popen(cmd, cwd=os.getcwd(), env=env)

if __name__ == "__main__":
    logger.info("Initializing FoxNOC360 Multi-Process Worker Manager...")
    
    # Auto-scaling logic:
    # Scale based on CPU cores for maximum parallelism.
    # If the user has 20,000 devices, we want to fully utilize the system.
    cpu_count = multiprocessing.cpu_count()
    worker_count = max(2, cpu_count)
    
    logger.info(f"Scaling architecture: spawning {worker_count} parallel workers.")
    
    processes = []
    try:
        for i in range(worker_count):
            logger.info(f"Launching worker process #{i+1}...")
            processes.append(start_rq_worker())
            time.sleep(0.5)
            
        logger.info("Monitoring system is active. Scalability limit: 20k+ devices.")
        
        # Monitoring / Fail-Safe loop
        while True:
            for i, p in enumerate(processes):
                # Check if process is still running
                if p.poll() is not None:
                    logger.warning(f"Worker #{i+1} (PID: {p.pid}) terminated unexpectedly. Restarting...")
                    processes[i] = start_rq_worker()
            time.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Shutdown signal received. Terminating all workers...")
        for p in processes:
            p.terminate()
        logger.info("All worker processes stopped.")
