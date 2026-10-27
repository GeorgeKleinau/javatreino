const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SOURCE_ROOT = process.env.GABARITOS_DIR ||
  '/Volumes/Cartão01/TRABALHO/IBMR/Lógica_Material_Meu/Exercícios/MiniProjeto_Padaria/Exercicios_Preparatorios/codigo_professor';
const WEB_ROOT = __dirname;

const typeByExtension = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };

function readExercises() {
  const folders = fs.readdirSync(SOURCE_ROOT, { withFileTypes: true })
    .filter(item => item.isDirectory() && !item.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return folders.map(folder => {
    const exerciseRoot = path.join(SOURCE_ROOT, folder.name);
    const files = [];
    function visit(directory) {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, item.name);
        if (item.isDirectory()) visit(fullPath);
        if (item.isFile() && item.name.endsWith('.java') && !item.name.startsWith('._')) {
          files.push({
            path: path.relative(exerciseRoot, fullPath).replaceAll(path.sep, '/'),
            name: item.name,
            code: fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '')
          });
        }
      }
    }
    visit(exerciseRoot);
    return { id: folder.name, title: folder.name.replace(/^Ex\d+_/, '').replace(/^ExExtra_/, ''), files };
  }).filter(exercise => exercise.files.length > 0);
}

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  response.end(body);
}

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/exercises') {
    try {
      return send(response, 200, JSON.stringify({ exercises: readExercises() }));
    } catch (error) {
      return send(response, 500, JSON.stringify({ error: `Não foi possível ler os gabaritos: ${error.message}` }));
    }
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = path.normalize(requested).replace(/^([.][.][\\/])+/, '');
  const filePath = path.join(WEB_ROOT, safePath);
  if (!filePath.startsWith(WEB_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(response, 404, 'Página não encontrada', 'text/plain; charset=utf-8');
  }
  send(response, 200, fs.readFileSync(filePath), typeByExtension[path.extname(filePath)] || 'application/octet-stream');
}).listen(PORT, () => {
  console.log(`Laboratório disponível em http://localhost:${PORT}`);
  console.log(`Gabaritos: ${SOURCE_ROOT}`);
});
