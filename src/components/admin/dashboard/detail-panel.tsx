type DetailPanelProps = {
  title: string;
  rows: Array<[string, string]>;
  onClose: () => void;
};

export function DetailPanel({ title, rows, onClose }: DetailPanelProps) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[rgba(0,0,0,0.65)] px-4 py-10 backdrop-blur-[4px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="h-screen w-[480px] overflow-y-auto border-l border-border bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-5">
          <div>{title}</div>
          <button
            type="button"
            className="cursor-pointer border border-border-2 bg-transparent px-[10px] py-1 font-mono text-[11px] tracking-[0.06em] text-muted hover:border-[#555] hover:text-fg"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-[22px]">
          {rows.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between border-b border-border-2 py-[7px]"
            >
              <span>{key}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
