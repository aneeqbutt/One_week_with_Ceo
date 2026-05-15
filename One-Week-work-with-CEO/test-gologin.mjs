(async () => {
  try {
    const mod = await import('gologin');
    console.log('gologin import OK, exports keys:', Object.keys(mod));
  } catch (err) {
    console.error('gologin import FAILED:', err);
    process.exit(1);
  }
})();