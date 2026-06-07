'use client';

import { useRef, useState } from 'react';
import { Film, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface UploadedFile {
  url: string;
  absoluteUrl: string;
  kind: 'image' | 'video';
  filename: string;
  size: number;
}

interface MediaUploaderProps {
  /** Existing image URLs (relative or absolute). */
  images: string[];
  /** Optional existing video URL. */
  videoUrl?: string | null;
  /** Max image count (default 10). */
  maxImages?: number;
  onImagesChange: (urls: string[]) => void;
  onVideoChange: (url: string | null) => void;
}

const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp,image/gif';
const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime';

export function MediaUploader({
  images,
  videoUrl,
  maxImages = 10,
  onImagesChange,
  onVideoChange,
}: MediaUploaderProps) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  async function uploadOne(file: File): Promise<UploadedFile> {
    const form = new FormData();
    form.append('file', file);
    // Critical: do NOT set a Content-Type header. Axios needs to set it itself
    // (e.g. "multipart/form-data; boundary=…") so the server can parse the body.
    // Hard-coding 'multipart/form-data' without the boundary breaks the request.
    // The default 'application/json' from the axios instance is also wrong here,
    // so explicitly null it out per-request.
    const res = await api.post<{ success: boolean; data: UploadedFile; error?: { message: string } }>(
      '/uploads/file',
      form,
      { headers: { 'Content-Type': null as unknown as string } },
    );
    if (!res.data.success) throw new Error(res.data.error?.message ?? 'Upload failed');
    return res.data.data;
  }

  async function onImagesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxImages} images.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    if (files.length > toUpload.length) {
      toast.warning(`Only the first ${toUpload.length} image${toUpload.length === 1 ? '' : 's'} will be uploaded (limit ${maxImages}).`);
    }
    setUploadingImages(true);
    try {
      const uploaded = await Promise.all(toUpload.map(uploadOne));
      onImagesChange([...images, ...uploaded.map((u) => u.url)]);
      toast.success(`Uploaded ${uploaded.length} image${uploaded.length === 1 ? '' : 's'}.`);
    } catch (e) {
      toast.error(`Image upload failed: ${(e as Error).message}`);
    } finally {
      setUploadingImages(false);
      if (imageInput.current) imageInput.current.value = '';
    }
  }

  async function onVideoPicked(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const out = await uploadOne(file);
      onVideoChange(out.url);
      toast.success('Video uploaded.');
    } catch (e) {
      toast.error(`Video upload failed: ${(e as Error).message}`);
    } finally {
      setUploadingVideo(false);
      if (videoInput.current) videoInput.current.value = '';
    }
  }

  function removeImage(idx: number) {
    onImagesChange(images.filter((_, i) => i !== idx));
  }

  function removeVideo() {
    onVideoChange(null);
  }

  return (
    <div className="space-y-4">
      {/* IMAGES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            Images <span className="text-muted-foreground">({images.length}/{maxImages})</span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploadingImages || images.length >= maxImages}
            onClick={() => imageInput.current?.click()}
          >
            {uploadingImages
              ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Uploading…</>
              : <><ImagePlus className="mr-2 h-3 w-3" /> Add images</>}
          </Button>
          <input
            ref={imageInput}
            type="file"
            multiple
            accept={ACCEPT_IMAGE}
            className="hidden"
            onChange={(e) => onImagesPicked(e.target.files)}
          />
        </div>

        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((src, i) => (
              <div key={`${src}-${i}`} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Image ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={uploadingImages}
            className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/50"
          >
            <Upload className="h-5 w-5" />
            <span>Click to add up to {maxImages} images</span>
            <span className="text-xs">JPEG, PNG, WebP, GIF · 5MB each</span>
          </button>
        )}
      </div>

      {/* VIDEO */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Video <span className="text-muted-foreground">(optional)</span></p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploadingVideo}
            onClick={() => videoInput.current?.click()}
          >
            {uploadingVideo
              ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Uploading…</>
              : <><Film className="mr-2 h-3 w-3" /> {videoUrl ? 'Replace video' : 'Add video'}</>}
          </Button>
          <input
            ref={videoInput}
            type="file"
            accept={ACCEPT_VIDEO}
            className="hidden"
            onChange={(e) => onVideoPicked(e.target.files)}
          />
        </div>

        {videoUrl ? (
          <div className="relative overflow-hidden rounded-md border bg-black">
            <video src={videoUrl} controls className="aspect-video w-full" />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90"
              aria-label="Remove video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            disabled={uploadingVideo}
            className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/50"
          >
            <Film className="h-5 w-5" />
            <span>Click to upload one promo video</span>
            <span className="text-xs">MP4, WebM, MOV · up to 50MB</span>
          </button>
        )}
      </div>
    </div>
  );
}
