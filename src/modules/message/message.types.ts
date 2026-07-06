export type FileType = 'image' | 'document' | 'archive' | 'other';

export interface AttachmentInput {
  url: string;
  publicId: string;
  fileName: string;
  fileSize: number;
  fileType: FileType;
}

export const resolveFileType = (mimeType: string): FileType => {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType === 'text/plain'
  ) {
    return 'document';
  }
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-rar-compressed' ||
    mimeType === 'application/x-tar' ||
    mimeType === 'application/gzip'
  ) {
    return 'archive';
  }
  return 'other';
};
