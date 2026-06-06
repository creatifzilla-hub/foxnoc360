import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import uuid

from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.device import Device
from app.models.device_interface import DeviceInterface
from app.models.snmp_log import SNMPLog
from app.services.alert_service import send_bandwidth_alert

logger = logging.getLogger("snmp_service")

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# ── SNMP v2/v3 Fetch Engine ──────────────────────────────────────────────────

async def snmp_get_multiple(host: str, port: int, version: str, community: str, 
                            v3_user: str = None, v3_auth_p: str = None, v3_auth_k: str = None,
                            v3_priv_p: str = None, v3_priv_k: str = None,
                            oids: List[str] = []) -> Dict[str, Any]:
    """
    Perform SNMP GET for multiple OIDs.
    """
    from pysnmp.hlapi.asyncio import (
        get_cmd, SnmpEngine, CommunityData, UdpTransportTarget, 
        ContextData, ObjectType, ObjectIdentity, UsmUserData
    )
    
    auth_data = None
    if version == "v3":
        from pysnmp.hlapi.asyncio import usmHMACMD5AuthProtocol, usmHMACSHAAuthProtocol, usmDESPrivProtocol, usmAesCfb128Protocol
        auth_proto = usmHMACMD5AuthProtocol if v3_auth_p == "MD5" else usmHMACSHAAuthProtocol if v3_auth_p == "SHA" else None
        priv_proto = usmDESPrivProtocol if v3_priv_p == "DES" else usmAesCfb128Protocol if v3_priv_p == "AES" else None
        auth_data = UsmUserData(v3_user, authKey=v3_auth_k, authProtocol=auth_proto, privKey=v3_priv_k, privProtocol=priv_proto)
    else:
        auth_data = CommunityData(community, mpModel=1)

    try:
        snmp_engine = SnmpEngine()
        var_binds_in = [ObjectType(ObjectIdentity(oid)) for oid in oids]
        error_indication, error_status, error_index, var_binds = await get_cmd(
            snmp_engine, auth_data, await UdpTransportTarget.create((host, port), timeout=2, retries=1), ContextData(), *var_binds_in
        )
        if error_indication or error_status: return {}
        results = {}
        for var_bind in var_binds:
            oid_str = str(var_bind[0])
            val = var_bind[1]
            try: results[oid_str] = int(val)
            except: results[oid_str] = str(val)
        return results
    except Exception as e:
        logger.debug(f"[SNMP] Exception polling {host}: {e}")
        return {}

# ── Interface Discovery ──────────────────────────────────────────────────────

async def discover_interfaces(device_id: str) -> List[Dict[str, Any]]:
    """
    Walk the ifTable and ifXTable to find all interfaces on a device.
    """
    from pysnmp.hlapi.asyncio import (
        walk_cmd, SnmpEngine, CommunityData, UdpTransportTarget, 
        ContextData, ObjectType, ObjectIdentity, UsmUserData
    )
    
    async with AsyncSessionLocal() as db:
        device = await db.get(Device, device_id)
        if not device: return []
        
        host = device.ip_address
        port = device.snmp_port
        if device.snmp_version == "v3":
            from pysnmp.hlapi.asyncio import usmHMACMD5AuthProtocol, usmHMACSHAAuthProtocol, usmDESPrivProtocol, usmAesCfb128Protocol
            auth_proto = usmHMACMD5AuthProtocol if device.snmp_v3_auth_p == "MD5" else usmHMACSHAAuthProtocol if device.snmp_v3_auth_p == "SHA" else None
            priv_proto = usmDESPrivProtocol if device.snmp_v3_priv_p == "DES" else usmAesCfb128Protocol if device.snmp_v3_priv_p == "AES" else None
            auth_data = UsmUserData(device.snmp_v3_user, authKey=device.snmp_v3_auth_k, authProtocol=auth_proto, privKey=device.snmp_v3_priv_k, privProtocol=priv_proto)
        else:
            auth_data = CommunityData(device.snmp_community, mpModel=1)

        interfaces = {}
        walk_oids = {
            "name": "1.3.6.1.2.1.2.2.1.2",
            "alias": "1.3.6.1.2.1.31.1.1.1.18",
            "type": "1.3.6.1.2.1.2.2.1.3",
            "mac": "1.3.6.1.2.1.2.2.1.6"
        }

        for key, base_oid in walk_oids.items():
            it = walk_cmd(SnmpEngine(), auth_data, await UdpTransportTarget.create((host, port), timeout=2, retries=1), ContextData(), ObjectType(ObjectIdentity(base_oid)), lexicographicMode=False)
            async for errorIndication, errorStatus, errorIndex, varBinds in it:
                if errorIndication or errorStatus: break
                for varBind in varBinds:
                    oid_str = str(varBind[0]); idx = int(oid_str.split(".")[-1]); val = varBind[1]
                    if idx not in interfaces: interfaces[idx] = {"if_index": idx}
                    try: interfaces[idx][key] = str(val) if key != "type" else int(val)
                    except: interfaces[idx][key] = str(val)

        discovered_list = []
        for idx, data in interfaces.items():
            result = await db.execute(select(DeviceInterface).where(DeviceInterface.device_id == device.id, DeviceInterface.if_index == idx))
            iface = result.scalars().first()
            if not iface:
                iface = DeviceInterface(id=uuid.uuid4(), device_id=device.id, if_index=idx, name=data.get("name", f"Interface {idx}"), description=data.get("alias") or data.get("name"), type=data.get("type"), mac_address=data.get("mac"))
                db.add(iface)
            else:
                iface.name = data.get("name", iface.name)
                iface.description = data.get("alias") or data.get("name") or iface.description
            discovered_list.append({"if_index": idx, "name": iface.name, "description": iface.description, "is_monitored": iface.is_monitored})
        await db.commit()
        return discovered_list

