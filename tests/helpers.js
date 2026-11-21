export async function waitFor(condFn, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condFn()) return;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error(`Timeout waiting for condition: ${condFn.toString()}`);
}
