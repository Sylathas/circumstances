import {
  getDownloadURL,
  ref,
  uploadBytes,
  deleteObject,
} from "firebase/storage";
import { storage } from "../components/firebase/firebaseConfig";

/**
 * Uploads a file to Firebase Storage and returns its download URL.
 * @param file - The file to upload
 * @param path - Storage path (e.g. "covers/123_filename.jpg")
 * @returns The public download URL
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Extracts the storage path from a Firebase Storage download URL.
 */
function getPathFromDownloadUrl(downloadUrl: string): string | null {
  try {
    const match = downloadUrl.match(/\/o\/(.+?)(\?|$)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Deletes a file from Firebase Storage by its download URL.
 * No-op if the URL is not a valid Storage URL or path cannot be extracted.
 */
export async function deleteFileByUrl(downloadUrl: string): Promise<void> {
  const path = getPathFromDownloadUrl(downloadUrl);
  if (!path) return;
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}