# ── Bandwidth Polling ────────────────────────────────────────────────────────

_prev_counters: Dict[str, tuple[int, int, datetime]] = {}

async def poll_device_bandwidth_enhanced(device: Device, monitored_interfaces: List[DeviceInterface]):
    if not monitored_interfaces: return [], []
    oids = []
    for iface in monitored_interfaces:
        oids.append(f"1.3.6.1.2.1.31.1.1.1.6.{iface.if_index}")
        oids.append(f"1.3.6.1.2.1.31.1.1.1.10.{iface.if_index}")
        oids.append(f"1.3.6.1.2.1.2.2.1.10.{iface.if_index}")
        oids.append(f"1.3.6.1.2.1.2.2.1.16.{iface.if_index}")

    results = await snmp_get_multiple(host=device.ip_address, port=device.snmp_port, version=device.snmp_version, community=device.snmp_community, v3_user=device.snmp_v3_user, v3_auth_p=device.snmp_v3_auth_p, v3_auth_k=device.snmp_v3_auth_k, v3_priv_p=device.snmp_v3_priv_p, v3_priv_k=device.snmp_v3_priv_k, oids=oids)
    if not results: return [], []
    
    now = utc_now(); logs_to_add = []; alerts_to_send = []
    for iface in monitored_interfaces:
        in_hc = f"1.3.6.1.2.1.31.1.1.1.6.{iface.if_index}"; out_hc = f"1.3.6.1.2.1.31.1.1.1.10.{iface.if_index}"
        in_std = f"1.3.6.1.2.1.2.2.1.10.{iface.if_index}"; out_std = f"1.3.6.1.2.1.2.2.1.16.{iface.if_index}"
        curr_in = results.get(in_hc) or results.get(in_std); curr_out = results.get(out_hc) or results.get(out_std)
        if curr_in is None or curr_out is None: continue
        is_hc = results.get(in_hc) is not None; MAX_VAL = 18446744073709551615 if is_hc else 4294967295
        key = f"{device.id}:{iface.if_index}"; in_bps = out_bps = 0.0
        if key in _prev_counters:
            prev_in, prev_out, prev_time = _prev_counters[key]
            if prev_time.tzinfo is None: prev_time = prev_time.replace(tzinfo=timezone.utc)
            dt = (now - prev_time).total_seconds()
            if dt > 0:
                def calc_delta(c, p): d = c - p; return d if d >= 0 else (MAX_VAL - p + c)
                in_bps = (calc_delta(curr_in, prev_in) * 8) / dt
                out_bps = (calc_delta(curr_out, prev_out) * 8) / dt
                if in_bps > 100_000_000_000 or in_bps < 0: in_bps = 0
                if out_bps > 100_000_000_000 or out_bps < 0: out_bps = 0
        _prev_counters[key] = (curr_in, curr_out, now)
        logs_to_add.append(SNMPLog(tenant_id=device.tenant_id, device_id=device.id, if_index=iface.if_index, interface_name=iface.name, oid=in_hc if is_hc else in_std, in_octets=curr_in, out_octets=curr_out, in_bps=round(in_bps, 2), out_bps=round(out_bps, 2), polled_at=now))
        if iface.is_monitored and iface.threshold_mbps:
             if (max(in_bps, out_bps) / 1_000_000) > iface.threshold_mbps:
                 alerts_to_send.append({"tenant_id": device.tenant_id, "device_name": device.name, "if_name": iface.name, "bps": max(in_bps, out_bps), "threshold_mbps": iface.threshold_mbps})
    return logs_to_add, alerts_to_send

async def run_snmp_poll_cycle():
    from sqlalchemy.orm import selectinload
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Device).options(selectinload(Device.interfaces)))
        devices = result.scalars().all()
        if not devices: return
        sem = asyncio.Semaphore(100)
        async def task(d):
            async with sem:
                m = [i for i in d.interfaces if i.is_monitored]
                if not m: return [], []
                return await poll_device_bandwidth_enhanced(d, m)
        batch = await asyncio.gather(*[task(d) for d in devices], return_exceptions=True)
        for res in batch:
            if isinstance(res, tuple):
                logs, alerts = res; [session.add(l) for l in logs]
                for a in alerts:
                    try: await send_bandwidth_alert(db=session, tenant_id=a["tenant_id"], device_name=a["device_name"], if_name=a["if_name"], bps=a["bps"], threshold_mbps=a["threshold_mbps"])
                    except: pass
            elif isinstance(res, Exception): logger.error(f"[SNMP] Error: {res}")
        await session.commit()
    logger.info("[SNMP] Cycle complete.")
