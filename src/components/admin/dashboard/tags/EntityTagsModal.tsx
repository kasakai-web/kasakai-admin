"use client";

/* The tag panel on its own, in a modal — for venues, which have no detail
   drawer to host it, and for venue rows in a segment's sample. */

import { MODAL_OVERLAY, MODAL, MODAL_HEAD, MODAL_CLOSE, SECTION_TITLE, SECTION_SUB } from "../shared/styles";
import { EntityTagPanel } from "./EntityTagPanel";
import { ENTITY_ONE, type EntityType } from "./shared";

export function EntityTagsModal({ entityType, entityId, title, onClose }: {
  entityType: EntityType;
  entityId: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className={MODAL_OVERLAY} onClick={onClose}>
      <div className={MODAL} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div>
            <div className={SECTION_TITLE}>{title}</div>
            <div className={SECTION_SUB}>Behaviour tags on this {ENTITY_ONE[entityType]}</div>
          </div>
          <button className={MODAL_CLOSE} onClick={onClose} type="button">✕</button>
        </div>
        <EntityTagPanel entityType={entityType} entityId={entityId} bare />
      </div>
    </div>
  );
}
