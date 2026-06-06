"use client";

import { useState, useMemo } from "react";
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBtn } from "./Modal";
import { Icons } from "./Sidebar";

interface Device {
  id: string;
  name: string;
  ip_address?: string;
}

interface ResetSLAModalProps {
  /** list of devices available to reset */
  availableDevices?: Device[];
  /** single device name for simple mode (if availableDevices not provided) */
  deviceName?: string;
  resetting: boolean;
  /** onConfirm now can take an array of device IDs */
  onConfirm: (deviceIds: string[] | null) => void;
  onCancel: () => void;
}

const WarningIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" className="w-5 h-5">
    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
  </svg>
);

export default function ResetSLAModal({ 
  availableDevices = [], 
  deviceName = "Selected Devices",
  resetting, 
  onConfirm, 
  onCancel 
}: ResetSLAModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!search) return availableDevices;
    const s = search.toLowerCase();
    return availableDevices.filter(d => 
      d.name.toLowerCase().includes(s) || 
      d.ip_address?.toLowerCase().includes(s)
    );
  }, [availableDevices, search]);

  const toggleDevice = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const isAllSelected = selectedIds.length === availableDevices.length && availableDevices.length > 0;
  
  const handleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(availableDevices.map(d => d.id));
  };

  const handleSubmit = () => {
    if (availableDevices.length > 0) {
      if (selectedIds.length === 0) return;
      onConfirm(selectedIds);
    } else {
      onConfirm(null);
    }
  };

  const showList = availableDevices.length > 0;

  return (
    <Modal open onClose={onCancel} width={520} closeOnBackdrop={!resetting}>
      <ModalHeader
        title="Reset SLA Data?"
        subtitle="This action is permanent and cannot be undone."
        icon={
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: "rgba(239,68,68,0.1)" }}>
            {WarningIcon}
          </div>
        }
        onClose={onCancel}
      />

      <ModalBody>
        <div className="space-y-5">
           {showList ? (
             <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider opacity-60 px-1">Select Target Devices</label>
                
                <div className="relative group">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted opacity-40 group-focus-within:opacity-100 transition-opacity">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                       <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                     </svg>
                  </span>
                  <input 
                    type="text" 
                    placeholder="Search device name or IP..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition-all border-2 focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500/20"
                    style={{ background: "var(--bg-base)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div className="border rounded-2xl overflow-hidden shadow-inner" style={{ borderColor: "var(--bg-border)", background: "var(--bg-base)" }}>
                   <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--bg-border)", background: "var(--bg-elevated)" }}>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                         {selectedIds.length} devices selected
                      </span>
                      <button 
                        onClick={handleSelectAll}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors"
                      >
                         {isAllSelected ? "Deselect All" : "Select All"}
                      </button>
                   </div>
                   <div className="max-h-56 overflow-y-auto custom-scrollbar">
                      {filtered.length > 0 ? (
                        filtered.map(d => (
                          <div 
                            key={d.id}
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b last:border-b-0"
                            style={{ borderColor: "rgba(128,128,128,0.1)" }}
                            onClick={() => toggleDevice(d.id)}
                          >
                             <div 
                               className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.includes(d.id) ? 'bg-rose-500 border-rose-500 shadow-sm' : 'border-gray-500/30 bg-transparent'}`}
                             >
                               {selectedIds.includes(d.id) && (
                                 <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                 </svg>
                               )}
                             </div>
                             <div className="flex flex-col">
                                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{d.name}</span>
                                {d.ip_address && <span className="text-[11px] opacity-50 font-mono">{d.ip_address}</span>}
                             </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-sm opacity-40">No devices found matching "{search}"</div>
                      )}
                   </div>
                </div>
             </div>
           ) : (
             <div
               className="rounded-xl px-4 py-4"
               style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
             >
               <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                 You are about to permanently delete all ping logs and downtime records for{" "}
                 <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                   {deviceName}
                 </span>
                 . Once removed, this data cannot be recovered.
               </p>
             </div>
           )}

           <div
             className="rounded-2xl px-4 py-4 flex gap-3 shadow-sm"
             style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
           >
             <span className="text-rose-500 shrink-0 text-lg">⚠️</span>
             <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
               Resetting will <span className="font-bold text-rose-500">permanently delete</span> all logs and history. 
               {showList && selectedIds.length > 0 && ` You currently have ${selectedIds.length} items queued for destruction.`}
             </p>
           </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <ModalBtn variant="ghost" onClick={onCancel} disabled={resetting}>
          Cancel
        </ModalBtn>
        <ModalBtn 
          variant="danger" 
          onClick={handleSubmit} 
          loading={resetting}
          disabled={showList && selectedIds.length === 0}
        >
          {resetting ? "Resetting…" : (showList ? `Reset ${selectedIds.length} Devices` : "Yes, Reset Data")}
        </ModalBtn>
      </ModalFooter>
      <style jsx>{`
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(128,128,128,0.2) transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 10px; }
      `}</style>
    </Modal>
  );
}
