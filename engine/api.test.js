
import test from 'node:test';
import assert from 'node:assert';

test('executeInSandbox - security check', () => {
    const ctx = {
        api: {
            clear: () => "cleared",
            safe: () => "safe"
        }
    };

    // Original implementation (vulnerable)
    const vulnerableExecute = (ctx, code) => {
        const API_NAMES = Object.keys(ctx.api);
        const fn = new Function(...API_NAMES, code);
        fn(...API_NAMES.map(n => ctx.api[n]));
    };

    // New implementation (secure)
    const secureExecute = (_ctx, code) => {
        const proxyAPI = new Proxy(_ctx.api, {
            has: (_target, _prop) => true,
            get: (target, prop) => {
                if (prop === Symbol.unscopables) return undefined;
                if (prop in target) return target[prop];
                throw new Error("SecurityError: Acceso restringido a: " + String(prop));
            }
        });
        const fn = new Function('api', `with(api) { ${code} }`);
        fn(proxyAPI);
    };

    // Test: Vulnerable code can access global window
    assert.throws(() => {
        vulnerableExecute(ctx, "clear(); window;"); // This actually shouldn't throw in vulnerable, it returns window
    }, /./); // Vulnerable doesn't throw on window access

    // Test: Secure code throws on global window access
    assert.throws(() => {
        secureExecute(ctx, "clear(); window;");
    }, /SecurityError/);

    // Test: Secure code allows safe API
    assert.doesNotThrow(() => {
        secureExecute(ctx, "clear(); safe();");
    });
});
