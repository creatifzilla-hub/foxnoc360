import json
import logging
from datetime import datetime, time, timezone
from typing import Optional, List, Dict
from app.services.redis_queue import redis_conn

logger = logging.getLogger("maintenance")

REDIS_MAINT_PREFIX = "maint_schedule:"

class MaintenanceService:
    @staticmethod
    def _get_key(device_id: str) -> str:
        return f"{REDIS_MAINT_PREFIX}{device_id}"

    @classmethod
    def set_maintenance_window(cls, device_id: str, start_time: str, end_time: str, is_recurrent: bool = False):
        """
        Sets a maintenance window for a device.
        - One-off: ISO format timestamps.
        - Recurrent: "HH:MM" format.
        """
        key = cls._get_key(device_id)
        config = {
            "start": start_time,
            "end": end_time,
            "recurrent": is_recurrent
        }
        # For simplicity in this enterprise logic, we allow 1 window per device.
        # Extension: Use a list of windows.
        redis_conn.set(key, json.dumps(config))
        logger.info(f"[MAINT] Set window for {device_id}: {start_time} - {end_time} (recurrent={is_recurrent})")

    @classmethod
    def is_in_maintenance(cls, device_id: str) -> bool:
        """Checks if the device is currently in its maintenance window."""
        key = cls._get_key(device_id)
        raw = redis_conn.get(key)
        if not raw:
            return False
        
        try:
            config = json.loads(raw)
            now = datetime.now(timezone.utc)
            
            if config["recurrent"]:
                # Daily recurrence check
                start_h, start_m = map(int, config["start"].split(":"))
                end_h, end_m = map(int, config["end"].split(":"))
                
                # Check current time vs maintenance window
                # Note: Handles wrap-around midnight (e.g. 23:00 to 01:00)
                current_time = now.time()
                m_start = time(start_h, start_m)
                m_end = time(end_h, end_m)
                
                if m_start <= m_end:
                    return m_start <= current_time <= m_end
                else:
                    # Overnight: 22:00 -> 02:00
                    return current_time >= m_start or current_time <= m_end
            else:
                # One-off timestamp check
                m_start = datetime.fromisoformat(config["start"])
                m_end = datetime.fromisoformat(config["end"])
                return m_start <= now <= m_end
                
        except Exception as e:
            logger.error(f"[MAINT] Error parsing window for {device_id}: {e}")
            return False

    @classmethod
    def clear_maintenance(cls, device_id: str):
        redis_conn.delete(cls._get_key(device_id))
        logger.info(f"[MAINT] Cleared maintenance for {device_id}")

    @classmethod
    def get_all_schedules(cls, device_ids: List[str]) -> Dict[str, dict]:
        """Bulk fetch schedules for batch processing."""
        pipe = redis_conn.pipeline()
        for d_id in device_ids:
            pipe.get(cls._get_key(d_id))
        
        results = pipe.execute()
        schedules = {}
        for i, d_id in enumerate(device_ids):
            if results[i]:
                schedules[d_id] = json.loads(results[i])
        return schedules
