module.exports = function (api) {
  // Los DOM components (mapa MapLibre en iOS/Android) se compilan con un preset legacy
  // que transpila clases. maplibre-gl arma su Web Worker serializando funciones con
  // toString(), así que los helpers de Babel quedan fuera del worker ("p is not defined").
  // Su dist ya viene listo para navegadores: lo dejamos sin transformar en ese bundle.
  const isDomComponent = api.caller((caller) => Boolean(caller && caller.isDomComponent));
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    ignore: isDomComponent ? [/node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?maplibre-gl[\\/]/] : [],
  };
};
