import styles from "./dashboard.module.css";

type DetailPanelProps = {
  title: string;
  rows: Array<[string, string]>;
  onClose: () => void;
};

export function DetailPanel({ title, rows, onClose }: DetailPanelProps) {
  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div className={styles.detailPanel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.panelHead}>
          <div>{title}</div>
          <button type="button" className={styles.actionBtn} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={styles.panelBody}>
          {rows.map(([key, value]) => (
            <div key={key} className={styles.detailRow}>
              <span>{key}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
