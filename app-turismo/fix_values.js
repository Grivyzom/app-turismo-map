const fs = require('fs');
const file = '/grivyzom/webs/app-turismo-map/app-turismo/app/(home)/index.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "{ label: 'Cultura', value: 'Cultura' }",
  "{ label: 'Cultura', value: 'cultura' }",
);
content = content.replace(
  "{ label: 'Naturaleza', value: 'Naturaleza' }",
  "{ label: 'Naturaleza', value: 'naturaleza' }",
);
content = content.replace(
  "{ label: 'Gastronomía', value: 'Gastronomía' }",
  "{ label: 'Gastronomía', value: 'gastronomia' }",
);
content = content.replace(
  "{ label: 'Deportes', value: 'Deportes' }",
  "{ label: 'Deportes', value: 'deportes' }",
);
content = content.replace(
  "{ label: 'Música', value: 'Música' }",
  "{ label: 'Música', value: 'musica' }",
);
content = content.replace(
  "{ label: 'Choque/Incidente', value: 'Choque' }",
  "{ label: 'Choque/Incidente', value: 'choque' }",
);
content = content.replace(
  "{ label: 'Público', value: 'Público' }",
  "{ label: 'Público', value: 'publico' }",
);

fs.writeFileSync(file, content);
console.log('Fixed values');
