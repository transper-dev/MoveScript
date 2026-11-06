export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        localStorage: "readonly",
        CodeMirror: "readonly",
        KeyboardEvent: "readonly",
        EventTarget: "readonly",
        CustomEvent: "readonly",
        fetch: "readonly",
        navigator: "readonly",
        devicePixelRatio: "readonly",
        require: "readonly",
        __dirname: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "caughtErrors": "none" }]
    }
  }
];
