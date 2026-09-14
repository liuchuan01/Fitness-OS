import { X, ChevronRight, ArrowUpRight, Crosshair, ChevronDown } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { useEffect, useRef, useState } from "react";
import { muscleLabels, type MuscleId } from "../../../shared/muscle-taxonomy";
import { bodyRegions, musclesInRegion, type BodyRegionId } from "./body-regions";
import "./muscle-picker.css";

type MusclePickerProps = {
  value: MuscleId | null;
  onChange: (value: MuscleId | null) => void;
  onExplore: (open: boolean, region: BodyRegionId | null) => void;
};

export function MusclePicker({ value, onChange, onExplore }: MusclePickerProps) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState<BodyRegionId | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const exploreRef = useRef(onExplore);
  exploreRef.current = onExplore;
  function close() {
    setOpen(false);
    setRegion(null);
    onExplore(false, null);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setRegion(null);
        exploreRef.current(false, null);
      }
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector<HTMLButtonElement>(".explorer-grid button, .explorer-muscles button")
        ?.focus();
  }, [open, region]);
  const currentRegion = bodyRegions.find((item) => item.id === region);
  return (
    <div
      className="muscle-explorer"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        className="explorer-trigger glass-card"
        type="button"
        aria-label="选择肌肉"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="body-explorer"
        onClick={() => {
          if (open) close();
          else {
            setOpen(true);
            setRegion(null);
            onExplore(true, null);
          }
        }}
      >
        <Crosshair size={18} strokeWidth={1.75} aria-hidden="true" />
        <span className="explorer-trigger-label">{value ? "切换身体部位" : "探索身体"}</span>
        <span className="explorer-trigger-compact">部位</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          id="body-explorer"
          role="dialog"
          aria-label="身体部位选择"
          className="explorer-panel glass-card"
          ref={panel}
        >
          <div className="explorer-heading">
            <span>BODY EXPLORER</span>
            <IconButton label="关闭部位选择" icon={X} onClick={close} />
          </div>
          <div className="explorer-path">
            <button
              type="button"
              onClick={() => {
                setRegion(null);
                onExplore(true, null);
              }}
            >
              身体分区
            </button>
            <ChevronRight size={12} aria-hidden="true" />
            <strong>{currentRegion?.label ?? "选择关注的部位"}</strong>
          </div>
          <p className="explorer-description">
            {region ? "选择具体肌肉，查看你的训练历史。" : "从身体分区开始，逐层了解你的训练。"}
          </p>
          {region ? (
            <div className="explorer-muscles" aria-label={`${currentRegion?.label}肌肉`}>
              {musclesInRegion(region).map((id, index) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={value === id}
                  onClick={() => {
                    onChange(id);
                    close();
                  }}
                >
                  <span className="explorer-index">{String(index + 1).padStart(2, "0")}</span>
                  <span>{muscleLabels[id]}</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="explorer-grid" aria-label="身体分区">
              {bodyRegions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  onPointerEnter={() => onExplore(true, item.id)}
                  onFocus={() => onExplore(true, item.id)}
                  onClick={() => {
                    setRegion(item.id);
                    onExplore(true, item.id);
                  }}
                >
                  <span className="explorer-index">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.label}</strong>
                  <small>{item.caption}</small>
                </button>
              ))}
            </div>
          )}
          <div className="explorer-footer">
            <i aria-hidden="true" />
            身体已暂停旋转{" "}
            <span>{region ? `${musclesInRegion(region).length} 块肌肉` : "01 分区 · 02 肌肉"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
