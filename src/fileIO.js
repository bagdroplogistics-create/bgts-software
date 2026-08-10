import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

/* ---------- cross-platform file save/share/read/print ----------
   expo-file-system and expo-sharing have effectively no web implementation
   (FileSystem.cacheDirectory is null on web, Sharing.isAvailableAsync() is false),
   so every "Export CSV" / "Download Template" / "Restore Backup" / "Print" button
   built against those APIs silently does nothing when this app runs as a web build.
   These helpers pick the right mechanism per platform so screens don't have to. */

/* Save text content to a file. Native: writes to cache + opens the share sheet.
   Web: triggers a normal browser download via a Blob + temporary <a download>. */
export async function downloadFile(filename, content, mimeType) {
  mimeType = mimeType || 'text/plain';
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, web: true };
  }
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, content);
  const shareable = await Sharing.isAvailableAsync();
  if (shareable) await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  return { ok: true, uri, shared: shareable };
}

/* Read a picked file (from expo-document-picker's getDocumentAsync result.assets[0]) as text.
   Web: DocumentPicker returns a real browser File object at asset.file — read that directly,
   since FileSystem.readAsStringAsync can't read the blob: URIs DocumentPicker hands back on web.
   Native: asset.uri is a real filesystem path, so FileSystem.readAsStringAsync works as normal. */
export async function readPickedFile(asset) {
  if (Platform.OS === 'web' && asset && asset.file) {
    return await asset.file.text();
  }
  return await FileSystem.readAsStringAsync(asset.uri);
}

/* expo-print's own docs are explicit about this: "on web this prints the HTML from
   the page" — Print.printAsync({html}) on web ignores the html option entirely and
   just calls window.print() on whatever page is currently open (confirmed in
   expo-print's own source, ExponentPrint.web.ts). That's why "Print"/"Save & Print"
   was printing the live app screen (sidebar, table, filters and all) instead of the
   generated LR/receipt document. Render the document into an off-screen iframe and
   print THAT frame's window instead — a standard, popup-blocker-proof technique that
   doesn't depend on expo-print's web shim at all. */
function printViaIframe(html) {
  return new Promise((resolve) => {
    let done = false;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    const fire = () => {
      if (done) return;
      done = true;
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { /* ignore */ }
      setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 1000);
      resolve({ ok: true, web: true });
    };
    iframe.onload = fire;
    /* document.write()'d content doesn't reliably fire iframe onload in every browser —
       this timeout guarantees the print dialog still opens even if it doesn't. */
    setTimeout(fire, 400);
  });
}

/* Print/share an HTML document (LR consignment notes, payment receipts, etc.).
   Native: renders to a PDF file and opens the share sheet.
   Web: prints the actual generated document via the iframe technique above, then the
   user can "Save as PDF" from the browser's native print dialog if they want a file. */
export async function printHtml(html, dialogTitle) {
  if (Platform.OS === 'web') {
    return await printViaIframe(html);
  }
  const { uri } = await Print.printToFileAsync({ html });
  const shareable = await Sharing.isAvailableAsync();
  if (shareable) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle });
  return { ok: true, uri, shared: shareable };
}

/* Share/save an already-local file (e.g. a POD photo captured via expo-image-picker).
   Web: there's no native share sheet, so this re-fetches the uri (works for blob:/data:
   URIs the picker hands back) and triggers a normal browser download instead.
   Native: opens the share sheet as before. */
export async function shareFile(uri, filename, mimeType) {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'file';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, web: true };
  }
  const shareable = await Sharing.isAvailableAsync();
  if (shareable) await Sharing.shareAsync(uri, { mimeType: mimeType || 'image/jpeg', dialogTitle: filename });
  return { ok: true, shared: shareable };
}
