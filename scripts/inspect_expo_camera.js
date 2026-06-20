try {
  const mod = require('expo-camera');
  console.log('expo-camera module keys:', Object.keys(mod));
  console.log('typeof Camera export:', typeof mod.Camera);
  console.log('typeof default export:', typeof mod.default);
  console.log('is default === Camera?', mod.default === mod.Camera);
  console.log('Camera keys:', mod.Camera ? Object.keys(mod.Camera) : null);
} catch (e) {
  console.error('Error requiring expo-camera:', e);
}
