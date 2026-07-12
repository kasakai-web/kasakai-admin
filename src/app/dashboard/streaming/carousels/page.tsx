"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { scrApi } from "@/lib/screening-api";

type SelectedFile = { file: File; url: string; uploadedUrl?: string };
type UploadType = "banner" | "poster";

type UploadState = {
  banner: SelectedFile | null;
  poster: SelectedFile | null;
};

type CarouselItem = {
  _id: string;
  title: string;
  banner: string;
  poster: string;
  createdAt: string;
};

const uploadConfig = {
  banner: {
    label: "Landscape Banner (16:9)",
    help: "PNG / JPG / WebP · max 2 MB",
    placeholder: "Select your landscape banner here",
    size: "Recommended size: 1600 × 900 px",
    alt: "Landscape banner preview",
  },
  poster: {
    label: "Portrait Poster (3:4)",
    help: "PNG / JPG / WebP · max 2 MB",
    placeholder: "Select your portrait poster here",
    size: "Recommended size: 900 × 1200 px",
    alt: "Portrait poster preview",
  },
};

export default function Page() {
  const [files, setFiles] = useState<UploadState>({banner: null,poster: null});
  const [carouselText, setCarouselText] = useState("");

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [carousels, setCarousels] = useState<CarouselItem[]>([]);
  const [loadingCarousels, setLoadingCarousels] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function loadCarousels() {
    setLoadingCarousels(true);
    try {
      const list = await scrApi.listCarousels();
      setCarousels(list);
    } catch (err: unknown) {
      setMessage(`Failed to load carousels: ${(err as Error)?.message || 'unknown'}`);
    } finally {
      setLoadingCarousels(false);
    }
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>,target: UploadType) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const isAllowedExtension = /\.(png|jpe?g|webp)$/i.test(selected.name);
    const isAllowedMimeType = allowedTypes.includes(selected.type);

    if (!isAllowedExtension && !isAllowedMimeType) {
      setMessage("Only PNG, JPG, and WebP images are supported.");
      event.target.value = "";
      return;
    }

    if (selected.size > 2 * 1024 * 1024) {
      setMessage("File is too large. Maximum size is 2 MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(selected);

    try {
      setUploading(true);
      setMessage(null);

      // Upload image and get URL from API
      const uploadedUrl = await scrApi.uploadImage(selected);

      setFiles((prev) => {
        if (prev[target]?.url) URL.revokeObjectURL(prev[target]!.url);

        return {
          ...prev,
          [target]: { file: selected, url: objectUrl, uploadedUrl },
        };
      });

      setMessage(`${target === "banner" ? "Banner" : "Poster"} uploaded successfully.`);
    } catch (err: unknown) {
      setMessage(`Upload failed: ${(err as Error)?.message || "unknown"}`);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }

  function remove(target: UploadType) {
    setFiles((prev) => {
      if (prev[target]?.url) URL.revokeObjectURL(prev[target]!.url);

      return {
        ...prev,
        [target]: null,
      };
    });
    setMessage(null);
  }

  async function upload() {
    // Validate title
    if (!carouselText.trim()) {
      setMessage("Display text is required.");
      return;
    }

    // Validate both images are uploaded
    if (!files.banner?.uploadedUrl || !files.poster?.uploadedUrl) {
      setMessage("Please upload both a landscape banner and a portrait poster.");
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      await scrApi.createCarousel({
        title: carouselText,
        banner: files.banner.uploadedUrl,
        poster: files.poster.uploadedUrl,
      });

      setMessage("Carousel created successfully.");
      setCarouselText("");
      setFiles({ banner: null, poster: null });
      await loadCarousels();
    } catch (err: unknown) {
      setMessage("Upload failed: " + ((err as Error)?.message || "unknown"));
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    loadCarousels();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(files).forEach((item) => {
        if (item?.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [files]);

  async function deleteCarouselItem(id: string) {
    setDeletingId(id);
    setMessage(null);

    try {
      await scrApi.deleteCarousel(id);
      setCarousels((prev) => prev.filter((item) => item._id !== id));
      setMessage("Carousel deleted successfully.");
    } catch (err: unknown) {
      setMessage("Delete failed: " + ((err as Error)?.message || "unknown"));
    } finally {
      setDeletingId(null);
    }
  }

  async function confirmDeleteCarousel() {
    if (!pendingDeleteId) return;
    await deleteCarouselItem(pendingDeleteId);
    setPendingDeleteId(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.pill}>Carousel creatives</div>
          <h1>Upload Image For Carousel</h1>
          <p>
            Add a landscape banner and a portrait poster to give the carousel a
            polished look across desktop and mobile screens.
          </p>
        </div>
      </div>

      <div className={styles.scrCard}>
        <p className={styles.sec}>Carousel Text</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className={styles.lbl}>
            Display Text
            <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>
          </label>
          <input
            type="text"
            className={styles.input}
            placeholder="Enter text to display on carousel"
            value={carouselText}
            onChange={(e) => setCarouselText(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.scrCard}>
        <p className={styles.sec}>Creatives</p>

        <div className={styles.scrGrid2}>
          {(Object.keys(uploadConfig) as UploadType[]).map((type) => {
            const config = uploadConfig[type];
            const file = files[type];

            return (
              <div key={type} className={styles.uploadBox}>
                <label className={styles.lbl}>
                  {config.label}
                  <span className="block mt-2" >{config.help}</span>
                </label>

                <label className={styles.dropzone}>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => handleFileSelect(e, type)}
                  />

                  {file ? (
                    <div className={styles.previewWrap}>
                      <div className={styles.previewFrame}>
                        <Image
                          src={file.url}
                          alt={config.alt}
                          fill
                          className={styles.previewImage}
                          unoptimized
                        />
                      </div>

                      <div className={styles.previewMeta}>
                        <span>{file.file.name}</span>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => remove(type)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.placeholder}>
                      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: "0 auto 10px", display: "block" }}>
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>{config.placeholder}</p>
                      <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", opacity: 0.6 }}>{config.size}</p>
                    </div>
                  )}
                </label>
              </div>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={upload}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload creatives"}
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              remove("banner");
              remove("poster");
              setMessage(null);
            }}
          >
            Clear selections
          </button>
        </div>

        {message && (
          <div
            className={`${styles.status} ${message.startsWith("Carousel") || message.startsWith("Deleted")
                ? styles.success
                : styles.error
              }`}
          >
            {message}
          </div>
        )}
      </div>

      <div className={styles.scrCard}>
        <p className={styles.sec}>Uploaded carousels</p>

        {loadingCarousels ? (
          <p className={styles.empty}>Loading previous carousels...</p>
        ) : carousels.length === 0 ? (
          <p className={styles.empty}>No carousels uploaded yet.</p>
        ) : (
          <div className={styles.carouselList}>
            {carousels.map((item) => (
              <div key={item._id} className={styles.carouselRow}>
                <div className={styles.carouselPreview}>
                  <Image
                    src={item.banner}
                    alt={item.title}
                    fill
                    className={styles.carouselImage}
                    unoptimized
                  />
                  <button
                    type="button"
                    className={styles.carouselDeleteIcon}
                    onClick={() => setPendingDeleteId(item._id)}
                    disabled={deletingId === item._id}
                  >
                    {deletingId === item._id ? '…' : 'X'}
                  </button>
                </div>

                <div className={styles.carouselDetails}>
                  <p className={styles.carouselTitle}>{item.title}</p>
                  <p className={styles.carouselMeta}>
                    Uploaded {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDeleteId && (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => setPendingDeleteId(null)}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-carousel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalIcon}>!</div>
            <h3 id="delete-carousel-title" className={styles.modalTitle}>
              Delete carousel creative?
            </h3>
            <p className={styles.modalText}>
              This will remove the selected carousel image from the gallery. This action cannot be undone.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setPendingDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={confirmDeleteCarousel}
                disabled={deletingId !== null}
              >
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}