export interface MediaFile {
  fileId: string;
  uploadedBy: number;
  fileName: string;
  contentType: string;
  fileSizeKb: number;
  blobUrl: string;
  thumbnailUrl?: string;
  messageId?: number;
  roomId?: number;
  uploadedAt: Date;
  expiresAt?: Date;
}

export interface UploadResponse {
  fileId: string;
  blobUrl: string;
  fileName: string;
  contentType: string;
  fileSizeKb: number;
}
