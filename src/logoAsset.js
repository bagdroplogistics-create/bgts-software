/* Loads the bundled BGTS logo (assets/bgts-logo.png) as a base64 data: URI at
   runtime, for use in generated print HTML (logic.js's lrHtml/receiptHtml)
   where a plain require()'d asset path can't be relied on to resolve inside
   expo-print's/the browser's isolated HTML renderer. Memoized so the actual
   read only happens once per app session. Resolves to '' (not a rejected
   promise) on any failure, so a print action never blocks or errors out
   just because the decorative logo couldn't be loaded. */
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

let cached = null;

export async function getLogoDataUri() {
  if (cached != null) return cached;
  try {
    const asset = Asset.fromModule(require('../assets/bgts-logo.png'));
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;

    if (Platform.OS === 'web') {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      cached = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      });
    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      cached = 'data:image/png;base64,' + base64;
    }
  } catch (e) {
    cached = '';
  }
  return cached;
}
