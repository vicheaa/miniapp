import type { SuperAppBridge } from '../../types/bridge';

function checkResult(result: unknown, fallback: string): void {
  if (result === false) throw new Error(fallback);
  if (result && typeof result === 'object') {
    const value = result as { success?: boolean; error?: unknown; message?: unknown };
    if (value.success === false || value.error) {
      throw new Error(typeof value.error === 'string' ? value.error : typeof value.message === 'string' ? value.message : fallback);
    }
  }
}
export async function printReceipt(bridge: SuperAppBridge | null, text: string): Promise<void> {
  if (!bridge || typeof bridge.printText !== 'function') throw new Error('Receipt printing is unavailable. Please use the mobile app with printer support.');
  checkResult(await bridge.printText(text, true), 'The printer could not print this receipt.');
}
export async function openPrinterSettings(bridge: SuperAppBridge | null): Promise<void> {
  if (!bridge || typeof bridge.openPrinterSettings !== 'function') throw new Error('Printer settings are unavailable in this app version.');
  checkResult(await bridge.openPrinterSettings(), 'Unable to open printer settings.');
}
