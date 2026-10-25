import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { API_ORIGIN, ensureFreshToken, tokens } from "../api/client";

export interface PickedFile { uri: string; name: string; type: string }

const toPicked = (a: { uri: string; mimeType?: string | null; fileName?: string | null; name?: string | null }, fallback: string): PickedFile => {
  const type = a.mimeType || (a.uri.endsWith(".png") ? "image/png" : a.uri.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  const ext = type === "image/png" ? "png" : type === "application/pdf" ? "pdf" : type === "image/webp" ? "webp" : "jpg";
  return { uri: a.uri, type, name: a.fileName || a.name || `${fallback}.${ext}` };
};

export const pickImage = async (opts: { camera?: boolean; multiple?: boolean } = {}): Promise<PickedFile[]> => {
  if (opts.camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera permission is needed to take a photo");
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    return r.canceled ? [] : r.assets.map((a) => toPicked(a, "photo"));
  }
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: !!opts.multiple, selectionLimit: opts.multiple ? 4 : 1,
  });
  return r.canceled ? [] : r.assets.map((a) => toPicked(a, "image"));
};

export const pickDocument = async (): Promise<PickedFile | null> => {
  const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  if (a.size && a.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB");
  return toPicked({ uri: a.uri, mimeType: a.mimeType, name: a.name }, "document");
};

/** Append a picked file to FormData in the shape React Native (and web) expects. */
export const appendFile = async (form: FormData, field: string, f: PickedFile) => {
  if (Platform.OS === "web") {
    const blob = await (await fetch(f.uri)).blob();
    form.append(field, blob, f.name);
  } else {
    form.append(field, { uri: f.uri, name: f.name, type: f.type } as any);
  }
};

/** Download an authenticated PDF (invoice / receipt) and open the share sheet. */
export const downloadPdf = async (apiPath: string, filename: string) => {
  let token = tokens.access;
  const url = `${API_ORIGIN}/api${apiPath}`;
  if (Platform.OS === "web") {
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { token = await ensureFreshToken(); res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); }
    if (!res.ok) throw new Error("Could not download the file");
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return;
  }
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  const dest = new File(Paths.cache, safe);
  if (dest.exists) dest.delete();
  const attempt = async (t: string | null) =>
    File.createDownloadTask(url, dest, { headers: { Authorization: `Bearer ${t}` } }).downloadAsync();
  try {
    await attempt(token);
  } catch {
    token = await ensureFreshToken();
    if (dest.exists) dest.delete();
    await attempt(token);
  }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest.uri, { mimeType: "application/pdf", dialogTitle: filename, UTI: "com.adobe.pdf" });
};
