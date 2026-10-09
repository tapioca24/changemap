import type { Ref } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@base-ui/react/button";
import type { MergedFileNode } from "../graph/model.js";
import type { MapPackage } from "./map-model.js";
import { StatusBadge } from "./status-badge.js";

export function PackagePane({
  pkg,
  onSelect,
  onClose,
  closeButtonRef,
  narrow,
}: {
  pkg: MapPackage;
  onSelect(id: string): void;
  onClose(): void;
  closeButtonRef?: Ref<HTMLButtonElement>;
  narrow: boolean;
}) {
  const changed = pkg.files.filter((file) => file.change !== null);
  const related = pkg.files.filter((file) => file.change === null);
  function fileList(files: readonly MergedFileNode[], title: string) {
    if (!files.length) return null;
    return (
      <section className="package-file-section" aria-label={title}>
        <h3>
          {title} <span>{files.length}</span>
        </h3>
        <ul>
          {files.map((file) => {
            const path = file.newPath ?? file.oldPath!;
            return (
              <li key={file.id}>
                <button onClick={() => onSelect(file.id)} aria-label={`Open ${path}`}>
                  <span className="package-file-name">
                    <strong>{path.split("/").pop()}</strong>
                    {file.status !== "unchanged" && <StatusBadge status={file.status} />}
                  </span>
                  <small>
                    {file.status === "renamed" ? `${file.oldPath} → ${file.newPath}` : path}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
  return (
    <aside className="package-pane" aria-label={`Go package ${pkg.path} files`}>
      <div className="package-pane-heading">
        <div>
          <span className="package-kind">GO PACKAGE</span>
          <h2>{pkg.path}</h2>
          <p>
            {changed.length} changed · {related.length} related
          </p>
        </div>
        <Button
          ref={closeButtonRef}
          className="icon-button"
          aria-label={narrow ? "Back to graph" : "Close package pane"}
          onClick={onClose}
        >
          {narrow ? <ArrowLeft aria-hidden="true" /> : <X aria-hidden="true" />}
        </Button>
      </div>
      <div className="package-pane-files">
        {fileList(changed, "Changed files")}
        {fileList(related, "Related files")}
      </div>
    </aside>
  );
}
