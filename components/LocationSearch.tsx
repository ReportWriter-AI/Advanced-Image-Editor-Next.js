"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  options: string[];
  value: string;
  onChangeAction: (val: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  width?: number | string;
  autoFocus?: boolean;
  onAddNew?: (newLocation: string) => void;
};

// A lightweight, dependency-free combobox with type-ahead filtering and keyboard navigation
export default function LocationSearch({
  options,
  value,
  onChangeAction,
  placeholder = "Select location…",
  allowCustom = true,
  width = 180,
  autoFocus = false,
  onAddNew,
}: Props) {
  const [query, setQuery] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState("");

  // Sync internal query state with external value prop
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
    return base.slice(0, 100); // safety cap
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const commit = (val: string) => {
    setQuery(val); // Update internal query state immediately
    onChangeAction(val);
    setOpen(false);
    setHighlight(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered.length > 0) {
        commit(filtered[highlight]);
      } else if (allowCustom) {
        commit(query.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Make width responsive: cap at 100% on small screens to avoid horizontal overflow
  const containerWidth = typeof width === "number" ? `min(100%, ${width}px)` : (width || "100%");

  // When open, position dropdown using a portal to escape ancestor overflow clipping (iOS Safari)
  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({ left: Math.round(rect.left), top: Math.round(rect.bottom + 4), width: Math.round(rect.width) });
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  const handleAddNew = () => {
    setShowAddModal(true);
    setNewLocationInput("");
  };

  const handleSaveNewLocation = () => {
    if (newLocationInput && newLocationInput.trim()) {
      const trimmed = newLocationInput.trim();
      if (onAddNew) {
        onAddNew(trimmed);
      }
      commit(trimmed);
      setShowAddModal(false);
      setNewLocationInput("");
    }
  };

  // Dropdown content (shared between in-place and portal rendering)
  const dropdownList = (
    <>
      {filtered.length === 0 ? (
        <div style={{ padding: "8px 10px", fontSize: 12, color: "#6b7280" }}>
          {allowCustom ? "Press Enter to use custom value" : "No results"}
        </div>
      ) : (
        filtered.map((opt, i) => (
          <div
            key={`${opt}-${i}`}
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={(e) => {
              // Commit on mousedown so the value is set even if click doesn't fire (mobile/iOS quirks)
              e.preventDefault();
              e.stopPropagation();
              commit(opt);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              commit(opt);
            }}
            onClick={(e) => {
              // Redundant safety: also commit on click
              e.preventDefault();
              e.stopPropagation();
              commit(opt);
            }}
            role="option"
            aria-selected={i === highlight}
            style={{
              padding: "8px 10px",
              fontSize: 12,
              cursor: "pointer",
              background: i === highlight ? "#eff6ff" : "white",
              color: "#111827",
            }}
          >
            {opt}
          </div>
        ))
      )}
    </>
  );

  const dropdownBox = (
    <div
      role="listbox"
      style={{
        maxHeight: 280,
        overflowY: "auto",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {dropdownList}
    </div>
  );

  const portalDropdown = dropdownPos
    ? createPortal(
        <div
          style={{
            position: "fixed",
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: dropdownPos.width,
            zIndex: 100000,
          }}
        >
          {dropdownBox}
        </div>,
        document.body
      )
    : null;

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", width: containerWidth }}>
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        <div style={{ position: "relative" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            style={{
              width: "100%",
              padding: "0.5rem 2rem 0.5rem 0.5rem",
              fontSize: "0.75rem",
              borderRadius: "0.25rem",
              border: "1px solid #d1d5db",
              outline: "none",
              backgroundColor: "white",
            }}
            onBlur={(e) => {
              // Keep dropdown open while clicking inside the list
              // Delay to allow option click to register
              setTimeout(() => {
                if (!containerRef.current?.contains(document.activeElement)) {
                  setOpen(false);
                }
              }, 120);
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => commit("")}
              aria-label="Clear"
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                fontSize: 14,
                padding: 2,
              }}
            >
              ×
            </button>
          )}
        </div>
        {open && (
          portalDropdown ?? (
            <div
              role="listbox"
              style={{
                position: "absolute",
                zIndex: 30,
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
              }}
            >
              {dropdownBox}
            </div>
          )
        )}
      </div>
      {onAddNew && (
        <button
          type="button"
          onClick={handleAddNew}
          style={{
            padding: "0.5rem 0.75rem",
            fontSize: "0.75rem",
            borderRadius: "0.25rem",
            border: "1px solid #10b981",
            backgroundColor: "#10b981",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
            height: "fit-content",
          }}
        >
          Add New
        </button>
      )}

      {/* Add New Location Modal */}
      {showAddModal && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100001,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "24px",
              width: "90%",
              maxWidth: "400px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600, color: "#111827" }}>
              Add New Location
            </h3>
            <input
              type="text"
              value={newLocationInput}
              onChange={(e) => setNewLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveNewLocation();
                } else if (e.key === "Escape") {
                  setShowAddModal(false);
                }
              }}
              placeholder="Enter location name..."
              autoFocus
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                outline: "none",
                marginBottom: "16px",
              }}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "white",
                  color: "#374151",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewLocation}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#10b981",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Add Location
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
